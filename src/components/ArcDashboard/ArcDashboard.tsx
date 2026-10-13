import { useROCrate } from '../../arc/hooks.ts'
import type { ARC } from '@nfdi4plants/arctrl'
import { Suspense, lazy, useMemo } from 'react'
import { Button } from '@primer/react'
import { buildProvenanceIndex } from '../../arc/provenance/buildIndex.ts'
import { ProvenanceExplorer } from './Provenance/ProvenanceExplorer'

const ArcViewer = lazy(() => import('./ArcViewer/ArcViewer.tsx'))

type ArcDashboardProps = {
    name: string;
    url: string;
    source: string;
    projectId: number;
    token?: string;
    onBack: () => void;
};

function LoadedArc({ arc, name, url, onBack }: { arc: ARC; name: string; url: string; onBack: () => void }) {
    console.log(arc)
    // Built once per ARC. A new index sends the explorer back to its datasets view.
    const provenance = useMemo(() => buildProvenanceIndex(arc), [arc])

    return <>
        Arc Dashboard: {name} -
        <a href={url}>Link</a>
        <Button onClick={onBack}>Back</Button>
        <Suspense fallback={<p role="status">Loading ARC viewer…</p>}>
            <ArcViewer />
        </Suspense>
        {/* The explorer fills its box, so the box gets a height. */}
        <div style={{ height: '66dvh' }}>
            <ProvenanceExplorer index={provenance} />
        </div>
    </>
}

function ArcDashboard({ name, url, source, projectId, token, onBack }: ArcDashboardProps) {

    const state = useROCrate(source, projectId, token)

    if (state.status === 'Error') return <p role="alert">Could not load ARC.</p>
    if (state.status !== 'Result') return <p>Loading…</p>

    return <LoadedArc arc={state.arc} name={name} url={url} onBack={onBack} />
}

export default ArcDashboard;
