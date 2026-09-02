import { RunRegistry } from "./lib/run-registry";
import { Store } from "./lib/store";
import { dispatchSignal, signalMessage } from "./lib/webhook";
import type { AgentRunSignal } from "./types";

// MV3 service worker. Owns the cap-tripwire (chrome.alarms) and dispatches
// signals from the content script to the configured IM channels. The run-state
// decisions live in RunRegistry (pure, unit-tested); this file is the chrome glue.

const store = new Store();
const runs = new RunRegistry();
const CAP_ALARM_PREFIX = "cap:";

async function handleSignal(signal: AgentRunSignal): Promise<void> {
  const cfg = await store.getConfig();
  if (signal.kind === "completed") {
    // The run finished — no cap warning is needed; cancel the pending alarm.
    runs.markCompleted(signal.taskId);
    await chrome.alarms.clear(CAP_ALARM_PREFIX + signal.taskId);
  }
  await dispatchSignal(signal, cfg);
  console.log(`[AgentBeacon] ${signal.kind} · ${signalMessage(signal)}`);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "run_started" && typeof msg.taskId === "string") {
    const tabId = sender.tab?.id;
    void (async () => {
      const cfg = await store.getConfig();
      runs.startRun(msg.taskId, Date.now(), tabId);
      await chrome.alarms.clear(CAP_ALARM_PREFIX + msg.taskId);
      if (cfg.capThresholdMin > 0) {
        chrome.alarms.create(CAP_ALARM_PREFIX + msg.taskId, {
          delayInMinutes: cfg.capThresholdMin,
        });
      }
    })();
    return false;
  }
  if (msg?.type === "signal" && msg.signal) {
    void handleSignal(msg.signal as AgentRunSignal);
    return false;
  }
  return false;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(CAP_ALARM_PREFIX)) return;
  const taskId = alarm.name.slice(CAP_ALARM_PREFIX.length);
  const cfg = await store.getConfig();
  const signal = runs.evaluateCapWarning(
    taskId,
    Date.now(),
    cfg.capThresholdMin,
  );
  if (signal) {
    await dispatchSignal(signal, cfg);
    console.log(`[AgentBeacon] ${signal.kind} · ${signalMessage(signal)}`);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  // Persist defaults so a fresh install has a known-good config shape on disk.
  const cfg = await store.getConfig();
  await store.saveConfig(cfg);
});
