import { describe, it, expect } from "vitest";
import { buildWeworkRequest } from "../src/lib/channels/wework";

const WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=ABC";

describe("buildWeworkRequest", () => {
  it("builds a text payload and leaves the URL (which carries the key) untouched", async () => {
    const req = await buildWeworkRequest("hello", WEBHOOK_URL, undefined, 1);
    expect(req.url).toBe(WEBHOOK_URL);
    expect(req.method).toBe("POST");
    expect(req.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(req.body);
    expect(body.msgtype).toBe("text");
    expect(body.text.content).toBe("hello");
  });
});
