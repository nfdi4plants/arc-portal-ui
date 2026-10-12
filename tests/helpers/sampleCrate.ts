import type { ArcSource } from '../../src/arc/types'
import crateJson from '../../public/sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json?raw'

export { crateJson }

// A source that serves the bundled sample crate without network access.
export function sampleCrateSource(overrides: Partial<ArcSource> = {}): ArcSource {
  return {
    key: 'test:talinum',
    label: 'Talinum test ARC',
    fetchROCrate: () => Promise.resolve(crateJson),
    ...overrides,
  }
}
