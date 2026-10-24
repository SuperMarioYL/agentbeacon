# Changelog

All notable changes to AgentBeacon are documented here.
This project adheres to [Semantic Versioning](https://semver.org).

## [0.3.0] — 2026-10-25

Fix-led release from the post-ship source review of v0.2.0: a rejected IM
delivery is no longer reported as a successful ping, every user-visible version
surface reports the shipped version, the popup stops advertising a threshold
nothing reads, the release workflow finally attaches its archive, and the demo
command reproduces the output the README shows again.

### fix — a rejected IM delivery is no longer reported as a successful ping
- New `src/lib/channels/ack.ts` parses each platform's own delivery code
  (飞书 `code`, 钉钉/企业微信 `errcode`; 0 = delivered). All three APIs answer a
  rejected message — a bad signature, a rotated token, a rate limit — with
  HTTP 200, so `dispatchSignal` previously recorded `ok: true` and the popup
  reported 成功 for a webhook that delivered nothing.
- `DispatchResult` carries the platform's explanation (`error`) and the popup's
  test ping shows it, so a misconfigured 钉钉 sign tells the user what to fix
  instead of counting as a success.

### fix — every user-visible version surface reports the shipped version
- README badges, `web/site.json` footer tag and `docs/demo-results.json` were
  still on 0.1.0 while `VERSION`, `manifest.json`, `package.json` and
  `meta.content_version` said 0.2.0 — the live site rendered the stale one.
- `test/version-lockstep.test.ts` now covers those surfaces too, so the next
  bump cannot land half-done on the strings a user actually reads.

### fix — the popup no longer advertises a loop-idle threshold nothing reads
- `loopThresholdMin` was exposed as 循环空闲阈值（分钟）, documented as the idle-path
  trigger, and never consulted by any decision; the alert's idle figure comes
  from the observation clock, not the config. Re-adding the trigger is not an
  option — the settle-window completion latch fires 60 s after streaming stops,
  so an idle trigger is either unreachable or a false positive on every
  completed run (recorded in the plan's `out_of_scope`).
- The control is gone; the popup still round-trips any previously stored value.

### fix — the release workflow attaches its artifacts to the Release
- `.github/workflows/release.yml` staged `agentbeacon-chromium.zip` +
  `checksums.txt` and handed them to `actions/upload-artifact`, which never
  reaches the Release page. Both shipped releases carry 20 loose `dist/` files
  and no archive or checksums.
- The workflow now attaches them with `gh release upload --clobber`, creating
  the release when the tag arrives without one, so it stays idempotent against
  `publish_repo.sh`'s own `dist/*` upload.

### fix — the completed demo reproduces the recorded output
- `bun examples/presentation_demo.ts completed` printed `[]` on v0.2.0 while the
  README and `docs/demo-results.json` advertised a completed signal: the fixture
  never supplied `completedSettleSec` (so the settle comparison was `NaN`) and
  landed its second observation on the same tick, and `examples/` was outside
  `tsconfig`'s include so the incomplete config was never typechecked.
- The fixture now carries a complete typed config, streams → stops → observes
  once more 60 s later (reproducing the recorded output exactly), `examples/` is
  typechecked, and the script exits non-zero when a scenario yields no signal.

## [0.2.0] — 2026-09-18

Fix-led release from the post-ship source review: the cap tripwire now survives
service-worker restarts, "completed" no longer fires on mid-run gaps, and alerts
carry the open-tab link the plan promised.

### fix — cap tripwire survives MV3 service-worker restarts
- New `src/lib/run-store.ts` persists run records to `chrome.storage.session`
  (survives service-worker restarts, auto-cleared on browser close — exactly a
  run's lifetime; falls back to `chrome.storage.local`). v0.1.0 kept the
  registry only in memory, so the worker cold-restarted by the very cap alarm
  found an empty registry and silently dropped the warning.
- The alarm handler rehydrates the persisted record before evaluating, and
  `startRun` / `markCompleted` write through.

### fix — completed fires on sustained idle, not the first streaming gap
- The `Detector` now starts a settle clock (default 60 s, `completedSettleSec`)
  when streaming stops and only emits `completed` after the DOM stays quiet
  past it; the content script schedules the confirming observation itself.
  v0.1.0 fired "✅ Agent completed" on the first turn-to-turn gap of a
  multi-turn run.
- Streaming resuming re-arms the completion latch so the true completion still
  pings, with a 5-minute per-task cooldown (`completedCooldownSec`) against
  spam on re-armed completions.

### fix — alerts carry the open-tab conversation link
- `loop_suspected`, `cap_warning` and `completed` messages now append
  `https://chatgpt.com/c/<taskId>` when the taskId is a conversation uuid
  (the `tab-` fallback gets no link). v0.1.0's loop alert said "Open the tab
  to check." with no link, despite the plan's m3 spec.

### quality — version lockstep
- `test/version-lockstep.test.ts` pins `VERSION`, `manifest.json`,
  `package.json` and `web/site.json` to the same version so no future bump
  lands half-done.

## [0.1.0] — 2026-09-02

### m1 — observe agent
- Content-script `MutationObserver` on `chatgpt.com` extracts an `AgentObservation`
  from the conversation DOM and feeds a stateful `Detector`.
- The `Detector` emits a typed `AgentRunSignal { kind: "completed" }` on the
  streaming → idle transition once a final turn is present.
- 飞书 (Feishu/Lark) webhook channel with optional timestamp + HMAC-SHA256 signing.
- Background service worker dispatches signals to enabled channels via injectable
  fetch.

### m2 — route channels + cap tripwire
- 钉钉 (DingTalk, signed via URL `timestamp` + `sign`) and 企业微信 (WeCom) channel
  builders.
- Popup config UI: per-channel webhook URL + secret, enable toggles, cap/loop
  thresholds, persisted to `chrome.storage.local`.
- `chrome.alarms` cap tripwire: fires a `cap_warning` signal when a run is still
  active past the configured threshold (default 240 min).

### m3 — detect loop
- Loop heuristic: flags `loop_suspected` when a substantial (≥60 char) assistant
  message repeats across turns past the turn-count floor — best-effort and labeled
  as such in the alert. Idle minutes are carried in the signal for context.

### Tooling
- Vitest suite: 35 tests covering the detector, signing vectors, store, run
  registry, and dispatch (no chrome / no network).
- `tsc --noEmit` typecheck; `vite build` produces a load-unpacked `dist/`.
- CI (`ci.yml`), release (`release.yml`), and demo (`demo.yml`) workflows.
- MIT LICENSE; `VERSION` 0.1.0; animated hero + atlas SVG pairs.
