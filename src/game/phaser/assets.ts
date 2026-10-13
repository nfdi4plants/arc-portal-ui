import type Phaser from 'phaser'
import mageUrl from '../assets/ARCMage.png'
import { MAGE_TEXTURE } from '../contracts/constants'

// Queues the image assets every scene may use. Call from preload().
export function preloadCoreAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MAGE_TEXTURE)) scene.load.image(MAGE_TEXTURE, mageUrl)
}
