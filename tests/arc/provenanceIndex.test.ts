import { ARC, ArcTable, CompositeCell, CompositeHeader, IOType, OntologyAnnotation } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import type { ProvenanceDataset, ProvenanceIndex, ProvenanceProcess } from '../../src/arc/provenance/types'
import { crateJson } from '../helpers/sampleCrate'

let index: ProvenanceIndex

beforeAll(() => {
  index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

function processNamed(name: string): ProvenanceProcess {
  const process = index.processes.find((candidate) => candidate.name === name)
  if (!process) throw new Error(`No process named ${name}`)
  return process
}

function tableOf(arc: ARC, assayIdentifier: string, tableName: string): ArcTable {
  const table = arc.Assays.find((assay) => assay.Identifier === assayIdentifier)?.Tables.find((t) => t.Name === tableName)
  if (!table) throw new Error(`No table ${assayIdentifier}/${tableName}`)
  return table
}

const sorted = (values: string[]) => [...values].sort()

describe('buildProvenanceIndex on the sample ARC', () => {
  it('finds all datasets, processes, rows and nodes', () => {
    expect(index.datasets).toHaveLength(11)
    expect(index.processes).toHaveLength(15)
    expect(index.rows).toHaveLength(139)
    expect(index.nodes).toHaveLength(102)
  })

  it('fills the lookup maps', () => {
    const groupCount = index.processes.reduce((sum, p) => sum + p.inputGroups.length + p.outputGroups.length, 0)
    expect(index.datasetById.size).toBe(11)
    expect(index.processByKey.size).toBe(15)
    expect(index.rowById.size).toBe(139)
    expect(index.nodeById.size).toBe(102)
    expect(index.groupById.size).toBe(groupCount)
  })

  it('lists studies, assays and runs with their identifiers', () => {
    expect(index.datasets.map((dataset) => dataset.id)).toEqual([
      'studies/TalinumGenomeDraft/',
      'studies/TalinumSamples-STRI/',
      'assays/GCqTOF_targets/',
      'assays/MassHunter_targets/',
      'assays/RNASeq/',
      'runs/deseq2/',
      'runs/fastqc/',
      'runs/kallisto/',
      'runs/sleuth/',
      'runs/isaSampleToRawDataSeq/',
      'runs/shiny/',
    ])
    expect(index.datasetById.get('runs/kallisto/')).toEqual({ id: 'runs/kallisto/', kind: 'run', identifier: 'kallisto' })
    expect(index.datasetById.get('assays/RNASeq/')?.kind).toBe('assay')
    expect(index.datasetById.get('studies/TalinumGenomeDraft/')?.kind).toBe('study')
  })

  it('keys and names the processes of each dataset after the tables of the parsed ARC', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const tableNamesOf = (dataset: ProvenanceDataset) => {
      const owners = dataset.kind === 'study' ? arc.Studies : dataset.kind === 'assay' ? arc.Assays : arc.Runs
      return owners
        .filter((owner) => owner.Identifier === dataset.identifier)
        .flatMap((owner) => owner.Tables.map((table) => table.Name))
    }

    for (const dataset of index.datasets) {
      const processes = index.processes.filter((process) => process.datasetId === dataset.id)
      expect(sorted(processes.map((process) => process.name))).toEqual(sorted(tableNamesOf(dataset)))
      expect(processes.map((process) => process.key)).toEqual(processes.map((process) => `${dataset.id}::${process.name}`))
    }
    expect(index.processByKey.get('assays/MassHunter_targets/::Metabolite Identification')?.name).toBe('Metabolite Identification')
  })

  it('has no process for the main invocation of a run', () => {
    expect(index.processes.filter((process) => process.datasetId === 'runs/deseq2/')).toEqual([])
    expect(index.processes.filter((process) => process.datasetId === 'runs/kallisto/').map((process) => process.name)).toEqual([
      'kallisto-index',
      'kallisto-quant',
    ])
  })

  it('numbers the rows of a table from 0 and names them after it', () => {
    const process = processNamed('plant_material')

    expect(process.rowIds).toHaveLength(6)
    expect(process.rowIds[0]).toBe('studies/TalinumSamples-STRI/::plant_material#0')
    expect(process.rowIds[5]).toBe('studies/TalinumSamples-STRI/::plant_material#5')
    expect(index.rowById.get(process.rowIds[0])).toMatchObject({
      name: 'plant_material_0',
      processKey: process.key,
      datasetId: 'studies/TalinumSamples-STRI/',
      inputs: ['DB_097'],
      outputs: ['CAM_01'],
    })
  })

  it('reads protocol, parameter values, units and accessions of a row', () => {
    const row = index.rowById.get('studies/TalinumSamples-STRI/::plant_material#0')

    expect(row?.annotations[0]).toEqual({
      name: 'Protocol',
      value: 'plant_material.md',
      unit: null,
      accession: null,
      category: 'protocol',
    })
    expect(row?.annotations).toContainEqual({
      name: 'humidity day',
      value: '37',
      unit: 'percent',
      accession: 'http://purl.org/nfdi4plants/ontology/dpbo/DPBO_0000005',
      category: 'parameter',
    })
    expect(row?.annotations.map((annotation) => annotation.category)).toEqual([
      'protocol',
      'parameter',
      'parameter',
      'parameter',
      'parameter',
      'parameter',
    ])
  })

  it('splits gas_chromatography into four signatures by injection mode and sample type', () => {
    const process = processNamed('gas_chromatography')

    expect(process.signatures).toHaveLength(4)
    for (const signature of process.signatures) {
      expect(signature.distinguishing.map((a) => a.name)).toEqual(['Chromatography injection mode', 'MS sample type'])
    }
  })

  it('groups the gas_chromatography inputs by the signatures they feed', () => {
    const process = processNamed('gas_chromatography')

    expect(process.inputGroups.map((g) => g.label)).toEqual(['Inputs A', 'Inputs B'])
    expect(process.inputGroups.map((g) => sorted(g.nodeIds))).toEqual([
      sorted(['Std. Mix 5µM', 'blank 1', 'blank 2']),
      sorted(['DB23', 'DB24', 'DB26', 'DB39', 'DB40', 'DB41']),
    ])
    expect(process.outputGroups.map((g) => g.label)).toEqual(['Outputs A', 'Outputs B', 'Outputs C', 'Outputs D'])
  })

  it('aggregates the gas_chromatography rows into four group edges', () => {
    const process = processNamed('gas_chromatography')

    expect(process.groupEdges).toHaveLength(4)
    expect(process.groupEdges.map((edge) => edge.rowIds.length).sort()).toEqual([4, 4, 6, 6])
  })

  it.each([
    ['plant_material', 2, 2, 2, 2],
    ['kallisto-quant', 2, 2, 1, 2],
    ['mh-quant-results', 1, 1, 1, 1],
  ])('%s has %i signatures, %i input groups, %i output groups and %i edges', (name, signatures, inputs, outputs, edges) => {
    const process = processNamed(name)

    expect(process.signatures).toHaveLength(signatures)
    expect(process.inputGroups).toHaveLength(inputs)
    expect(process.outputGroups).toHaveLength(outputs)
    expect(process.groupEdges).toHaveLength(edges)
  })

  it('keeps a sample in the datasets that use it', () => {
    const node = index.nodeById.get('CAM_01')

    expect(node?.kind).toBe('sample')
    expect(node?.datasetIds).toEqual(
      expect.arrayContaining(['studies/TalinumSamples-STRI/', 'assays/GCqTOF_targets/', 'assays/RNASeq/']),
    )
  })

  it('merges the characteristics of a source', () => {
    const node = index.nodeById.get('DB_097')

    expect(node?.kind).toBe('source')
    expect(node?.annotations).toContainEqual(
      expect.objectContaining({ name: 'organism', value: 'Talinum fruticosum', category: 'characteristic' }),
    )
  })

  it('puts the factors of a row on its output sample', () => {
    expect(index.nodeById.get('CAM_01')?.annotations).toContainEqual(
      expect.objectContaining({ name: 'Photosynthesis mode', value: 'CAM', category: 'factor' }),
    )
  })

  it('names data nodes by their path without a leading "./"', () => {
    const node = index.nodeById.get('runs/kallisto/kallisto_results/DB_097/abundance.h5')

    expect(node?.kind).toBe('data')
    expect(index.nodes.some((candidate) => candidate.id.startsWith('./'))).toBe(false)
  })

  it('links a node to the rows that produce and consume it', () => {
    const processKeyOf = (rowId: string) => index.rowById.get(rowId)?.processKey

    expect(index.producedBy.get('CAM_01')?.map(processKeyOf)).toEqual(['studies/TalinumSamples-STRI/::plant_material'])
    expect(index.consumedBy.get('CAM_01')?.map(processKeyOf)).toEqual([
      'assays/GCqTOF_targets/::metabolite_extraction',
      'assays/RNASeq/::rna_extraction',
    ])
  })
})

describe('buildProvenanceIndex on edited ARCs', () => {
  it('reads a Date column and lets it split a signature', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const table = tableOf(arc, 'GCqTOF_targets', 'gas_chromatography')
    const dates = Array.from({ length: table.RowCount }, (_, row) => CompositeCell.freeText(row === 0 ? '2015-01-12' : ''))
    table.AddColumn(CompositeHeader.date(), dates)

    const dated = buildProvenanceIndex(arc)
    const rowId = 'assays/GCqTOF_targets/::gas_chromatography#0'
    const process = dated.processByKey.get('assays/GCqTOF_targets/::gas_chromatography')!
    const signature = process.signatures.find((candidate) => candidate.rowIds.includes(rowId))

    expect(dated.rowById.get(rowId)?.annotations).toContainEqual({
      name: 'Date',
      value: '2015-01-12',
      unit: null,
      accession: null,
      category: 'date',
    })
    expect(dated.rowById.get('assays/GCqTOF_targets/::gas_chromatography#1')?.annotations.map((a) => a.category)).not.toContain('date')
    expect(process.signatures).toHaveLength(5)
    expect(signature?.rowIds).toEqual([rowId])
    expect(signature?.distinguishing.map((a) => a.name)).toContain('Date')
  })

  it('reads performer and comment columns as step annotations', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const table = tableOf(arc, 'RNASeq', 'illumina')
    const cells = (text: string) => Array.from({ length: table.RowCount }, () => CompositeCell.freeText(text))
    table.AddColumn(CompositeHeader.performer(), cells('Ada Lovelace'))
    table.AddColumn(CompositeHeader.comment('lane'), cells('L001'))

    const edited = buildProvenanceIndex(arc)
    const row = edited.rowById.get('assays/RNASeq/::illumina#0')

    expect(row?.annotations).toContainEqual({ name: 'Performer', value: 'Ada Lovelace', unit: null, accession: null, category: 'performer' })
    expect(row?.annotations).toContainEqual({ name: 'lane', value: 'L001', unit: null, accession: null, category: 'comment' })
  })

  it('ignores the characteristics a sample has in other tables when it compares rows', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const frozen = ArcTable.init('storage_check')
    frozen.AddColumn(CompositeHeader.input(IOType.sample()), [CompositeCell.freeText('DB23')])
    frozen.AddColumn(CompositeHeader.characteristic(OntologyAnnotation.create('storage')), [
      CompositeCell.term(OntologyAnnotation.create('frozen')),
    ])
    arc.Assays.find((assay) => assay.Identifier === 'RNASeq')!.AddTable(frozen)

    const edited = buildProvenanceIndex(arc)
    const gas = edited.processByKey.get('assays/GCqTOF_targets/::gas_chromatography')!
    const check = edited.processByKey.get('assays/RNASeq/::storage_check')!

    expect(edited.nodeById.get('DB23')?.annotations).toContainEqual(
      expect.objectContaining({ name: 'storage', value: 'frozen', category: 'characteristic' }),
    )
    expect(check.signatures).toHaveLength(1)
    expect(check.signatures[0].annotations).toContainEqual(
      expect.objectContaining({ name: 'storage', value: 'frozen', category: 'characteristic' }),
    )

    expect(gas.signatures).toHaveLength(4)
    for (const signature of gas.signatures) {
      expect(signature.annotations.map((a) => a.name)).not.toContain('storage')
      expect(signature.distinguishing.map((a) => a.name)).toEqual(['Chromatography injection mode', 'MS sample type'])
    }
    expect(gas.inputGroups.map((g) => sorted(g.nodeIds))).toEqual([
      sorted(['Std. Mix 5µM', 'blank 1', 'blank 2']),
      sorted(['DB23', 'DB24', 'DB26', 'DB39', 'DB40', 'DB41']),
    ])
    expect(gas.groupEdges).toHaveLength(4)
    expect(gas.groupEdges.map((edge) => edge.rowIds.length).sort()).toEqual([4, 4, 6, 6])
  })

  it('creates no process for a table without rows', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    arc.Assays.find((assay) => assay.Identifier === 'RNASeq')!.Tables.push(ArcTable.init('empty_table'))

    const edited = buildProvenanceIndex(arc)

    expect(edited.processes).toHaveLength(15)
    expect(edited.processByKey.has('assays/RNASeq/::empty_table')).toBe(false)
  })

  it('keeps the process of rows that have no inputs and outputs', () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const table = tableOf(arc, 'GCqTOF_targets', 'mass_spec')
    table.RemoveColumns([table.Headers.findIndex((h) => h.isInput), table.Headers.findIndex((h) => h.isOutput)])

    const patched = buildProvenanceIndex(arc)
    const process = patched.processByKey.get('assays/GCqTOF_targets/::mass_spec')!

    expect(patched.processes).toHaveLength(15)
    expect(patched.rows).toHaveLength(139)
    expect(process.rowIds).toHaveLength(20)
    expect(patched.rowById.get(process.rowIds[0])).toMatchObject({ inputs: [], outputs: [] })
    expect(process.signatures).toEqual([])
    expect(process.inputGroups).toEqual([])
    expect(process.outputGroups).toEqual([])
    expect(process.groupEdges).toEqual([])
    expect(patched.processByKey.get('assays/GCqTOF_targets/::gas_chromatography')!.signatures).toHaveLength(4)
  })
})
