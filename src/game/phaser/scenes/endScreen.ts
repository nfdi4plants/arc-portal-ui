import type Phaser from 'phaser'
import type { RunContext } from './context'
import { addButton, onCanvasKey } from './ui'

const CHOICES = [
  { choice: 'retry', label: 'Retry (R)', code: 'KeyR' },
  { choice: 'newPath', label: 'New path (N)', code: 'KeyN' },
  { choice: 'menu', label: 'Menu (M)', code: 'KeyM' },
] as const

const BUTTON_W = 96
const BUTTON_H = 22
const GAP = 8

// Retry, New path and Menu, by click or by key. Returns a function that places the row centred
// on (x, y).
export function addEndButtons(scene: Phaser.Scene, ctx: RunContext): (x: number, y: number) => void {
  let chosen = false
  const pick = (choice: (typeof CHOICES)[number]['choice']) => {
    if (chosen) return
    chosen = true
    ctx.requestMenu(choice)
  }
  const buttons = CHOICES.map(({ choice, label }) => addButton(scene, label, BUTTON_W, BUTTON_H, () => pick(choice)))
  onCanvasKey(scene, (code) => {
    const match = CHOICES.find((entry) => entry.code === code)
    if (match) pick(match.choice)
  })
  return (x, y) => {
    const left = x - (CHOICES.length * BUTTON_W + (CHOICES.length - 1) * GAP) / 2 + BUTTON_W / 2
    buttons.forEach((button, i) => button.setPosition(left + i * (BUTTON_W + GAP), y))
  }
}
