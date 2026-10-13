import { describe, expect, it } from 'vitest'
import { initials, isAutomationAuthor, toPeople } from './people.ts'

describe('toPeople', () => {
  it('de-duplicates by lower-cased email', () => {
    const people = toPeople([
      { name: 'Jane Doe', email: 'JANE@Example.org', commits: 3 },
      { name: 'Jane Doe', email: 'jane@example.org', commits: 5 },
      { name: 'John', email: 'john@example.org', commits: 1 },
    ])
    expect(people).toEqual([
      { id: 'jane@example.org', name: 'Jane Doe' },
      { id: 'john@example.org', name: 'John' },
    ])
  })

  it('de-duplicates by name when the email is empty', () => {
    const people = toPeople([
      { name: 'Nora', email: '', commits: 2 },
      { name: 'Nora', email: '', commits: 1 },
    ])
    expect(people).toEqual([{ id: 'nora', name: 'Nora' }])
  })

  it('removes ARCitect and the info mailbox', () => {
    const people = toPeople([
      { name: 'ARCitect', email: 'arcitect@nfdi4plants.org', commits: 999 },
      { name: 'Someone', email: 'info@nfdi4plants.org', commits: 1 },
      { name: 'Jane', email: 'jane@example.org', commits: 1 },
    ])
    expect(people).toEqual([{ id: 'jane@example.org', name: 'Jane' }])
  })
})

describe('isAutomationAuthor', () => {
  it('matches ARCitect and the info mailbox by any casing', () => {
    expect(isAutomationAuthor('ARCitect', 'arcitect@nfdi4plants.org')).toBe(true)
    expect(isAutomationAuthor('Someone', 'INFO@nfdi4plants.org')).toBe(true)
    expect(isAutomationAuthor('Jane', 'jane@example.org')).toBe(false)
  })
})

describe('initials', () => {
  it('takes the first and last word', () => {
    expect(initials('Marília Bueno da Silva')).toBe('MS')
  })

  it('takes the first letter of a single name', () => {
    expect(initials('Nora')).toBe('N')
  })

  it('handles an empty name', () => {
    expect(initials('')).toBe('')
  })
})