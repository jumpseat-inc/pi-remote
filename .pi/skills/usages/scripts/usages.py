#!/usr/bin/env python3
"""Report one repository's pi/council usage, cross-matched against OpenRouter.

Pipeline: harvest generation ids and local token/cost facts from pi session
JSONL, council run manifests/transcripts, and the durable usage store; resolve
exact per-generation dollars through `POST /api/v1/analytics/query`; reconcile
against `GET /api/v1/activity`; write a JSON record and a Markdown rendering
under `<repo>/<config>/council/usages/`.

This tool is the only network surface of the `/usages` skill. Standard library
only. `--offline` forbids all network calls and uses the cache alone.
"""

import argparse
import json
import os
import re
import statistics
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Rendered by /council-init at copy time; the literal is the package-source
# fallback so the tool also runs from the package tree.
CONFIG_DIR = ".pi"
if CONFIG_DIR == ".pi":
    CONFIG_DIR = ".pi"

SCHEMA_VERSION = 1
MAX_WINDOW_DAYS = 30
CHUNK = 500
OFFLINE_LIMITATION = "offline: no network calls were made; uncached generations use catalogue estimates"
SOURCE_RANK = {"seats": 0, "main": 1, "durable": 2}


def log(msg):
    print(msg, file=sys.stderr)


def utc_today():
    return datetime.now(timezone.utc).date()


def parse_iso_date(s):
    return datetime.strptime(s.strip(), "%Y-%m-%d").date()


def parse_range(spec, today):
    """Resolve an English/ISO range to an inclusive (start_date, end_date)."""
    s = (spec or "last 30 days").strip().lower()
    if not s:
        s = "last 30 days"
    if s == "today":
        return today, today
    if s == "yesterday":
        y = today - timedelta(days=1)
        return y, y
    m = re.match(r"^last\s+(\d+)\s+(day|days|week|weeks|month|months)$", s)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        span = n if unit.startswith("day") else (7 * n if unit.startswith("week") else 30 * n)
        return today - timedelta(days=span - 1), today
    if s == "this week":
        monday = today - timedelta(days=today.weekday())
        return monday, today
    if s == "last week":
        monday = today - timedelta(days=today.weekday() + 7)
        return monday, monday + timedelta(days=6)
    if s == "this month":
        return today.replace(day=1), today
    if s == "last month":
        last_prev = today.replace(day=1) - timedelta(days=1)
        return last_prev.replace(day=1), last_prev
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to)\s*(\d{4}-\d{2}-\d{2})$", s)
    if m:
        return parse_iso_date(m.group(1)), parse_iso_date(m.group(2))
    try:
        d = parse_iso_date(s)
        return d, d
    except ValueError:
        raise SystemExit(f"usages: cannot parse range {spec!r}")


def windows(start, end, max_days=MAX_WINDOW_DAYS):
    out = []
    cur = start
    while cur <= end:
        last = min(cur + timedelta(days=max_days - 1), end)
        out.append((cur, last))
        cur = last + timedelta(days=1)
    return out


def norm_model(m):
    if isinstance(m, str) and m.startswith("openrouter/"):
        return m[len("openrouter/"):]
    return m


def in_range(day, start, end):
    return day is not None and start.isoformat() <= day <= end.isoformat()


def under_repo(cwd, repo):
    try:
        repo_real = os.path.realpath(repo)
        cwd_real = os.path.realpath(cwd)
    except (TypeError, ValueError):
        return False
    return cwd_real == repo_real or cwd_real.startswith(repo_real + os.sep)


def wire_tokens(u):
    u = u or {}
    return {
        "input": int(u.get("input") or 0),
        "output": int(u.get("output") or 0),
        "cacheRead": int(u.get("cacheRead") or 0),
        "cacheWrite": int(u.get("cacheWrite") or 0),
        "reasoning": int(u.get("reasoning") or 0),
        "total": int(u.get("totalTokens") or 0),
    }


def make_row(source, seat, model, ts, response_id, tokens, catalogue_cost):
    ts = ts or ""
    # Only OpenRouter generation ids are cross-matchable; other providers
    # (e.g. llama.cpp's `chatcmpl-...`) contribute catalogue cost only.
    rid = response_id if isinstance(response_id, str) and response_id.startswith("gen-") else None
    return {
        "source": source,
        "seat": seat or "unknown",
        "model": norm_model(model),
        "timestamp": ts,
        "date": ts[:10] if len(ts) >= 10 else None,
        "responseId": rid,
        "tokens": tokens,
        "catalogueCost": float(catalogue_cost or 0.0),
    }


def harvest_sessions(agent_dir, repo, start, end):
    rows = []
    base = Path(agent_dir) / "sessions"
    if not base.is_dir():
        return rows
    for f in sorted(base.glob("*/*.jsonl")):
        try:
            lines = f.read_text(errors="ignore").splitlines()
        except OSError:
            continue
        if not lines:
            continue
        try:
            header = json.loads(lines[0])
        except ValueError:
            continue
        if not under_repo(header.get("cwd"), repo):
            continue
        for line in lines[1:]:
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if o.get("type") != "message":
                continue
            msg = o.get("message") or {}
            if msg.get("role") != "assistant":
                continue
            ts = o.get("timestamp") or msg.get("timestamp") or ""
            if not in_range(ts[:10], start, end):
                continue
            u = msg.get("usage") or {}
            cost = (u.get("cost") or {}).get("total") or 0
            rows.append(make_row("main", "main", msg.get("model"), ts, msg.get("responseId"), wire_tokens(u), cost))
    return rows


def harvest_runs(repo, config_dir, start, end):
    rows = []
    runs = Path(repo) / config_dir / "council" / "runs"
    if not runs.is_dir():
        return rows
    for run_dir in sorted(p for p in runs.iterdir() if p.is_dir()):
        manifests = {}
        for mf in run_dir.glob("job-*.json"):
            try:
                m = json.loads(mf.read_text())
            except (ValueError, OSError):
                continue
            manifests[m.get("id")] = m
        seen_jobs = set()
        for tf in run_dir.glob("*_job-*.jsonl"):
            name = tf.name
            job_id = name.rsplit("_", 1)[-1][: -len(".jsonl")] if "_job-" in name else None
            m = manifests.get(job_id, {})
            seen_jobs.add(job_id)
            seat = m.get("seat") or job_id or "unknown"
            model = m.get("model")
            try:
                lines = tf.read_text(errors="ignore").splitlines()
            except OSError:
                continue
            for line in lines:
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                if o.get("type") != "message":
                    continue
                msg = o.get("message") or {}
                if msg.get("role") != "assistant":
                    continue
                ts = o.get("timestamp") or ""
                if not in_range(ts[:10], start, end):
                    continue
                u = msg.get("usage") or {}
                cost = (u.get("cost") or {}).get("total") or 0
                rows.append(make_row("seats", seat, model, ts, msg.get("responseId"), wire_tokens(u), cost))
        # Manifests whose transcript produced no in-range rows: fall back to the
        # manifest usage on the run's start day (catalogue basis).
        run_started = manifests.get("__run__")
        run_date = None
        rj = run_dir / "run.json"
        if rj.is_file():
            try:
                started = json.loads(rj.read_text()).get("startedAt")
                if isinstance(started, (int, float)):
                    run_date = datetime.fromtimestamp(started / 1000, timezone.utc).date().isoformat()
            except (ValueError, OSError):
                pass
        for job_id, m in manifests.items():
            if job_id in seen_jobs:
                continue
            if not in_range(run_date, start, end):
                continue
            u = m.get("usage") or {}
            rows.append(make_row("seats", m.get("seat") or job_id, m.get("model"), (run_date or "") + "T00:00:00.000Z", None, wire_tokens(u), u.get("cost") or 0))
    return rows


def harvest_durable(agent_dir, repo, start, end):
    rows = []
    store = Path(agent_dir) / "council" / "usage"
    if not store.is_dir():
        return rows
    repo_real = os.path.realpath(repo)
    for f in sorted(store.glob("*.json")):
        try:
            rec = json.loads(f.read_text())
        except (ValueError, OSError):
            continue
        try:
            if os.path.realpath(rec.get("repoRoot") or "") != repo_real:
                continue
        except (TypeError, ValueError):
            continue
        written = rec.get("writtenAt") or ""
        if not in_range(written[:10], start, end):
            continue
        seat_of_job = {}
        for sr in rec.get("seats") or []:
            seat_of_job[sr.get("jobId")] = sr.get("seat")
            u = sr.get("usage") or {}
            rows.append(make_row("durable", sr.get("seat") or "unknown", sr.get("model"), written, None, wire_tokens(u), u.get("cost") or 0))
        for g in (rec.get("provider") or {}).get("generations") or []:
            rows.append(make_row("durable", seat_of_job.get(g.get("jobId")) or "unknown", g.get("model"), written, g.get("generationId"), wire_tokens({}), 0.0))
    return rows


def empty_bucket(name):
    return {
        "seat": name,
        "models": set(),
        "turns": 0,
        "requests": 0,
        "tokens": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "total": 0},
        "catalogueCostUsd": 0.0,
        "exactCostUsd": 0.0,
        "genIds": set(),
        "matchedGenIds": set(),
        "orPrompt": 0,
        "orCompletion": 0,
        "orCached": 0,
        "perGenCostPerMInput": [],
        "perGenCostPerMOutput": [],
    }


def per_million(cost, tokens):
    return round(cost / tokens * 1e6, 6) if tokens else None


def finalize_bucket(b):
    total_g = len(b["genIds"])
    matched = len(b["matchedGenIds"])
    if total_g > 0 and matched == total_g:
        basis = "exact"
    elif matched > 0:
        basis = "mixed"
    else:
        basis = "catalogue-estimate"
    cache_hit = None
    if b["orPrompt"] > 0:
        cache_hit = round(b["orCached"] / b["orPrompt"], 6)
    else:
        denom = b["tokens"]["cacheRead"] + b["tokens"]["input"]
        if denom > 0:
            cache_hit = round(b["tokens"]["cacheRead"] / denom, 6)
    return {
        "seat": b["seat"],
        "models": sorted(m for m in b["models"] if m),
        "turns": b["turns"],
        "requests": matched,
        "tokens": dict(b["tokens"]),
        "exactCostUsd": round(b["exactCostUsd"], 6),
        "catalogueCostUsd": round(b["catalogueCostUsd"], 6),
        "basis": basis,
        "derived": {
            "costPerMillionInputUsd": per_million(b["exactCostUsd"], b["tokens"]["input"]),
            "costPerMillionOutputUsd": per_million(b["exactCostUsd"], b["tokens"]["output"]),
            "medianCostPerMillionInputUsd": round(statistics.median(b["perGenCostPerMInput"]), 6) if b["perGenCostPerMInput"] else None,
            "medianCostPerMillionOutputUsd": round(statistics.median(b["perGenCostPerMOutput"]), 6) if b["perGenCostPerMOutput"] else None,
            "cacheHitRate": cache_hit,
            "blendedCostPerMillionTokensUsd": per_million(b["exactCostUsd"], b["tokens"]["total"]),
        },
    }


def aggregate(rows, exact):
    """Fold rows + exact figures into buckets, per-day and per-model series."""
    gen_rows = {}
    for r in rows:
        gid = r.get("responseId")
        if not gid:
            continue
        cur = gen_rows.get(gid)
        if cur is None or SOURCE_RANK.get(r["source"], 9) < SOURCE_RANK.get(cur["source"], 9):
            gen_rows[gid] = r

    buckets = {}

    def bucket(name):
        if name not in buckets:
            buckets[name] = empty_bucket(name)
        return buckets[name]

    days = {}
    models = {}
    for r in rows:
        b = bucket(r["seat"])
        if r.get("model"):
            b["models"].add(r["model"])
        if r["source"] in ("main", "seats"):
            b["turns"] += 1
        for k in ("input", "output", "cacheRead", "cacheWrite", "reasoning", "total"):
            b["tokens"][k] += r["tokens"].get(k, 0)
        b["catalogueCostUsd"] += r["catalogueCost"]
        if r.get("responseId"):
            b["genIds"].add(r["responseId"])
        d = days.setdefault(r["date"] or "unknown", {"date": r["date"] or "unknown", "turns": 0,
                                                     "tokens": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "total": 0},
                                                     "exactCostUsd": 0.0, "catalogueCostUsd": 0.0})
        if r["source"] in ("main", "seats"):
            d["turns"] += 1
        for k in ("input", "output", "cacheRead", "cacheWrite", "reasoning", "total"):
            d["tokens"][k] += r["tokens"].get(k, 0)
        d["catalogueCostUsd"] += r["catalogueCost"]
        if r.get("model"):
            mm = models.setdefault(r["model"], {"model": r["model"], "requests": 0,
                                                "tokens": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "total": 0},
                                                "exactCostUsd": 0.0, "catalogueCostUsd": 0.0})
            if r["source"] in ("main", "seats"):
                mm["requests"] += 1
            for k in ("input", "output", "cacheRead", "cacheWrite", "reasoning", "total"):
                mm["tokens"][k] += r["tokens"].get(k, 0)
            mm["catalogueCostUsd"] += r["catalogueCost"]

    exact_by_day = {}
    for gid, r in gen_rows.items():
        fig = exact.get(gid)
        if not fig:
            continue
        b = bucket(r["seat"])
        b["matchedGenIds"].add(gid)
        cost = float(fig.get("total_usage") or 0)
        b["exactCostUsd"] += cost
        b["orPrompt"] += int(fig.get("tokens_prompt") or 0)
        b["orCompletion"] += int(fig.get("tokens_completion") or 0)
        b["orCached"] += int(fig.get("cached_tokens") or 0)
        prompt = int(fig.get("tokens_prompt") or 0)
        completion = int(fig.get("tokens_completion") or 0)
        if prompt:
            b["perGenCostPerMInput"].append(cost / prompt * 1e6)
        if completion:
            b["perGenCostPerMOutput"].append(cost / completion * 1e6)
        d = days.setdefault(r["date"] or "unknown", {"date": r["date"] or "unknown", "turns": 0,
                                                     "tokens": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "total": 0},
                                                     "exactCostUsd": 0.0, "catalogueCostUsd": 0.0})
        d["exactCostUsd"] += cost
        exact_by_day[r["date"]] = exact_by_day.get(r["date"], 0.0) + cost
        if r.get("model"):
            mm = models.setdefault(r["model"], {"model": r["model"], "requests": 0,
                                                "tokens": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "total": 0},
                                                "exactCostUsd": 0.0, "catalogueCostUsd": 0.0})
            mm["exactCostUsd"] += cost

    finalized = {name: finalize_bucket(b) for name, b in buckets.items()}
    seat_rows = sorted(
        (v for k, v in finalized.items() if k != "main" and (v["turns"] or v["catalogueCostUsd"] or v["exactCostUsd"])),
        key=lambda x: x["seat"],
    )
    main_row = finalized.get("main") or finalize_bucket(empty_bucket("main"))

    totals = empty_bucket("totals")
    for b in buckets.values():
        totals["turns"] += b["turns"]
        totals["genIds"] |= b["genIds"]
        totals["matchedGenIds"] |= b["matchedGenIds"]
        totals["exactCostUsd"] += b["exactCostUsd"]
        totals["catalogueCostUsd"] += b["catalogueCostUsd"]
        for k in totals["tokens"]:
            totals["tokens"][k] += b["tokens"][k]
    totals_final = finalize_bucket(totals)
    totals_final["cacheHitRate"] = totals_final["derived"]["cacheHitRate"]
    totals_final["blendedCostPerMillionTokensUsd"] = totals_final["derived"]["blendedCostPerMillionTokensUsd"]
    return {
        "main": main_row,
        "seats": seat_rows,
        "models": [models[k] for k in sorted(models)],
        "days": [days[k] for k in sorted(days)],
        "totals": totals_final,
        "exact_by_day": exact_by_day,
        "gen_rows": gen_rows,
    }


# ---------------------------------------------------------------------------
# Network (the only surface)
# ---------------------------------------------------------------------------


def http_json(url, key, data=None, timeout=60):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def load_cache(path):
    try:
        obj = json.loads(Path(path).read_text())
        if isinstance(obj, dict) and isinstance(obj.get("generations"), dict):
            return obj
    except (OSError, ValueError):
        pass
    return {"schemaVersion": 1, "generations": {}}


def save_cache(path, cache):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + f".tmp-{os.getpid()}")
    tmp.write_text(json.dumps(cache, indent=1) + "\n")
    os.replace(tmp, p)


def analytics_query(api_base, key, metrics, dimensions, filters, start, end, limit=1000):
    body = {
        "metrics": metrics,
        "dimensions": dimensions,
        "filters": filters,
        "time_range": {"start": start.strftime("%Y-%m-%dT00:00:00Z"), "end": end.strftime("%Y-%m-%dT23:59:59Z")},
        "limit": limit,
    }
    return http_json(f"{api_base}/analytics/query", key, data=body)


def resolve_exact(api_base, key, gen_rows, wins, cache, offline):
    """Return (exact_figures, hits, misses, limitations)."""
    limitations = []
    figures = {}
    hits = 0
    ids_by_gen = {}
    for gid, r in gen_rows.items():
        ids_by_gen.setdefault(r["date"], []).append(gid)
    for gid, d in [(g, r["date"]) for g, r in gen_rows.items()]:
        if gid in cache["generations"]:
            figures[gid] = cache["generations"][gid]
            hits += 1
    if offline:
        misses = len(gen_rows) - hits
        if misses:
            limitations.append(f"{misses} generation(s) had no cached figures — catalogue estimates used")
        limitations.insert(0, OFFLINE_LIMITATION)
        return figures, hits, misses, limitations
    misses = 0
    failed = 0
    for (wstart, wend) in wins:
        todo = []
        for d, ids in ids_by_gen.items():
            if d and wstart.isoformat() <= d <= wend.isoformat():
                todo += [g for g in ids if g not in cache["generations"]]
        for i in range(0, len(todo), CHUNK):
            chunk = todo[i:i + CHUNK]
            try:
                resp = analytics_query(api_base, key, ["total_usage", "tokens_prompt", "tokens_completion", "cached_tokens", "cache_hit_rate"],
                                       ["generation_id"], [{"field": "generation_id", "operator": "in", "value": chunk}], wstart, wend)
                for row in (resp.get("data") or {}).get("data", []):
                    gid = row.get("generation_id")
                    if not gid:
                        continue
                    cache["generations"][gid] = {
                        "total_usage": float(row.get("total_usage") or 0),
                        "tokens_prompt": int(row.get("tokens_prompt") or 0),
                        "tokens_completion": int(row.get("tokens_completion") or 0),
                        "cached_tokens": int(row.get("cached_tokens") or 0),
                        "cache_hit_rate": float(row.get("cache_hit_rate") or 0),
                    }
            except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as e:
                failed += 1
                limitations.append(f"analytics chunk failed ({len(chunk)} generations): {e}")
    for gid in gen_rows:
        if gid in cache["generations"]:
            figures[gid] = cache["generations"][gid]
        else:
            misses += 1
    if misses:
        limitations.append(f"{misses} generation(s) unresolved by analytics — catalogue estimates used")
    if failed:
        limitations.append(f"{failed} analytics chunk(s) failed — see above; figures are partial")
    return figures, hits, misses, limitations


def resolve_activity(api_base, key, start, end, today, offline):
    """Return (activity_block, queried_days, limitations)."""
    block = {"available": False, "start": None, "end": None, "totalUsd": 0.0, "byModel": [], "byDay": []}
    limitations = []
    retention_start = today - timedelta(days=30)
    retention_end = today - timedelta(days=1)
    lo = max(start, retention_start)
    hi = min(end, retention_end)
    queried = []
    d = lo
    while d <= hi:
        queried.append(d)
        d += timedelta(days=1)
    if offline or not queried:
        return block, queried, limitations
    by_model = {}
    by_day = {}
    total = 0.0
    failed = 0
    for day in queried:
        try:
            resp = http_json(f"{api_base}/activity?date={day.isoformat()}", key)
            for row in resp.get("data", []):
                usage = float(row.get("usage") or 0)
                total += usage
                by_day[day.isoformat()] = by_day.get(day.isoformat(), 0.0) + usage
                m = row.get("model") or "unknown"
                by_model[m] = by_model.get(m, 0.0) + usage
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as e:
            failed += 1
            limitations.append(f"activity fetch failed for {day.isoformat()}: {e}")
    if failed == len(queried):
        return block, queried, limitations
    block = {
        "available": True,
        "start": queried[0].isoformat(),
        "end": queried[-1].isoformat(),
        "totalUsd": round(total, 6),
        "byModel": [{"model": k, "usageUsd": round(v, 6)} for k, v in sorted(by_model.items(), key=lambda x: -x[1])],
        "byDay": [{"date": k, "usageUsd": round(v, 6)} for k, v in sorted(by_day.items())],
    }
    return block, queried, limitations


def resolve_pi_origin(api_base, key, wins, offline):
    if offline:
        return None, []
    total = 0.0
    for (wstart, wend) in wins:
        try:
            resp = analytics_query(api_base, key, ["total_usage"], ["model"],
                                   [{"field": "origin", "operator": "eq", "value": "https://pi.dev/"}], wstart, wend)
            for row in (resp.get("data") or {}).get("data", []):
                total += float(row.get("total_usage") or 0)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError):
            return None, ["pi-origin analytics query failed — account comparison unavailable"]
    return round(total, 6), []


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def render_markdown(report):
    lines = []
    lines.append(f"# Usages — {report['range']['start']} to {report['range']['end']}")
    lines.append("")
    lines.append(f"Generated {report['generatedAt']} for `{report['repo']['root']}`.")
    lines.append("")
    t = report["totals"]
    lines.append("## Totals")
    lines.append("")
    lines.append(f"- turns: {t['turns']}, matched requests: {t['requests']}")
    lines.append(f"- tokens: in {t['tokens']['input']} / out {t['tokens']['output']} / cacheRead {t['tokens']['cacheRead']} / total {t['tokens']['total']}")
    lines.append(f"- exact cost: ${t['exactCostUsd']:.6f}; catalogue estimate: ${t['catalogueCostUsd']:.6f}")
    if t.get("cacheHitRate") is not None:
        lines.append(f"- cache hit rate: {t['cacheHitRate']}")
    lines.append("")
    lines.append("## Seats")
    lines.append("")
    lines.append("| seat | turns | requests | in | out | cacheRead | exact $ | catalogue $ | basis |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in [report["main"], *report["seats"]]:
        lines.append(
            f"| {row['seat']} | {row['turns']} | {row['requests']} | {row['tokens']['input']} | {row['tokens']['output']} | "
            f"{row['tokens']['cacheRead']} | {row['exactCostUsd']:.6f} | {row['catalogueCostUsd']:.6f} | {row['basis']} |"
        )
    lines.append("")
    lines.append("## Account context")
    lines.append("")
    a = report["account"]
    act = a["activity"]
    if act["available"]:
        lines.append(f"- OpenRouter activity {act['start']}..{act['end']}: ${act['totalUsd']:.4f} (account-wide)")
    else:
        lines.append("- OpenRouter activity: unavailable for this range (retained 30 completed UTC days only)")
    lines.append(f"- attributed to this repo within the activity window: ${a['attributedUsd']:.6f}")
    if a.get("unattributedUsd") is not None:
        lines.append(f"- unattributed account remainder: ${a['unattributedUsd']:.6f}")
    if a.get("piOriginUsd") is not None:
        lines.append(f"- pi-harness-wide (origin=pi.dev) in range: ${a['piOriginUsd']:.4f}")
    lines.append("")
    lines.append("## Basis legend")
    lines.append("")
    lines.append("- `exact` — provider-reported charge for that generation")
    lines.append("- `catalogue-estimate` — pi catalogue rates, not a bill")
    lines.append("- `mixed` — some generations exact, some catalogue")
    lines.append("")
    lines.append("## Limitations")
    lines.append("")
    for lim in report["limitations"]:
        lines.append(f"- {lim}")
    lines.append("")
    return "\n".join(lines)


def ensure_out_dir(out_dir):
    p = Path(out_dir)
    p.mkdir(parents=True, exist_ok=True)
    gi = p / ".gitignore"
    if not gi.exists():
        gi.write_text("*\n")


def human_summary(report):
    t = report["totals"]
    out = [f"usages {report['range']['start']}..{report['range']['end']} — turns={t['turns']} exact=${t['exactCostUsd']:.4f} catalogue=${t['catalogueCostUsd']:.4f}"]
    for row in [report["main"], *report["seats"]]:
        out.append(f"  {row['seat']:<16} turns={row['turns']:<4} in={row['tokens']['input']:<9} out={row['tokens']['output']:<8} exact=${row['exactCostUsd']:.4f} ({row['basis']})")
    c = report["cache"]
    out.append(f"cache: hits={c['hits']} misses={c['misses']}")
    a = report["account"]
    if a["activity"]["available"]:
        out.append(f"  account activity ${a['activity']['totalUsd']:.4f}; attributed in window ${a['attributedUsd']:.4f}")
    for lim in report["limitations"]:
        out.append(f"  ! {lim}")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------


def build_parser():
    p = argparse.ArgumentParser(prog="usages", description="Report repo pi/council usage against OpenRouter")
    p.add_argument("--range", dest="range_spec", default=None)
    p.add_argument("--start")
    p.add_argument("--end")
    p.add_argument("--today")
    p.add_argument("--repo", default=os.getcwd())
    p.add_argument("--config-dir", default=CONFIG_DIR)
    p.add_argument("--agent-dir", default=os.environ.get("PI_CODING_AGENT_DIR") or os.path.expanduser("~/.pi/agent"))
    p.add_argument("--out-dir", default=None)
    p.add_argument("--cache-file", default=None)
    p.add_argument("--api-base", default="https://openrouter.ai/api/v1")
    p.add_argument("--offline", action="store_true")
    p.add_argument("--json", action="store_true")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    today = parse_iso_date(args.today) if args.today else utc_today()
    if args.start or args.end:
        start = parse_iso_date(args.start) if args.start else parse_range(args.range_spec, today)[0]
        end = parse_iso_date(args.end) if args.end else today
    else:
        start, end = parse_range(args.range_spec, today)
    if end < start:
        log("usages: end date is before start date")
        return 2

    key = os.environ.get("OPENROUTER_MANAGEMENT_KEY") or ""
    if not key and not args.offline:
        log("usages: OPENROUTER_MANAGEMENT_KEY is not set.")
        log("Mint a provisioning key at OpenRouter → Settings → Keys → 'Provisioning key',")
        log("then export OPENROUTER_MANAGEMENT_KEY=sk-or-… in the environment that launches pi.")
        log("(OPENROUTER_API_KEY is not accepted for this report.)")
        return 2

    repo = os.path.abspath(args.repo)
    out_dir = args.out_dir or os.path.join(repo, args.config_dir, "council", "usages")
    cache_file = args.cache_file or os.path.join(out_dir, ".cache.json")
    ensure_out_dir(out_dir)

    rows = []
    rows += harvest_sessions(args.agent_dir, repo, start, end)
    rows += harvest_runs(repo, args.config_dir, start, end)
    rows += harvest_durable(args.agent_dir, repo, start, end)

    # Compose the source-count summary and the pre-exact report skeleton so a
    # network failure still yields a labelled catalogue-basis report.
    wins = windows(start, end)
    cache = load_cache(cache_file)

    # Determine generation rows for the cross-match (same precedence as aggregate).
    gen_rows = {}
    for r in rows:
        gid = r.get("responseId")
        if not gid:
            continue
        cur = gen_rows.get(gid)
        if cur is None or SOURCE_RANK.get(r["source"], 9) < SOURCE_RANK.get(cur["source"], 9):
            gen_rows[gid] = r

    exact, hits, misses, lim_exact = resolve_exact(args.api_base, key, gen_rows, wins, cache, args.offline)
    if not args.offline:
        try:
            save_cache(cache_file, cache)
        except OSError as e:
            log(f"usages: could not write cache: {e}")

    agg = aggregate(rows, exact)

    activity_block, queried_days, lim_activity = resolve_activity(args.api_base, key, start, end, today, args.offline)
    pi_origin, lim_pi = resolve_pi_origin(args.api_base, key, wins, args.offline)

    attributed = round(sum(v for d, v in agg["exact_by_day"].items() if d in {q.isoformat() for q in queried_days}), 6)
    unattributed = round(activity_block["totalUsd"] - attributed, 6) if activity_block["available"] else None

    limitations = [
        "run directories are pruned to the last 15 runs; older seat detail falls back to the durable usage store",
        "OpenRouter activity is account-wide and retained for 30 completed UTC days",
        "analytics queries are capped at 31 days and chunked; failed chunks fall back to catalogue estimates",
        "the account reconciliation covers completed UTC days only; the current day's cost is in totals but not in attributedUsd",
        "council child session ids are job-N and collide across runs; generations are joined by generation_id",
    ]
    limitations += lim_exact + lim_activity + lim_pi

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tool": {"name": "usages", "version": "1"},
        "range": {"input": args.range_spec or f"{start} to {end}", "start": start.isoformat(), "end": end.isoformat(),
                  "windows": [[a.isoformat(), b.isoformat()] for a, b in wins]},
        "repo": {"root": repo, "configDir": args.config_dir},
        "sources": {
            "sessions": {"generations": sum(1 for r in rows if r["source"] == "main" and r["responseId"])},
            "runs": {"generations": sum(1 for r in rows if r["source"] == "seats" and r["responseId"])},
            "durable": {"generations": sum(1 for r in rows if r["source"] == "durable" and r["responseId"])},
        },
        "limitations": limitations,
        "totals": agg["totals"],
        "main": agg["main"],
        "seats": agg["seats"],
        "models": agg["models"],
        "days": agg["days"],
        "account": {
            "activity": activity_block,
            "piOriginUsd": pi_origin,
            "attributedUsd": attributed,
            "unattributedUsd": unattributed,
        },
        "cache": {"file": cache_file, "hits": hits, "misses": misses},
    }

    stem = f"usages-{start.isoformat()}_{end.isoformat()}"
    try:
        Path(out_dir, stem + ".json").write_text(json.dumps(report, indent=1) + "\n")
        Path(out_dir, stem + ".md").write_text(render_markdown(report))
    except OSError as e:
        log(f"usages: could not write report: {e}")
        return 3

    if args.json:
        print(json.dumps(report, indent=1))
    else:
        print(human_summary(report))
        print(f"\nwrote {Path(out_dir, stem + '.json')}")
        print(f"wrote {Path(out_dir, stem + '.md')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())