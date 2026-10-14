import { RocketIcon } from '@primer/octicons-react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import mageUrl from '../../../game/assets/ARCMage.png'
import styles from './ArcGame.module.css'
import banner from './ArcadeBanner.module.css'
import { Scene, Sparkle } from './Scenery'
import { useTrimmedImage } from './useTrimmedImage'

// Below this many em in either direction the banner would be unreadable, so the tile shows the icon.
const MIN_WIDTH_EM = 9
const MIN_HEIGHT_EM = 5.5

interface Size {
  width: number
  height: number
  tiny: boolean
}

// The banner of the compact ARCade tile: the start screen's hills, the mage and the logo, without
// the run controls. A tile too small for it shows the rocket icon instead.
export function ArcadeBanner() {
  const root = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size | null>(null)
  const mageImage = useTrimmedImage(mageUrl)

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const measure = () => {
      const width = element.offsetWidth
      const height = element.offsetHeight
      if (width === 0 || height === 0) return
      const em = parseFloat(getComputedStyle(element).fontSize) || 16
      const tiny = width < MIN_WIDTH_EM * em || height < MIN_HEIGHT_EM * em
      setSize((current) => (current && current.width === width && current.height === height && current.tiny === tiny ? current : { width, height, tiny }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // jsdom has no layout, so an unmeasured tile keeps the icon.
  const tiny = size?.tiny ?? true
  const tall = size ? size.height > size.width : false
  const scale = size ? Math.max(0.4, Math.min(1.5, Math.min(size.width / 300, size.height / 200))) : 1
  const mageHeight = size ? Math.round(size.height * (tall ? 0.4 : 0.6)) : undefined

  return (
    <div ref={root} className={`${styles.root} ${banner.banner}`} aria-hidden="true">
      {tiny ? (
        <span className={banner.icon}>
          <RocketIcon size={48} />
        </span>
      ) : (
        <div className={`${styles.screen} ${banner.screen}`} data-layout="compact" data-tall={tall ? '' : undefined} style={{ '--scale': scale } as CSSProperties}>
          <Scene />
          {mageImage && (
            <div className={styles.figure}>
              <span className={styles.hill} />
              <img className={styles.mage} src={mageImage} alt="" style={{ height: mageHeight }} />
              <Sparkle />
            </div>
          )}
          <div className={`${styles.content} ${banner.content}`}>
            <span className={styles.logo}>
              ARC<span className={styles.logoTail}>ade</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
