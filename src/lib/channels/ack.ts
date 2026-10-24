import type { ChannelName } from "../../types";

// Delivery-status parsing for the bot webhook responses. 飞书, 钉钉 and 企业微信
// all answer a *rejected* message with HTTP 200 and a non-zero code in the body
// (a bad signature, a rotated token, a rate limit), so the HTTP status alone
// cannot tell a delivered message from a rejected one. Each platform names that
// code — and the message that explains it — differently; these two tables are
// the single owner of that knowledge.

const ACK_CODE_KEY: Record<ChannelName, string> = {
  feishu: "code",
  dingtalk: "errcode",
  wework: "errcode",
};

const ACK_MESSAGE_KEY: Record<ChannelName, string> = {
  feishu: "msg",
  dingtalk: "errmsg",
  wework: "errmsg",
};

export interface ChannelAck {
  /** false only when the body reports a non-zero code for this platform. */
  ok: boolean;
  /** The platform's own explanation of a failure, when it sent one. */
  error?: string;
}

/** Parse a bot webhook response body. A body that is not JSON, or that omits
 *  the platform's code field, yields ok — the caller keeps the HTTP verdict
 *  rather than inventing a failure from a shape we do not recognise. */
export function parseChannelAck(channel: ChannelName, body: string): ChannelAck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: true };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: true };
  const rec = parsed as Record<string, unknown>;
  const code = rec[ACK_CODE_KEY[channel]];
  if (typeof code !== "number" || code === 0) return { ok: true };
  const message = rec[ACK_MESSAGE_KEY[channel]];
  return {
    ok: false,
    error: typeof message === "string" && message ? message : `code ${code}`,
  };
}
