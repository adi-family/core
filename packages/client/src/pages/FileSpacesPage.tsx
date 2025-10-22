import { ListPage } from "@/components/ListPage"
import { FileSpacePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { FileSpace } from "@types"

export function FileSpacesPage() {
  return (
    <ListPage<FileSpace>
      title="File Spaces"
      description="Manage repository file spaces for tasks"
      fetchFn={() => client["file-spaces"].$get({ query: {} })}
      presenter={FileSpacePresenter}
      emptyMessage="No file spaces found"
    />
  )
}
