import { afterAll, beforeAll } from 'vitest'

// jsdom has no native dialog/top-layer layout. Browser checks cover actual placement.
const methods = ['showModal', 'show', 'close', 'showPopover', 'hidePopover'] as const
const originals = methods.map(method => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method))
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; this.querySelector('button')?.focus() } },
    show: { configurable: true, value() { this.open = true } },
    close: { configurable: true, value() { this.open = false } },
    showPopover: { configurable: true, value() {} },
    hidePopover: { configurable: true, value() {} },
  })
})
afterAll(() => {
  methods.forEach((method, index) => {
    const original = originals[index]
    if (original) Object.defineProperty(HTMLDialogElement.prototype, method, original)
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[method]
  })
})
