// Decides which target the info panel shows while the pointer sweeps over targets. A target must
// be hovered for showMs before the panel opens, so crossing several mobs does not flicker. Once
// open it switches at once to the next target and closes hideMs after the pointer left every
// target, unless the pointer rests on the panel. Pure and fed with timestamps.
export class HoverIntent<T> {
  private candidate: T | null = null
  private since = 0
  private shown: T | null = null
  private leftAt: number | null = null
  private onPanel = false
  private readonly showMs: number
  private readonly hideMs: number

  constructor(showMs = 250, hideMs = 200) {
    this.showMs = showMs
    this.hideMs = hideMs
  }

  // The target under the pointer, or null.
  over(target: T | null, now: number): void {
    if (target === null) {
      this.candidate = null
      if (this.shown !== null && this.leftAt === null) this.leftAt = now
      return
    }
    this.leftAt = null
    if (target === this.candidate) return
    this.candidate = target
    this.since = now
    if (this.shown !== null) this.shown = target
  }

  // True while the pointer is on the open panel.
  panel(on: boolean, now: number): void {
    const wasOn = this.onPanel
    this.onPanel = on
    if (on) this.leftAt = null
    // Counts from the moment the pointer leaves the panel, not from when it left the mob.
    else if (wasOn && this.shown !== null && this.candidate === null) this.leftAt = now
  }

  // Returns the target to show, or null for none.
  tick(now: number): T | null {
    if (this.candidate !== null && this.shown === null && now - this.since >= this.showMs) this.shown = this.candidate
    if (this.shown !== null && !this.onPanel && this.leftAt !== null && now - this.leftAt >= this.hideMs) {
      this.shown = null
      this.leftAt = null
    }
    return this.shown
  }

  // Forgets what is shown. A target still under the pointer opens again after the delay.
  reset(now: number): void {
    this.shown = null
    this.leftAt = null
    this.since = now
  }
}
