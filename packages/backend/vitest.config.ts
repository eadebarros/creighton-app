import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests hit a real remote Postgres (Railway's public proxy, not local) —
    // several sequential round trips per test easily exceed vitest's 5s default.
    testTimeout: 120_000,
    hookTimeout: 30_000,
    // All test files share ONE physical test schema with a blanket
    // truncate-all-tables beforeEach (test/setup.ts) — running files in
    // parallel would let one file's truncate wipe data another file's
    // in-flight transaction depends on. No ephemeral per-file DB is
    // available (see .env.test.example), so sequential is the safe choice.
    fileParallelism: false,
  },
});
