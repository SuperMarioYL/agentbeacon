import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// No future version bump can land half-done: VERSION, manifest.json,
// package.json and (when the site exists) web/site.json must all agree.
// This is the portfolio's most-repeated post-ship defect class.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function norm(version: string): string {
  return version.trim().replace(/^v/, "");
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
}

describe("version lockstep", () => {
  const versionFile = norm(readFileSync(path.join(ROOT, "VERSION"), "utf-8"));

  it("manifest.json matches VERSION", () => {
    expect(norm(String(readJson("manifest.json").version))).toBe(versionFile);
  });

  it("package.json matches VERSION", () => {
    expect(norm(String(readJson("package.json").version))).toBe(versionFile);
  });

  it("web/site.json content_version matches VERSION when the site exists", () => {
    const sitePath = path.join(ROOT, "web", "site.json");
    if (!exists(sitePath)) return; // site.json lands with the website commit
    const site = readJson("web/site.json");
    const meta = site.meta as { content_version?: string } | undefined;
    expect(norm(String(meta?.content_version ?? ""))).toBe(versionFile);
  });
});

function exists(p: string): boolean {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}
