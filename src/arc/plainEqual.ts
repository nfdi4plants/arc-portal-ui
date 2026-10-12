// Structural equality for plain data (primitives, arrays, plain objects), the
// shape selectors return. Class instances such as arctrl objects are only equal
// by identity, which is one more reason selectors must not return them.
export function plainEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((value, index) => plainEqual(value, b[index]))
  }
  if (Array.isArray(b)) return false

  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const keys = Object.keys(aRecord)
  if (keys.length !== Object.keys(bRecord).length) return false
  return keys.every((key) => Object.hasOwn(bRecord, key) && plainEqual(aRecord[key], bRecord[key]))
}
