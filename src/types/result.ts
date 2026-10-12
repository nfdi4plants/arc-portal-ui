export type Result<T> =
  | { success: true; value: T }
  | { success: false; error: string }

export function Success<T>(value: T): Result<T> { return { success: true, value } }
export function Failure<T>(error: string): Result<T> { return { success: false, error } }

export function bind<T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> {
  return result.success === true ? fn(result.value) : Failure(result.error)
}

export async function bindAsync<T, U>(result: Result<T> | Promise<Result<T>>, fn: (value: T) => Promise<Result<U>>): Promise<Result<U>> {
  const awaited = await result
  return awaited.success === true ? fn(awaited.value) : Failure(awaited.error)
}

export function map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
  return result.success === true ? Success(fn(result.value)) : Failure(result.error)
}

export function pipe<T>(value: T) {
  return {
    to<U>(fn: (value: T) => U) { return pipe(fn(value)) },
    value() { return value },
  }
}

export function pipeResult<T>(result: Result<T>) {
  return {
    bind<U>(fn: (value: T) => Result<U>) { return pipeResult(bind(result, fn)) },
    map<U>(fn: (value: T) => U) { return pipeResult(map(result, fn)) },
    result: () => result,
  }
}
