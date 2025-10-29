import {BaseTaskSource} from './base';
import {createLogger} from '@utils/logger.ts';
import {sql} from '@db/client.ts';
import {findSecretById, updateSecret} from '@db/secrets.ts';
import type {JiraMetadata, TaskSource, TaskSourceIssue, TaskSourceJiraConfig} from "@types";
import { JIRA_OAUTH_CLIENT_ID, JIRA_OAUTH_CLIENT_SECRET } from '@backend/config';

interface JiraSearchResponse {
  total?: number;
  issues?: Array<{
    id: string;
    key: string;
    fields?: {
      summary?: string;
      description?: unknown;
      updated?: string;
    };
  }>;
  nextPageToken?: string;
}

/**
 * Extract plain text from Atlassian Document Format (ADF)
 * Jira API v3 returns description as ADF object, not plain text
 */
function extractTextFromADF(adf: unknown): string {
  if (!adf || typeof adf !== 'object') {
    return '';
  }

  const doc = adf as any;

  // If it's already a string, return it
  if (typeof doc === 'string') {
    return doc;
  }

  const extractFromNode = (node: any): string => {
    if (!node) return '';

    // Text node - return the text content
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // Node with content array - recursively extract from children
    if (Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join('');
    }

    return '';
  };

  // Extract text from all content nodes
  if (Array.isArray(doc.content)) {
    return doc.content.map((node: any) => {
      const text = extractFromNode(node);
      // Add newline after paragraphs, headings, etc.
      if (node.type === 'paragraph' || node.type === 'heading') {
        return text + '\n';
      }
      return text;
    }).join('').trim();
  }

  return '';
}

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
    // Use jql_filter if provided, otherwise use default query
    let jqlQuery: string;
    if (this.jiraConfig.jql_filter && this.jiraConfig.jql_filter.trim() !== '') {
      jqlQuery = this.jiraConfig.jql_filter;
      // Add ORDER BY if not already present in custom JQL
      if (!jqlQuery.toLowerCase().includes('order by')) {
        jqlQuery += ' ORDER BY updated DESC';
      }
    } else if (this.jiraConfig.project_key && this.jiraConfig.project_key.trim() !== '') {
      jqlQuery = `project = ${this.jiraConfig.project_key} AND resolution = Unresolved ORDER BY updated DESC`;
    } else {
      // Default: fetch all unresolved issues the user has access to, sorted by most recently updated
      jqlQuery = 'resolution = Unresolved ORDER BY updated DESC';
    }

    if (!this.jiraConfig.access_token_secret_id) {
      this.logger.error('Access token secret ID is required for Jira integration');
      throw new Error('Access token secret ID is required for Jira integration');
    }

    const secret = await findSecretById(sql, this.jiraConfig.access_token_secret_id);
    let accessToken = secret.value;

    // Check if OAuth token is expired and refresh if needed
    if (secret.token_type === 'oauth' && secret.expires_at) {
      const expiresAt = new Date(secret.expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        this.logger.info('OAuth token expired, refreshing...', {
          expiresAt: secret.expires_at,
          now: now.toISOString()
        });

        if (!secret.refresh_token) {
          throw new Error('OAuth token expired and no refresh token available');
        }

        // Refresh the token
        const clientId = JIRA_OAUTH_CLIENT_ID;
        const clientSecret = JIRA_OAUTH_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new Error('Jira OAuth not configured - cannot refresh token');
        }

        const tokenUrl = 'https://auth.atlassian.com/oauth/token';
        const refreshResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: secret.refresh_token,
          }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          this.logger.error('Failed to refresh OAuth token', {
            status: refreshResponse.status,
            error: errorText
          });
          throw new Error(`Failed to refresh OAuth token: ${errorText}`);
        }

        const tokenData = await refreshResponse.json() as any;
        const newAccessToken = tokenData.access_token;
        const newRefreshToken = tokenData.refresh_token || secret.refresh_token;
        const expiresIn = tokenData.expires_in;
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Update the secret in the database
        await updateSecret(sql, secret.id, {
          value: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: newExpiresAt,
        });

        this.logger.info('Successfully refreshed OAuth token', {
          newExpiresAt,
          secretId: secret.id
        });

        accessToken = newAccessToken;
      }
    }

    // Prepare headers and API URL
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    let apiUrl: string;

    this.logger.debug('Secret details:', {
      tokenType: secret.token_type,
      hasCloudId: !!this.jiraConfig.cloud_id,
      host: this.jiraConfig.host,
      tokenFormat: accessToken.includes(':') ? 'email:token' : 'plain'
    });

    if (secret.token_type === 'oauth') {
      // OAuth token - use Bearer auth with cloud ID
      const cloudId = this.jiraConfig.cloud_id;
      if (!cloudId) {
        throw new Error('Cloud ID is required for OAuth authentication');
      }

      headers['Authorization'] = `Bearer ${accessToken}`;
      apiUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`;
      this.logger.debug('Using OAuth authentication with cloud ID');
    } else if (accessToken.includes(':')) {
      // API token with email:token format - use Basic Auth
      const encodedToken = Buffer.from(accessToken).toString('base64');
      headers['Authorization'] = `Basic ${encodedToken}`;
      apiUrl = `${this.jiraConfig.host}/rest/api/3/search/jql`;
      this.logger.debug('Using Basic Auth (email:token format)');
    } else {
      // Plain token - use Bearer auth
      headers['Authorization'] = `Bearer ${accessToken}`;
      apiUrl = `${this.jiraConfig.host}/rest/api/3/search/jql`;
      this.logger.debug('Using Bearer auth (plain token)');
    }

    this.logger.debug('API request details:', {
      url: apiUrl,
      hasAuthHeader: !!headers['Authorization'],
      jql: jqlQuery
    });

    try {
      const maxResults = 100;
      let nextPageToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const requestBody: any = {
          jql: jqlQuery,
          maxResults,
          fields: ['summary', 'description', 'updated', 'key']
        };

        // Add nextPageToken only if it exists (for subsequent pages)
        if (nextPageToken) {
          requestBody.nextPageToken = nextPageToken;
        }

        this.logger.debug('Making API request:', {
          method: 'POST',
          url: apiUrl,
          bodyKeys: Object.keys(requestBody),
          jqlLength: jqlQuery.length,
          hasNextPageToken: !!nextPageToken,
          maxResults
        });

        // Make direct POST request to /rest/api/3/search/jql
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });

        this.logger.debug('Received response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error('Jira API error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            requestUrl: apiUrl,
            authType: secret.token_type
          });
          throw new Error(`Jira API error (${response.status}): ${errorText}`);
        }

        const result = await response.json() as JiraSearchResponse;

        // Log the response for debugging
        this.logger.debug('Jira API response:', {
          total: result.total,
          issueCount: result.issues?.length,
          hasNextPageToken: !!result.nextPageToken,
          firstIssue: result.issues?.[0] ? {
            id: result.issues[0].id,
            key: result.issues[0].key,
            fields: Object.keys(result.issues[0].fields || {})
          } : null
        });

        if (result.issues) {
          for (const issue of result.issues) {
            if (!issue || !issue.key) {
              this.logger.warn('Skipping issue without key:', { issueId: issue?.id });
              continue;
            }

            // Extract project key from issue key (e.g., "PROJ-123" -> "PROJ")
            const projectKey = this.jiraConfig.project_key || issue.key.split('-')[0] || 'UNKNOWN';

            const metadata: JiraMetadata = {
              provider: 'jira',
              key: issue.key,
              project_key: projectKey,
              host: this.jiraConfig.host
            };

            yield {
              id: issue.id,
              iid: null,
              title: issue.fields?.summary || 'Untitled',
              description: extractTextFromADF(issue.fields?.description),
              updatedAt: issue.fields?.updated || new Date().toISOString(),
              uniqueId: `jira-${issue.id}`,
              metadata
            };
          }
        }

        // Check if there are more results using nextPageToken
        nextPageToken = result.nextPageToken;
        hasMore = !!nextPageToken;

        this.logger.debug('Pagination status:', {
          fetchedCount: result.issues?.length || 0,
          nextPageToken: nextPageToken ? 'present' : 'none',
          hasMore
        });
      }
    } catch (error) {
      this.logger.error('Failed to fetch Jira issues:', error);
      throw error;
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for JiraTaskSource');
  }
}
