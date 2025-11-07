import { useState, useEffect } from 'react'

/**
 * Generic hook for fetching data from API endpoints with loading and error states
 */
export function useFetchData<T>(
  fetchFn: () => Promise<Response>,
  options?: {
    initialValue?: T
    skip?: boolean
    onError?: (error: string) => void
  }
): { data: T | null; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(options?.initialValue ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (options?.skip) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetchFn()
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Error fetching data:', errorText)
        setError(errorText)
        options?.onError?.(errorText)
        setLoading(false)
        return
      }

      const responseData = await res.json()
      setData(responseData as T)
      setLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Error fetching data:', err)
      setError(errorMessage)
      options?.onError?.(errorMessage)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData().catch((err) => {
      console.error('Unexpected error in fetchData:', err)
    })
     
  }, [options?.skip])

  return { data, loading, error, refetch: fetchData }
}
