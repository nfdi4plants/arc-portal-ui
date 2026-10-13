import type { ComponentProps, CSSProperties } from 'react'
import { DashboardComponent } from './DashboardWindow'
import './dashlet.css'

export type DashletProps = ComponentProps<typeof DashboardComponent> & {
  maxWidth?: number
  height?: CSSProperties['height']
  className?: string
}

export function Dashlet({ maxWidth, height, className, ...props }: DashletProps) {
  return (
    <div className={`dashlet${className ? ` ${className}` : ''}`} style={{ maxWidth, height }}>
      <DashboardComponent {...props} />
    </div>
  )
}
