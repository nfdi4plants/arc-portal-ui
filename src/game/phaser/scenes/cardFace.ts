import Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { Action, Bindings } from '../../contracts/input'
import type { PlayerBuild, PowerUpCard } from '../../contracts/progression'
import { bindingLabel } from '../../model/input'
import { cardDetails } from '../../model/progression'
import { applySpriteRef, CARD_HEIGHT, CARD_WIDTH, cardArt, RARITY_COLOR } from '../art'
import { addText } from './ui'

// The paper card of the level-up screen and the FAIR trade store: the card art, its name, its
// description, the rarity line and the key number, in one container. And the detail note that
// opens over a hovered card.

export function fitText(text: Phaser.GameObjects.Text, content: string, width: number, height: number, maxSize: number, minSize: number): void {
  text.setWordWrapWidth(width).setText(content)
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    text.setFontSize(size)
    if (text.height <= height) return
  }
  const words = content.split(' ')
  while (words.length > 1 && text.height > height) {
    words.pop()
    text.setText(`${words.join(' ')}...`)
  }
}

export interface CardFace {
  box: Phaser.GameObjects.Container
  // Every text on the card, turned back upright when the card tilts.
  texts: Phaser.GameObjects.Text[]
  glow: Phaser.GameObjects.Image
  art: Phaser.GameObjects.Sprite
  name: Phaser.GameObjects.Text
  description: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  key: Phaser.GameObjects.Text
  // Skips the text fitting when neither the card nor its size changed.
  fitKey: string
}

// `extras` go on top of the card, in the same container. Their texts are added to `texts`.
export function createCardFace(scene: Phaser.Scene, glowKey: string, keyLabel: string, extras: Phaser.GameObjects.GameObject[] = []): CardFace {
  const glow = scene.add.image(0, 0, glowKey).setTint(PALETTE.yellow).setVisible(false)
  const art = scene.add.sprite(0, 0, '__DEFAULT')
  const name = addText(scene, '', 8.5, { color: PALETTE.navy, bold: true, align: 'center' }).setOrigin(0.5)
  const description = addText(scene, '', 7, { color: PALETTE.outline, align: 'center' }).setOrigin(0.5, 0)
  const meta = addText(scene, '', 5.8, { color: PALETTE.navy, align: 'center' }).setOrigin(0.5)
  const key = addText(scene, keyLabel, 7.5, { color: PALETTE.navy, bold: true }).setOrigin(0.5)
  const box = scene.add.container(0, 0, [glow, art, name, description, meta, key, ...extras]).setVisible(false)
  const texts = [name, description, meta, key, ...extras.filter((part): part is Phaser.GameObjects.Text => part instanceof Phaser.GameObjects.Text)]
  return { box, texts, glow, art, name, description, meta, key, fitKey: '' }
}

// Puts a card on the face. `progress` offsets the boiling, so cards side by side do not boil alike.
export function showCardOn(scene: Phaser.Scene, face: CardFace, card: PowerUpCard, progress: number): void {
  applySpriteRef(face.art, cardArt(scene, card.rarity, card.kind))
  face.art.setOrigin(0.5)
  face.art.anims.setProgress(progress)
  face.fitKey = ''
  face.meta.setText(card.slot ? `${card.rarity} · ${card.slot}` : card.rarity)
  face.glow.setVisible(card.rarity === 'legendary')
}

// Sizes the face to a card `w` units wide. Returns the scale from card art units, or 0 when nothing
// changed since the last call.
export function sizeCardFace(face: CardFace, card: PowerUpCard, w: number): number {
  const h = (w * CARD_HEIGHT) / CARD_WIDTH
  const s = w / CARD_WIDTH
  const local = (x: number, y: number): [number, number] => [(x - CARD_WIDTH / 2) * s, (y - CARD_HEIGHT / 2) * s]
  face.art.setDisplaySize(w, h)
  face.glow.setDisplaySize(w * 1.7, h * 1.5)
  face.name.setPosition(...local(50, 16.5))
  face.description.setPosition(...local(50, 67))
  face.meta.setPosition(...local(50, 126))
  face.key.setPosition(...local(14, 126))
  const fitKey = `${card.id}:${Math.round(w * 4)}`
  if (face.fitKey === fitKey) return 0
  face.fitKey = fitKey
  fitText(face.name, card.name, 84 * s, 22 * s, 8.5 * s, 5.5 * s)
  fitText(face.description, card.description, 82 * s, 46 * s, 7 * s, 4.8 * s)
  face.meta.setFontSize(5.8 * s)
  face.key.setFontSize(7.5 * s)
  return s
}

// Where a detail note may go: centred over anchorX, inside [left, right], from top down to bottom.
export interface NoteArea {
  anchorX: number
  width: number
  left: number
  right: number
  top: number
  bottom: number
}

// The detail note of a card, built by cardDetails. Drawn when it opens and when the view changes,
// never per frame.
export class CardNote {
  private readonly panel: Phaser.GameObjects.Graphics
  private readonly title: Phaser.GameObjects.Text
  private readonly body: Phaser.GameObjects.Text
  private readonly flavor: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setVisible(false)
    this.title = addText(scene, '', 9, { color: PALETTE.navy, bold: true }).setVisible(false)
    this.body = addText(scene, '', 7.5, { color: PALETTE.navy }).setVisible(false)
    this.flavor = addText(scene, '', 7, { color: PALETTE.outline }).setFontStyle('italic').setVisible(false)
  }

  show(card: PowerUpCard, build: PlayerBuild, bindings: Bindings, area: NoteArea): void {
    const lines = cardDetails(build, card.id, (slot) => {
      const binding = bindings[`ability${slot + 1}` as Action][0]
      return binding ? bindingLabel(binding) : `slot ${slot + 1}`
    })
    const flavor = lines.pop() ?? ''
    const panelW = area.width
    const pad = 6
    const inner = panelW - pad * 2
    const x = Phaser.Math.Clamp(area.anchorX - panelW / 2, area.left, area.right - panelW)
    const room = area.bottom - area.top - pad * 2
    this.title.setText(card.name).setWordWrapWidth(inner)
    const body = lines.join('\n')
    for (let size = 7.5; size >= 5.5; size -= 0.5) {
      this.body.setWordWrapWidth(inner).setFontSize(size).setText(body)
      this.flavor.setWordWrapWidth(inner).setFontSize(size - 0.5).setText(flavor)
      if (this.title.height + 2 + this.body.height + 3 + this.flavor.height <= room) break
    }
    const height = pad * 2 + this.title.height + 2 + this.body.height + 3 + this.flavor.height
    const y = Math.min(area.top, area.bottom - height)
    this.title.setPosition(x + pad, y + pad)
    this.body.setPosition(x + pad, this.title.y + this.title.height + 2)
    this.flavor.setPosition(x + pad, this.body.y + this.body.height + 3)
    this.draw(x, y, panelW, height, RARITY_COLOR[card.rarity])
    this.setVisible(true)
  }

  hide(): void {
    this.setVisible(false)
  }

  private setVisible(visible: boolean): void {
    for (const part of [this.panel, this.title, this.body, this.flavor]) part.setVisible(visible)
  }

  // A paper note with a hand-drawn double outline.
  private draw(x: number, y: number, w: number, h: number, color: number): void {
    const g = this.panel
    g.clear().fillStyle(0xfffdf6, 1).fillRect(x, y, w, h).fillStyle(color, 1).fillRect(x, y, w, 3)
    const jitter = () => (Math.random() - 0.5) * 1.6
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass === 0 ? 1.4 : 0.8, PALETTE.outline, pass === 0 ? 1 : 0.6)
      const corners = [x, y, x + w, y, x + w, y + h, x, y + h]
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4
        g.lineBetween(corners[k * 2] + jitter(), corners[k * 2 + 1] + jitter(), corners[next * 2] + jitter(), corners[next * 2 + 1] + jitter())
      }
    }
  }
}
