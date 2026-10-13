import {Button} from '@primer/react'

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
        </div>
    );
}

export default ArcDashboard;