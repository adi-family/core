import { ListPage } from "@/components/ListPage"
import { SessionPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Session } from "../../../types"

export function SessionsPage() {
  return (
    <ListPage<Session>
      title="Sessions"
      description="View all sessions in the system"
      fetchFn={() => client.sessions.$get()}
      presenter={SessionPresenter}
      emptyMessage="No sessions found"
    />
  )
}
