/** Navigate through the embedded viewer's own links; it has no public navigation prop. */
export function navigateToFolder(container: HTMLElement, path: string) {
  const segments = path.split('/').filter(Boolean)
  let started = false
  let next = 0
  const update = () => {
    if (!started) {
      const root = container.querySelector<HTMLAnchorElement>('[aria-label="Breadcrumbs"] a')
      if (!root) return
      started = true
      root.click()
    }
    const links = [...container.querySelectorAll<HTMLAnchorElement>('tbody a[href="#"]')]
    const link = links.find(candidate =>
      (candidate.querySelector('[title]')?.getAttribute('title') ?? candidate.textContent?.trim()) === segments[next])
    if (!link) return
    next++
    link.click()
    if (next === segments.length) {
      observer.disconnect()
      container.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    }
  }
  const observer = new MutationObserver(update)
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  update()
  return () => observer.disconnect()
}
