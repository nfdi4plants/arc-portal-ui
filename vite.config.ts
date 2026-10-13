import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)

// The package's exports map hides the browser build from Node's resolver,
// so derive it from the resolved node entry (checked against v0.8.1).
const liveRegionEntry = join(dirname(require.resolve('@primer/live-region-element')), '..', '..', 'esm', 'index.js')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/arc-portal-ui/',
  test: {
    // Primer hides responsive action copies with CSS; tests must see the visible UI.
    css: true,
    server: { deps: { inline: ['@primer/react'] } },
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // The package's node build has no <live-region> element, which Primer's table pagination announces through.
    alias: {
      '@primer/live-region-element': liveRegionEntry,
    },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './src/test/setup.ts'],
    restoreMocks: true,
  },
})
