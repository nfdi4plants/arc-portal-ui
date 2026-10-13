import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import crateJson from '../../../../../public/sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json?raw'
import { ArcProvider } from '../../../../arc/ArcProvider'
import { createArcStore } from '../../../../arc/arcStore'
import type { ArcSource } from '../../../../arc/types'
import { referenceGitLab } from '../../../../config/gitlab'
import { InvestigationDetails, type InvestigationDetailsProps } from './InvestigationDetails'

const sampleSource: ArcSource = {
  key: 'storybook:facultative-cam-in-talinum',
  label: 'Facultative CAM in Talinum',
  fetchROCrate: () => Promise.resolve(crateJson),
}

function SampleInvestigationDetails(props: InvestigationDetailsProps) {
  const [store] = useState(() => createArcStore(sampleSource))

  useEffect(() => {
    void store.load()
    return () => store.dispose()
  }, [store])

  return (
    <ArcProvider store={store}>
      <InvestigationDetails {...props} />
    </ArcProvider>
  )
}

const meta = {
  title: 'Dashboard/Investigation Details',
  component: SampleInvestigationDetails,
  args: {
    repository: {
      source: referenceGitLab.source,
      projectPath: 'brilator/Facultative-CAM-in-Talinum',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Talinum investigation details with contacts, organization affiliations, publications, and versions. Optional DataHub metadata is supplied by the caller through dataHubData; this component makes no DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof SampleInvestigationDetails>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {}
