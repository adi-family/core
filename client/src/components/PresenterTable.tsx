import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { BasePresenter } from "@/presenters/base"

interface PresenterTableProps<T, P extends BasePresenter<T>> {
  presenter: new (model: T, ...args: any[]) => P
  items: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T) => void
  buildPresenter?: (item: T) => P
}

export function PresenterTable<T, P extends BasePresenter<T>>({
  presenter: PresenterClass,
  items,
  loading = false,
  emptyMessage = "No items found",
  onRowClick,
  buildPresenter,
}: PresenterTableProps<T, P>) {
  if (loading) {
    return <div className="text-center py-8 text-sm uppercase tracking-wide text-gray-500">Loading...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm uppercase tracking-wide text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  const createPresenter = (item: T): P => {
    return buildPresenter ? buildPresenter(item) : new PresenterClass(item)
  }

  // Create a presenter instance to get column configuration
  const firstPresenter = createPresenter(items[0])
  const columns = firstPresenter.getTableColumns()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const itemPresenter = createPresenter(item)
          const actions = itemPresenter.getActions()

          return (
            <TableRow
              key={itemPresenter.getId()}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render(item)}
                </TableCell>
              ))}
              <TableCell>
                <div className="flex gap-2">
                  {actions.map((action, idx) => (
                    <Button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.onClick(item)
                      }}
                      disabled={action.disabled || action.loading}
                      variant={action.variant}
                      size="sm"
                    >
                      {action.loading ? '...' : action.label}
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
