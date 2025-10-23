import { useEffect } from 'react'
import { useFetchData } from './useFetchData'

/**
 * Hook for fetching data with automatic polling/refresh at intervals
 * Extends useFetchData with polling capability
 */
export function useAutoRefresh<T>(
  fetchFn: () => Promise<Response>,
  options?: {
    initialValue?: T
    pollInterval?: number // milliseconds, undefined = no polling
    skip?: boolean
    onError?: (error: string) => void
  }
): { data: T | null; loading: boolean; error: string | null; refetch: () => Promise<void> } {
  const { data, loading, error, refetch } = useFetchData<T>(fetchFn, options)

  useEffect(() => {
    if (!options?.pollInterval || options.skip) return

    const interval = setInterval(() => {
      refetch().catch((err) => {
        console.error('Auto-refresh error:', err)
      })
    }, options.pollInterval)

    return () => clearInterval(interval)
  }, [options?.pollInterval, options?.skip, refetch])

  return { data, loading, error, refetch }
}
