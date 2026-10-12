import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Primer dialogs observe their scrollable body; jsdom has no layout observer.
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

// Primer's tooltip popover polyfill adopts sheets into document/shadow roots.
for (const prototype of [Document.prototype, ShadowRoot.prototype]) {
  Object.defineProperty(prototype, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] })
}

// Primer's theme provider queries the system color scheme.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }),
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
