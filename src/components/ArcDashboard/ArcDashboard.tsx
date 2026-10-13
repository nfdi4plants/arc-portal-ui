import { useROCrate } from '../../arc/hooks.ts'
import { ARC } from '@nfdi4plants/arctrl'
import { useMemo, useState } from 'react'
import { Button } from '@primer/react'
import { buildProvenanceIndex } from '../../arc/provenance/buildIndex.ts'
import { DashboardContent } from './Dashboard'
import { NewDashboardContent } from './NewDashboard'
import { StackedDashboardContent } from './StackedDashboard'
import { DashboardWindow } from '../DashboardWindow'
import { selectInvestigationMetadata } from './Investigation/selectInvestigationMetadata'
import type { ArcRepositoryOverview } from '../../api/gitlab'

type ArcDashboardProps = {
    name: string;
    url: string;
    source: string;
    projectId: number;
    token?: string;
    onBack: () => void;
    dataHubData?: ArcRepositoryOverview;
};

function LoadedArc({ arc, name, url, onBack, dataHubData }: { arc: ARC } & Pick<ArcDashboardProps, 'name' | 'url' | 'onBack' | 'dataHubData'>) {
    const [layout, setLayout] = useState<'classic' | 'radial' | 'stacked'>('classic')
    // Built once per ARC. A new index sends the explorer back to its datasets view.
    const provenance = useMemo(() => buildProvenanceIndex(arc), [arc])
    const metadata = useMemo(() => selectInvestigationMetadata(arc), [arc])
    const arcJson = useMemo(() => ARC.toROCrateJsonString()(arc), [arc])
    const Content = layout === 'radial' ? NewDashboardContent : layout === 'stacked' ? StackedDashboardContent : DashboardContent

    return (
        <DashboardWindow label="ARC-Dashboard" fillHeight={layout === 'radial'}>
            <Content
                metadata={metadata}
                provenance={provenance}
                arcJson={arcJson}
                dataHubData={dataHubData}
                dataHubLinks={[{ name, url }]}
                actions={<>
                    <Button onClick={onBack}>Back</Button>
                    <Button aria-pressed={layout === 'radial'} onClick={() => setLayout(value => value === 'classic' ? 'radial' : 'classic')}>
                        {layout === 'classic' ? 'NewDashboard' : 'Classic dashboard'}
                    </Button>
                    <Button aria-pressed={layout === 'stacked'} onClick={() => setLayout('stacked')}>Stacked dashboard</Button>
                </>}
            />
        </DashboardWindow>
    )
}

function ArcDashboard({ name, url, source, projectId, token, onBack, dataHubData }: ArcDashboardProps) {

    const state = useROCrate(source, projectId, token)

    if (state.status === 'Error') return <p role="alert">Could not load ARC.</p>
    if (state.status !== 'Result') return <p>Loading…</p>

    return <LoadedArc arc={state.arc} name={name} url={url} onBack={onBack} dataHubData={dataHubData} />
}

export default ArcDashboard;
