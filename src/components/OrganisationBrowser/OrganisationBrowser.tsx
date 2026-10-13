import { useId, useMemo, useState } from 'react'
import { Banner, Button, FormControl, Heading, Select, SkeletonBox, Stack, Text } from '@primer/react'
import type { OrganisationBrowserProps } from '../../types/organisation.ts'
import { useResult } from '../../util/useResult.ts'
import { useProjectPage } from '../../util/useProjectPage.ts'
import { ArcList } from '../ArcList/ArcList.tsx'
import { ArcListSkeleton } from '../ArcList/ArcListSkeleton.tsx'
import styles from './OrganisationBrowser.module.css'

export function OrganisationBrowser({ fetchPublicGroups, fetchMembershipGroups, fetchGroupProjects, onArcClick }: OrganisationBrowserProps) {
  const headingId = useId()
  const publicGroups = useResult(fetchPublicGroups)
  const membershipGroups = useResult(fetchMembershipGroups)
  const [selection, setSelection] = useState<{
    fetchGroupProjects: OrganisationBrowserProps['fetchGroupProjects']; groupId: number; page: number
  } | null>(null)
  const activeSelection = selection?.fetchGroupProjects === fetchGroupProjects ? selection : null
  const load = useMemo(() => activeSelection
    ? (signal: AbortSignal) => fetchGroupProjects(activeSelection.groupId, { page: activeSelection.page, perPage: 10, signal })
    : null, [activeSelection, fetchGroupProjects])
  const projects = useProjectPage(load)

  const mine = membershipGroups.status === 'success' ? membershipGroups.result : []
  const memberIds = new Set(mine.map(group => group.id))
  const others = publicGroups.status === 'success' ? publicGroups.result.filter(group => !memberIds.has(group.id)) : []
  const groupedByMembership = membershipGroups.status === 'success'
  const loading = publicGroups.status === 'loading' || membershipGroups.status === 'loading'

  function select(value: string) {
    setSelection(value ? { fetchGroupProjects, groupId: Number(value), page: 1 } : null)
  }

  return <section className={styles.section} aria-labelledby={headingId}>
    <Heading as="h2" variant="medium" id={headingId} className={styles.heading}>Browse organisations</Heading>
    <Text as="p" className={styles.subtitle}>Select a GitLab group to browse its repositories, including those in subgroups.</Text>
    {loading && <Stack direction="vertical" gap="condensed" role="status" aria-label="Loading organisations…">
      <Text>Loading organisations…</Text>
      <SkeletonBox height="32px" width="100%" className={styles.selector} aria-hidden="true" />
    </Stack>}
    {publicGroups.status === 'error' && <Banner variant="critical" role="alert"
      primaryAction={<Banner.PrimaryAction onClick={publicGroups.retry}>Retry public organisations</Banner.PrimaryAction>}>
      <Banner.Title as="h3">Unable to load public organisations</Banner.Title>
      <Banner.Description>{publicGroups.error}</Banner.Description>
    </Banner>}
    {membershipGroups.status === 'error' && <Banner variant="critical" role="alert"
      primaryAction={<Banner.PrimaryAction onClick={membershipGroups.retry}>Retry your organisations</Banner.PrimaryAction>}>
      <Banner.Title as="h3">Unable to load your organisations</Banner.Title>
      <Banner.Description>{membershipGroups.error} You can still browse public organisations.</Banner.Description>
    </Banner>}
    {(!loading || mine.length + others.length > 0) && <FormControl className={styles.selector} disabled={mine.length + others.length === 0}>
      <FormControl.Label>Organisation</FormControl.Label>
      <Select block value={activeSelection?.groupId ?? ''} onChange={event => select(event.target.value)}>
        <Select.Option value="">Select an organisation</Select.Option>
        {groupedByMembership && <Select.OptGroup label="Your organisations">
          {mine.map(group => <Select.Option key={group.id} value={String(group.id)}>{group.full_path}</Select.Option>)}
        </Select.OptGroup>}
        <Select.OptGroup label={groupedByMembership ? 'Other public organisations' : 'Public organisations'}>
          {others.map(group => <Select.Option key={group.id} value={String(group.id)}>{group.full_path}</Select.Option>)}
        </Select.OptGroup>
      </Select>
      <FormControl.Caption>{groupedByMembership
        ? 'Your organisations are groups where your account is a member. Other public organisations are available to everyone.'
        : 'Public organisations are available without login.'}</FormControl.Caption>
    </FormControl>}
    {!loading && publicGroups.status === 'success' && mine.length + others.length === 0
      && <Text as="p" role="status">No organisations found.</Text>}
    {projects.status === 'loading' && <ArcListSkeleton label="Loading organisation repositories…" />}
    {projects.status === 'error' && <Banner variant="critical" role="alert"
      primaryAction={<Banner.PrimaryAction onClick={projects.retry}>Retry organisation repositories</Banner.PrimaryAction>}>
      <Banner.Title as="h3">Unable to load organisation repositories</Banner.Title>
      <Banner.Description>{projects.error}</Banner.Description>
    </Banner>}
    {projects.status === 'success' && activeSelection && <>
      {projects.result.items.length > 0
        ? <ArcList projects={projects.result.items} label="Organisation repositories" onArcClick={onArcClick} />
        : <Text as="p" role="status">No repositories found on this page.</Text>}
      <Stack as="nav" aria-label="Organisation repository pages" direction="horizontal" justify="space-between" align="center" className={styles.pagination}>
        <Button disabled={projects.result.previousPage === null}
          onClick={() => setSelection({ ...activeSelection, page: projects.result.previousPage! })}>Previous</Button>
        <Text>Page {projects.result.page}</Text>
        <Button disabled={projects.result.nextPage === null}
          onClick={() => setSelection({ ...activeSelection, page: projects.result.nextPage! })}>Next</Button>
      </Stack>
    </>}
  </section>
}
