// No Phaser import, so the pure art modules and their unit tests can use it.
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
