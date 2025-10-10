import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Message {
  id: string
  session_id: string
  data: Record<string, unknown>
  created_at: string
}

export function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => {
        setMessages(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Error fetching messages:", error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>View all messages in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No messages found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-mono text-xs">
                      {message.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {message.session_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="max-w-md">
                      <pre className="text-xs overflow-auto max-h-20">
                        {JSON.stringify(message.data, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(message.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
