import type Phaser from 'phaser'
import { useEffect, useRef } from 'react'
import { bootSandbox } from './bootSandbox'

// Storybook host for a development scene. The canvas fills the preview, so the viewport toolbar
// shows how a scene behaves per device. Click the canvas to give it keyboard focus.
export function SandboxStory({ scenes }: { scenes: Phaser.Types.Scenes.SceneType[] }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    return bootSandbox(parent, scenes)
  }, [scenes])

  return <div ref={host} tabIndex={0} style={{ width: '100vw', height: '100dvh', overflow: 'hidden', outline: 'none' }} />
}
