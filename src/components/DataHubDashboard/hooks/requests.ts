import { AUTH_FAILED_MESSAGE } from '../../../api/gitlab/client.ts'
import { Failure, Success, type Result } from '../../../types/result.ts'

export interface ResourceValue<T> {
  data: T
  tokenRejected: boolean
}

/** An expired runtime session may still browse public resources. Retry once only. */
export async function withPublicFallback<T>(token: string | undefined,
  call: (token?: string) => Promise<Result<T>>): Promise<Result<ResourceValue<T>>> {
  let result = await call(token)
  const tokenRejected = !!token && !result.success && result.error === AUTH_FAILED_MESSAGE
  if (tokenRejected) result = await call()
  return result.success ? Success({ data: result.value, tokenRejected }) : Failure(result.error)
}
