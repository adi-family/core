import { useNavigate } from "react-router-dom"
import { Button } from '@adi-simple/ui/button'
import { ListPage } from "@/components/ListPage"
import { FileSpacePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { FileSpace } from "@types"

export function FileSpacesPage() {
  const navigate = useNavigate()

  return (
    <ListPage<FileSpace>
      title="File Spaces"
      description="Manage repository file spaces for tasks"
      fetchFn={() => client["file-spaces"].$get({ query: {} })}
      presenter={FileSpacePresenter}
      emptyMessage="No file spaces found"
      headerActions={
        <Button
          onClick={() => navigate("/create-file-space")}
          className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
        >
          Create File Space
        </Button>
      }
    />
  )
}
