import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { MessagePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Message } from "../../../backend/types"

export function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMessages = async () => {
      const res = await client.messages.$get()
      if (!res.ok) {
        console.error("Error fetching messages:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setMessages(data)
      setLoading(false)
    }

    fetchMessages().catch((error) => {
      console.error("Error fetching messages:", error)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>View all messages in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenterTable
            presenter={MessagePresenter}
            items={messages}
            loading={loading}
            emptyMessage="No messages found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
