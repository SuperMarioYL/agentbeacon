import { describe, it, expect } from "vitest";
import { parseChannelAck } from "../src/lib/channels/ack";

// Every one of these bot APIs answers a *rejected* delivery with HTTP 200 and a
// non-zero code in the body (wrong sign, expired token, rate limit), so the body
// — not the HTTP status — decides whether the message arrived.
describe("parseChannelAck", () => {
  it("accepts the zero code each platform uses for a delivered message", () => {
    expect(parseChannelAck("feishu", '{"code":0,"msg":"success"}').ok).toBe(true);
    expect(parseChannelAck("dingtalk", '{"errcode":0,"errmsg":"ok"}').ok).toBe(true);
    expect(parseChannelAck("wework", '{"errcode":0,"errmsg":"ok"}').ok).toBe(true);
  });

  it("rejects a non-zero code and carries the platform's own message", () => {
    const dingtalk = parseChannelAck(
      "dingtalk",
      '{"errcode":310000,"errmsg":"sign not match"}',
    );
    expect(dingtalk.ok).toBe(false);
    expect(dingtalk.error).toBe("sign not match");

    const feishu = parseChannelAck("feishu", '{"code":9499,"msg":"Bad Request"}');
    expect(feishu.ok).toBe(false);
    expect(feishu.error).toBe("Bad Request");

    const wework = parseChannelAck(
      "wework",
      '{"errcode":93000,"errmsg":"invalid webhook url"}',
    );
    expect(wework.ok).toBe(false);
    expect(wework.error).toBe("invalid webhook url");
  });

  it("falls back to the code when the platform sends no message", () => {
    const ack = parseChannelAck("dingtalk", '{"errcode":310000}');
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe("code 310000");
  });

  it("does not invent a failure from a body it cannot read", () => {
    // an unparseable or unrecognised body leaves the HTTP verdict to the caller
    expect(parseChannelAck("feishu", "not json").ok).toBe(true);
    expect(parseChannelAck("feishu", "[]").ok).toBe(true);
    expect(parseChannelAck("feishu", '{"msg":"success"}').ok).toBe(true);
  });
});
