// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  Detector,
  extractObservation,
  hashMessage,
  type AgentObservation,
} from "../src/lib/detector";

const LONG_A =
  "AgentBeacon loop test message that is long enough to exceed the sixty char threshold.";
const LONG_B =
  "A completely different long message that also exceeds sixty characters for sure yes.";

function dom(html: string): ParentNode {
  const root = document.createElement("div");
  root.innerHTML = html.trim();
  return root;
}

const assistant = (text: string): string =>
  `<div data-message-author-role="assistant">${text}</div>`;
const streaming = (on: boolean): string =>
  on ? `<div data-testid="composer-stop-button"></div>` : "";

/** Build a deterministic observation without going through the DOM. */
function obs(
  turns: string[],
  opts: { streaming?: boolean; now: number },
): AgentObservation {
  const last = turns.length ? turns[turns.length - 1] : "";
  return {
    isStreaming: opts.streaming ?? false,
    hasTerminalArtifact: turns.length > 0,
    turnCount: turns.length,
    assistantMessages: turns,
    lastMessageText: last,
    lastActivityAt: opts.now,
    now: opts.now,
  };
}

describe("hashMessage", () => {
  it("matches authoritative vectors", () => {
    expect(hashMessage("")).toBe("1505");
    expect(hashMessage("hello")).toBe("a9cede7");
    expect(hashMessage(LONG_A)).toBe("79014f68");
  });

  it("is deterministic and distinguishes distinct inputs", () => {
    expect(hashMessage(LONG_A)).toBe(hashMessage(LONG_A));
    expect(hashMessage(LONG_A)).not.toBe(hashMessage(LONG_B));
  });
});

describe("extractObservation", () => {
  it("counts assistant turns and reads the last message", () => {
    const o = extractObservation(dom(assistant("first") + assistant("second")), 1000);
    expect(o.turnCount).toBe(2);
    expect(o.lastMessageText).toBe("second");
    expect(o.hasTerminalArtifact).toBe(true);
    expect(o.isStreaming).toBe(false);
  });

  it("detects streaming via the stop button", () => {
    expect(extractObservation(dom(assistant("x") + streaming(true)), 1).isStreaming).toBe(
      true,
    );
    expect(extractObservation(dom(assistant("x") + streaming(false)), 1).isStreaming).toBe(
      false,
    );
  });

  it("reports no terminal artifact on an empty conversation", () => {
    const o = extractObservation(dom(""), 1);
    expect(o.turnCount).toBe(0);
    expect(o.hasTerminalArtifact).toBe(false);
    expect(o.lastMessageText).toBe("");
  });
});

describe("Detector — completion", () => {
  it("emits completed once on the streaming→idle transition", () => {
    const d = new Detector({ loopTurnDelta: 2, loopThresholdMin: 5 }, 0, "t1");
    // turn 1 streams in
    expect(d.observe(obs([LONG_A], { streaming: true, now: 1000 }))).toHaveLength(0);
    // streaming stops -> completion
    const s = d.observe(obs([LONG_A], { streaming: false, now: 1000 + 43 * 60_000 }));
    expect(s).toHaveLength(1);
    expect(s[0].kind).toBe("completed");
    if (s[0].kind === "completed") {
      expect(s[0].taskId).toBe("t1");
      expect(s[0].durationMin).toBe(43);
      expect(s[0].summary).toBe(LONG_A.slice(0, 140));
    }
    // does not re-emit on a later idle tick
    expect(
      d.observe(obs([LONG_A], { streaming: false, now: 1000 + 44 * 60_000 })),
    ).toHaveLength(0);
  });

  it("does not emit completed if the run never streamed (stale page load)", () => {
    const d = new Detector({ loopTurnDelta: 2, loopThresholdMin: 5 }, 0, "t1");
    expect(d.observe(obs([LONG_A], { streaming: false, now: 1000 }))).toHaveLength(0);
  });
});

describe("Detector — loop", () => {
  it("flags loop_suspected on a repeated substantial message", () => {
    const d = new Detector({ loopTurnDelta: 2, loopThresholdMin: 5 }, 0, "t1");
    // turn 1 streams in (distinct, new content)
    d.observe(obs([LONG_A], { streaming: true, now: 1000 }));
    // turn 2 repeats turn 1 verbatim while still streaming -> loop
    const s = d.observe(obs([LONG_A, LONG_A], { streaming: true, now: 2000 }));
    const loop = s.find((x) => x.kind === "loop_suspected");
    expect(loop).toBeDefined();
    if (loop && loop.kind === "loop_suspected") {
      expect(loop.taskId).toBe("t1");
      expect(loop.turnCount).toBe(2);
      expect(loop.repeatedMsgHash).toBe(hashMessage(LONG_A));
    }
  });

  it("does not flag a loop on short repeated acknowledgements", () => {
    const d = new Detector({ loopTurnDelta: 2, loopThresholdMin: 5 }, 0, "t1");
    d.observe(obs(["ok"], { streaming: true, now: 1000 }));
    d.observe(obs(["ok"], { streaming: false, now: 2000 }));
    const s = d.observe(obs(["ok", "ok"], { streaming: true, now: 3000 }));
    expect(s.find((x) => x.kind === "loop_suspected")).toBeUndefined();
  });

  it("respects the turn-count floor before flagging", () => {
    const d = new Detector({ loopTurnDelta: 3, loopThresholdMin: 5 }, 0, "t1");
    d.observe(obs([LONG_A], { streaming: true, now: 1000 }));
    // 2 turns but floor is 3 -> not yet
    const early = d.observe(obs([LONG_A, LONG_A], { streaming: true, now: 2000 }));
    expect(early.find((x) => x.kind === "loop_suspected")).toBeUndefined();
    // 3rd turn (still repeating) -> fires
    const s = d.observe(
      obs([LONG_A, LONG_A, LONG_A], { streaming: true, now: 3000 }),
    );
    expect(s.find((x) => x.kind === "loop_suspected")).toBeDefined();
  });

  it("fires a loop only once total", () => {
    const d = new Detector({ loopTurnDelta: 2, loopThresholdMin: 5 }, 0, "t1");
    d.observe(obs([LONG_A], { streaming: true, now: 1000 }));
    d.observe(obs([LONG_A, LONG_A], { streaming: true, now: 2000 }));
    const again = d.observe(
      obs([LONG_A, LONG_A, LONG_A], { streaming: true, now: 3000 }),
    );
    expect(again.find((x) => x.kind === "loop_suspected")).toBeUndefined();
  });
});
