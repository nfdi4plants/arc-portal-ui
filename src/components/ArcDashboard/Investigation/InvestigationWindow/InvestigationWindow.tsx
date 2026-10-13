import { Stack, Text } from '@primer/react'
import type { ReactNode } from 'react'

export function InvestigationWindow({ children, title = 'ARC Investigation' }: { children: ReactNode; title?: string }) {
  return (
    <div className="investigation-window-container">
      <section className="investigation-window" aria-label="Investigation preview">
        <header className="investigation-window-bar">
          <Stack className="investigation-window-controls" direction="horizontal" gap="tight" aria-hidden="true">
            <span />
            <span />
            <span />
          </Stack>
          <Text as="span" className="investigation-window-title">
            {title}
          </Text>
        </header>
        <div className="investigation-window-content">{children}</div>
      </section>
    </div>
  )
}
