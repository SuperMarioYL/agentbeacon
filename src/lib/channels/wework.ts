import type { ChannelRequest } from "../../types";

// 企业微信 (WeCom) group robot webhook. The `key` query param in the webhook
// URL authenticates the bot; the basic group-robot API does not use a separate
// HMAC signature, so the secret field is intentionally unused here. Keeping it
// in the config shape lets a future enterprise-app signature slot in without a
// schema change.
export async function buildWeworkRequest(
  text: string,
  webhookUrl: string,
  _secret: string | undefined,
  _nowMs: number,
): Promise<ChannelRequest> {
  const payload = { msgtype: "text", text: { content: text } };
  return {
    url: webhookUrl,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}
