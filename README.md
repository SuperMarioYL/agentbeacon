[English](README.en.md) | **简体中文**

<picture>
  <source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="assets/presentation/hero-mobile-dark.svg">
  <source media="(max-width: 640px)" srcset="assets/presentation/hero-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="assets/presentation/hero-dark.svg">
  <img src="assets/presentation/hero-light.svg" width="1000" alt="观察 ChatGPT 标签页的完成与重复消息信号，通过已配置的 IM webhook 发出提醒。">
</picture>

**观察 ChatGPT 标签页的完成与重复消息信号，通过已配置的 IM webhook 发出提醒。**

`v0.1.0` · `Node.js 22+; Bun for demo` · [MIT](LICENSE)

[Website](https://agentbeacon.lei6393.com) · [Demo record](docs/demo-results.json)

## 为什么使用

长任务运行时，反复打开标签页只为看看是否结束很打断工作。AgentBeacon 在浏览器侧观察状态变化，把一次完成、可疑重复和运行超时转换成可路由的事件。提醒仍需要启用的浏览器扩展和有效 webhook。

## 架构

<picture>
  <source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="assets/presentation/architecture-mobile-dark.svg">
  <source media="(max-width: 640px)" srcset="assets/presentation/architecture-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="assets/presentation/architecture-dark.svg">
  <img src="assets/presentation/architecture-light.svg" width="1000" alt="content.ts 通过 MutationObserver 采样页面，detector.ts 的状态机产生 AgentRunSignal；background.ts 管理 chrome.alarms 与分发。频道模块构造飞书、钉钉、企业微信请求，配置保存在 chrome.storage.local。">
</picture>

content.ts 通过 MutationObserver 采样页面，detector.ts 的状态机产生 AgentRunSignal；background.ts 管理 chrome.alarms 与分发。频道模块构造飞书、钉钉、企业微信请求，配置保存在 chrome.storage.local。

核心分类器见 [detector.ts](src/lib/detector.ts)，默认配置见 [store.ts](src/lib/store.ts)。completed 表示观察到一轮从 streaming 转为 idle，不等于后台任务已全面成功。

## 安装

扩展构建需要 Node.js 22+；下面的离线 TypeScript 示例使用 Bun。构建后可在 chrome://extensions 加载 dist/，这一步由使用者手动完成。

```bash
git clone https://github.com/SuperMarioYL/agentbeacon.git
cd agentbeacon
npm ci
npm run build
```

## 快速开始

演示直接运行真实 Detector，输入固定的合成状态快照，分别得到 completed 和 loop_suspected。没有读取真实 ChatGPT 页面、发送 IM 或测试账户额度。

```bash
bun examples/presentation_demo.ts completed
bun examples/presentation_demo.ts loop
```

完整快照和状态推进在 [examples/presentation_demo.ts](examples/presentation_demo.ts) 中。

## 使用

扩展加载后，在 popup 填写 webhook URL、可选 secret 与启用开关。完成提醒每个 Detector 生命周期只发送一次；循环提醒要求至少达到轮数下限，且长度不少于 60 字符的消息重复出现。请用你自己的浏览器和测试频道验证当前 DOM 适配。

## 实际 Demo

<picture>
  <source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="assets/presentation/process-mobile-dark.svg">
  <source media="(max-width: 640px)" srcset="assets/presentation/process-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="assets/presentation/process-dark.svg">
  <img src="assets/presentation/process-light.svg" width="1000" alt="演示直接运行真实 Detector，输入固定的合成状态快照，分别得到 completed 和 loop_suspected。没有读取真实 ChatGPT 页面、发送 IM 或测试账户额度。">
</picture>

### 完成转换

固定一分钟的状态变化产生 completed。

```text
$ bun examples/presentation_demo.ts completed
[
  {
    "kind": "completed",
    "taskId": "demo-task",
    "durationMin": 1,
    "summary": "The example is complete."
  }
]
```

### 重复消息

三轮中重复长消息产生 loop_suspected。

```text
$ bun examples/presentation_demo.ts loop
[
  {
    "kind": "loop_suspected",
    "taskId": "demo-task",
    "turnCount": 3,
    "idleMin": 0,
    "repeatedMsgHash": "c4b2ce0"
  }
]
```

## 能力与接入

<picture>
  <source media="(max-width: 640px) and (prefers-color-scheme: dark)" srcset="assets/presentation/integrations-mobile-dark.svg">
  <source media="(max-width: 640px)" srcset="assets/presentation/integrations-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="assets/presentation/integrations-dark.svg">
  <img src="assets/presentation/integrations-light.svg" width="1000" alt="观察与分类在浏览器本地进行，通知通过用户配置的 webhook 发送。纯逻辑演示只覆盖分类器，频道送达属于另一项需要真实配置的验证。">
</picture>

观察与分类在浏览器本地进行，通知通过用户配置的 webhook 发送。纯逻辑演示只覆盖分类器，频道送达属于另一项需要真实配置的验证。



## 配置

默认 capThresholdMin=240、loopTurnDelta=3、loopThresholdMin=5，频道均关闭。配置键为 agentbeacon.config.v1。cap_warning 是按运行时间触发的提醒，不读取真实用量，也不停止服务端任务或执行额度熔断。

## 路线图与范围

已实现 MV3 扩展、三类信号、三个 webhook 频道与本地配置。托管中继、商店分发、进程级集成与团队功能仍为后续方向，没有浏览器关闭后继续运行的服务器。

- DOM 选择器依赖页面结构，未在本次离线演示中验证当前线上页面。
- 重复文本只是启发式信号，不证明服务端动作陷入循环。
- 不读取实际用量，也不执行硬额度限制。

[Terminal recording](assets/demo.gif) · [Recording script](docs/demo.tape)

## 许可证

[MIT](LICENSE)
