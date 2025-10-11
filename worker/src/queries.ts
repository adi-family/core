import type { Sql, MaybeRow, PendingQuery } from 'postgres';

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source_gitlab_issue: unknown | null;
  source_github_issue: unknown | null;
  source_jira_issue: unknown | null;
  created_at: Date;
  updated_at: Date;
};

export type Session = {
  id: string;
  task_id: string | null;
  runner: string;
  created_at: Date;
  updated_at: Date;
};

export type Message = {
  id: string;
  session_id: string;
  data: unknown;
  created_at: Date;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  status: string;
  source_gitlab_issue?: unknown;
};

export type CreateSessionInput = {
  task_id: string;
  runner: string;
};

export type CreateMessageInput = {
  session_id: string;
  data: unknown;
};

export const createTask = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const cols = ['title', 'description', 'status', 'source_gitlab_issue'] as const;
  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, cols)}
    RETURNING *
  `);
  if (!task) {
    throw new Error('Failed to create task');
  }
  return task;
};

export const updateTaskStatus = async (sql: Sql, id: string, status: string): Promise<Task> => {
  const [task] = await get(sql<Task[]>`
    UPDATE tasks
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `);
  if (!task) {
    throw new Error('Failed to update task status');
  }
  return task;
};

export const createSession = async (sql: Sql, input: CreateSessionInput): Promise<Session> => {
  const cols = ['task_id', 'runner'] as const;
  const [session] = await get(sql<Session[]>`
    INSERT INTO sessions ${sql(input, cols)}
    RETURNING *
  `);
  if (!session) {
    throw new Error('Failed to create session');
  }
  return session;
};

export const createMessage = async (sql: Sql, input: CreateMessageInput): Promise<Message> => {
  const cols = ['session_id', 'data'] as const;
  const [message] = await get(sql<Message[]>`
    INSERT INTO messages ${sql(input, cols)}
    RETURNING *
  `);
  if (!message) {
    throw new Error('Failed to create message');
  }
  return message;
};
