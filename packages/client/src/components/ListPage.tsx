import { type ReactNode } from 'react'
import { PageCard } from './PageCard'
import { PresenterTable } from './PresenterTable'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { BasePresenter } from '@/presenters/base'

interface ListPageProps<T> {
  title: string
  description?: string
  fetchFn: () => Promise<Response>
  presenter: new (...args: any[]) => BasePresenter<T>
  buildPresenter?: (item: T) => BasePresenter<T>
  emptyMessage?: string
  headerActions?: ReactNode
  pollInterval?: number // Auto-refresh interval in milliseconds (optional)
}

/**
 * Generic list page component with standardized structure
 * Handles data fetching, loading, and rendering with PresenterTable
 * Supports optional auto-refresh/polling
 */
export function ListPage<T>({
  title,
  description,
  fetchFn,
  presenter,
  buildPresenter,
  emptyMessage = 'No items found',
  headerActions,
  pollInterval,
}: ListPageProps<T>) {
  // Use auto-refresh hook if pollInterval is provided, otherwise use regular fetch
  // Note: We pass pollInterval to a single hook to avoid conditional hook calls
  const { data, loading } = useAutoRefresh<T[]>(fetchFn, {
    initialValue: [],
    pollInterval, // undefined means no polling
  })

  return (
    <div className="mx-auto">
      <PageCard title={title} description={description}>
        {headerActions && <div className="mb-4">{headerActions}</div>}
        <PresenterTable
          presenter={presenter}
          items={data ?? []}
          loading={loading}
          emptyMessage={emptyMessage}
          buildPresenter={buildPresenter}
        />
      </PageCard>
    </div>
  )
}
