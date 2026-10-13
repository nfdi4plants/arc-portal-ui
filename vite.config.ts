import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Primer hides responsive action copies with CSS; tests must see the visible UI.
    css: true,
    server: { deps: { inline: ['@primer/react'] } },
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // The package's node build has no <live-region> element, which Primer's table pagination announces through.
    alias: {
      '@primer/live-region-element': fileURLToPath(new URL('./node_modules/@primer/live-region-element/dist/esm/index.js', import.meta.url)),
    },
    // Primer's table and dialogs render slowly in jsdom when the whole suite runs in parallel.
    testTimeout: 15000,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './src/test/setup.ts'],
    restoreMocks: true,
  },
})
