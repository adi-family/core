import { useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { ListPage } from "@/components/ListPage"
import { SessionPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import { listSessionsConfig } from "@adi/api-contracts"
import type { Session } from "../../../types"

export function SessionsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  return (
    <ListPage<Session>
      title="Sessions"
      description="View all sessions in the system"
      fetchFn={async () => {
        const data = await client.run(listSessionsConfig)
        // Wrap in Response-like object for compatibility with ListPage
        return new Response(JSON.stringify(data), { status: 200 })
      }}
      presenter={SessionPresenter}
      emptyMessage="No sessions found"
    />
  )
}
