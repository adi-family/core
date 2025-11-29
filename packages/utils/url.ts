export const buildUrl = (base: string, params: Record<string, string>): string => {
  const url = new URL(base)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return url.toString()
}
