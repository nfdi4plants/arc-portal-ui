import Phaser from 'phaser'
import type { CreateGame } from '../contracts/events'
import { baseGameConfig } from './config'
import { createGameHandle, createLoopPause } from './gameHandle'
import { BootScene } from './scenes/BootScene'
import { BossScene } from './scenes/BossScene'
import { RunContext } from './scenes/context'
import { DeathScene } from './scenes/DeathScene'
import { FinalBossScene } from './scenes/FinalBossScene'
import { HudScene } from './scenes/HudScene'
import { LevelUpScene } from './scenes/LevelUpScene'
import { StretchScene } from './scenes/StretchScene'
import { VictoryScene } from './scenes/VictoryScene'

// Phaser 4.2.1 never calls WEBGL_lose_context, and every Start run from the menu creates a new game.
// Without this the destroyed games keep their GL contexts until the browser reclaims them.
function releaseWebGlContext(game: Phaser.Game): void {
  const renderer = game.renderer
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return
  try {
    renderer.gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    // The context is already gone, so there is nothing left to release.
  }
}

export const createGame: CreateGame = (parent, { bindings }) => {
  const ctx = new RunContext(bindings, (event) => control.emit(event))
  // The dashlet wants the keys right away, without a click on the canvas first.
  const focus = () => game.canvas?.focus()
  // Scene order is draw order: the HUD and the overlays come after the gameplay scenes.
  const scenes = [
    new BootScene(() => {
      control.ready()
      focus()
    }),
    new StretchScene(ctx),
    new BossScene(ctx),
    new FinalBossScene(ctx),
    new HudScene(ctx),
    new LevelUpScene(ctx),
    new DeathScene(ctx),
    new VictoryScene(ctx),
  ]
  const game = new Phaser.Game(baseGameConfig(parent, scenes))
  ctx.attach(game)
  const loopPause = createLoopPause(game)
  const control = createGameHandle({
    command(command) {
      switch (command.type) {
        case 'start':
          ctx.startRun(command.plan)
          focus()
          break
        case 'pause':
          ctx.setExternalPause(command.paused)
          loopPause.setPaused(command.paused)
          break
        case 'setBindings':
          ctx.setBindings(command.bindings)
          break
        case 'quitToMenu':
          ctx.quitToMenu()
          break
      }
    },
    resize: (width, height) => {
      game.scale.resize(Math.max(1, width), Math.max(1, height))
      loopPause.drawOnce()
    },
    focus,
    destroy: () => {
      loopPause.setPaused(false)
      releaseWebGlContext(game)
      game.destroy(true)
    },
  })
  return control.handle
}
