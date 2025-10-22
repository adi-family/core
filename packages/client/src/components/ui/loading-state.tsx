interface LoadingStateProps {
  message?: string
  className?: string
}

/**
 * Reusable loading state component
 */
export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={className ?? 'text-center py-8 text-sm uppercase tracking-wide text-gray-500'}>
      {message}
    </div>
  )
}
