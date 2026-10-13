import type { GitLabContributor } from '../../../types/gitlab.ts'
import type { Person } from '../../../types/dashboard.ts'

/** GitLab's automation account and the nfdi4plants contact mailbox. */
export function isAutomationAuthor(name: string, email: string) {
  const normalizedName = name.trim().toLowerCase()
  const normalizedEmail = email.trim().toLowerCase()
  return normalizedName === 'arcitect' || normalizedEmail === 'info@nfdi4plants.org'
}

/** De-duplicates contributors by lower-cased email (or name when the email is empty) and drops automation accounts. */
export function toPeople(contributors: GitLabContributor[]): Person[] {
  const people: Person[] = []
  const seen = new Set<string>()
  for (const contributor of contributors) {
    if (isAutomationAuthor(contributor.name, contributor.email)) continue
    const id = contributor.email.trim().toLowerCase() || contributor.name.trim().toLowerCase()
    if (seen.has(id)) continue
    seen.add(id)
    people.push({ id, name: contributor.name.trim() })
  }
  return people
}

/** Initials of the first and last word, for avatar circles. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0][0]
  if (parts.length === 1) return first.toUpperCase()
  return `${first}${parts.at(-1)![0]}`.toUpperCase()
}