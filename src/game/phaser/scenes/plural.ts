// Apart from ui.ts, which imports Phaser, so unit tests can reach it.
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
