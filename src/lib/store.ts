import type { AgentBeaconConfig, ChannelName } from "../types";

/** Minimal storage interface that chrome.storage.local satisfies. Injecting a
 *  fake at construction lets the store be unit-tested without chrome. */
export interface StorageLike {
  get(keys?: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const DEFAULT_CONFIG: AgentBeaconConfig = {
  feishu: { webhookUrl: "", enabled: false },
  dingtalk: { webhookUrl: "", enabled: false },
  wework: { webhookUrl: "", enabled: false },
  capThresholdMin: 240,
  loopThresholdMin: 5,
  loopTurnDelta: 3,
};

export const CONFIG_KEY = "agentbeacon.config.v1";

function merge(stored: Partial<AgentBeaconConfig> | undefined): AgentBeaconConfig {
  const s = stored ?? {};
  const channel = (name: ChannelName) => ({
    ...DEFAULT_CONFIG[name],
    ...s[name],
  });
  return {
    feishu: channel("feishu"),
    dingtalk: channel("dingtalk"),
    wework: channel("wework"),
    capThresholdMin: s.capThresholdMin ?? DEFAULT_CONFIG.capThresholdMin,
    loopThresholdMin: s.loopThresholdMin ?? DEFAULT_CONFIG.loopThresholdMin,
    loopTurnDelta: s.loopTurnDelta ?? DEFAULT_CONFIG.loopTurnDelta,
  };
}

/** Thin wrapper over chrome.storage.local. Owns the config schema + defaults. */
export class Store {
  constructor(
    private readonly storage: StorageLike = chrome.storage
      .local as unknown as StorageLike,
  ) {}

  async getConfig(): Promise<AgentBeaconConfig> {
    const rec = await this.storage.get([CONFIG_KEY]);
    return merge(rec[CONFIG_KEY] as Partial<AgentBeaconConfig> | undefined);
  }

  async saveConfig(cfg: AgentBeaconConfig): Promise<void> {
    await this.storage.set({ [CONFIG_KEY]: cfg });
  }
}
