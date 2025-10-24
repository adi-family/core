import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Badge } from "./badge";

export function TableDemo() {
  const users = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "active" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Developer", status: "active" },
    { id: 3, name: "Carol White", email: "carol@example.com", role: "Designer", status: "inactive" },
    { id: 4, name: "David Brown", email: "david@example.com", role: "Developer", status: "active" },
  ];

  return (
    <section id="tables" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tables</h2>
        <p className="text-gray-600">Data table components with headers and rows</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-mono text-xs">{user.id}</TableCell>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-gray-600">{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                <Badge variant={user.status === "active" ? "success" : "gray"}>
                  {user.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
