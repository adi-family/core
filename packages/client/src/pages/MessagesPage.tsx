import { useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { ListPage } from "@/components/ListPage"
import { MessagePresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import { listMessagesConfig } from "@adi/api-contracts"
import type { Message } from "../../../types"

export function MessagesPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  return (
    <ListPage<Message>
      title="Messages"
      description="View all messages in the system"
      fetchFn={async () => {
        const data = await client.run(listMessagesConfig)
        // Wrap in Response-like object for compatibility with ListPage
        return new Response(JSON.stringify(data), { status: 200 })
      }}
      presenter={MessagePresenter}
      emptyMessage="No messages found"
    />
  )
}
