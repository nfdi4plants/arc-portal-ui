import { Link, Stack, Text } from '@primer/react'
import type { GitLabProject } from '../../types/gitlab.ts'
import styles from './ArcList.module.css'

interface ArcListProps {
  projects: GitLabProject[]
  label: string
  onArcClick?: (url: string, name: string) => void
}

export function ArcList({ projects, label, onArcClick }: ArcListProps) {
  return (
    <ul className={styles.list} aria-label={label}>
      {projects.map(project => (
        <li key={project.id} className={styles.item} onClick={onArcClick ? event => {
          event.preventDefault()
          onArcClick(project.web_url, project.name)
        } : undefined}>
          <Stack direction="horizontal" align="baseline" justify="space-between" gap="normal">
            <Link href={project.web_url} className={styles.name}>{project.name}</Link>
            <Text size="medium" whiteSpace="nowrap" className={styles.stars} aria-label={`${project.star_count} stars`}>
              <span aria-hidden="true">☆ </span>{project.star_count}
            </Text>
          </Stack>
          <Text as="p" size="small" className={styles.namespace}>{project.path_with_namespace}</Text>
          <Text as="p" size="medium" className={styles.description}>{project.description?.trim() || 'No description provided.'}</Text>
        </li>
      ))}
    </ul>
  )
}
