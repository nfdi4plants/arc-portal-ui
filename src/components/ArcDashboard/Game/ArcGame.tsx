import { AlertIcon } from '@primer/octicons-react'
import { Banner, Button, Heading, Stack, Text, ThemeProvider } from '@primer/react'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import type { ProvenanceIndex } from '../../../arc/provenance/types'
import mageUrl from '../../../game/assets/ARCMage.png'
import type { CreateGame, GameHandle } from '../../../game/contracts/events'
import { ACTIONS, type Action, type Binding, type Bindings } from '../../../game/contracts/input'
import { bindingLabel, DEFAULT_BINDINGS, findConflicts, loadBindings, saveBindings } from '../../../game/model/input'
import { planRun } from '../../../game/model/run'
import { BarList } from '../../BarList/BarList'
import styles from './ArcGame.module.css'
import { Scene, Sparkle } from './Scenery'
import { useTrimmedImage } from './useTrimmedImage'

type Mode = 'menu' | 'settings' | 'playing'

const ACTION_NAMES: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump',
  dash: 'Dash',
  light: 'Light attack',
  heavy: 'Heavy attack',
  ability1: 'Ability 1',
  ability2: 'Ability 2',
  ability3: 'Ability 3',
  ability4: 'Ability 4',
  pause: 'Pause',
}

const BINDING_SLOTS = [0, 1]

// The start screen puts the mage next to the path when the box is at least this many em wide and
// not taller than wide. The measure is in em so a larger font size keeps the text readable.
const SIDE_BY_SIDE_MIN_EM = 28
// Share of the box height the mage illustration takes.
const MAGE_HEIGHT_WIDE = 0.55
const MAGE_HEIGHT_STACKED = 0.17
const MAGE_HEIGHT_COMPACT = 0.5
// Boxes smaller than this many em in either direction get the compact title card.
const COMPACT_MAX_WIDTH_EM = 22.5
const COMPACT_MAX_HEIGHT_EM = 16.25

const FINE_POINTER = '(any-pointer: fine)'

function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const hasFinePointer = () => window.matchMedia(FINE_POINTER).matches

const newSeed = () => Math.floor(Math.random() * 36 ** 8).toString(36).padStart(8, '0')

interface Box {
  width: number
  height: number
  stacked: boolean
  compact: boolean
}

// The size of the element, kept up to date by a ResizeObserver. It is null until the element has
// a layout, which is also the case in jsdom.
function useBox(ref: RefObject<HTMLElement | null>): Box | null {
  const [box, setBox] = useState<Box | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      // Layout size, so a popup that opens by scaling up from its tile is measured at its final size.
      // getBoundingClientRect would include the transform, and a transform never fires the observer.
      const width = element.offsetWidth
      const height = element.offsetHeight
      if (width === 0 || height === 0) return
      const em = parseFloat(getComputedStyle(element).fontSize) || 16
      const stacked = width < height || width < SIDE_BY_SIDE_MIN_EM * em
      const compact = width < COMPACT_MAX_WIDTH_EM * em || height < COMPACT_MAX_HEIGHT_EM * em
      setBox((current) =>
        current && current.width === width && current.height === height && current.stacked === stacked && current.compact === compact
          ? current
          : { width, height, stacked, compact },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return box
}

const sameBinding = (a: Binding, b: Binding) =>
  a.device === 'key' ? b.device === 'key' && a.code === b.code : b.device === 'mouse' && a.button === b.button

function withSlot(list: Binding[], slot: number, binding: Binding): Binding[] {
  const others = list.filter((_, position) => position !== slot)
  if (others.some((other) => sameBinding(other, binding))) return list
  const next = [...list]
  next[Math.min(slot, list.length)] = binding
  return next
}

function withoutSlot(list: Binding[], slot: number): Binding[] {
  return list.filter((_, position) => position !== slot)
}

// The game fills the box of the dashlet. The start screen, the settings and the running game are
// three modes of this one component, and the game itself lives in a Phaser canvas inside it.
export default function ArcGame({ index, arcTitle }: { index: ProvenanceIndex; arcTitle: string }) {
  const [mode, setMode] = useState<Mode>('menu')
  const [seed, setSeed] = useState(newSeed)
  const [bindings, setBindings] = useState(loadBindings)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [focused, setFocused] = useState(false)
  const [capture, setCapture] = useState<{ action: Action; slot: number } | null>(null)
  // A new index is another ARC. The run of the old one must not outlive it.
  const [seenIndex, setSeenIndex] = useState(index)
  if (seenIndex !== index) {
    setSeenIndex(index)
    setMode('menu')
    setCapture(null)
  }

  const root = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const handleRef = useRef<GameHandle | null>(null)
  const bindingsRef = useRef(bindings)
  const box = useBox(root)
  const mageImage = useTrimmedImage(mageUrl)
  const finePointer = useSyncExternalStore(subscribeToPointer, hasFinePointer)

  const plan = useMemo(() => planRun(index, arcTitle, seed), [index, arcTitle, seed])
  const conflicts = useMemo(() => findConflicts(bindings), [bindings])

  // The game module loads when the run starts, so Phaser stays out of the page until then. The game
  // is created per mount of the host and destroyed with it. The plan and the bindings cannot
  // change while the game runs, because the controls and the new path button live on the other
  // screens.
  useEffect(() => {
    const parent = host.current
    if (mode !== 'playing' || !parent || !plan) return
    let cancelled = false
    let stop: (() => void) | undefined

    const run = (createGame: CreateGame) => {
      const handle = createGame(parent, { bindings })
      handleRef.current = handle

      // The Phaser scenes draw the death and victory screens, so those events need no reaction here.
      const stopListening = handle.on((event) => {
        if (event.type !== 'menuRequested') return
        if (event.choice === 'retry') {
          handle.send({ type: 'start', plan })
          return
        }
        if (event.choice === 'newPath') setSeed(newSeed())
        setMode('menu')
      })

      // The game runs only while its canvas has focus and the dashlet is on screen. A sleeping game
      // costs no GPU time. The run starts paused, behind the "Click to play" overlay.
      let isFocused = false
      let isVisible = true
      let isPaused: boolean | undefined
      const syncPause = () => {
        const paused = !(isFocused && isVisible)
        if (paused === isPaused) return
        isPaused = paused
        handle.send({ type: 'pause', paused })
      }
      handle.send({ type: 'start', plan })
      syncPause()
      const onFocusIn = () => {
        isFocused = true
        setFocused(true)
        syncPause()
      }
      const onFocusOut = () => {
        isFocused = false
        setFocused(false)
        syncPause()
      }
      parent.addEventListener('focusin', onFocusIn)
      parent.addEventListener('focusout', onFocusOut)

      const visibility = new IntersectionObserver((entries) => {
        isVisible = entries[entries.length - 1].isIntersecting
        syncPause()
      })
      visibility.observe(parent)

      const resizing = new ResizeObserver(() => {
        if (parent.clientWidth > 0 && parent.clientHeight > 0) handle.resize(parent.clientWidth, parent.clientHeight)
      })
      resizing.observe(parent)

      return () => {
        resizing.disconnect()
        visibility.disconnect()
        parent.removeEventListener('focusin', onFocusIn)
        parent.removeEventListener('focusout', onFocusOut)
        stopListening()
        handle.destroy()
        handleRef.current = null
      }
    }

    import('../../../game/phaser/createGame').then(
      ({ createGame }) => {
        if (cancelled) return
        stop = run(createGame)
        setReady(true)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )

    return () => {
      cancelled = true
      stop?.()
      setReady(false)
      setLoadFailed(false)
      setFocused(false)
    }
  }, [mode, plan, bindings])

  const updateBindings = useCallback((next: Bindings) => {
    bindingsRef.current = next
    setBindings(next)
    saveBindings(next)
    handleRef.current?.send({ type: 'setBindings', bindings: next })
  }, [])

  // Waits for the next key or mouse button and binds it. Escape cancels, Delete and Backspace clear
  // the slot. A mouse press on a button other than the capturing slot cancels the capture and the
  // click goes through. The capture ends only after the release, so the click or the Space release
  // that follows does not press the slot button again.
  useEffect(() => {
    if (!capture) return
    const { action, slot } = capture
    let assigned = false
    const assign = (binding: Binding) => {
      assigned = true
      const current = bindingsRef.current
      updateBindings({ ...current, [action]: withSlot(current[action], slot, binding) })
    }
    const clear = () => {
      assigned = true
      const current = bindingsRef.current
      if (current[action][slot]) updateBindings({ ...current, [action]: withoutSlot(current[action], slot) })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (assigned || event.repeat) return
      if (event.code === 'Escape') setCapture(null)
      else if (event.code === 'Delete' || event.code === 'Backspace') clear()
      else assign({ device: 'key', code: event.code })
    }
    const onMouseDown = (event: MouseEvent) => {
      if (assigned || event.button > 2) return
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (button && !button.hasAttribute('data-capturing')) {
        setCapture(null)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      assign({ device: 'mouse', button: event.button as 0 | 1 | 2 })
    }
    const onRelease = (event: Event) => {
      if (!assigned) return
      event.preventDefault()
      setTimeout(() => setCapture(null))
    }
    const onContextMenu = (event: Event) => event.preventDefault()
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('keyup', onRelease, true)
    window.addEventListener('mouseup', onRelease, true)
    window.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('keyup', onRelease, true)
      window.removeEventListener('mouseup', onRelease, true)
      window.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [capture, updateBindings])

  const compact = box?.compact ?? false
  const layout = compact ? 'compact' : box?.stacked ? 'stacked' : 'wide'
  const mageShare = compact ? MAGE_HEIGHT_COMPACT : box?.stacked ? MAGE_HEIGHT_STACKED : MAGE_HEIGHT_WIDE
  const mageStyle = box ? { height: Math.round(box.height * mageShare) } : undefined
  // One scale factor for the logo and the buttons, derived from what the box can hold.
  const scale = !box
    ? 1
    : compact
      ? Math.min(box.width / 300, box.height / 200)
      : box.stacked
        ? Math.min(box.width / 420, box.height / 700)
        : Math.min(box.width / 900, box.height / 560)
  const sceneStyle = { '--scale': Math.max(0.5, Math.min(1.5, scale)) } as CSSProperties

  let screen
  if (mode === 'playing') {
    screen = (
      <div className={styles.play}>
        <div ref={host} className={styles.host} role="group" aria-label="ARCade game" />
        {loadFailed ? (
          <div className={styles.status}>
            <Banner variant="critical" title="The game could not be loaded" description="Reload the page to try again." />
            <Button onClick={() => setMode('menu')}>Back</Button>
          </div>
        ) : !ready ? (
          <Text as="p" role="status" className={styles.status}>Loading game…</Text>
        ) : (
          !focused && (
            <button type="button" className={styles.overlay} onClick={() => handleRef.current?.focus()}>
              Click to play
            </button>
          )
        )}
      </div>
    )
  } else if (mode === 'settings') {
    const noteFor = (action: Action) =>
      conflicts
        .filter(({ actions }) => actions.includes(action))
        .map(({ binding, actions }) => ({ binding, others: actions.filter((other) => other !== action) }))
        .filter(({ others }) => others.length > 0)
        .map(({ binding, others }) => `${bindingLabel(binding)} is also bound to ${others.map((other) => ACTION_NAMES[other]).join(', ')}.`)
        .join(' ')

    screen = (
      <div className={styles.screen} data-layout={layout} style={sceneStyle}>
        <Scene />
        <div className={`${styles.content} ${styles.card}`}>
          <Stack direction="horizontal" align="center" justify="space-between" wrap="wrap" gap="condensed" className={styles.fullWidth}>
            <Heading as="h2" variant="medium">Controls</Heading>
            <Stack direction="horizontal" gap="condensed">
              <Button onClick={() => { setCapture(null); updateBindings(DEFAULT_BINDINGS) }}>Reset to defaults</Button>
              <Button onClick={() => { setCapture(null); setMode('menu') }}>Back</Button>
            </Stack>
          </Stack>
          <Text as="p" role="status" className={styles.hint}>
            {capture
              ? `Press a key or a mouse button for ${ACTION_NAMES[capture.action]}. Delete or Backspace clears the binding and Escape cancels.`
              : 'Click a binding, then press a key or a mouse button. Each action takes up to two.'}
          </Text>
          <ul className={styles.bindings} aria-label="Controls">
            {ACTIONS.map((action) => {
              const note = noteFor(action)
              return (
                <li key={action} className={styles.bindingRow}>
                  <span className={styles.actionName}>{ACTION_NAMES[action]}</span>
                  <span className={styles.slots}>
                    {BINDING_SLOTS.map((slot) => {
                      const binding = bindings[action][slot]
                      const capturing = capture?.action === action && capture.slot === slot
                      const text = capturing ? 'Press a key' : binding ? bindingLabel(binding) : 'Unbound'
                      return (
                        <Button
                          key={slot}
                          size="small"
                          className={styles.slot}
                          aria-label={`${ACTION_NAMES[action]} binding ${slot + 1}: ${text}`}
                          data-capturing={capturing ? '' : undefined}
                          onClick={() => {
                            if (!capture) setCapture({ action, slot })
                          }}
                        >
                          {text}
                        </Button>
                      )
                    })}
                  </span>
                  {note && (
                    <Text className={styles.conflict}>
                      <AlertIcon size={16} /> {note}
                    </Text>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  } else {
    const totalAnnotations = plan?.segments.reduce((sum, segment) => sum + segment.annotations.length, 0) ?? 0
    const actions = finePointer ? (
      <div className={styles.actions}>
        <Button variant="primary" className={`${styles.game} ${styles.start}`} onClick={() => setMode('playing')}>Start run</Button>
        {!compact && (
          <>
            <Button className={styles.game} onClick={() => setSeed(newSeed())}>New path</Button>
            <Button className={styles.game} onClick={() => setMode('settings')}>Settings</Button>
          </>
        )}
      </div>
    ) : (
      <>
        <p className={styles.message}>
          <strong>Keyboard required</strong>
          <span>ARCade needs a keyboard and a mouse.</span>
        </p>
        {!compact && (
          <div className={styles.actions}>
            <Button className={styles.game} onClick={() => setSeed(newSeed())}>New path</Button>
          </div>
        )}
      </>
    )
    screen = (
      <div className={styles.screen} data-layout={layout} style={sceneStyle}>
        <Scene />
        {plan && mageImage && (
          <div className={styles.figure}>
            <span className={styles.hill} aria-hidden="true" />
            <img className={styles.mage} src={mageImage} alt="" style={mageStyle} />
            <Sparkle />
          </div>
        )}
        <div className={styles.content}>
          <h2 className={styles.logo} aria-label="ARCade">
            <span aria-hidden="true">ARC<span className={styles.logoTail}>ade</span></span>
          </h2>
          {plan ? (
            compact ? (
              <>
                <p className={styles.summary} title={`${plan.segments.length} steps, ${totalAnnotations} monsters, quest: ${arcTitle}`}>
                  {plan.segments.length} steps &middot; {totalAnnotations} monsters &middot; quest: {arcTitle}
                </p>
                {actions}
              </>
            ) : (
              <>
                <p className={styles.quest} title={arcTitle}>Quest: {arcTitle}</p>
                <div className={styles.card}>
                  <Text as="p" className={styles.hint}>
                    Fight along one path through {arcTitle}. Every annotation on the way is a monster and every node after a step is a boss.
                  </Text>
                  <dl className={styles.facts}>
                    <dt>Path</dt>
                    <dd>{plan.nodes[0].id} &rarr; {plan.nodes[plan.nodes.length - 1].id}</dd>
                    <dt>Steps</dt>
                    <dd>{plan.segments.length}</dd>
                    <dt>Annotations</dt>
                    <dd>{totalAnnotations}</dd>
                    <dt>Seed</dt>
                    <dd><code>{plan.seed}</code></dd>
                  </dl>
                  <div className={styles.path}>
                    <BarList
                      title="Annotations per step"
                      max={plan.segments.length}
                      items={plan.segments.map((segment) => ({
                        key: String(segment.index),
                        label: segment.processName,
                        count: segment.annotations.length,
                        title: `${segment.processName}: ${segment.fromNodeId} to ${segment.toNodeId}`,
                      }))}
                    />
                  </div>
                </div>
                {actions}
              </>
            )
          ) : (
            <p className={styles.message}>
              <strong>No provenance yet</strong>
              <span>This ARC has no provenance yet. Annotate a study or assay table to open the path for ARCade.</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={root} className={styles.root}>
      {mode === 'playing' ? screen : <ThemeProvider colorMode="day">{screen}</ThemeProvider>}
    </div>
  )
}
