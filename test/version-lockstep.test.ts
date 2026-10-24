import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// No future version bump can land half-done: VERSION, manifest.json,
// package.json and (when the site exists) web/site.json must all agree — and so
// must the surfaces a *user* reads: the README badges, the site footer tag and
// the recorded demo. The v0.2.0 bump updated only the first four and left the
// README badges, the live footer and the demo record on the previous version,
// which is the portfolio's most-repeated post-ship defect class.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function norm(version: string): string {
  return version.trim().replace(/^v/, "");
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
}

function readText(rel: string): string | undefined {
  try {
    return readFileSync(path.join(ROOT, rel), "utf-8");
  } catch {
    return undefined;
  }
}

function exists(p: string): boolean {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
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

  it("README version badges match VERSION", () => {
    for (const rel of ["README.md", "README.en.md"]) {
      const text = readText(rel);
      if (text === undefined) continue;
      const badges = [...text.matchAll(/`v(\d+\.\d+\.\d+)`/g)].map((m) => m[1]);
      expect(badges.length, `${rel} carries no \`vX.Y.Z\` badge`).toBeGreaterThan(0);
      expect(badges).toEqual(badges.map(() => versionFile));
    }
  });

  it("web/site.json footer tag matches VERSION when the site exists", () => {
    const sitePath = path.join(ROOT, "web", "site.json");
    if (!exists(sitePath)) return;
    const site = readJson("web/site.json");
    const footer = site.footer as { tag?: string } | undefined;
    expect(String(footer?.tag ?? "").startsWith(`${versionFile} ·`)).toBe(true);
  });

  it("docs/demo-results.json version matches VERSION when the record exists", () => {
    const recordPath = path.join(ROOT, "docs", "demo-results.json");
    if (!exists(recordPath)) return;
    expect(norm(String(readJson("docs/demo-results.json").version))).toBe(versionFile);
  });
});
