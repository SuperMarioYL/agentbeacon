import type { ChannelRequest } from "../../types";
import { bytesToBase64, hmacSha256 } from "../webcrypto";

// 飞书 (Feishu/Lark) custom bot webhook.
// When a signing secret is configured, the request body carries `timestamp`
// (seconds) and `sign = base64(HMAC-SHA256(key = `${ts}\n${secret}`, msg = ""))`.
export async function buildFeishuRequest(
  text: string,
  webhookUrl: string,
  secret: string | undefined,
  nowMs: number,
): Promise<ChannelRequest> {
  const payload: Record<string, unknown> = {
    msg_type: "text",
    content: { text },
  };
  if (secret) {
    const timestamp = Math.floor(nowMs / 1000).toString();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = bytesToBase64(await hmacSha256(stringToSign, ""));
    payload.timestamp = timestamp;
    payload.sign = sign;
  }
  return {
    url: webhookUrl,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}
