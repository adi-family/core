import { BaseTaskSource } from './base';
import { createLogger } from '@utils/logger.ts';
import { sql } from '@db/client.ts';
import { findSecretById, updateSecret } from '@db/secrets.ts';
import type { JiraMetadata, TaskSource, TaskSourceIssue, TaskSourceJiraConfig } from "@types";
import { JIRA_OAUTH_CLIENT_ID, JIRA_OAUTH_CLIENT_SECRET } from '@backend/config';

interface JiraSearchResponseIssue {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    description?: unknown;
    updated?: string;
  };
}

interface JiraSearchResponse {
  total?: number;
  issues?: JiraSearchResponseIssue[];
  nextPageToken?: string;
}

interface ADFNode {
  type?: string;
  text?: string;
  content?: ADFNode[];
  [key: string]: unknown;
}

interface ADFDocument {
  content?: ADFNode[];
  [key: string]: unknown;
}

interface Secret {
  id: string;
  refresh_token?: string;
  expires_at?: string;
  [key: string]: unknown;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Extract plain text from Atlassian Document Format (ADF)
 * Jira API v3 returns description as ADF object, not plain text
 */
function extractTextFromADF(adf: unknown): string {
  if (!adf || typeof adf !== 'object') {
    return '';
  }

  const doc = adf as ADFDocument;

  // If it's already a string, return it
  if (typeof doc === 'string') {
    return doc;
  }

  const extractFromNode = (node: ADFNode): string => {
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
    return doc.content.map((node) => {
      const text = extractFromNode(node);
      // Add newline after paragraphs, headings, etc.
      if (node.type === 'paragraph' || node.type === 'heading') {
        return `${text  }\n`;
      }
      return text;
    }).join('').trim();
  }

  return '';
}

/**
 * Authentication configuration for Jira API
 */
interface JiraAuthConfig {
  headers: Record<string, string>
  apiUrl: string
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

  /**
   * Build JQL query from config
   */
  private buildJqlQuery(): string {
    if (this.jiraConfig.jql_filter?.trim()) {
      let jql = this.jiraConfig.jql_filter
      if (!jql.toLowerCase().includes('order by')) {
        jql += ' ORDER BY updated DESC'
      }
      return jql
    }

    if (this.jiraConfig.project_key?.trim()) {
      return `project = ${this.jiraConfig.project_key} AND resolution = Unresolved ORDER BY updated DESC`
    }

    return 'resolution = Unresolved ORDER BY updated DESC'
  }

  /**
   * Refresh OAuth token if expired
   */
  private async refreshOAuthToken(secret: Secret): Promise<string> {
    if (!secret.refresh_token) {
      throw new Error('OAuth token expired and no refresh token available')
    }

    if (!JIRA_OAUTH_CLIENT_ID || !JIRA_OAUTH_CLIENT_SECRET) {
      throw new Error('Jira OAuth not configured - cannot refresh token')
    }

    this.logger.info('OAuth token expired, refreshing...', {
      expiresAt: secret.expires_at,
      now: new Date().toISOString()
    })

    const refreshResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: JIRA_OAUTH_CLIENT_ID,
        client_secret: JIRA_OAUTH_CLIENT_SECRET,
        refresh_token: secret.refresh_token,
      }),
    })

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text()
      this.logger.error('Failed to refresh OAuth token', {
        status: refreshResponse.status,
        error: errorText
      })
      throw new Error(`Failed to refresh OAuth token: ${errorText}`)
    }

    const tokenData = await refreshResponse.json() as OAuthTokenResponse
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    await updateSecret(sql, secret.id, {
      value: tokenData.access_token,
      refresh_token: tokenData.refresh_token || secret.refresh_token,
      expires_at: newExpiresAt,
    })

    this.logger.info('Successfully refreshed OAuth token', {
      newExpiresAt,
      secretId: secret.id
    })

    return tokenData.access_token
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    if (!this.jiraConfig.access_token_secret_id) {
      throw new Error('Access token secret ID is required for Jira integration')
    }

    const secret = await findSecretById(sql, this.jiraConfig.access_token_secret_id)

    if (secret.token_type === 'oauth' && secret.expires_at) {
      const expiresAt = new Date(secret.expires_at)
      if (expiresAt <= new Date()) {
        return await this.refreshOAuthToken(secret)
      }
    }

    return secret.value
  }

  /**
   * Setup authentication headers and API URL
   */
  private async setupAuthentication(): Promise<JiraAuthConfig> {
    const accessToken = await this.getAccessToken()
    const secret = await findSecretById(sql, this.jiraConfig.access_token_secret_id!)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    this.logger.debug('Secret details:', {
      tokenType: secret.token_type,
      hasCloudId: !!this.jiraConfig.cloud_id,
      host: this.jiraConfig.host,
      tokenFormat: accessToken.includes(':') ? 'email:token' : 'plain'
    })

    if (secret.token_type === 'oauth') {
      if (!this.jiraConfig.cloud_id) {
        throw new Error('Cloud ID is required for OAuth authentication')
      }
      headers['Authorization'] = `Bearer ${accessToken}`
      const apiUrl = `https://api.atlassian.com/ex/jira/${this.jiraConfig.cloud_id}/rest/api/3/search/jql`
      this.logger.debug('Using OAuth authentication with cloud ID')
      return { headers, apiUrl }
    }

    if (accessToken.includes(':')) {
      headers['Authorization'] = `Basic ${Buffer.from(accessToken).toString('base64')}`
      this.logger.debug('Using Basic Auth (email:token format)')
    } else {
      headers['Authorization'] = `Bearer ${accessToken}`
      this.logger.debug('Using Bearer auth (plain token)')
    }

    return { headers, apiUrl: `${this.jiraConfig.host}/rest/api/3/search/jql` }
  }

  /**
   * Fetch a single page of issues
   */
  private async fetchIssuesPage(
    apiUrl: string,
    headers: Record<string, string>,
    jqlQuery: string,
    nextPageToken?: string
  ): Promise<JiraSearchResponse> {
    const requestBody: Record<string, unknown> = {
      jql: jqlQuery,
      maxResults: 100,
      fields: ['summary', 'description', 'updated', 'key']
    }

    if (nextPageToken) {
      requestBody.nextPageToken = nextPageToken
    }

    this.logger.debug('Making API request:', {
      method: 'POST',
      url: apiUrl,
      hasNextPageToken: !!nextPageToken,
    })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error('Jira API error:', {
        status: response.status,
        body: errorText,
      })
      throw new Error(`Jira API error (${response.status}): ${errorText}`)
    }

    return await response.json() as JiraSearchResponse
  }

  /**
   * Transform Jira issue to TaskSourceIssue
   */
  private transformIssue(issue: JiraSearchResponseIssue): TaskSourceIssue | null {
    if (!issue?.key) {
      this.logger.warn('Skipping issue without key:', { issueId: issue?.id })
      return null
    }

    const projectKey = this.jiraConfig.project_key || issue.key.split('-')[0] || 'UNKNOWN'

    const metadata: JiraMetadata = {
      provider: 'jira',
      key: issue.key,
      project_key: projectKey,
      host: this.jiraConfig.host
    }

    return {
      id: issue.id,
      iid: null,
      title: issue.fields?.summary || 'Untitled',
      description: extractTextFromADF(issue.fields?.description),
      updatedAt: issue.fields?.updated || new Date().toISOString(),
      uniqueId: `jira-${issue.id}`,
      metadata
    }
  }

  /**
   * Fetch all issues with pagination
   */
  async *getIssues(): AsyncIterable<TaskSourceIssue> {
    const jqlQuery = this.buildJqlQuery()
    const { headers, apiUrl } = await this.setupAuthentication()

    this.logger.debug('API request details:', {
      url: apiUrl,
      jql: jqlQuery
    })

    try {
      let nextPageToken: string | undefined = undefined
      let hasMore = true

      while (hasMore) {
        const result = await this.fetchIssuesPage(apiUrl, headers, jqlQuery, nextPageToken)

        this.logger.debug('Jira API response:', {
          total: result.total,
          issueCount: result.issues?.length,
          hasNextPageToken: !!result.nextPageToken,
        })

        if (result.issues) {
          for (const issue of result.issues) {
            const taskIssue = this.transformIssue(issue)
            if (taskIssue) {
              yield taskIssue
            }
          }
        }

        nextPageToken = result.nextPageToken
        hasMore = !!nextPageToken

        this.logger.debug('Pagination status:', {
          fetchedCount: result.issues?.length || 0,
          hasMore
        })
      }
    } catch (error) {
      this.logger.error('Failed to fetch Jira issues:', error)
      throw error
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for JiraTaskSource');
  }
}
