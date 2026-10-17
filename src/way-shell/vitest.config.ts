import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // Building the fixture modules with Vite takes a few seconds on a cold disk.
    testTimeout: 60_000,
  },
});
