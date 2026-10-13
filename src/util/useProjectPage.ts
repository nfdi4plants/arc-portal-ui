import type { ArcPage } from '../types/arc.ts'
import type { Result } from '../types/result.ts'
import { useResult } from './useResult.ts'

export function useProjectPage(load: ((signal: AbortSignal) => Promise<Result<ArcPage>>) | null) {
  return useResult(load)
}
