import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import crateJson from '../../../public/sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json?raw'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import type { ArcSource } from '../../arc/types'
import { Investigation } from './Investigation'

const sampleSource: ArcSource = {
  key: 'storybook:facultative-cam-in-talinum',
  label: 'Facultative CAM in Talinum',
  fetchROCrate: () => Promise.resolve(crateJson),
}

function SampleInvestigation() {
  const [store] = useState(() => createArcStore(sampleSource))

  useEffect(() => {
    void store.load()
    return () => store.dispose()
  }, [store])

  return (
    <ArcProvider store={store}>
      <Investigation />
    </ArcProvider>
  )
}

const meta = {
  title: 'Investigation/Investigation',
  component: SampleInvestigation,
  parameters: {
    docs: {
      description: {
        component: 'Investigation metadata read from the bundled Talinum ARC with ARCtrl.',
      },
    },
  },
} satisfies Meta<typeof SampleInvestigation>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {}
