// Text for the speech bubbles of chatter mobs.

export const CHATTER_CYCLE_MS = 2000
// The bubble pops out for the rest of each cycle, so a single line still reads as speech.
const VISIBLE_MS = 1600
const MAX_LINE = 16
const MAX_LINES = 3

// The annotation's value with its unit, or its name when the value is empty.
export function chatterText(name: string, value: string | null, unit: string | null): string {
  const text = [value?.trim(), unit?.trim()].filter(Boolean).join(' ')
  return text === '' ? name : text
}

// Greedy word wrap into bubble-sized lines. Text beyond MAX_LINES ends in an ellipsis.
export function chunkText(text: string): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const piece = word.length > MAX_LINE ? `${word.slice(0, MAX_LINE - 1)}…` : word
    if (line !== '' && line.length + 1 + piece.length > MAX_LINE) {
      lines.push(line)
      line = piece
    } else {
      line = line === '' ? piece : `${line} ${piece}`
    }
  }
  if (line !== '') lines.push(line)
  if (lines.length > MAX_LINES) {
    lines.length = MAX_LINES
    lines[MAX_LINES - 1] = `${lines[MAX_LINES - 1].slice(0, MAX_LINE - 1)}…`
  }
  return lines.length > 0 ? lines : [text]
}

// Which line is showing and whether the bubble is up, `elapsedMs` after the mob started talking.
export function bubbleAt(elapsedMs: number, lines: number): { index: number; visible: boolean } {
  const cycle = Math.floor(elapsedMs / CHATTER_CYCLE_MS)
  return { index: cycle % lines, visible: elapsedMs % CHATTER_CYCLE_MS < VISIBLE_MS }
}
