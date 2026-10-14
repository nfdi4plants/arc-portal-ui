import type Phaser from 'phaser'
import mageUrl from '../assets/ARCMage.png'
import { MAGE_FRAME, MAGE_TEXTURE } from '../contracts/constants'
import { visibleBounds } from '../model/image'

const MAGE_SOURCE = `${MAGE_TEXTURE}:source`
// The mage is drawn 48 world units tall, at camera zoom up to about 3. 160 pixels stay sharp at
// that size and keep the texture small.
const MAGE_PIXEL_HEIGHT = 160

// Queues the image assets every scene may use. Call from preload().
export function preloadCoreAssets(scene: Phaser.Scene): void {
  if (scene.textures.exists(MAGE_TEXTURE) || scene.textures.exists(MAGE_SOURCE)) return
  scene.load.image(MAGE_SOURCE, mageUrl)
  scene.load.once(`filecomplete-image-${MAGE_SOURCE}`, () => addMageTexture(scene))
}

// The supplied image may sit anywhere on a large transparent canvas. This crops it to its
// visible pixels, scales it down to MAGE_PIXEL_HEIGHT and drops the full-size source, so a
// replaced image needs no manual editing and costs little GPU memory.
function addMageTexture(scene: Phaser.Scene): void {
  const image = scene.textures.get(MAGE_SOURCE).getSourceImage() as HTMLImageElement
  const scan = document.createElement('canvas')
  scan.width = image.width
  scan.height = image.height
  const scanContext = scan.getContext('2d', { willReadFrequently: true })
  if (!scanContext) return
  scanContext.drawImage(image, 0, 0)
  const { data, width: scanWidth, height: scanHeight } = scanContext.getImageData(0, 0, image.width, image.height)
  const bounds = visibleBounds(data, scanWidth, scanHeight)
  if (!bounds) return

  const scale = MAGE_PIXEL_HEIGHT / bounds.height
  const width = Math.max(1, Math.round(bounds.width * scale))
  const texture = scene.textures.createCanvas(MAGE_TEXTURE, width, MAGE_PIXEL_HEIGHT)
  if (!texture) return
  const context = texture.getContext()
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, width, MAGE_PIXEL_HEIGHT)
  texture.refresh()
  texture.add(MAGE_FRAME, 0, 0, 0, width, MAGE_PIXEL_HEIGHT)
  scene.textures.remove(MAGE_SOURCE)
}
