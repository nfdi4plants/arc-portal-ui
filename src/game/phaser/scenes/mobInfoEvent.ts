// The gameplay scene emits this on the game's event emitter when the player clicks a mob while
// paused. With a spec, its segment and the mob's vertical place in the view (0 to 1) the HUD opens
// the info panel on the other half of the view, without arguments it closes it.
export const MOB_INFO_EVENT = 'mob-info'
