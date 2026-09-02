import type { AgentRunSignal } from "../types";

export interface RunRecord {
  taskId: string;
  startMs: number;
  completed: boolean;
  tabId?: number;
}

/** Owns the per-task run-state needed by the cap tripwire: when a run started,
 *  whether it has completed, and whether enough time has elapsed to warn. Pure
 *  logic — the background service worker wires it to chrome.alarms. */
export class RunRegistry {
  private readonly runs = new Map<string, RunRecord>();

  startRun(taskId: string, startMs: number, tabId?: number): RunRecord {
    const existing = this.runs.get(taskId);
    if (existing) return existing;
    const rec: RunRecord = { taskId, startMs, completed: false, tabId };
    this.runs.set(taskId, rec);
    return rec;
  }

  get(taskId: string): RunRecord | undefined {
    return this.runs.get(taskId);
  }

  markCompleted(taskId: string): void {
    const rec = this.runs.get(taskId);
    if (rec) rec.completed = true;
  }

  isActive(taskId: string): boolean {
    const r = this.runs.get(taskId);
    return !!r && !r.completed;
  }

  /** Returns a cap_warning signal if the run is still active and past the
   *  threshold, otherwise null (run unknown, finished, or not yet due). */
  evaluateCapWarning(
    taskId: string,
    nowMs: number,
    thresholdMin: number,
  ): AgentRunSignal | null {
    const rec = this.runs.get(taskId);
    if (!rec || rec.completed) return null;
    const elapsedMin = round1((nowMs - rec.startMs) / 60000);
    if (elapsedMin < thresholdMin) return null;
    return {
      kind: "cap_warning",
      taskId,
      elapsedMin,
      thresholdMin,
    };
  }

  clear(taskId: string): void {
    this.runs.delete(taskId);
  }

  size(): number {
    return this.runs.size;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
