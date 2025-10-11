import {BaseTaskSource, type TaskSource, type TaskSourceIssue} from './base';
import {execSync} from 'child_process';
import chalk from 'chalk';

export type JiraConfig = {
  project_key: string;
  jql_filter?: string;
  host: string;
};

export class JiraTaskSource extends BaseTaskSource {
  private jiraConfig: JiraConfig;

  constructor(taskSource: TaskSource) {
    super(taskSource);
    this.jiraConfig = taskSource.config as JiraConfig;
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
          yield {
            id: issue.id,
            iid: null,
            title: issue.fields.summary,
            description: issue.fields.description,
            updatedAt: new Date(issue.fields.updated),
            uniqueId: `jira-${issue.id}`,
            metadata: {
              provider: 'jira',
              key: issue.key,
              project_key: this.jiraConfig.project_key,
              host: this.jiraConfig.host
            }
          };
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to fetch Jira issues:'), error);
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for JiraTaskSource');
  }
}
