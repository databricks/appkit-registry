import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['registry/**/tests/*.test.mjs'],
    // AppKit's test kit manages process-wide service contexts and environment variables.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
