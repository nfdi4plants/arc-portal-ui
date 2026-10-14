// The gameplay scene emits this on the game's event emitter when the player clicks a mob while
// paused. With a spec, its segment and the mob's vertical place in the view (0 to 1) the HUD pins
// the info panel next to the mob, without arguments it unpins and closes it.
export const MOB_INFO_EVENT = 'mob-info'
// The inspector emits this when the pointer has rested on a mob long enough (spec and the mob's
// rectangle) or has left it for good (no arguments). The HUD shows the panel unless one is pinned.
export const MOB_HOVER_EVENT = 'mob-hover'

// A rectangle as fractions of the view, so the gameplay camera and the HUD camera can exchange
// places without knowing each other's size.
export interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

// Registry keys. The inspector writes the anchor of the mob it hovers or clicks, the HUD writes
// the rectangle the open panel covers. The inspector reads that one to keep clicks and hover that
// land on the panel away from the world, without the panel being an input target (a target above
// the pause buttons would take their hover and clicks).
export const MOB_ANCHOR_KEY = 'mob-info-anchor'
export const MOB_PANEL_RECT_KEY = 'mob-info-rect'
