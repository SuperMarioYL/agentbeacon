import { defineConfig } from "vitest/config";

// Tests target the pure logic (detector, channel signing, store, run registry,
// dispatch). They never touch the `chrome` global or the network — `chrome` is
// injected via seams and `fetch` is replaceable per-test.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: true,
    reporters: ["default"],
    pool: "forks",
  },
});
