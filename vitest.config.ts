import { defineConfig } from 'vitest/config'

// Tests are pure logic (engine, reducer, delta parsing) — no DOM/JSX needed,
// so this config carries no plugins and avoids vite version-type friction.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
