import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Primer hides responsive action copies with CSS; tests must see the visible UI.
    css: true,
    include: ['src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: ['@primer/react'] } },
    restoreMocks: true,
  },
})
