# Changelog

All notable changes to AgentBeacon are documented here.
This project adheres to [Semantic Versioning](https://semver.org).

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
