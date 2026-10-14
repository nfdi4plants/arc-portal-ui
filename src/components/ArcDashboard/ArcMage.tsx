import type { ReactNode } from 'react'
import mageUrl from '../../game/assets/ARCMage.png'
import './arcMage.css'

// ARCMage.png is a 1448x1086 canvas with the robot inside x55..241, y173..451.
// The viewBox crops to that area (plus a small margin) without editing the asset.
const VIEW_BOX = '49 167 198 290'

function MageImage({ className, children }: { className: string; children?: ReactNode }) {
  return (
    <svg className={className} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <image href={mageUrl} width={1448} height={1086} />
      {children}
    </svg>
  )
}

/** Full loading screen: the mage blinks "Loading" on its face display. */
export function ArcMageLoading({ label = 'Loading ARC…' }: { label?: string }) {
  return (
    <div className="arc-mage-loading" role="status">
      <MageImage className="arc-mage-loading-image">
        {/* Centre of the dark face display (x148..216, y264..322). */}
        <text className="arc-mage-screen-text" x={182} y={293} textAnchor="middle" dominantBaseline="central">Loading</text>
      </MageImage>
      <span className="arc-mage-visually-hidden">{label}</span>
    </div>
  )
}

/** Compact mascot with a greeting, shown in the loaded dashboard's header. */
export function ArcMageGreeting() {
  return (
    <div className="arc-mage-greeting">
      <MageImage className="arc-mage-greeting-image" />
      <p className="arc-mage-bubble">Help me on my adventure!</p>
    </div>
  )
}
