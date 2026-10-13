import {Button} from '@primer/react'
import {lazy, Suspense} from 'react'

const ArcViewer = lazy(() => import('./ArcViewer/ArcViewer.tsx'))

type ArcDashboardProps = {
    name: string;
    url: string;
    onBack: () => void;
};

function ArcDashboard({ name, url, onBack }: ArcDashboardProps) {
    return (
        <div>
            Arc Dashboard: {name} -
            <a href={url}>Link</a>
            <Button onClick={onBack}>Back</Button>
            <Suspense fallback={<p role="status">Loading ARC viewer…</p>}>
                <ArcViewer />
            </Suspense>
        </div>
    );
}

export default ArcDashboard;
