import type {
  AgentBeaconConfig,
  AgentRunSignal,
  ChannelName,
  ChannelRequest,
  DispatchResult,
} from "../types";
import { buildFeishuRequest } from "./channels/feishu";
import { buildDingtalkRequest } from "./channels/dingtalk";
import { buildWeworkRequest } from "./channels/wework";

export interface ChannelRequestInit {
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface FetchResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
}

/** Injectable fetch seam — tests pass a fake; production uses the platform fetch. */
export type FetchImpl = (
  input: string,
  init: ChannelRequestInit,
) => Promise<FetchResponse>;

const defaultFetch: FetchImpl = async (input, init) => {
  const res = await fetch(input, init);
  return { status: res.status, ok: res.ok, text: () => res.text() };
};

type ChannelBuilder = (
  text: string,
  url: string,
  secret: string | undefined,
  nowMs: number,
) => Promise<ChannelRequest>;

const CHANNEL_BUILDERS: Record<ChannelName, ChannelBuilder> = {
  feishu: buildFeishuRequest,
  dingtalk: buildDingtalkRequest,
  wework: buildWeworkRequest,
};

const CHANNEL_ORDER: ChannelName[] = ["feishu", "dingtalk", "wework"];

/** Human-readable alert text for a signal — the IM bot message body. */
export function signalMessage(signal: AgentRunSignal): string {
  switch (signal.kind) {
    case "completed":
      return `✅ Agent completed (${signal.durationMin} min).\n${signal.summary}`;
    case "loop_suspected": {
      const repeat = signal.repeatedMsgHash
        ? ` · repeated msg ${signal.repeatedMsgHash.slice(0, 8)}`
        : "";
      return `⚠️ Loop suspected — cap at risk.\nTurns: ${signal.turnCount}, idle ${signal.idleMin} min${repeat}.\nOpen the tab to check.`;
    }
    case "cap_warning":
      return `⏱️ ${signal.elapsedMin} min elapsed — cap at risk (threshold ${signal.thresholdMin} min). Check your usage.`;
  }
}

/** Push a signal to every enabled, configured channel. Returns one result per
 *  attempted channel (skipped channels are omitted). */
export async function dispatchSignal(
  signal: AgentRunSignal,
  config: AgentBeaconConfig,
  fetchImpl: FetchImpl = defaultFetch,
  nowMs: number = Date.now(),
): Promise<DispatchResult[]> {
  const text = signalMessage(signal);
  const results: DispatchResult[] = [];
  for (const name of CHANNEL_ORDER) {
    const ch = config[name];
    if (!ch.enabled || !ch.webhookUrl) continue;
    try {
      const req = await CHANNEL_BUILDERS[name](
        text,
        ch.webhookUrl,
        ch.secret,
        nowMs,
      );
      const res = await fetchImpl(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      const body = await res.text();
      results.push({
        channel: name,
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        body,
      });
    } catch (err) {
      results.push({
        channel: name,
        ok: false,
        status: 0,
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
