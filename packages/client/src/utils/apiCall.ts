/**
 * Wrapper utility for API calls with standardized error handling
 */
export async function apiCall<T>(
  fn: () => Promise<Response>,
  options?: {
    onError?: (error: string) => void
    onSuccess?: (data: T) => void
  }
): Promise<{ data: T | null; error: string | null; ok: boolean }> {
  try {
    const res = await fn()

    if (!res.ok) {
      const errorText = await res.text()
      console.error('API Error:', errorText)
      options?.onError?.(errorText)
      return { data: null, error: errorText, ok: false }
    }

    const data = await res.json() as T
    options?.onSuccess?.(data)
    return { data, error: null, ok: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    console.error('API Call Exception:', err)
    options?.onError?.(errorMessage)
    return { data: null, error: errorMessage, ok: false }
  }
}
