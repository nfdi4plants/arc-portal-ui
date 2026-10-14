import { afterEach, expect, it, vi } from 'vitest'
import { ArcadeBanner } from '../../src/components/ArcDashboard/Game/ArcadeBanner'
import { renderWithTheme } from '../../src/test/helpers'

function sizeBoxes(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('shows the ARCade logo on a tile with room for it', () => {
  sizeBoxes(320, 180)
  const { container } = renderWithTheme(<ArcadeBanner />)

  expect(container.textContent).toBe('ARCade')
  expect(container.querySelector('.octicon-rocket')).toBeNull()
})

it('falls back to the rocket icon on a very small tile', () => {
  sizeBoxes(96, 64)
  const { container } = renderWithTheme(<ArcadeBanner />)

  expect(container.querySelector('.octicon-rocket')).not.toBeNull()
  expect(container.textContent).toBe('')
})
