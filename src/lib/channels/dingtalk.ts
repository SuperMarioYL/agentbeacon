import type { ChannelRequest } from "../../types";
import { bytesToBase64, hmacSha256 } from "../webcrypto";

// 钉钉 (DingTalk) custom robot webhook.
// When a secret is configured, `timestamp` (ms) + `sign` are appended to the
// URL as query params: sign = base64(HMAC-SHA256(key = secret, msg = `${ts}\n${secret}`)),
// then URL-percent-encoded.
export async function buildDingtalkRequest(
  text: string,
  webhookUrl: string,
  secret: string | undefined,
  nowMs: number,
): Promise<ChannelRequest> {
  const payload = { msgtype: "text", text: { content: text } };
  let url = webhookUrl;
  if (secret) {
    const timestamp = nowMs.toString();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = bytesToBase64(await hmacSha256(secret, stringToSign));
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}timestamp=${encodeURIComponent(timestamp)}&sign=${encodeURIComponent(sign)}`;
  }
  return {
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}
