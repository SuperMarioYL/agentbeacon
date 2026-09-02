import { Detector, extractObservation } from "./lib/detector";
import { Store } from "./lib/store";
import type { AgentBeaconConfig } from "./types";

// Content script — runs only on chatgpt.com. Wires a MutationObserver on the
// conversation surface to the pure Detector, and forwards typed signals to the
// background service worker. DOM extraction + classification are pure + tested;
// this file is the chrome/DOM glue.

const store = new Store();
const CONFIG_STORAGE_KEY = "agentbeacon.config.v1";

function getConversationRoot(): ParentNode {
  return document.querySelector("main") ?? document.body;
}

function deriveTaskId(): string {
  // ChatGPT conversation URLs look like /c/<uuid>; fall back to a path slug.
  const m = location.pathname.match(/\/c\/([a-f0-9-]+)/i);
  if (m) return m[1];
  const seg = location.pathname.replace(/^\/+/, "").slice(0, 16);
  return `tab-${seg || "default"}`;
}

const taskId = deriveTaskId();
let detector = new Detector({ loopThresholdMin: 5, loopTurnDelta: 3 }, Date.now(), taskId);
let streamingSeen = false;
let debounce: ReturnType<typeof setTimeout> | null = null;

function send(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
    /* service worker may be asleep during quiet periods — best effort */
  });
}

function tick(): void {
  const obs = extractObservation(getConversationRoot(), Date.now());
  if (obs.isStreaming && !streamingSeen) {
    streamingSeen = true;
    send({ type: "run_started", taskId });
  }
  for (const signal of detector.observe(obs)) {
    send({ type: "signal", signal });
  }
}

async function init(): Promise<void> {
  const cfg = await store.getConfig();
  detector = new Detector(
    { loopThresholdMin: cfg.loopThresholdMin, loopTurnDelta: cfg.loopTurnDelta },
    Date.now(),
    taskId,
  );

  // Live-update thresholds if the user changes config in the popup.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes[CONFIG_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue as AgentBeaconConfig | undefined;
    if (next) {
      detector.updateConfig({
        loopThresholdMin: next.loopThresholdMin,
        loopTurnDelta: next.loopTurnDelta,
      });
    }
  });

  const observer = new MutationObserver(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(tick, 600);
  });
  observer.observe(getConversationRoot(), {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

void init();
