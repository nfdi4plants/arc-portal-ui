import { Text } from '@primer/react'
import type { CSSProperties, ReactNode } from 'react'
import './dashboardWindow.css'

interface WindowProps {
  title: string
  children: ReactNode
  label?: string
  actions?: ReactNode
}

function WindowFrame({ title, children, label, className, style, fillHeight, actions }: WindowProps & { className: string; style?: CSSProperties; fillHeight?: boolean }) {
  return (
    <section className={className} style={style} data-fill-height={fillHeight || undefined} aria-label={label ?? title}>
      <header className="dashboard-window-bar">
        <Text as="span" className="dashboard-window-title">{title}</Text>
        {actions && <div className="dashboard-window-actions">{actions}</div>}
      </header>
      <div className={`${className}-content`}>{children}</div>
    </section>
  )
}

export function DashboardWindow({ maxWidth, fillHeight, ...props }: WindowProps & { maxWidth?: number; fillHeight?: boolean }) {
  return (
    <div className="dashboard-window-container">
      <WindowFrame {...props} className="dashboard-window" style={{ maxWidth }} fillHeight={fillHeight} />
    </div>
  )
}

export function DashboardComponent(props: WindowProps) {
  return <WindowFrame {...props} className="dashboard-component" />
}
