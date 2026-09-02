# Quickstart — load + first ping

```bash
npm install        # install dev deps
npm run build      # bundle the extension into dist/
# chrome://extensions → Developer mode → Load unpacked → select dist/
```

Then click the AgentBeacon toolbar icon, paste a 飞书/钉钉/企业微信 webhook
URL, enable the channel, and click **发送测试 ping**. The IM message you
receive looks like:

```
✅ Agent completed (0.1 min).
AgentBeacon 测试 ping — 收到说明配置正确。
```

Start a ChatGPT Sol / Deep Research run and walk away — you will get the same
ping on real completion, a `⚠️ Loop suspected` if a turn repeats, and a
`⏱️ N min elapsed — cap at risk` if the run crosses your threshold.
