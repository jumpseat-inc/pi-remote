#!/usr/bin/env bash
# Council preflight (generic starting point — adapt to your project).
# Card-aware: with a card id it checks the card file exists. Extend with your
# project's own gates too (database up, services running, datasets mounted) before
# your first run. Prints the remediation line for the superpowers gate; all other
# gates print no install steps — that's the facilitator's job.
# Any FAIL: line must halt the run.
set -u

fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "OK: $*"; }

# ---- Superpowers gate ----
# The council depends on the superpowers skills package (TDD, planning,
# debugging, ...). /council-init pins it project-locally (.pi/settings.json
# plus a clone under .pi/git/...) — that is what makes it portable to
# teammates. A global-only install leaves the repo, so the instructor refuses
# to start a council run without a project-local presence.
SUPER_PKG=".pi/git/github.com/obra/superpowers"
SUPER_PIN=".pi/settings.json"
if [ -d "$SUPER_PKG" ] && [ -f "$SUPER_PKG/package.json" ]; then
  ok "superpowers present (skills package under $SUPER_PKG)"
elif [ -f "$SUPER_PIN" ] && grep -q 'superpowers' "$SUPER_PIN" 2>/dev/null; then
  ok "superpowers present (pin in $SUPER_PIN)"
else
  fail "superpowers is not installed project-locally — run /council-init to scaffold the council and install superpowers project-locally (or run pi install -l git:github.com/obra/superpowers yourself), then run /reload so pi loads its skills. The council refuses to run without it."
fi

# ---- Ask-user-question extension gate ----
# The council needs the rpiv-ask-user-question extension (a tool a seat can use
# to interrupt for a human answer). /council-init pins it project-locally
# (.pi/settings.json plus an install under
# .pi/npm/node_modules/@juicesharp/rpiv-ask-user-question) — that is
# what makes it portable to teammates. A global-only install leaves the repo,
# so the instructor refuses to start a council run without a project-local
# presence.
ASK_PKG=".pi/npm/node_modules/@juicesharp/rpiv-ask-user-question"
ASK_PIN=".pi/settings.json"
if [ -d "$ASK_PKG" ] && [ -f "$ASK_PKG/package.json" ]; then
  ok "ask-user-question present (extension under $ASK_PKG)"
elif [ -f "$ASK_PIN" ] && grep -q 'rpiv-ask-user-question' "$ASK_PIN" 2>/dev/null; then
  ok "ask-user-question present (pin in $ASK_PIN)"
else
  fail "ask-user-question is not installed project-locally — run /council-init (or run pi install -l npm:@juicesharp/rpiv-ask-user-question yourself), then run /reload. The council refuses to run without it."
fi

command -v bun >/dev/null 2>&1 || fail "bun is not on PATH (install via https://bun.sh)"
ok "bun found: $(bun --version)"

[ -f bun.lock ] || [ -f package.json ] || fail "not a project root (no package.json/bun.lock)"
ok "project files present"

if [ -f package.json ]; then
  bun install --frozen-lockfile >/dev/null 2>&1 || fail "bun install failed (deps not installed)"
  ok "dependencies installed"
fi

if [ "${1:-}" != "" ]; then
  [ -f "council/cards/$1.md" ] || fail "card file council/cards/$1.md not found"
  ok "card $1 present"
fi

# main must be able to fast-forward from origin.
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo main)
if [ "$branch" != "main" ]; then
  git fetch origin >/dev/null 2>&1
  git merge-base --is-ancestor origin/main HEAD 2>/dev/null \
    || fail "local history does not descend from origin/main (stale before running a card)"
  ok "history is up to date with origin/main"
fi

# ---- MCP gate (context7, tavily) ----
# The scaffold writes .pi/council/mcp.json registering context7 and
# tavily. Structural check only: registration present + stored credentials
# present for each. A real OAuth re-auth/live-token probe is out of scope for
# preflight. Any FAIL: line must halt the run. (.pi is replaced with
# the real config-dir name by council-init at copy time; the agent-auth path
# honors $PI_CODING_AGENT_DIR.)
for c7 in context7 tavily; do
  c7_mcp=".pi/council/mcp.json"
  if [ ! -f "$c7_mcp" ] || ! grep -q "\"$c7\"" "$c7_mcp" 2>/dev/null; then
    fail "$c7 not registered (missing or no entry in $c7_mcp) — run /council-init"
  fi
  ok "$c7 registered"

  c7_auth="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/council/mcp-auth.json"
  if [ ! -f "$c7_auth" ] || ! grep -q "\"$c7\"" "$c7_auth" 2>/dev/null; then
    fail "$c7 not authenticated — no stored credentials in $c7_auth — run /mcp login $c7"
  fi
  ok "$c7 authenticated (stored credentials present)"
done

# ---- OpenRouter (model provider) gate ----
# Seats pin OpenRouter models by default, so the provider must be authorized
# for pi. pi resolves an API key from ambient OPENROUTER_API_KEY or a stored
# api_key credential for provider "openrouter" in the agent auth.json (env
# honored via $PI_CODING_AGENT_DIR). Seats inherit the same environment, so
# this one check covers parent + seat children. Structural only: verifies a
# key source exists, not that a live request succeeds.
if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  ok "openrouter authorized (OPENROUTER_API_KEY set)"
elif [ -f "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/auth.json" ] && grep -q '"openrouter"' "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/auth.json" && grep -q '"api_key"' "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/auth.json"; then
  ok "openrouter authorized (stored api_key in auth.json)"
else
  fail "openrouter not authorized — set OPENROUTER_API_KEY or run /login openrouter in pi, then re-run preflight"
fi

echo "PASS: preflight clean"
