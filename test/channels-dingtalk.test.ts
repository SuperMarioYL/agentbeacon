import { describe, it, expect } from "vitest";
import { buildDingtalkRequest } from "../src/lib/channels/dingtalk";

const WEBHOOK_URL = "https://oapi.dingtalk.com/robot/send?access_token=X";

describe("buildDingtalkRequest", () => {
  it("builds an unsigned text payload (no secret -> URL untouched)", async () => {
    const req = await buildDingtalkRequest("hello", WEBHOOK_URL, undefined, 1700000000000);
    expect(req.url).toBe(WEBHOOK_URL);
    expect(req.method).toBe("POST");
    expect(req.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(req.body);
    expect(body.msgtype).toBe("text");
    expect(body.text.content).toBe("hello");
  });

  it("appends timestamp (ms) + sign to the URL when a secret is set", async () => {
    const req = await buildDingtalkRequest("hello", WEBHOOK_URL, "SECTEST", 1700000000000);
    const u = new URL(req.url);
    expect(u.searchParams.get("access_token")).toBe("X");
    expect(u.searchParams.get("timestamp")).toBe("1700000000000");
    // Authoritative vector: base64(HMAC-SHA256(key=secret, msg=`ts\nsecret`))
    expect(u.searchParams.get("sign")).toBe(
      "i2UrNUwzXd3lJto53Akm2+k8oIikTAa8nO/OqD+B0ig=",
    );
  });
});
