interface EmptyStateProps {
  message?: string
  className?: string
}

/**
 * Reusable empty state component
 */
export function EmptyState({ message = 'No items found', className }: EmptyStateProps) {
  return (
    <div className={className ?? 'text-center py-8 text-sm uppercase tracking-wide text-gray-500'}>
      {message}
    </div>
  )
}
