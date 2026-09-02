import { describe, it, expect } from "vitest";
import { buildFeishuRequest } from "../src/lib/channels/feishu";

const WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/abc";

describe("buildFeishuRequest", () => {
  it("builds an unsigned text payload", async () => {
    const req = await buildFeishuRequest("hello", WEBHOOK_URL, undefined, 1700000000000);
    expect(req.url).toBe(WEBHOOK_URL);
    expect(req.method).toBe("POST");
    expect(req.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(req.body);
    expect(body.msg_type).toBe("text");
    expect(body.content.text).toBe("hello");
    expect(body.timestamp).toBeUndefined();
    expect(body.sign).toBeUndefined();
  });

  it("signs with timestamp (seconds) + base64 HMAC when a secret is set", async () => {
    const req = await buildFeishuRequest("hello", WEBHOOK_URL, "SECTEST", 1700000000000);
    const body = JSON.parse(req.body);
    expect(body.timestamp).toBe("1700000000");
    // Authoritative vector: base64(HMAC-SHA256(key=`ts\nsecret`, msg=""))
    expect(body.sign).toBe("csYWr5gGLpuxkUizML47eS/IQU5tmD9WhVFgWmbhBYU=");
  });
});
