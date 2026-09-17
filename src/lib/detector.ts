import type { AgentRunSignal } from "../types";

// DOM selectors for the ChatGPT conversation surface. These track the current
// ChatGPT DOM; if OpenAI renames them, only these constants change — the
// classification logic below is selector-agnostic.
export const ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';
export const STREAMING_SELECTOR =
  '[data-testid="composer-stop-button"], [data-testid="stop-button"], button[aria-label*="Stop" i]';

// Messages shorter than this are not hashed for repeat detection — short
// repeated acknowledgements ("Got it.", "Done.") are normal conversation, not
// a loop. A repeated *substantial* message is the real loop signature.
const REPEAT_MIN_LEN = 60;
const MESSAGE_SLICE = 800;

/** Per-tick snapshot of the observed agent tab, extracted from the DOM. */
export interface AgentObservation {
  isStreaming: boolean;
  hasTerminalArtifact: boolean;
  turnCount: number;
  assistantMessages: string[];
  lastMessageText: string;
  lastActivityAt: number;
  now: number;
}

/** Read a DOM root and produce a pure observation. Stateless, no side effects. */
export function extractObservation(root: ParentNode, now: number): AgentObservation {
  const turns = root.querySelectorAll<HTMLElement>(ASSISTANT_SELECTOR);
  const assistantMessages = Array.from(turns).map((el) =>
    (el.textContent ?? "").trim().slice(0, MESSAGE_SLICE),
  );
  const turnCount = assistantMessages.length;
  const lastMessageText = turnCount > 0 ? assistantMessages[turnCount - 1] : "";
  return {
    isStreaming: !!root.querySelector(STREAMING_SELECTOR),
    hasTerminalArtifact: !!lastMessageText,
    turnCount,
    assistantMessages,
    lastMessageText,
    lastActivityAt: now,
    now,
  };
}

/** djb2 string hash — stable across JS engines, sufficient for detecting
 *  identical repeated assistant turns without a crypto dep at classify time. */
export function hashMessage(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}

export interface DetectorConfig {
  /** Minimum total turns before a loop is even considered (false-positive floor). */
  loopTurnDelta: number;
  /** Minutes of inactivity reported in the loop alert for context. */
  loopThresholdMin: number;
  /** Seconds of sustained no-streaming quiet before "completed" fires. A
   *  brief mid-run gap between turns must not ping. */
  completedSettleSec: number;
  /** Minimum seconds between two "completed" pings for the same task, so a
   *  re-armed completion after a resumed run cannot spam. */
  completedCooldownSec: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** Stateful classifier: turns a stream of AgentObservations into typed
 *  AgentRunSignals. Pure logic — no DOM, no chrome — so it is fully unit-tested.
 *
 *  Signals:
 *   - completed      once per sustained quiet period: streaming stopped AND the
 *                    DOM stayed quiet for completedSettleSec (the settle
 *                    window) AND a final turn is present. A brief mid-run gap
 *                    between turns does NOT fire; streaming resuming re-arms
 *                    the latch so the true completion still pings, subject to
 *                    the completedCooldownSec anti-spam window.
 *   - loop_suspected once, when a substantial message is repeated across turns
 *                    (after the turn-count floor). idle minutes are carried in
 *                    the signal for labelling. The cap tripwire (background)
 *                    separately catches long silent runs, so this detector
 *                    deliberately stays a low-false-positive repeat detector. */
export class Detector {
  private completed = false;
  private loopReported = false;
  private hadStreaming = false;
  private wasStreaming = false;
  private prevTurnCount = 0;
  private lastActivityMs: number;
  private streamingStartMs = 0;
  private idleSinceMs: number | null = null;
  private lastCompletedAtMs = 0;
  private readonly messageHashCounts = new Map<string, number>();

  constructor(
    private config: DetectorConfig,
    private readonly runStartMs: number,
    private readonly taskId: string,
  ) {
    this.lastActivityMs = runStartMs;
  }

  updateConfig(config: DetectorConfig): void {
    this.config = config;
  }

  /** True when streaming has stopped but the settle window has not yet
   *  elapsed — the glue schedules one more observation to confirm. */
  hasPendingCompletion(): boolean {
    return this.idleSinceMs !== null && !this.completed;
  }

  /** The current settle window in ms, for the glue's confirm tick. */
  settleWindowMs(): number {
    return this.config.completedSettleSec * 1000;
  }

  observe(obs: AgentObservation): AgentRunSignal[] {
    const signals: AgentRunSignal[] = [];
    const now = obs.now;

    if (obs.turnCount > this.prevTurnCount) {
      for (let i = this.prevTurnCount; i < obs.turnCount; i++) {
        const text = obs.assistantMessages[i] ?? "";
        if (text.length >= REPEAT_MIN_LEN) {
          const h = hashMessage(text);
          this.messageHashCounts.set(h, (this.messageHashCounts.get(h) ?? 0) + 1);
        }
      }
      this.prevTurnCount = obs.turnCount;
      this.lastActivityMs = now;
    }
    if (obs.isStreaming) {
      if (!this.hadStreaming) {
        this.hadStreaming = true;
        this.streamingStartMs = now;
      }
      this.lastActivityMs = now;
      // streaming resumed — the previous quiet period was a mid-run gap, so
      // re-arm the completion latch (the cooldown still limits ping spam).
      this.idleSinceMs = null;
      if (this.completed && this.pastCooldown(now)) {
        this.completed = false;
      }
    }

    // completion — fire only after the DOM has stayed quiet for the settle
    // window. The observation stream only advances on DOM mutations, so the
    // glue must schedule a confirm tick via hasPendingCompletion().
    if (!obs.isStreaming) {
      if (this.wasStreaming) {
        this.idleSinceMs = now; // streaming → idle transition starts the clock
      }
      if (
        this.idleSinceMs !== null &&
        !this.completed &&
        obs.hasTerminalArtifact &&
        now - this.idleSinceMs >= this.config.completedSettleSec * 1000
      ) {
        if (this.pastCooldown(now)) {
          this.completed = true;
          this.lastCompletedAtMs = now;
          const since = this.streamingStartMs || this.runStartMs;
          signals.push({
            kind: "completed",
            taskId: this.taskId,
            durationMin: round1((now - since) / 60000),
            summary: truncate(obs.lastMessageText, 140),
          });
        } else {
          // a re-armed completion inside the cooldown window is consumed
          // silently — the operator was already pinged moments ago
          this.completed = true;
        }
      }
    }

    // loop — fire once when a substantial message repeats past the turn floor.
    if (
      !this.loopReported &&
      this.hadStreaming &&
      obs.turnCount >= this.config.loopTurnDelta
    ) {
      const repeatedHash = this.firstRepeatedHash();
      if (repeatedHash !== undefined) {
        this.loopReported = true;
        signals.push({
          kind: "loop_suspected",
          taskId: this.taskId,
          turnCount: obs.turnCount,
          idleMin: round1((now - this.lastActivityMs) / 60000),
          repeatedMsgHash: repeatedHash,
        });
      }
    }

    this.wasStreaming = obs.isStreaming;
    return signals;
  }

  private pastCooldown(now: number): boolean {
    return (
      this.lastCompletedAtMs === 0 ||
      now - this.lastCompletedAtMs >= this.config.completedCooldownSec * 1000
    );
  }

  private firstRepeatedHash(): string | undefined {
    for (const [h, count] of this.messageHashCounts) {
      if (count >= 2) return h;
    }
    return undefined;
  }
}
