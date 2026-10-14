export interface PixelBounds {
  x: number
  y: number
  width: number
  height: number
}

// The smallest box around the pixels whose alpha is above the threshold, or null for an image
// with none. `data` is RGBA, as ImageData holds it.
export function visibleBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 8,
): PixelBounds | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= alphaThreshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
