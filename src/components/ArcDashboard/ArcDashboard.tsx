import { useROCrate } from '../../arc/hooks.ts'
import { ARC } from '@nfdi4plants/arctrl'
import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { Button } from '@primer/react'
import { buildProvenanceIndex } from '../../arc/provenance/buildIndex.ts'
import { DashboardContent } from './Dashboard'
import { DashboardWindow } from '../DashboardWindow'
import { selectInvestigationMetadata } from './Investigation/selectInvestigationMetadata'
import type { ArcRepositoryOverview } from '../../api/gitlab'
import type { DashboardContentProps } from './dashboardTypes'

type ArcDashboardProps = {
    name: string;
    url: string;
    source: string;
    projectId: number;
    token?: string;
    onBack: () => void;
    dataHubData?: ArcRepositoryOverview;
    content?: ComponentType<DashboardContentProps>;
};

function LoadedArc({ arc, name, url, token, onBack, dataHubData, content: Content = DashboardContent }: { arc: ARC } & Pick<ArcDashboardProps, 'name' | 'url' | 'token' | 'onBack' | 'dataHubData' | 'content'>) {
    // Built once per ARC. A new index sends the explorer back to its datasets view.
    const provenance = useMemo(() => buildProvenanceIndex(arc), [arc])
    const metadata = useMemo(() => selectInvestigationMetadata(arc), [arc])
    const arcJson = useMemo(() => ARC.toROCrateJsonString()(arc), [arc])

    return (
        <DashboardWindow label="ARC-Dashboard">
            <Content
                metadata={metadata}
                provenance={provenance}
                arcJson={arcJson}
                repositoryUrl={url}
                token={token}
                dataHubData={dataHubData}
                dataHubLinks={[{ name, url }]}
                actions={<Button onClick={onBack}>Back</Button>}
            />
        </DashboardWindow>
    )
}

function ArcDashboard({ name, url, source, projectId, token, onBack, dataHubData, content }: ArcDashboardProps) {

    const state = useROCrate(source, projectId, token)

    if (state.status === 'Error') return <p role="alert">Could not load ARC.</p>
    if (state.status !== 'Result') return <p>Loading…</p>

    return <LoadedArc arc={state.arc} name={name} url={url} token={token} onBack={onBack} dataHubData={dataHubData} content={content} />
}

export default ArcDashboard;
