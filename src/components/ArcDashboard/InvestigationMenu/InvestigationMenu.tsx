import { ActionList, ActionMenu, Button } from '@primer/react'
import { useRef, useState } from 'react'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { investigationDashletTitles, investigationDetailIds, type InvestigationDashletId } from '../InvestigationDashlets/investigationDashletOptions'
import type { InvestigationMetadata } from '../Investigation/types'
import './investigationMenu.css'

export function InvestigationMenu({ metadata, arcJson }: { metadata: InvestigationMetadata; arcJson: string }) {
  const [investigation, setInvestigation] = useState<InvestigationDashletId | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <div className="investigation-menu">
      <ActionMenu anchorRef={trigger}>
        <ActionMenu.Anchor><Button>Investigation</Button></ActionMenu.Anchor>
        <ActionMenu.Overlay>
          <ActionList>
            {investigationDetailIds.map(id => (
              <ActionList.Item key={id} onSelect={() => setInvestigation(id)}>
                {investigationDashletTitles[id]}
                {(id === 'contacts' || id === 'organizations' || id === 'publications' || id === 'assays' || id === 'studies' || id === 'runs' || id === 'workflows') && ` (${metadata[id].length})`}
              </ActionList.Item>
            ))}
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>
      <div className="investigation-menu-popups">
        <InvestigationDashlets metadata={metadata} arcJson={arcJson} classNamePrefix="investigation-menu" ids={investigationDetailIds}
          externalPopup={{ activeId: investigation, onClose: () => setInvestigation(null), returnFocusRef: trigger }}
        />
      </div>
    </div>
  )
}
