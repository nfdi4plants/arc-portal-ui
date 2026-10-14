export interface Box {
  x: number
  y: number
  w: number
  h: number
}

// Top left corner for a panel of w by h next to the anchor, inside the view. It prefers the right
// side, then the left, then below, then above, so the anchor stays uncovered when any side has
// room. Without room anywhere it takes the roomier vertical side and overlaps.
export function placePanel(anchor: Box, w: number, h: number, view: { width: number; height: number }, margin: number, gap: number): { x: number; y: number } {
  const clamp = (value: number, size: number, limit: number) => Math.max(margin, Math.min(value, limit - size - margin))
  const sideY = clamp(anchor.y + anchor.h / 2 - h / 2, h, view.height)
  const right = anchor.x + anchor.w + gap
  if (right + w <= view.width - margin) return { x: right, y: sideY }
  const left = anchor.x - gap - w
  if (left >= margin) return { x: left, y: sideY }
  const centerX = clamp(anchor.x + anchor.w / 2 - w / 2, w, view.width)
  const below = anchor.y + anchor.h + gap
  if (below + h <= view.height - margin) return { x: centerX, y: below }
  const above = anchor.y - gap - h
  if (above >= margin) return { x: centerX, y: above }
  const roomAbove = anchor.y
  const roomBelow = view.height - anchor.y - anchor.h
  return { x: centerX, y: roomAbove > roomBelow ? margin : view.height - h - margin }
}
