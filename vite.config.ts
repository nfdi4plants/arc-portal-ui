import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Primer hides responsive action copies with CSS; tests must see the visible UI.
    css: true,
    server: { deps: { inline: ['@primer/react'] } },
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './src/test/setup.ts'],
    restoreMocks: true,
  },
})
