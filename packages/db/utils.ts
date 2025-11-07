/**
 * Filter columns to only include those present in the input object
 * This prevents postgres from throwing UNDEFINED_VALUE errors when updating with partial data
 */
export function filterPresentColumns<T extends readonly string[]>(
  input: Record<string, unknown>,
  columns: T
): T[number][] {
  return columns.filter(col => col in input) as T[number][]
}
