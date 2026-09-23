---
id: BUG-1
title: "Route /rc:login --headless to the device-flow driver instead of hardcoding attended"
state: In Review
owner: null
epic: EPIC-1
goal: Invoking `/rc:login --headless` selects the login driver's `headless` mode — the RFC 8628 device flow, observable as the `login.headless.instructions` copy being printed and no browser being opened — while `/rc:login` with no flag still selects `attended`, both proven by tests in test/index.test.ts.
---

## Intent

`/rc:login --headless` is specified behavior: PI-SPEC §7.2 defines the RFC 8628
Device Authorization Grant for headless hosts, §8's command table documents
`/rc:login --headless` as running it, and EV-7's goal and acceptance require
both modes ("On a headless host, `/rc:login` completes by relaying a single
short value (code or URL) through another device"). The driver already exists
and is tested: `src/login.ts` exports `type LoginMode = "attended" | "headless"`
and `run(mode, …)`, and `test/login.test.ts`'s "EV-7 headless flow" suite
exercises it, including the discovery-without-device-endpoint failure.

The gap is at the command surface. `index.ts`'s `rcLoginCommand()` takes no
arguments and calls `cmd.run("attended", existing)` unconditionally. Both
registrations drop the argument: `RemoteController.commands` is typed
`handler: () => void | Promise<void>`, `deps.command("rc:login", rcLoginCommand)`
passes the zero-argument function, and the entry point's
`handler: (args) => handler(args)` hands the argv string to it anyway. So
`--headless` is silently ignored and every invocation runs the attended browser
flow — a shipped surface that contradicts both the spec's command table and
EV-7's acceptance.

The fix is small and well-bounded: thread the argv string through the command
type and both registration points, parse `--headless` (attended stays the
default when the flag is absent), and pass the resolved `LoginMode` to
`run()`. Everything else must stay exactly as shipped: the while-live/non-idle
refusal (EV-8 J5, synced into §8 by FLLWUP-10), the server-URL prompt that
fires before the driver, the `authorizing` → `off` footer transitions, and the
final `applyFooter("off")` on both success and failure. No user-visible copy is
added or changed — both flows' copy is already keyed and ruled — so no
product-owner copy ruling is required.

Adjacent but out of scope (separate open follow-ups, both epic EPIC-2):
FLLWUP-24 (RFC 8628 §3.2 connection-failure slowdown during polling) and
FLLWUP-25 (surface the token endpoint's `error_description`). This card only
routes the flag; it does not change the device-flow driver's poll semantics.

## Acceptance

- `/rc:login --headless` invokes the login driver with mode `headless`: the
  device-flow copy (`login.headless.instructions`) is printed and no browser is
  opened (`openUrl` not called) — an automated test in `test/index.test.ts`.
- `/rc:login` with no flag still invokes the driver with mode `attended` — an
  automated test in `test/index.test.ts`.
- The while-live/non-idle refusal still fires before any mode selection and its
  copy is unchanged.
- `bunx tsc --noEmit` exit 0; `bun test` exit 0 with the full suite green.