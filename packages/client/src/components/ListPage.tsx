import { type ReactNode } from 'react'
import { PageCard } from './PageCard'
import { PresenterTable } from './PresenterTable'
import { useFetchData } from '@/hooks/useFetchData'
import type { BasePresenter } from '@/presenters/base'

interface ListPageProps<T> {
  title: string
  description?: string
  fetchFn: () => Promise<Response>
  presenter: new (...args: any[]) => BasePresenter<T>
  buildPresenter?: (item: T) => BasePresenter<T>
  emptyMessage?: string
  headerActions?: ReactNode
}

/**
 * Generic list page component with standardized structure
 * Handles data fetching, loading, and rendering with PresenterTable
 */
export function ListPage<T>({
  title,
  description,
  fetchFn,
  presenter,
  buildPresenter,
  emptyMessage = 'No items found',
  headerActions,
}: ListPageProps<T>) {
  const { data, loading } = useFetchData<T[]>(fetchFn, { initialValue: [] })

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
