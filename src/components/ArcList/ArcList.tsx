import { Link } from '@primer/react'
import type { GitLabProject } from '../../types/gitlab.ts'
import styles from './ArcList.module.css'

interface ArcListProps {
  projects: GitLabProject[]
  label: string
}

export function ArcList({ projects, label }: ArcListProps) {
  return (
    <ul className={styles.list} aria-label={label}>
      {projects.map(project => (
        <li key={project.id} className={styles.item}>
          <div className={styles.heading}>
            <Link href={project.web_url} className={styles.name}>{project.name}</Link>
            <span className={styles.stars} aria-label={`${project.star_count} stars`}>
              <span aria-hidden="true">☆ </span>{project.star_count}
            </span>
          </div>
          <p className={styles.namespace}>{project.path_with_namespace}</p>
          <p className={styles.description}>{project.description?.trim() || 'No description provided.'}</p>
        </li>
      ))}
    </ul>
  )
}
