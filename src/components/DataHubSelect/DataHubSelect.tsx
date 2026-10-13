import { FormControl, Select } from '@primer/react'
import type { GitLabInstance } from '../../types/gitlab.ts'

interface DataHubSelectProps {
  availableDataHubs: readonly GitLabInstance[]
  current: GitLabInstance
  setCurrent: (dataHub: GitLabInstance) => void
  className?: string
}

export function DataHubSelect({ availableDataHubs, current, setCurrent, className }: DataHubSelectProps) {
  return <FormControl className={className}>
    <FormControl.Label>GitLab instance</FormControl.Label>
    <Select block value={current.id} onChange={event => {
      const dataHub = availableDataHubs.find(dataHub => dataHub.id === event.target.value)
      if (dataHub) setCurrent(dataHub)
    }}>
      {availableDataHubs.map(dataHub => <Select.Option key={dataHub.id} value={dataHub.id}>{dataHub.name}</Select.Option>)}
    </Select>
    {current.description && <FormControl.Caption>{current.description}</FormControl.Caption>}
  </FormControl>
}
