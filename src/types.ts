// AgentBeacon core types. The central abstraction is AgentRunSignal — a typed
// observation of a cloud-agent tab's DOM state, bridging the DOM-observable
// agent state to IM-push dispatch + cap-tripwire logic.

export type AgentRunSignal =
  | { kind: "completed"; taskId: string; durationMin: number; summary: string }
  | {
      kind: "loop_suspected";
      taskId: string;
      turnCount: number;
      idleMin: number;
      repeatedMsgHash?: string;
    }
  | {
      kind: "cap_warning";
      taskId: string;
      elapsedMin: number;
      thresholdMin: number;
    };

export type SignalKind = AgentRunSignal["kind"];

export type ChannelName = "feishu" | "dingtalk" | "wework";

export interface ChannelConfig {
  webhookUrl: string;
  /** Signing secret. Feishu + DingTalk sign with it; the WeCom group-robot
   *  authenticates via the `key` in its webhook URL and ignores this field. */
  secret?: string;
  enabled: boolean;
}

export interface AgentBeaconConfig {
  feishu: ChannelConfig;
  dingtalk: ChannelConfig;
  wework: ChannelConfig;
  /** Minutes after run start before a cap_warning fires. Default 240 (4h). */
  capThresholdMin: number;
  /** Minutes of inactivity before a non-terminating run is flagged (idle path). */
  loopThresholdMin: number;
  /** Turn count at which a stalled run is considered long enough to flag. */
  loopTurnDelta: number;
}

/** A built, signed, ready-to-send HTTP request to one IM bot webhook. */
export interface ChannelRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

export interface DispatchResult {
  channel: ChannelName;
  ok: boolean;
  status: number;
  body: string;
}
