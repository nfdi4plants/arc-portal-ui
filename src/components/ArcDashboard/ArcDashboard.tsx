import { useROCrate } from '../../arc/hooks.ts'
import type { ARC } from '@nfdi4plants/arctrl'
import { Suspense, lazy } from 'react'
import { Button } from '@primer/react'

const ArcViewer = lazy(() => import('./ArcViewer/ArcViewer.tsx'))

type ArcDashboardProps = {
    name: string;
    url: string;
    source: string;
    projectId: number;
    token?: string;
    onBack: () => void;
};

function LoadedArc({ arc, name, url, token, onBack }: { arc: ARC; name: string; url: string; token?: string; onBack: () => void }) {
    console.log(arc)

    return <>
        Arc Dashboard: {name} -
        <a href={url}>Link</a>
        <Button onClick={onBack}>Back</Button>
        <Suspense fallback={<p role="status">Loading ARC viewer…</p>}>
            <ArcViewer repositoryUrl={url} token={token} jsonString={arc.ToROCrateJsonString()} />
        </Suspense>
    </>
}

function ArcDashboard({ name, url, source, projectId, token, onBack }: ArcDashboardProps) {

    const state = useROCrate(source, projectId, token)

    if (state.status === 'Error') return <p role="alert">Could not load ARC.</p>
    if (state.status !== 'Result') return <p>Loading…</p>

    return <LoadedArc arc={state.arc} name={name} url={url} token={token} onBack={onBack} />
}

export default ArcDashboard;
