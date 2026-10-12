import type { ArcKey, ArcSource } from './types'

// Fetches an RO-Crate from a URL. The same code path will serve GitLab-hosted
// crates later; only the URL (and possibly an auth header) changes.
export function urlSource(options: { key: ArcKey; label: string; url: string; init?: RequestInit }): ArcSource {
  const { key, label, url, init } = options
  return {
    key,
    label,
    async fetchROCrate(signal) {
      const response = await fetch(url, { ...init, signal })
      if (!response.ok) {
        throw new Error(`Fetching RO-Crate for "${label}" failed: ${response.status} ${response.statusText}`)
      }
      return response.text()
    },
  }
}

// RO-Crates bundled in public/sample-arcs for local development.
export const sampleSources: ArcSource[] = [
  urlSource({
    key: 'sample:facultative-cam-in-talinum',
    label: 'Facultative CAM in Talinum',
    url: `${import.meta.env.BASE_URL}sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json`,
  }),
]
