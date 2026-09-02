import { describe, it, expect } from "vitest";
import { RunRegistry } from "../src/lib/run-registry";

const MIN = 60_000;

describe("RunRegistry", () => {
  it("starts a run and reports it active", () => {
    const r = new RunRegistry();
    const rec = r.startRun("t1", 0, 5);
    expect(rec.taskId).toBe("t1");
    expect(rec.tabId).toBe(5);
    expect(r.isActive("t1")).toBe(true);
    expect(r.size()).toBe(1);
  });

  it("is idempotent for a duplicate startRun", () => {
    const r = new RunRegistry();
    r.startRun("t1", 100, 1);
    const second = r.startRun("t1", 200, 2); // must not reset startMs
    expect(second.startMs).toBe(100);
    expect(r.size()).toBe(1);
  });

  it("returns null before the cap threshold", () => {
    const r = new RunRegistry();
    r.startRun("t1", 0);
    expect(r.evaluateCapWarning("t1", 100 * MIN, 240)).toBeNull();
  });

  it("emits a cap_warning once past the threshold", () => {
    const r = new RunRegistry();
    r.startRun("t1", 0);
    const warn = r.evaluateCapWarning("t1", 250 * MIN, 240);
    expect(warn).not.toBeNull();
    if (warn && warn.kind === "cap_warning") {
      expect(warn.taskId).toBe("t1");
      expect(warn.elapsedMin).toBe(250);
      expect(warn.thresholdMin).toBe(240);
    }
  });

  it("suppresses the warning once the run is completed", () => {
    const r = new RunRegistry();
    r.startRun("t1", 0);
    r.markCompleted("t1");
    expect(r.evaluateCapWarning("t1", 999 * MIN, 240)).toBeNull();
    expect(r.isActive("t1")).toBe(false);
  });

  it("returns null for an unknown task", () => {
    const r = new RunRegistry();
    expect(r.evaluateCapWarning("nope", 999 * MIN, 1)).toBeNull();
  });

  it("clears a run", () => {
    const r = new RunRegistry();
    r.startRun("t1", 0);
    r.clear("t1");
    expect(r.size()).toBe(0);
    expect(r.get("t1")).toBeUndefined();
  });
});
