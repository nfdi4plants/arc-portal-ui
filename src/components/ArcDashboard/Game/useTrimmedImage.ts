import { useEffect, useState } from 'react'
import { visibleBounds } from '../../../game/model/image'

// The bounds are found on a copy no larger than this, so the scan stays cheap on large images.
const SCAN_SIZE = 256

// The mage image sits on a larger transparent canvas. This returns a URL of the same image cut to
// its visible pixels, so the illustration can be sized by what the player sees. It is null until
// the image has loaded.
export function useTrimmedImage(url: string): string | null {
  const [trimmed, setTrimmed] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const scale = Math.min(1, SCAN_SIZE / Math.max(image.naturalWidth, image.naturalHeight))
      const scan = document.createElement('canvas')
      scan.width = Math.max(1, Math.round(image.naturalWidth * scale))
      scan.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = scan.getContext('2d', { willReadFrequently: true })
      if (!context) return setTrimmed(url)
      context.drawImage(image, 0, 0, scan.width, scan.height)
      const { data, width, height } = context.getImageData(0, 0, scan.width, scan.height)
      const bounds = visibleBounds(data, width, height)
      if (!bounds) return setTrimmed(url)
      // One scan pixel of margin, mapped back to the full image, so no outline gets cut off.
      const left = Math.max(0, Math.floor((bounds.x - 1) / scale))
      const top = Math.max(0, Math.floor((bounds.y - 1) / scale))
      const right = Math.min(image.naturalWidth, Math.ceil((bounds.x + bounds.width + 1) / scale))
      const bottom = Math.min(image.naturalHeight, Math.ceil((bounds.y + bounds.height + 1) / scale))
      const cut = document.createElement('canvas')
      cut.width = right - left
      cut.height = bottom - top
      cut.getContext('2d')?.drawImage(image, left, top, cut.width, cut.height, 0, 0, cut.width, cut.height)
      setTrimmed(cut.toDataURL())
    }
    image.src = url
    return () => {
      cancelled = true
    }
  }, [url])
  return trimmed
}
