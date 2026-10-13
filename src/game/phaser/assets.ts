import type Phaser from 'phaser'
import mageUrl from '../assets/ARCMage.png'
import { MAGE_FRAME, MAGE_TEXTURE } from '../contracts/constants'

// Queues the image assets every scene may use. Call from preload().
export function preloadCoreAssets(scene: Phaser.Scene): void {
  if (scene.textures.exists(MAGE_TEXTURE)) return
  scene.load.image(MAGE_TEXTURE, mageUrl)
  scene.load.once(`filecomplete-image-${MAGE_TEXTURE}`, () => addTrimmedFrame(scene, MAGE_TEXTURE, MAGE_FRAME))
}

// The mage image may sit anywhere on a larger transparent canvas. This adds a frame that covers
// only its visible pixels, so a replaced image needs no manual cropping.
function addTrimmedFrame(scene: Phaser.Scene, textureKey: string, frameName: string): void {
  const texture = scene.textures.get(textureKey)
  const image = texture.getSourceImage() as HTMLImageElement
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, image.width, image.height)

  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] <= 8) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return
  texture.add(frameName, 0, minX, minY, maxX - minX + 1, maxY - minY + 1)
}
