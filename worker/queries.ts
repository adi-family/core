import type { Sql, MaybeRow, PendingQuery } from 'postgres';

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export type GitlabMetadata = {
  provider: 'gitlab';
  repo: string;
  host?: string;
  iid?: number;
};

export type GithubMetadata = {
  provider: 'github';
  repo: string;
  host?: string;
};

export type JiraMetadata = {
  provider: 'jira';
  host: string;
  key: string;
  project_key: string;
};

export type IssueMetadata = GitlabMetadata | GithubMetadata | JiraMetadata;

export type GitlabIssue = {
  id: string;
  iid?: number | null;
  title: string;
  updated_at: Date;
  metadata: GitlabMetadata;
};

export type GithubIssue = {
  id: string;
  iid?: number | null;
  title: string;
  updated_at: Date;
  metadata: GithubMetadata;
};

export type JiraIssue = {
  id: string;
  title: string;
  updated_at: Date;
  metadata: JiraMetadata;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  project_id: string | null;
  task_source_id: string | null;
  source_gitlab_issue: GitlabIssue | null;
  source_github_issue: GithubIssue | null;
  source_jira_issue: JiraIssue | null;
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

export type Project = {
  id: string;
  name: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  status: string;
  project_id?: string;
  task_source_id?: string;
  source_gitlab_issue?: GitlabIssue;
  source_github_issue?: GithubIssue;
  source_jira_issue?: JiraIssue;
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
  if (!input.title || input.title.trim() === '') {
    throw new Error('Task title is required and cannot be empty');
  }

  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  if (!validStatuses.includes(input.status)) {
    throw new Error(`Invalid task status: ${input.status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  const cols = ['title', 'description', 'status', 'project_id', 'task_source_id', 'source_gitlab_issue'] as const;
  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, cols)}
    RETURNING *
  `);
  if (!task) {
    throw new Error('Failed to create task');
  }
  return task;
};

export const addTaskFileSpaces = async (sql: Sql, taskId: string, fileSpaceIds: string[]): Promise<void> => {
  if (fileSpaceIds.length === 0) {
    return;
  }

  const values = fileSpaceIds.map(fileSpaceId => ({
    task_id: taskId,
    file_space_id: fileSpaceId
  }));

  await get(sql`
    INSERT INTO task_file_spaces ${sql(values, 'task_id', 'file_space_id')}
    ON CONFLICT (task_id, file_space_id) DO NOTHING
  `);
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

export const getAllEnabledProjects = async (sql: Sql): Promise<Project[]> => {
  return await get(sql<Project[]>`
    SELECT * FROM projects
    WHERE enabled = true
    ORDER BY created_at ASC
  `);
};

export const getProjectById = async (sql: Sql, id: string): Promise<Project | null> => {
  const [project] = await get(sql<Project[]>`
    SELECT * FROM projects
    WHERE id = ${id}
  `);
  if (!project) {
    return null;
  }
  return project;
};

export type FileSpace = {
  id: string;
  project_id: string;
  name: string;
  type: 'gitlab' | 'github';
  config: unknown;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type TaskSource = {
  id: string;
  project_id: string;
  name: string;
  type: 'gitlab_issues' | 'jira' | 'github_issues';
  config: unknown;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export const getFileSpacesByProjectId = async (sql: Sql, projectId: string): Promise<FileSpace[]> => {
  return await get(sql<FileSpace[]>`
    SELECT * FROM file_spaces
    WHERE project_id = ${projectId} AND enabled = true
    ORDER BY created_at ASC
  `);
};

export const getTaskSourcesByProjectId = async (sql: Sql, projectId: string): Promise<TaskSource[]> => {
  return await get(sql<TaskSource[]>`
    SELECT * FROM task_sources
    WHERE project_id = ${projectId} AND enabled = true
    ORDER BY created_at ASC
  `);
};

export const getFileSpaceById = async (sql: Sql, id: string): Promise<FileSpace | null> => {
  const [fileSpace] = await get(sql<FileSpace[]>`
    SELECT * FROM file_spaces
    WHERE id = ${id}
  `);
  if (!fileSpace) {
    return null;
  }
  return fileSpace;
};

export const getTaskSourceById = async (sql: Sql, id: string): Promise<TaskSource | null> => {
  const [taskSource] = await get(sql<TaskSource[]>`
    SELECT * FROM task_sources
    WHERE id = ${id}
  `);
  return taskSource || null;
};
