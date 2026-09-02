import { Store } from "../lib/store";
import { dispatchSignal } from "../lib/webhook";
import type { AgentBeaconConfig, ChannelConfig, ChannelName } from "../types";

const store = new Store();
const form = document.getElementById("config-form") as HTMLFormElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const testBtn = document.getElementById("test") as HTMLButtonElement;

const CHANNELS: ChannelName[] = ["feishu", "dingtalk", "wework"];

function field(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function readForm(): AgentBeaconConfig {
  const channels = {} as Record<ChannelName, ChannelConfig>;
  for (const c of CHANNELS) {
    const secretEl = document.getElementById(
      `${c}-secret`,
    ) as HTMLInputElement | null;
    channels[c] = {
      webhookUrl: field(`${c}-url`).value.trim(),
      secret: secretEl ? secretEl.value.trim() || undefined : undefined,
      enabled: field(`${c}-enabled`).checked,
    };
  }
  return {
    feishu: channels.feishu,
    dingtalk: channels.dingtalk,
    wework: channels.wework,
    capThresholdMin: Number(field("cap-threshold").value) || 0,
    loopThresholdMin: Number(field("loop-threshold").value) || 0,
    loopTurnDelta: Number(field("loop-turn-delta").value) || 0,
  };
}

function fillForm(cfg: AgentBeaconConfig): void {
  for (const c of CHANNELS) {
    field(`${c}-url`).value = cfg[c].webhookUrl;
    field(`${c}-enabled`).checked = cfg[c].enabled;
    const sec = document.getElementById(
      `${c}-secret`,
    ) as HTMLInputElement | null;
    if (sec) sec.value = cfg[c].secret ?? "";
  }
  field("cap-threshold").value = String(cfg.capThresholdMin);
  field("loop-threshold").value = String(cfg.loopThresholdMin);
  field("loop-turn-delta").value = String(cfg.loopTurnDelta);
}

function flash(msg: string, ms = 2500): void {
  status.textContent = msg;
  if (ms > 0) setTimeout(() => (status.textContent = ""), ms);
}

async function init(): Promise<void> {
  fillForm(await store.getConfig());
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await store.saveConfig(readForm());
  flash("已保存 ✓");
});

testBtn.addEventListener("click", async () => {
  testBtn.disabled = true;
  const cfg = readForm();
  await store.saveConfig(cfg);
  const results = await dispatchSignal(
    {
      kind: "completed",
      taskId: "test",
      durationMin: 0.1,
      summary: "AgentBeacon 测试 ping — 收到说明配置正确。",
    },
    cfg,
  );
  const ok = results.filter((r) => r.ok).length;
  if (results.length === 0) {
    flash("未启用任何通道，请填写 URL 并勾选启用。");
  } else {
    flash(`测试发送：${ok}/${results.length} 成功`, 4000);
  }
  testBtn.disabled = false;
});

void init();
