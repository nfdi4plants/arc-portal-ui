import { SkeletonBox, Text } from '@primer/react'
import styles from './ArcList.module.css'

export function ArcListSkeleton({ label }: { label: string }) {
  return <div role="status" aria-label={label}>
    <Text as="p" size="medium" className={styles.loadingLabel}>{label}</Text>
    <ul className={styles.list} aria-hidden="true">
      {[0, 1, 2].map(index => <li key={index} className={styles.skeletonItem}>
        <SkeletonBox height="20px" width="65%" />
        <SkeletonBox height="14px" width="40%" />
        <SkeletonBox height="14px" width="100%" />
        <SkeletonBox height="14px" width="80%" />
      </li>)}
    </ul>
  </div>
}
