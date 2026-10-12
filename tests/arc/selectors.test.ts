import { ARC, OntologyAnnotation, Person } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { crateJson } from '../helpers/sampleCrate'
import { toOntologyTerm, toPersonSummary } from '../../src/arc/selectors/common'
import { selectAnnotationColumns } from '../../src/arc/selectors/annotations'
import { selectContacts, selectInvestigationSummary, selectPublications } from '../../src/arc/selectors/investigation'
import { selectAllPeople } from '../../src/arc/selectors/people'
import { selectAssay, selectAssays, selectStudies } from '../../src/arc/selectors/studiesAndAssays'

let arc: ARC

beforeAll(() => {
  arc = ARC.fromROCrateJsonString(crateJson)
})

describe('investigation selectors', () => {
  it('summarizes the investigation', () => {
    const summary = selectInvestigationSummary(arc)
    expect(summary.identifier).toBe('Facultative-CAM-in-Talinum')
    expect(summary.title).toBe('Facultative CAM in Talinum triangulare')
    expect(summary.counts).toEqual({ studies: 2, assays: 3, workflows: 6, runs: 6, contacts: 5 })
  })

  it('maps contacts to plain objects with ORCID links and roles', () => {
    const contacts = selectContacts(arc)
    expect(contacts).toHaveLength(5)
    const weber = contacts.find((person) => person.orcid === '0000-0003-0970-4672')
    expect(weber).toMatchObject({
      name: 'Andreas P M Weber',
      orcidUrl: 'https://orcid.org/0000-0003-0970-4672',
      roles: [expect.objectContaining({ name: 'principal investigator' })],
    })
    expect(new Set(contacts.map((person) => person.key)).size).toBe(5)
  })

  it('lists publications', () => {
    expect(selectPublications(arc)).toHaveLength(1)
  })
})

describe('study and assay selectors', () => {
  it('lists studies with their tables', () => {
    const studies = selectStudies(arc)
    expect(studies.map((study) => study.identifier)).toEqual(['TalinumGenomeDraft', 'TalinumSamples-STRI'])
    expect(studies[1].tables).toEqual([{ name: 'plant_material', rowCount: 6, columnCount: 16 }])
  })

  it('maps assay ontology annotations, dropping empty accessions', () => {
    const rnaSeq = selectAssays(arc).find((assay) => assay.identifier === 'RNASeq')
    expect(rnaSeq?.measurementType).toMatchObject({ name: 'mRNA Sequencing', accession: 'NCIT:C129432' })
    expect(rnaSeq?.measurementType?.url).toMatch(/^https?:\/\//)
    expect(rnaSeq?.technologyPlatform).toEqual({ name: 'Illumina HiSeq 2500', accession: undefined, url: undefined })
  })

  it('finds a single assay by identifier', () => {
    expect(selectAssay(arc, 'GCqTOF_targets')?.tables.map((table) => table.name)).toEqual([
      'metabolite_extraction',
      'gas_chromatography',
      'mass_spec',
    ])
    expect(selectAssay(arc, 'does-not-exist')).toBeUndefined()
  })
})

describe('combined access functions', () => {
  it('merges contacts, study contacts and performers into unique people', () => {
    const people = selectAllPeople(arc)
    expect(people).toHaveLength(12)

    const brilhaus = people.find((person) => person.orcid === '0000-0001-9021-3197')
    expect(brilhaus?.involvedIn).toHaveLength(6)

    // Listed with an ORCID as a contact but only by name elsewhere.
    const winter = people.filter((person) => person.name === 'Klaus Winter')
    expect(winter).toHaveLength(1)
    expect(winter[0].involvedIn).toEqual([
      { kind: 'investigation', identifier: 'Facultative-CAM-in-Talinum' },
      { kind: 'study', identifier: 'TalinumSamples-STRI' },
      { kind: 'assay', identifier: 'RNASeq' },
    ])
  })

  it('collects annotation columns across study, assay and run tables', () => {
    const columns = selectAnnotationColumns(arc)
    const byKey = new Map(columns.map((column) => [column.key, column]))

    expect(byKey.get('Parameter:DPBO:0000013')?.usedIn).toEqual([
      { kind: 'assay', identifier: 'GCqTOF_targets', table: 'metabolite_extraction' },
      { kind: 'assay', identifier: 'RNASeq', table: 'rna_extraction' },
    ])
    expect(byKey.get('Characteristic:OBI:0100026')?.usedIn.map((usage) => usage.kind)).toEqual(['study', 'study'])
    expect(byKey.get('Parameter:fragment-length')?.usedIn).toEqual([
      { kind: 'run', identifier: 'kallisto', table: 'kallisto-quant' },
    ])
    // Free-text term without accession: no URL.
    expect(byKey.get('Factor:Photosynthesis mode')?.term).toEqual({ name: 'Photosynthesis mode', accession: undefined, url: undefined })
  })
})

describe('toOntologyTerm', () => {
  const term = (name: string, tsr: string, tan: string) => toOntologyTerm(OntologyAnnotation.create(name, tsr, tan))

  it('links compact accessions and keeps full IRIs as their own link', () => {
    expect(term('mass spectrometer', 'MS', 'MS:1000031')).toMatchObject({ accession: 'MS:1000031', url: expect.stringMatching(/^https?:/) })
    expect(term('custom', 'X', 'https://example.org/terms/123')).toEqual({
      name: 'custom',
      accession: 'https://example.org/terms/123',
      url: 'https://example.org/terms/123',
    })
  })

  it('does not invent URLs for local accessions', () => {
    expect(term('local', 'X', 'local-id')?.url).toBeUndefined()
  })

  it('falls back to the accession when the name is empty and drops empty terms', () => {
    expect(term('', 'MS', 'MS:1000031')?.name).toBe('MS:1000031')
    expect(term('', '', '')).toBeUndefined()
  })
})

describe('empty strings', () => {
  it('treats empty ORCID and email as missing', () => {
    const a = Person.create('', 'One', 'Ada', undefined, '')
    const b = Person.create('', 'Two', 'Bea', undefined, '')
    const [first, second] = [a, b].map(toPersonSummary)
    expect(first.email).toBeUndefined()
    expect(first.key).not.toBe(second.key)
  })
})
