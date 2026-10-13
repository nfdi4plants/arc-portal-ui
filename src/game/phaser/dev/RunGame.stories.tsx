import { ARC } from '@nfdi4plants/arctrl'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef } from 'react'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import { talinumArcJson } from '../../../storybook/fixtures/talinumArc'
import { loadBindings } from '../../model/input'
import { planRun } from '../../model/run'
import { createGame } from '../createGame'

const arc = ARC.fromROCrateJsonString(talinumArcJson)
const index = buildProvenanceIndex(arc)

// Boots the real game in a full-size box and starts a run on the Talinum ARC.
function FullRun({ seed }: { seed: string }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    const handle = createGame(parent, { bindings: loadBindings() })
    const start = (runSeed: string) => {
      const plan = planRun(index, 'Talinum', runSeed)
      if (plan) handle.send({ type: 'start', plan })
    }
    start(seed)
    // Retry and New path work here too. Menu has no menu to return to in this story.
    const stop = handle.on((event) => {
      if (event.type !== 'menuRequested') return
      if (event.choice === 'retry') start(seed)
      if (event.choice === 'newPath') start(`${seed}-${Date.now()}`)
    })
    const resizing = new ResizeObserver(() => handle.resize(parent.clientWidth, parent.clientHeight))
    resizing.observe(parent)
    return () => {
      resizing.disconnect()
      stop()
      handle.destroy()
    }
  }, [seed])

  return <div ref={host} style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }} />
}

const meta = {
  title: 'Game/Dev/FullRun',
  component: FullRun,
  args: { seed: 'storybook' },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A whole run on the Talinum ARC, from the first stretch to the final boss. Click the canvas if it has no keyboard focus.',
      },
    },
  },
} satisfies Meta<typeof FullRun>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
