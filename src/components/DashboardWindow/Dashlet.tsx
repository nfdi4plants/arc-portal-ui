import type { ComponentProps } from 'react'
import { DashboardComponent } from './DashboardWindow'
import './dashlet.css'

export function Dashlet({ maxWidth, ...props }: ComponentProps<typeof DashboardComponent> & { maxWidth?: number }) {
  return (
    <div className="dashlet" style={{ maxWidth }}>
      <DashboardComponent {...props} />
    </div>
  )
}
