import { Hono } from 'hono';
import type { Sql } from 'postgres';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createLogger } from '@utils/logger';
import * as secretQueries from '@db/secrets';
import { reqAuthed } from '../middleware/authz';
import {
  GITLAB_OAUTH_CLIENT_ID,
  GITLAB_OAUTH_CLIENT_SECRET,
  GITLAB_OAUTH_REDIRECT_URI,
  GITLAB_ROOT_OAUTH_HOST,
  JIRA_OAUTH_CLIENT_ID,
  JIRA_OAUTH_CLIENT_SECRET,
  JIRA_OAUTH_REDIRECT_URI,
} from '../config';

const logger = createLogger({ namespace: 'oauth-handler' });

const jiraExchangeTokenSchema = z.object({
  projectId: z.uuid(),
  code: z.string(),
  secretName: z.string().min(1),
  cloudId: z.string().optional(),
});

// Route Handlers
async function handleJiraAuthorize(c: any) {
  const scopes = 'read:jira-work write:jira-work offline_access';
  const state = crypto.randomUUID();

  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', JIRA_OAUTH_CLIENT_ID);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', JIRA_OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');

  logger.info('Initiating Jira OAuth flow', {
    clientId: JIRA_OAUTH_CLIENT_ID,
    state,
    redirectUri: JIRA_OAUTH_REDIRECT_URI
  });

  return c.json({ authUrl: authUrl.toString(), state });
}

async function handleJiraExchange(c: any, db: Sql) {
  await reqAuthed(c);
  const { projectId, code, secretName, cloudId } = c.req.valid('json');

  try {
    const tokenUrl = 'https://auth.atlassian.com/oauth/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: JIRA_OAUTH_CLIENT_ID,
        client_secret: JIRA_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: JIRA_OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Failed to exchange code for token', { status: tokenResponse.status, error: errorText });
      return c.json({ error: 'Failed to exchange authorization code', details: errorText }, 500);
    }

    const tokenData = await tokenResponse.json() as any;
    const { access_token, refresh_token, expires_in, scope } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const resourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';
    const resourcesResponse = await fetch(resourcesUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    if (!resourcesResponse.ok) {
      logger.error('Failed to fetch accessible resources', { status: resourcesResponse.status });
      return c.json({ error: 'Failed to fetch accessible Jira sites' }, 500);
    }

    const resources = await resourcesResponse.json() as any[];
    logger.info('Fetched accessible Jira sites', { count: resources.length });

    const secretResult = await secretQueries.upsertSecret(db, {
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

    logger.info('Successfully stored Jira OAuth token', { secretId: secretResult.id });

    return c.json({
      success: true,
      secretId: secretResult.id,
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

async function handleJiraRefresh(c: any, db: Sql) {
  await reqAuthed(c);
  const { secretId } = c.req.valid('param');

  if (!JIRA_OAUTH_CLIENT_ID || !JIRA_OAUTH_CLIENT_SECRET) {
    logger.error('Jira OAuth not configured');
    return c.json({ error: 'Jira OAuth is not configured on the server' }, 500);
  }

  try {
    const secret = await secretQueries.findSecretById(db, secretId);

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'jira') {
      return c.json({ error: 'Secret is not a Jira OAuth token' }, 400);
    }

    if (!secret.refresh_token) {
      return c.json({ error: 'No refresh token available' }, 400);
    }

    const tokenUrl = 'https://auth.atlassian.com/oauth/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: JIRA_OAUTH_CLIENT_ID,
        client_secret: JIRA_OAUTH_CLIENT_SECRET,
        refresh_token: secret.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Failed to refresh token', { status: tokenResponse.status, error: errorText });
      return c.json({ error: 'Failed to refresh token', details: errorText }, 500);
    }

    const tokenData = await tokenResponse.json() as any;
    const { access_token, refresh_token, expires_in, scope } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    await secretQueries.updateSecret(db, secretId, {
      value: access_token,
      refresh_token: refresh_token || secret.refresh_token,
      expires_at: expiresAt,
      scopes: scope || secret.scopes,
    });

    logger.info('Successfully refreshed Jira OAuth token', { secretId });
    return c.json({ success: true, expiresAt: expiresAt });
  } catch (error) {
    logger.error('Error during token refresh', { error });
    return c.json({ error: 'Internal server error during token refresh' }, 500);
  }
}

async function handleGitLabAuthorize(c: any) {
  if (!GITLAB_OAUTH_CLIENT_ID || !GITLAB_OAUTH_REDIRECT_URI) {
    return c.json({ error: 'GitLab OAuth not configured. Missing CLIENT_ID or REDIRECT_URI.' }, 500);
  }

  const state = crypto.randomUUID();
  const scopes = 'api';

  const authUrl = new URL(`${GITLAB_ROOT_OAUTH_HOST}/oauth/authorize`);
  authUrl.searchParams.set('client_id', GITLAB_OAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GITLAB_OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);

  logger.info('Initiating GitLab OAuth flow', {
    clientId: GITLAB_OAUTH_CLIENT_ID,
    gitlabHost: GITLAB_ROOT_OAUTH_HOST,
    state,
    redirectUri: GITLAB_OAUTH_REDIRECT_URI
  });

  return c.json({ authUrl: authUrl.toString(), state });
}

async function handleGitLabExchange(c: any, db: Sql) {
  await reqAuthed(c);
  const { projectId, code, secretName, gitlabHost } = c.req.valid('json');
  const host = gitlabHost || GITLAB_ROOT_OAUTH_HOST;

  if (!GITLAB_OAUTH_CLIENT_ID || !GITLAB_OAUTH_CLIENT_SECRET || !GITLAB_OAUTH_REDIRECT_URI) {
    logger.error('GitLab OAuth not configured');
    return c.json({ error: 'GitLab OAuth is not configured on the server' }, 500);
  }

  try {
    const tokenUrl = `${host}/oauth/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITLAB_OAUTH_CLIENT_ID,
        client_secret: GITLAB_OAUTH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: GITLAB_OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Failed to exchange GitLab code', { status: tokenResponse.status, error: errorText });
      return c.json({ error: 'Failed to exchange authorization code', details: errorText }, 500);
    }

    const tokenData = await tokenResponse.json() as any;
    const { access_token, refresh_token, expires_in, scope } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const userResponse = await fetch(`${host}/api/v4/user`, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!userResponse.ok) {
      logger.error('Failed to fetch GitLab user', { status: userResponse.status });
      return c.json({ error: 'Failed to verify GitLab token' }, 500);
    }

    const userData = await userResponse.json() as any;
    logger.info('GitLab OAuth successful', { username: userData.username, host });

    const secretResult = await secretQueries.upsertSecret(db, {
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

    logger.info('Successfully stored GitLab OAuth token', { secretId: secretResult.id });

    return c.json({
      success: true,
      secretId: secretResult.id,
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

async function handleGitLabRefresh(c: any, db: Sql) {
  await reqAuthed(c);
  const { secretId } = c.req.valid('param');

  if (!GITLAB_OAUTH_CLIENT_ID || !GITLAB_OAUTH_CLIENT_SECRET) {
    logger.error('GitLab OAuth not configured');
    return c.json({ error: 'GitLab OAuth is not configured' }, 500);
  }

  const secret = await secretQueries.findSecretById(db, secretId);

  if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'gitlab') {
    return c.json({ error: 'Secret is not a GitLab OAuth token' }, 400);
  }

  if (!secret.refresh_token) {
    return c.json({ error: 'No refresh token available' }, 400);
  }

  const tokenUrl = `${GITLAB_ROOT_OAUTH_HOST}/oauth/token`;
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITLAB_OAUTH_CLIENT_ID,
      client_secret: GITLAB_OAUTH_CLIENT_SECRET,
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

  await secretQueries.updateSecret(db, secretId, {
    value: access_token,
    refresh_token: refresh_token || secret.refresh_token,
    expires_at: expiresAt,
    scopes: scope || secret.scopes,
  });

  logger.info('Successfully refreshed GitLab OAuth token', { secretId });
  return c.json({ success: true, expiresAt: expiresAt });
}

export function createOAuthRoutes(db: Sql) {
  return new Hono()
    .get('/jira/authorize', async (c) => handleJiraAuthorize(c))
    .post('/jira/exchange', zValidator('json', jiraExchangeTokenSchema), async (c) =>
      handleJiraExchange(c, db)
    )
    .post('/jira/refresh/:secretId', zValidator('param', z.object({ secretId: z.uuid() })), async (c) =>
      handleJiraRefresh(c, db)
    )
    .get('/gitlab/authorize', async (c) => handleGitLabAuthorize(c))
    .post('/gitlab/exchange', zValidator('json', z.object({
      projectId: z.uuid(),
      code: z.string(),
      secretName: z.string().min(1),
      gitlabHost: z.url().optional(),
    })), async (c) =>
      handleGitLabExchange(c, db)
    )
    .post('/gitlab/refresh/:secretId', zValidator('param', z.object({ secretId: z.uuid() })), async (c) =>
      handleGitLabRefresh(c, db)
    );
}
