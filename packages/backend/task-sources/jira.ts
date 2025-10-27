import {BaseTaskSource} from './base';
import {execSync} from 'child_process';
import {createLogger} from '@utils/logger.ts';
import {sql} from '@db/client.ts';
import {findSecretById} from '@db/secrets.ts';
import type {JiraMetadata, TaskSource, TaskSourceIssue, TaskSourceJiraConfig} from "@types";

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

    if (!this.jiraConfig.access_token_secret_id) {
      this.logger.error('Access token secret ID is required for Jira integration');
      throw new Error('Access token secret ID is required for Jira integration');
    }

    const secretResult = await findSecretById(sql, this.jiraConfig.access_token_secret_id);
    if (!secretResult.ok) {
      this.logger.error('Failed to retrieve access token secret');
      throw new Error('Failed to retrieve access token secret');
    }

    const accessToken = secretResult.data.value;

    // Determine auth header format based on token format
    // If token contains ':', assume it's email:token format for Basic Auth
    let authHeader: string;
    if (accessToken.includes(':')) {
      const encodedToken = Buffer.from(accessToken).toString('base64');
      authHeader = `-H "Authorization: Basic ${encodedToken}"`;
    } else {
      authHeader = `-H "Authorization: Bearer ${accessToken}"`;
    }

    try {
      const result = execSync(
        `curl -s -X GET ${authHeader} -H "Content-Type: application/json" "${this.jiraConfig.host}/rest/api/2/search?jql=${encodeURIComponent(jqlQuery)}"`,
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
            updatedAt: issue.fields.updated,
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
