import { describe, it, expect } from "vitest";
import { dispatchSignal, signalMessage, type FetchImpl } from "../src/lib/webhook";
import type { AgentBeaconConfig, AgentRunSignal } from "../src/types";

function makeFetch(status: number): { impl: FetchImpl; calls: { url: string; body: string }[] } {
  const calls: { url: string; body: string }[] = [];
  const impl: FetchImpl = async (url, init) => {
    calls.push({ url, body: init.body });
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => `{"errcode":0}`,
    };
  };
  return { impl, calls };
}

const cfg: AgentBeaconConfig = {
  feishu: { webhookUrl: "https://f", secret: "S", enabled: true },
  dingtalk: { webhookUrl: "https://d", enabled: false },
  wework: { webhookUrl: "", enabled: true },
  capThresholdMin: 240,
  loopThresholdMin: 5,
  loopTurnDelta: 3,
};

describe("signalMessage", () => {
  it("renders each signal kind", () => {
    const completed: AgentRunSignal = {
      kind: "completed",
      taskId: "t",
      durationMin: 43,
      summary: "done",
    };
    expect(signalMessage(completed)).toContain("43 min");

    const loop: AgentRunSignal = {
      kind: "loop_suspected",
      taskId: "t",
      turnCount: 5,
      idleMin: 2,
      repeatedMsgHash: "abc12345",
    };
    expect(signalMessage(loop)).toContain("Loop suspected");
    expect(signalMessage(loop)).toContain("abc12345");

    const cap: AgentRunSignal = {
      kind: "cap_warning",
      taskId: "t",
      elapsedMin: 240,
      thresholdMin: 240,
    };
    expect(signalMessage(cap)).toContain("240 min elapsed");
  });
});

describe("dispatchSignal", () => {
  it("dispatches only to enabled channels with a URL", async () => {
    const { impl, calls } = makeFetch(200);
    const results = await dispatchSignal(
      { kind: "completed", taskId: "t", durationMin: 1, summary: "s" },
      cfg,
      impl,
      1700000000000,
    );
    // feishu: enabled + url -> dispatched
    // dingtalk: disabled -> skipped
    // wework: enabled but no url -> skipped
    expect(results).toHaveLength(1);
    expect(results[0].channel).toBe("feishu");
    expect(results[0].ok).toBe(true);
    expect(results[0].status).toBe(200);
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body);
    expect(body.content.text).toContain("Agent completed");
    // secret set -> feishu signed, timestamp (seconds) present
    expect(body.timestamp).toBe("1700000000");
  });

  it("records a failure on a non-2xx response", async () => {
    const { impl } = makeFetch(500);
    const results = await dispatchSignal(
      { kind: "cap_warning", taskId: "t", elapsedMin: 240, thresholdMin: 240 },
      cfg,
      impl,
      1,
    );
    expect(results[0].ok).toBe(false);
    expect(results[0].status).toBe(500);
  });

  it("captures a thrown fetch as a failed result", async () => {
    const impl: FetchImpl = async () => {
      throw new Error("network down");
    };
    const results = await dispatchSignal(
      { kind: "completed", taskId: "t", durationMin: 1, summary: "s" },
      cfg,
      impl,
      1,
    );
    expect(results[0].ok).toBe(false);
    expect(results[0].status).toBe(0);
    expect(results[0].body).toBe("network down");
  });

  it("dispatches nothing when no channel is enabled", async () => {
    const { impl, calls } = makeFetch(200);
    const empty: AgentBeaconConfig = {
      feishu: { webhookUrl: "https://f", enabled: false },
      dingtalk: { webhookUrl: "https://d", enabled: false },
      wework: { webhookUrl: "https://w", enabled: false },
      capThresholdMin: 240,
      loopThresholdMin: 5,
      loopTurnDelta: 3,
    };
    const results = await dispatchSignal(
      { kind: "completed", taskId: "t", durationMin: 1, summary: "s" },
      empty,
      impl,
      1,
    );
    expect(results).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});
