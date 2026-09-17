# Changelog

All notable changes to AgentBeacon are documented here.
This project adheres to [Semantic Versioning](https://semver.org).

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
