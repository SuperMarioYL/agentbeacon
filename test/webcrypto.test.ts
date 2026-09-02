import { describe, it, expect } from "vitest";
import { bytesToBase64, bytesToHex, hmacSha256 } from "../src/lib/webcrypto";

describe("webcrypto helpers", () => {
  it("bytesToHex encodes known bytes", () => {
    expect(bytesToHex(new Uint8Array([0, 255, 16, 17]))).toBe("00ff1011");
    expect(bytesToHex(new Uint8Array([]))).toBe("");
  });

  it("bytesToBase64 encodes with correct padding (canonical vectors)", () => {
    expect(bytesToBase64(new Uint8Array([0]))).toBe("AA==");
    expect(bytesToBase64(new Uint8Array([0, 0]))).toBe("AAA=");
    expect(bytesToBase64(new Uint8Array([65, 66, 67]))).toBe("QUJD");
    expect(bytesToBase64(new Uint8Array([77, 97, 110]))).toBe("TWFu");
  });

  it("hmacSha256 matches the DingTalk vector (key=secret, msg=`ts\\nsecret`)", async () => {
    const secret = "SECTEST";
    const ts = "1700000000000";
    const bytes = await hmacSha256(secret, `${ts}\n${secret}`);
    expect(bytesToHex(bytes)).toBe(
      "8b652b354c335ddde526da39dc0926dbe93ca088a44c06bc9cefcea83f81d228",
    );
    expect(bytesToBase64(bytes)).toBe(
      "i2UrNUwzXd3lJto53Akm2+k8oIikTAa8nO/OqD+B0ig=",
    );
  });

  it("hmacSha256 matches the Feishu vector (key=`ts\\nsecret`, empty msg)", async () => {
    const secret = "SECTEST";
    const ts = "1700000000";
    const bytes = await hmacSha256(`${ts}\n${secret}`, "");
    expect(bytesToHex(bytes)).toBe(
      "72c616af98062e9bb19148b330be3b792fc8414e6d983f568551605a66e10585",
    );
    expect(bytesToBase64(bytes)).toBe(
      "csYWr5gGLpuxkUizML47eS/IQU5tmD9WhVFgWmbhBYU=",
    );
  });
});
