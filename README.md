<div align="right"><sub><a href="./README.en.md">English</a>&nbsp;&nbsp;⇄&nbsp;&nbsp;<b>简体中文</b></sub></div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/hero-light.svg">
  <img src="./assets/hero-light.svg" width="880" alt="AgentBeacon — agent 完成 + 循环信号推送至 IM">
</picture>

<p align="center"><sub>把 ChatGPT agent 的完成与失控循环信号推送到 微信 / 钉钉 / 飞书，自带用量上限熔断。</sub></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/SuperMarioYL/agentbeacon?color=blue" alt="license"></a>
  <a href="https://github.com/SuperMarioYL/agentbeacon/releases"><img src="https://img.shields.io/github/v/release/SuperMarioYL/agentbeacon" alt="release"></a>
  <img src="https://img.shields.io/github/actions/workflow/status/SuperMarioYL/agentbeacon/ci.yml?branch=main&label=ci" alt="ci">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="typescript">
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="node">
</p>

> **让 Sol 跑通宵不再烧光额度。** 一个 MV3 浏览器扩展：观察 ChatGPT Sol / Deep Research 的 DOM 状态，在 agent 完成、或开始失控循环时，把信号推送给你真正在用的 IM。

---

<h2><img src="https://api.iconify.design/tabler:align-justified.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 目录</h2>

- [为什么需要](#为什么需要)
- [架构](#架构)
- [安装与快速开始](#安装与快速开始)
- [用法](#用法)
- [Demo](#demo)
- [配置](#配置)
- [路线图](#路线图)
- [License](#license)

<h2><img src="https://api.iconify.design/tabler:bulb.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 为什么需要</h2>

长时运行的云 agent（ChatGPT Sol、Deep Research）既没有完成信号，也没有失控保护。今天用户的唯一做法是开着浏览器标签页手动轮询；一旦睡觉，一个已经完成任务的 Sol 可能持续循环数小时，在任何人察觉之前把整周用量额度烧到零。真实的痛点来自一条 r/ChatGPTPro 帖子：“*It completed the task, then continually looped for hours until usage hit zero.*”

AgentBeacon 给出的动词是 **beacon**：检测 agent 已完成或已开始循环，把信号推送到你真正在用的 IM 表面。完成 → `✅ Agent completed`；失控循环 → `⚠️ Loop suspected — cap at risk`；跑过阈值 → `⏱️ N min elapsed — cap at risk`。

**为什么 OpenAI 自己不会做这件事**：用量上限熔断与 OpenAI 的计费动机相悖（循环烧额度 = 已付费的消耗），且没有美国厂商会原生集成 微信/钉钉/飞书。这两点正是这个组合（DOM 状态 → 类型化信号 → CN-IM 推送 + 额度熔断）的结构性护城河。

<h2><img src="https://api.iconify.design/tabler:topology-star-3.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 架构</h2>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/atlas-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/atlas-light.svg">
  <img src="./assets/atlas-light.svg" width="880" alt="架构：ChatGPT tab → Detector · Dispatch → 飞书/钉钉/企业微信">
</picture>

核心抽象是 **AgentRunSignal** —— 一条对云 agent 标签页 DOM 状态的类型化观察，由 content-script 的检测器产生、被 background 的分发器消费。它不是新协议，而是“DOM 可观察的 agent 状态”与“IM 推送 + 额度熔断”之间的类型化事件缝。

```typescript
type AgentRunSignal =
  | { kind: "completed";     taskId: string; durationMin: number; summary: string }
  | { kind: "loop_suspected"; taskId: string; turnCount: number; idleMin: number; repeatedMsgHash?: string }
  | { kind: "cap_warning";    taskId: string; elapsedMin: number; thresholdMin: number }
```

三个逻辑组件，**一个进程**（浏览器），无后端：`content.ts`（MutationObserver → `detector.ts`）→ `background.ts`（service worker + `chrome.alarms` 熔断 + `webhook.ts` 分发）→ 飞书 / 钉钉 / 企业微信 bot。频道构造器（`feishu.ts` / `dingtalk.ts` / `wework.ts`）是纯函数，各平台内聚、接口窄；钉钉与飞书用 HMAC-SHA256 加签，企业微信群机器人用 webhook URL 内的 `key` 鉴权。

## 安装与快速开始

<h2><img src="https://api.iconify.design/tabler:rocket.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 安装与快速开始</h2>

```bash
git clone https://github.com/SuperMarioYL/agentbeacon && cd agentbeacon
npm install && npm run build        # 产出 dist/，可 load-unpacked
```

1. 打开 `chrome://extensions` → 开启 **开发者模式** → **加载已解压的扩展程序** → 选择 `dist/` 目录。
2. 点工具栏的 AgentBeacon 图标 → 粘贴一个 飞书 / 钉钉 / 企业微信 webhook URL → 勾选 **启用** → **保存** → **发送测试 ping**。IM 里收到测试消息即配置成功。
3. 打开 chatgpt.com 启动 Sol / Deep Research 任务，然后离开。完成时你会收到 IM 推送。

<details><summary>首次构建的示例输出</summary>

```
 ✓ 17 modules transformed.
 dist/manifest.json           1.30 kB
 dist/service-worker-loader.js  0.04 kB
 dist/assets/background.ts-BZT1wa6g.js   1.67 kB
 dist/assets/popup.html-Ir_kWul8.js      2.35 kB
 ✓ built in 37ms
 Test Files  8 passed (8)
      Tests  35 passed (35)
```

</details>

## 用法

<h2><img src="https://api.iconify.design/tabler:terminal-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 用法</h2>

### 三类信号

| 信号 | 触发条件 | IM 文案 |
|---|---|---|
| `completed` | streaming → idle 转换且存在最终 turn（“agent 完成了一轮”） | `✅ Agent completed (N min). <摘要>` |
| `loop_suspected` | 一条 ≥60 字的 assistant 消息在多轮间重复（越过轮数下限） | `⚠️ Loop suspected — cap at risk. Turns: N, idle M min · repeated msg <hash>` |
| `cap_warning` | 运行仍在进行且超过用量阈值（`chrome.alarms` 计时） | `⏱️ N min elapsed — cap at risk (threshold M min).` |

> 循环检测是 **best-effort** 且如此标注：从浏览器 DOM 无法看到服务端动作重复，故只能基于“同一条 substantial 消息跨轮重复”判定。长时静默不结束的运行由 **额度熔断** 兜底（按时间），不靠循环检测。

### 三个 IM 平台

```typescript
// 飞书：body 内带 timestamp(秒) + sign = base64(HMAC-SHA256(key=`ts\nsecret`, msg=""))
// 钉钉：URL 上带 timestamp(毫秒) + sign = base64(HMAC-SHA256(key=secret, msg=`ts\nsecret`))，URL 编码
// 企业微信：webhook URL 内 key 即凭证，无需额外加签
```

各频道构造器都是纯函数 + 可注入 fetch，详见 `src/lib/channels/`。完整 happy path 见 [`examples/quickstart.md`](./examples/quickstart.md)。

## Demo

<h2><img src="https://api.iconify.design/tabler:photo.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> Demo</h2>

![demo](assets/demo.gif)

终端侧的 happy path（`npm ci → npm test → npm run build`）。浏览器侧的“装好 → Sol 跑一轮 → 飞书 ping”流程见 [`BUILD_SETUP_NEXT_STEPS.md`](./BUILD_SETUP_NEXT_STEPS.md) 第 1–3 步。`docs/demo.tape` 是 vhs 脚本，`demo.yml` 工作流可按需重新渲染 gif。

## 配置

<h2><img src="https://api.iconify.design/tabler:adjustments.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 配置</h2>

配置存于 `chrome.storage.local`，键 `agentbeacon.config.v1`，由 popup 读写。默认值见 `src/lib/store.ts` 的 `DEFAULT_CONFIG`。

| 键 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `feishu` / `dingtalk` / `wework` | `{ webhookUrl, secret?, enabled }` | 空 / 关闭 | 各频道 webhook URL、加签 secret、启用开关 |
| `capThresholdMin` | number | `240` | 运行多少分钟后触发额度熔断提醒（分钟） |
| `loopThresholdMin` | number | `5` | 报告里的空闲分钟上下文（分钟） |
| `loopTurnDelta` | number | `3` | 标记循环前所需的最小总轮数（误报地板） |

## 路线图

<h2><img src="https://api.iconify.design/tabler:map-2.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> 路线图</h2>

- [x] **m1 — observe agent**：content-script MutationObserver 检测完成，分发至 飞书。
- [x] **m2 — route channels**：钉钉 + 企业微信 + popup 配置 + `chrome.alarms` 额度熔断。
- [x] **m3 — detect loop**：重复 substantial 消息启发式 + best-effort 标注 + demo + README。
- [ ] **v0.2 — 托管中继**：Cloudflare Worker + D1，浏览器关闭时仍按服务端计时推送 IM（~$5/月档，仅当 ≥10 个候补确认“浏览器关机过夜”痛点为真时才建）。
- [ ] **v0.2 — Chrome Web Store 上架**（当前仅 load-unpacked，避免审核阻塞发布）。
- [ ] **v0.3+**：Codex CLI 进程包裹、全球 IM（Slack/Discord/Telegram）、多用户/团队面板。

## License

<h2><img src="https://api.iconify.design/tabler:license.svg?color=%230071E3&width=24" height="22" align="absmiddle" alt=""> License</h2>

MIT — 见 [LICENSE](./LICENSE)。欢迎提 issue 或 PR。
