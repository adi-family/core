import { ListPage } from "@/components/ListPage"
import { MessagePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Message } from "../../../types"

export function MessagesPage() {
  return (
    <ListPage<Message>
      title="Messages"
      description="View all messages in the system"
      fetchFn={() => client.messages.$get()}
      presenter={MessagePresenter}
      emptyMessage="No messages found"
    />
  )
}
