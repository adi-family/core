import { useState } from 'react'

/**
 * Custom hook for managing form state including loading, error, and success states
 */
export function useFormHandler<T = void>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (
    submitFn: () => Promise<Response>,
    options?: {
      onSuccess?: (data: T) => void
      onError?: (error: string) => void
      successMessage?: boolean
    }
  ) => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await submitFn()

      if (!res.ok) {
        const errorText = await res.text()
        setError(errorText)
        options?.onError?.(errorText)
        setLoading(false)
        return { success: false, data: null }
      }

      const data = await res.json() as T
      if (options?.successMessage !== false) {
        setSuccess(true)
      }
      options?.onSuccess?.(data)
      setLoading(false)
      return { success: true, data }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      options?.onError?.(errorMessage)
      setLoading(false)
      return { success: false, data: null }
    }
  }

  const reset = () => {
    setLoading(false)
    setError(null)
    setSuccess(false)
  }

  return {
    loading,
    error,
    success,
    handleSubmit,
    reset,
    setError,
    setSuccess,
  }
}
