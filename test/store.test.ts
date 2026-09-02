import { describe, it, expect } from "vitest";
import { Store, CONFIG_KEY, DEFAULT_CONFIG, type StorageLike } from "../src/lib/store";

function fakeStorage(init: Record<string, unknown> = {}): StorageLike {
  let data: Record<string, unknown> = { ...init };
  return {
    async get(keys) {
      if (!keys) return { ...data };
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items) {
      data = { ...data, ...items };
    },
  };
}

describe("Store", () => {
  it("returns defaults from empty storage", async () => {
    const cfg = await new Store(fakeStorage()).getConfig();
    expect(cfg.capThresholdMin).toBe(DEFAULT_CONFIG.capThresholdMin);
    expect(cfg.loopTurnDelta).toBe(3);
    expect(cfg.feishu).toEqual({ webhookUrl: "", enabled: false });
    expect(cfg.dingtalk.enabled).toBe(false);
    expect(cfg.wework.enabled).toBe(false);
  });

  it("round-trips a saved config", async () => {
    const store = new Store(fakeStorage());
    const cfg = await store.getConfig();
    cfg.feishu = { webhookUrl: "https://f", secret: "s", enabled: true };
    cfg.capThresholdMin = 60;
    await store.saveConfig(cfg);

    const loaded = await store.getConfig();
    expect(loaded.feishu.webhookUrl).toBe("https://f");
    expect(loaded.feishu.secret).toBe("s");
    expect(loaded.feishu.enabled).toBe(true);
    expect(loaded.capThresholdMin).toBe(60);
  });

  it("merges a partial stored config over the defaults", async () => {
    const store = new Store(
      fakeStorage({ [CONFIG_KEY]: { capThresholdMin: 120, loopTurnDelta: 7 } }),
    );
    const cfg = await store.getConfig();
    expect(cfg.capThresholdMin).toBe(120);
    expect(cfg.loopTurnDelta).toBe(7);
    expect(cfg.loopThresholdMin).toBe(DEFAULT_CONFIG.loopThresholdMin);
    expect(cfg.feishu.enabled).toBe(false);
  });
});
