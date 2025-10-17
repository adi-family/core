import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BasePresenter } from "@/presenters/base"

interface PresenterTableProps<T, P extends BasePresenter<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    return <div className="text-center py-4">Loading...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
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
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.onClick(item)
                      }}
                      disabled={action.disabled || action.loading}
                      className={`px-3 py-1 text-sm rounded-md ${getActionButtonClass(action.variant)} ${
                        action.disabled || action.loading ? 'opacity-50 cursor-not-allowed' : ''
                      } ${action.loading ? 'animate-pulse' : ''}`}
                    >
                      {action.loading ? '...' : action.label}
                    </button>
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

function getActionButtonClass(variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'): string {
  switch (variant) {
    case 'destructive':
      return 'bg-red-600 text-white hover:bg-red-700'
    case 'outline':
      return 'border border-gray-300 hover:bg-gray-100'
    case 'secondary':
      return 'bg-gray-200 hover:bg-gray-300'
    case 'ghost':
      return 'hover:bg-gray-100'
    case 'link':
      return 'text-blue-600 hover:underline'
    case 'default':
    default:
      return 'bg-blue-600 text-white hover:bg-blue-700'
  }
}
