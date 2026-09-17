import type { RunRecord } from "./run-registry";

// MV3 service workers are killed after ~30s idle and cold-restart on the next
// event — the cap alarm at t+capThresholdMin always outlives the worker that
// scheduled it. RunRecords therefore persist to chrome.storage.session, which
// survives service-worker restarts and is auto-cleared on browser close:
// exactly the lifetime of an agent run. The 'storage' permission already
// covers it; the local fallback keeps tests and older Chrome working.

export const RUNS_KEY = "agentbeacon.runs.v1";

export interface RunsStorageLike {
  get(keys?: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function defaultStorage(): RunsStorageLike {
  const areas = chrome.storage as unknown as Record<
    string,
    RunsStorageLike | undefined
  >;
  return areas.session ?? (chrome.storage.local as unknown as RunsStorageLike);
}

/** Persists the cap-tripwire's run records across service-worker restarts. */
export class RunStore {
  constructor(private readonly storage: RunsStorageLike = defaultStorage()) {}

  async startRun(rec: RunRecord): Promise<void> {
    const all = await this.readAll();
    // same semantics as RunRegistry.startRun: an existing record wins, so a
    // re-sent run_started (tab reload) cannot reset the elapsed-time clock
    if (all[rec.taskId]) return;
    all[rec.taskId] = rec;
    await this.writeAll(all);
  }

  async markCompleted(taskId: string): Promise<void> {
    const all = await this.readAll();
    const rec = all[taskId];
    if (!rec) return;
    rec.completed = true;
    await this.writeAll(all);
  }

  async get(taskId: string): Promise<RunRecord | undefined> {
    return (await this.readAll())[taskId];
  }

  private async readAll(): Promise<Record<string, RunRecord>> {
    const rec = await this.storage.get([RUNS_KEY]);
    return (rec[RUNS_KEY] as Record<string, RunRecord> | undefined) ?? {};
  }

  private async writeAll(all: Record<string, RunRecord>): Promise<void> {
    await this.storage.set({ [RUNS_KEY]: all });
  }
}
