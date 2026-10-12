// Identifies an ARC by where it comes from, not by its investigation identifier.
// Identifiers can repeat across GitLab instances, so a key looks like
// "sample:facultative-cam-in-talinum" or "git.nfdi4plants.org/group/project@main".
export type ArcKey = string

// Anything that can hand us the RO-Crate JSON of one ARC.
export interface ArcSource {
  key: ArcKey
  label: string
  fetchROCrate(signal?: AbortSignal): Promise<string>
}

export type ArcStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; error: unknown }
