import { describe, it, expect } from "vitest";
import { RunStore, RUNS_KEY, type RunsStorageLike } from "../src/lib/run-store";
import { RunRegistry } from "../src/lib/run-registry";

function fakeStorage(): RunsStorageLike & { dump(): Record<string, unknown> } {
  let data: Record<string, unknown> = {};
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of keys ?? []) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items) {
      data = { ...data, ...items };
    },
    dump() {
      return data;
    },
  };
}

describe("RunStore", () => {
  it("persists a started run and reads it back from a fresh instance", async () => {
    const storage = fakeStorage();
    await new RunStore(storage).startRun({
      taskId: "task-1",
      startMs: 1000,
      completed: false,
    });
    // a cold-restarted service worker reads through a NEW RunStore
    const revived = await new RunStore(storage).get("task-1");
    expect(revived).toBeDefined();
    expect(revived?.startMs).toBe(1000);
    expect(revived?.completed).toBe(false);
  });

  it("marks completion durably", async () => {
    const storage = fakeStorage();
    const a = new RunStore(storage);
    await a.startRun({ taskId: "task-1", startMs: 1000, completed: false });
    await a.markCompleted("task-1");
    const revived = await new RunStore(storage).get("task-1");
    expect(revived?.completed).toBe(true);
  });

  it("does not reset the clock on a duplicate run_started (tab reload)", async () => {
    const storage = fakeStorage();
    const a = new RunStore(storage);
    await a.startRun({ taskId: "task-1", startMs: 1000, completed: false });
    await a.startRun({ taskId: "task-1", startMs: 999_999, completed: false });
    const revived = await new RunStore(storage).get("task-1");
    expect(revived?.startMs).toBe(1000);
  });

  it("stores records under the versioned key", async () => {
    const storage = fakeStorage();
    await new RunStore(storage).startRun({
      taskId: "task-1",
      startMs: 1000,
      completed: false,
    });
    expect(storage.dump()[RUNS_KEY]).toBeDefined();
  });
});

describe("cap tripwire across a service-worker restart", () => {
  it("a run started by one worker still warns after a cold restart", async () => {
    const storage = fakeStorage();
    // worker incarnation #1: the run starts and the worker later dies
    const registry1 = new RunRegistry();
    const rec = registry1.startRun("task-1", 1000);
    await new RunStore(storage).startRun(rec);

    // worker incarnation #2 (alarm fired): fresh in-memory registry,
    // hydrates the persisted record before evaluating
    const registry2 = new RunRegistry();
    expect(registry2.evaluateCapWarning("task-1", 1000 + 240 * 60_000, 240)).toBeNull();
    const persisted = await new RunStore(storage).get("task-1");
    expect(persisted).toBeDefined();
    registry2.hydrate(persisted!);
    const signal = registry2.evaluateCapWarning(
      "task-1",
      1000 + 240 * 60_000,
      240,
    );
    expect(signal).not.toBeNull();
    expect(signal?.kind).toBe("cap_warning");
    if (signal?.kind === "cap_warning") {
      expect(signal.elapsedMin).toBe(240);
    }
  });

  it("a completed run never warns, even after restart", async () => {
    const storage = fakeStorage();
    const registry1 = new RunRegistry();
    const rec = registry1.startRun("task-1", 1000);
    await new RunStore(storage).startRun(rec);
    registry1.markCompleted("task-1");
    await new RunStore(storage).markCompleted("task-1");

    const registry2 = new RunRegistry();
    const persisted = await new RunStore(storage).get("task-1");
    registry2.hydrate(persisted!);
    expect(
      registry2.evaluateCapWarning("task-1", 1000 + 300 * 60_000, 240),
    ).toBeNull();
  });
});
