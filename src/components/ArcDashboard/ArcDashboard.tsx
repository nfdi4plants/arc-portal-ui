import { useROCrate } from '../../arc/hooks.ts'
import { ARC } from '@nfdi4plants/arctrl'
import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { Button } from '@primer/react'
import { buildProvenanceIndex } from '../../arc/provenance/buildIndex.ts'
import { NewDashboardContent } from './NewDashboard'
import { DashboardWindow } from '../DashboardWindow'
import { ArcMageGreeting, ArcMageLoading } from './ArcMage'
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
    fillHeight?: boolean;
};

function LoadedArc({ arc, name, url, token, onBack, dataHubData, content: Content = NewDashboardContent, fillHeight = true }: { arc: ARC } & Pick<ArcDashboardProps, 'name' | 'url' | 'token' | 'onBack' | 'dataHubData' | 'content' | 'fillHeight'>) {
    // Built once per ARC. A new index sends the explorer back to its datasets view.
    const provenance = useMemo(() => buildProvenanceIndex(arc), [arc])
    const metadata = useMemo(() => selectInvestigationMetadata(arc), [arc])
    const arcJson = useMemo(() => ARC.toROCrateJsonString()(arc), [arc])

    return (
        <DashboardWindow label="ARC-Dashboard" fillHeight={fillHeight}>
            <Content
                metadata={metadata}
                provenance={provenance}
                arcJson={arcJson}
                repositoryUrl={url}
                token={token}
                dataHubData={dataHubData}
                dataHubLinks={[{ name, url }]}
                actions={<div className="arc-mage-actions"><ArcMageGreeting /><Button onClick={onBack}>Back</Button></div>}
            />
        </DashboardWindow>
    )
}

function ArcDashboard({ name, url, source, projectId, token, onBack, dataHubData, content, fillHeight }: ArcDashboardProps) {

    const state = useROCrate(source, projectId, token)

    if (state.status === 'Error') return <p role="alert">Could not load ARC.</p>
    if (state.status !== 'Result') return <ArcMageLoading />

    return <LoadedArc arc={state.arc} name={name} url={url} token={token} onBack={onBack} dataHubData={dataHubData} content={content} fillHeight={fillHeight} />
}

export default ArcDashboard;
