import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, expect, it, vi } from 'vitest'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import type { ProvenanceIndex } from '../../src/arc/provenance/types'
import { ArcGameDashlet, PopupArcGame } from '../../src/components/ArcDashboard/Game'
import { renderWithTheme } from '../../src/test/helpers'
import { crateJson } from '../helpers/sampleCrate'

const arcade = vi.hoisted(() => ({ Arcade: vi.fn(() => <div data-testid="arcade" />) }))

vi.mock('@arc-rdg/arcade/react', () => ({
  Arcade: arcade.Arcade,
  ArcadeBanner: () => <div data-testid="arcade-banner" />,
}))

let index: ProvenanceIndex

beforeAll(() => {
  index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

it('gives the dashlet the ARC title and the dashboard provenance index', () => {
  const { getByTestId } = renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)

  expect(getByTestId('arcade')).toBeTruthy()
  expect(arcade.Arcade).toHaveBeenCalledWith(expect.objectContaining({ title: 'Talinum', provenance: index }), undefined)
})

it('shows the ARCade banner on the popup tile', () => {
  const { getByTestId } = renderWithTheme(<PopupArcGame index={index} arcTitle="Talinum" />)

  expect(getByTestId('arcade-banner')).toBeTruthy()
})

it('renders no popup without a provenance index', () => {
  const { container } = renderWithTheme(<PopupArcGame arcTitle="Talinum" />)

  expect(container.textContent).toBe('')
})
