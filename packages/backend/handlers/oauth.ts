import { Hono } from 'hono';
import type { Sql } from 'postgres';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createLogger } from '@utils/logger';
import * as secretQueries from '@db/secrets';
import { getClerkUserId } from '../middleware/clerk';

const logger = createLogger({ namespace: 'oauth-handler' });

/**
 * Jira OAuth configuration schema
 * Atlassian OAuth 2.0 (3LO) implementation
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */
const jiraOAuthConfigSchema = z.object({
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client secret is required'),
  redirect_uri: z.string().url('Valid redirect URI is required'),
  scopes: z.string().default('read:jira-work write:jira-work offline_access'),
});

const jiraCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

const jiraExchangeTokenSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string(),
  secretName: z.string().min(1),
  cloudId: z.string().optional(),
});

export function createOAuthRoutes(db: Sql) {
  const app = new Hono();

  // ============================================================================
  // JIRA OAUTH
  // ============================================================================

  /**
   * Initiate Jira OAuth flow
   * GET /oauth/jira/authorize?client_id=xxx&redirect_uri=xxx&state=xxx
   */
  app.get('/jira/authorize', zValidator('query', jiraOAuthConfigSchema.omit({ client_secret: true })), async (c) => {
    const { client_id, redirect_uri, scopes } = c.req.valid('query');
    const state = crypto.randomUUID();

    // Build authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.set('audience', 'api.atlassian.com');
    authUrl.searchParams.set('client_id', client_id);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirect_uri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('prompt', 'consent');

    logger.info('Initiating Jira OAuth flow', { client_id, state });

    return c.json({
      authUrl: authUrl.toString(),
      state,
    });
  });

  /**
   * Exchange authorization code for tokens
   * POST /oauth/jira/exchange
   * Body: { projectId, code, secretName, cloudId? }
   */
  app.post(
    '/jira/exchange',
    zValidator('json', jiraExchangeTokenSchema),
    async (c) => {
      const userId = getClerkUserId(c);
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { projectId, code, secretName, cloudId } = c.req.valid('json');

      // Get OAuth config from environment
      const clientId = process.env.JIRA_OAUTH_CLIENT_ID;
      const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET;
      const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        logger.error('Jira OAuth not configured. Missing environment variables.');
        return c.json(
          { error: 'Jira OAuth is not configured on the server' },
          500
        );
      }

      try {
        // Exchange code for tokens
        const tokenUrl = 'https://auth.atlassian.com/oauth/token';
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          logger.error('Failed to exchange code for token', { status: tokenResponse.status, error: errorText });
          return c.json(
            { error: 'Failed to exchange authorization code', details: errorText },
            500
          );
        }

        const tokenData = await tokenResponse.json() as any;
        const { access_token, refresh_token, expires_in, scope } = tokenData;

        // Calculate expiration timestamp
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Fetch accessible resources (Jira sites)
        const resourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';
        const resourcesResponse = await fetch(resourcesUrl, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/json',
          },
        });

        if (!resourcesResponse.ok) {
          logger.error('Failed to fetch accessible resources', { status: resourcesResponse.status });
          return c.json(
            { error: 'Failed to fetch accessible Jira sites' },
            500
          );
        }

        const resources = await resourcesResponse.json() as any[];
        logger.info('Fetched accessible Jira sites', { count: resources.length });

        // Store OAuth token as secret
        const secretResult = await secretQueries.createSecret(db, {
          project_id: projectId,
          name: secretName,
          value: access_token,
          description: `Jira OAuth token (auto-managed)${cloudId ? ` for cloud ID ${cloudId}` : ''}`,
          oauth_provider: 'jira',
          token_type: 'oauth',
          refresh_token,
          expires_at: expiresAt,
          scopes: scope,
        });

        if (!secretResult.ok) {
          logger.error('Failed to store OAuth secret', { error: secretResult.error });
          return c.json({ error: 'Failed to store OAuth token' }, 500);
        }

        logger.info('Successfully stored Jira OAuth token', { secretId: secretResult.data.id });

        return c.json({
          success: true,
          secretId: secretResult.data.id,
          expiresAt: expiresAt,
          sites: resources.map((r: any) => ({
            id: r.id,
            url: r.url,
            name: r.name,
            scopes: r.scopes,
          })),
        });
      } catch (error) {
        logger.error('Error during token exchange', { error });
        return c.json({ error: 'Internal server error during token exchange' }, 500);
      }
    }
  );

  /**
   * Refresh an expired OAuth token
   * POST /oauth/jira/refresh/:secretId
   */
  app.post(
    '/jira/refresh/:secretId',
    zValidator('param', z.object({ secretId: z.string().uuid() })),
    async (c) => {
      const userId = getClerkUserId(c);
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { secretId } = c.req.valid('param');

      // Get OAuth config from environment
      const clientId = process.env.JIRA_OAUTH_CLIENT_ID;
      const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        logger.error('Jira OAuth not configured');
        return c.json({ error: 'Jira OAuth is not configured on the server' }, 500);
      }

      try {
        // Fetch existing secret
        const secretResult = await secretQueries.findSecretById(db, secretId);
        if (!secretResult.ok) {
          return c.json({ error: 'Secret not found' }, 404);
        }

        const secret = secretResult.data;

        // Verify it's an OAuth token
        if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'jira') {
          return c.json({ error: 'Secret is not a Jira OAuth token' }, 400);
        }

        if (!secret.refresh_token) {
          return c.json({ error: 'No refresh token available' }, 400);
        }

        // Refresh the token
        const tokenUrl = 'https://auth.atlassian.com/oauth/token';
        const tokenResponse = await fetch(tokenUrl, {
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

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          logger.error('Failed to refresh token', { status: tokenResponse.status, error: errorText });
          return c.json(
            { error: 'Failed to refresh token', details: errorText },
            500
          );
        }

        const tokenData = await tokenResponse.json() as any;
        const { access_token, refresh_token, expires_in, scope } = tokenData;

        // Calculate new expiration
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Update secret with new token
        const updateResult = await secretQueries.updateSecret(db, secretId, {
          value: access_token,
          refresh_token: refresh_token || secret.refresh_token, // Keep old refresh token if new one not provided
          expires_at: expiresAt,
          scopes: scope || secret.scopes,
        });

        if (!updateResult.ok) {
          logger.error('Failed to update secret with refreshed token', { error: updateResult.error });
          return c.json({ error: 'Failed to update secret' }, 500);
        }

        logger.info('Successfully refreshed Jira OAuth token', { secretId });

        return c.json({
          success: true,
          expiresAt: expiresAt,
        });
      } catch (error) {
        logger.error('Error during token refresh', { error });
        return c.json({ error: 'Internal server error during token refresh' }, 500);
      }
    }
  );

  // ============================================================================
  // GITLAB OAUTH
  // ============================================================================

  /**
   * Initiate GitLab OAuth flow
   * GET /oauth/gitlab/authorize
   * GitLab OAuth docs: https://docs.gitlab.com/ee/api/oauth2.html
   */
  app.get('/gitlab/authorize', async (c) => {
    const gitlabHost = process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com';
    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return c.json({ error: 'GitLab OAuth not configured. Missing CLIENT_ID or REDIRECT_URI.' }, 500);
    }

    const state = crypto.randomUUID();
    // Use only 'api' scope which covers all API access including repositories and user info
    const scopes = 'api';

    const authUrl = new URL(`${gitlabHost}/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);

    logger.info('Initiating GitLab OAuth flow', { clientId, gitlabHost, state, redirectUri });

    return c.json({
      authUrl: authUrl.toString(),
      state,
    });
  });

  /**
   * Exchange GitLab authorization code for tokens
   * POST /oauth/gitlab/exchange
   */
  app.post(
    '/gitlab/exchange',
    zValidator('json', z.object({
      projectId: z.string().uuid(),
      code: z.string(),
      secretName: z.string().min(1),
      gitlabHost: z.string().url().optional(),
    })),
    async (c) => {
      const userId = getClerkUserId(c);
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { projectId, code, secretName, gitlabHost } = c.req.valid('json');

      const host = gitlabHost || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com';
      const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET;
      const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        logger.error('GitLab OAuth not configured');
        return c.json({ error: 'GitLab OAuth is not configured on the server' }, 500);
      }

      try {
        // Exchange code for token
        const tokenUrl = `${host}/oauth/token`;
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          logger.error('Failed to exchange GitLab code', { status: tokenResponse.status, error: errorText });
          return c.json({ error: 'Failed to exchange authorization code', details: errorText }, 500);
        }

        const tokenData = await tokenResponse.json() as any;
        const { access_token, refresh_token, expires_in, scope } = tokenData;

        // Calculate expiration
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Fetch user info to verify token
        const userResponse = await fetch(`${host}/api/v4/user`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        });

        if (!userResponse.ok) {
          logger.error('Failed to fetch GitLab user', { status: userResponse.status });
          return c.json({ error: 'Failed to verify GitLab token' }, 500);
        }

        const userData = await userResponse.json() as any;
        logger.info('GitLab OAuth successful', { username: userData.username, host });

        // Store OAuth token as secret
        const secretResult = await secretQueries.createSecret(db, {
          project_id: projectId,
          name: secretName,
          value: access_token,
          description: `GitLab OAuth token for ${userData.username} (auto-managed)`,
          oauth_provider: 'gitlab',
          token_type: 'oauth',
          refresh_token,
          expires_at: expiresAt,
          scopes: scope,
        });

        if (!secretResult.ok) {
          logger.error('Failed to store GitLab OAuth secret', { error: secretResult.error });
          return c.json({ error: 'Failed to store OAuth token' }, 500);
        }

        logger.info('Successfully stored GitLab OAuth token', { secretId: secretResult.data.id });

        return c.json({
          success: true,
          secretId: secretResult.data.id,
          expiresAt: expiresAt,
          user: {
            username: userData.username,
            name: userData.name,
            email: userData.email,
          },
        });
      } catch (error) {
        logger.error('Error during GitLab token exchange', { error });
        return c.json({ error: 'Internal server error during token exchange' }, 500);
      }
    }
  );

  /**
   * Refresh GitLab OAuth token
   * POST /oauth/gitlab/refresh/:secretId
   */
  app.post(
    '/gitlab/refresh/:secretId',
    zValidator('param', z.object({ secretId: z.string().uuid() })),
    async (c) => {
      const userId = getClerkUserId(c);
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { secretId } = c.req.valid('param');

      const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET;
      const gitlabHost = process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com';

      if (!clientId || !clientSecret) {
        logger.error('GitLab OAuth not configured');
        return c.json({ error: 'GitLab OAuth is not configured' }, 500);
      }

      try {
        const secretResult = await secretQueries.findSecretById(db, secretId);
        if (!secretResult.ok) {
          return c.json({ error: 'Secret not found' }, 404);
        }

        const secret = secretResult.data;

        if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'gitlab') {
          return c.json({ error: 'Secret is not a GitLab OAuth token' }, 400);
        }

        if (!secret.refresh_token) {
          return c.json({ error: 'No refresh token available' }, 400);
        }

        // Refresh the token
        const tokenUrl = `${gitlabHost}/oauth/token`;
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: secret.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          logger.error('Failed to refresh GitLab token', { status: tokenResponse.status, error: errorText });
          return c.json({ error: 'Failed to refresh token', details: errorText }, 500);
        }

        const tokenData = await tokenResponse.json() as any;
        const { access_token, refresh_token, expires_in, scope } = tokenData;

        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Update secret
        const updateResult = await secretQueries.updateSecret(db, secretId, {
          value: access_token,
          refresh_token: refresh_token || secret.refresh_token,
          expires_at: expiresAt,
          scopes: scope || secret.scopes,
        });

        if (!updateResult.ok) {
          logger.error('Failed to update secret with refreshed token', { error: updateResult.error });
          return c.json({ error: 'Failed to update secret' }, 500);
        }

        logger.info('Successfully refreshed GitLab OAuth token', { secretId });

        return c.json({
          success: true,
          expiresAt: expiresAt,
        });
      } catch (error) {
        logger.error('Error during GitLab token refresh', { error });
        return c.json({ error: 'Internal server error during token refresh' }, 500);
      }
    }
  );

  return app;
}
