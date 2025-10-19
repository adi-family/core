import {BaseTaskSource, type TaskSource, type TaskSourceIssue, type JiraMetadata, type TaskSourceJiraConfig} from './base';
import {execSync} from 'child_process';
import {createLogger} from '@utils/logger.ts';

export class JiraTaskSource extends BaseTaskSource {
  private jiraConfig: TaskSourceJiraConfig;
  private logger = createLogger({ namespace: 'JiraTaskSource' });

  constructor(taskSource: TaskSource) {
    super(taskSource);
    if (taskSource.type !== 'jira') {
      throw new Error('Invalid task source type for JiraTaskSource');
    }
    this.jiraConfig = taskSource.config;
  }

  async *getIssues(): AsyncIterable<TaskSourceIssue> {
    const jqlQuery = this.jiraConfig.jql_filter || `project = ${this.jiraConfig.project_key} AND status = "To Do"`;

    try {
      const result = execSync(
        `curl -s -X GET -H "Content-Type: application/json" "${this.jiraConfig.host}/rest/api/2/search?jql=${encodeURIComponent(jqlQuery)}"`,
        {encoding: 'utf-8'}
      );

      const data = JSON.parse(result);
      if (data.issues) {
        for (const issue of data.issues) {
          const metadata: JiraMetadata = {
            provider: 'jira',
            key: issue.key,
            project_key: this.jiraConfig.project_key,
            host: this.jiraConfig.host
          };

          yield {
            id: issue.id,
            iid: null,
            title: issue.fields.summary,
            description: issue.fields.description,
            updatedAt: new Date(issue.fields.updated),
            uniqueId: `jira-${issue.id}`,
            metadata
          };
        }
      }
    } catch (error) {
      this.logger.error('Failed to fetch Jira issues:', error);
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for JiraTaskSource');
  }
}
