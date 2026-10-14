import { ActionList, ActionMenu, CounterLabel, type ActionMenuButtonProps } from '@primer/react'
import { useRef, useState } from 'react'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { investigationDashletTitles, investigationDetailIds, type InvestigationDashletId } from '../InvestigationDashlets/investigationDashletOptions'
import type { InvestigationMetadata } from '../Investigation/types'
import { InvestigationEntityMenu } from './InvestigationEntityMenu'
import './investigationMenu.css'

export function InvestigationMenu({ metadata, arcJson, variant = 'default', presentation = 'popup', onNavigateFolder }: { metadata: InvestigationMetadata; arcJson: string; variant?: ActionMenuButtonProps['variant']; presentation?: 'popup' | 'submenu'; onNavigateFolder?: (path: string) => void }) {
  const [investigation, setInvestigation] = useState<InvestigationDashletId | null>(null)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <div className="investigation-menu">
      <ActionMenu anchorRef={trigger} open={presentation === 'submenu' ? open : undefined} onOpenChange={presentation === 'submenu' ? next => {
        setOpen(next)
        if (!next) setInvestigation(null)
      } : undefined}>
        <ActionMenu.Button variant={variant}>Investigation</ActionMenu.Button>
        <ActionMenu.Overlay className={presentation === 'submenu' ? 'investigation-categories-overlay' : undefined} width={presentation === 'submenu' ? 'auto' : undefined} displayInViewport>
          <ActionList>
            {investigationDetailIds.map(id => {
              const title = investigationDashletTitles[id]
              const count = id === 'description' ? null : metadata[id].length
              const label = `${title}${count === null ? '' : ` (${count})`}`
              return presentation === 'submenu' ? (
                <ActionMenu key={id} open={investigation === id} onOpenChange={next => setInvestigation(current => next ? id : current === id ? null : current)}>
                  <ActionMenu.Anchor>
                    <ActionList.Item>
                      <span className="investigation-category-label">
                        <span className="investigation-category-title">{title}</span>
                        {count !== null && <CounterLabel>{count}</CounterLabel>}
                      </span>
                    </ActionList.Item>
                  </ActionMenu.Anchor>
                  <ActionMenu.Overlay side="outside-right" align="start" width="auto" className="investigation-entities-overlay" displayInViewport>
                    <InvestigationEntityMenu metadata={metadata} id={id} onNavigateFolder={onNavigateFolder ? path => {
                      setOpen(false)
                      setInvestigation(null)
                      onNavigateFolder(path)
                    } : undefined} />
                  </ActionMenu.Overlay>
                </ActionMenu>
              ) : <ActionList.Item key={id} onSelect={() => setInvestigation(id)}>{label}</ActionList.Item>
            })}
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>
      {presentation === 'popup' && <div className="investigation-menu-popups">
        <InvestigationDashlets metadata={metadata} arcJson={arcJson} classNamePrefix="investigation-menu" ids={investigationDetailIds}
          externalPopup={{ activeId: investigation, onClose: () => setInvestigation(null), returnFocusRef: trigger }}
        />
      </div>}
    </div>
  )
}
