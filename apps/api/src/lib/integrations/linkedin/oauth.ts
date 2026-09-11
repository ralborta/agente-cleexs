import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma';
import { isLinkedInAppConfigured, resolveLinkedInAppConfig } from './config';
import type {
  LinkedInIntegrationConfig,
  LinkedInStatusPublic,
  LinkedInTokenResponse,
} from './types';

const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social'] as const;
const OAUTH_STATE_TTL = '10m';

type OAuthStatePayload = {
  ws: string;
  uid: string;
  nonce: string;
};

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  return secret;
}

function maskUrn(urn: string): string {
  if (urn.length <= 16) return `${urn.slice(0, 8)}…`;
  return `${urn.slice(0, 18)}…${urn.slice(-4)}`;
}

export function createOAuthState(workspaceSlug: string, userId: string): string {
  const payload: OAuthStatePayload = {
    ws: workspaceSlug,
    uid: userId,
    nonce: randomBytes(12).toString('hex'),
  };
  return jwt.sign(payload, jwtSecret(), { expiresIn: OAUTH_STATE_TTL });
}

export function parseOAuthState(state: string): OAuthStatePayload | null {
  try {
    const decoded = jwt.verify(state, jwtSecret()) as OAuthStatePayload;
    if (!decoded?.ws || !decoded?.uid) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(params: {
  workspaceSlug: string;
  state: string;
}): string {
  const config = resolveLinkedInAppConfig();
  if (!config) {
    throw new Error('LinkedIn no está configurado en el servidor');
  }

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', LINKEDIN_SCOPES.join(' '));
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const config = resolveLinkedInAppConfig();
  if (!config) {
    throw new Error('LinkedIn no está configurado en el servidor');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as LinkedInTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`No se pudo intercambiar el código OAuth de LinkedIn: ${detail}`);
  }

  return data;
}

export async function fetchLinkedInMemberProfile(accessToken: string): Promise<{
  personId: string;
  personUrn: string;
}> {
  const config = resolveLinkedInAppConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (config?.apiVersion) {
    headers['LinkedIn-Version'] = config.apiVersion;
  }

  const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers });
  if (userinfoRes.ok) {
    const info = (await userinfoRes.json()) as { sub?: string };
    if (info.sub) {
      return {
        personId: info.sub,
        personUrn: `urn:li:person:${info.sub}`,
      };
    }
  }

  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: {
      ...headers,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });
  if (!meRes.ok) {
    throw new Error(
      'No se pudo obtener el perfil de LinkedIn. Revisá los scopes openid/profile.',
    );
  }
  const me = (await meRes.json()) as { id?: string };
  if (!me.id) {
    throw new Error('Respuesta de LinkedIn /me sin id de persona');
  }
  return {
    personId: me.id,
    personUrn: `urn:li:person:${me.id}`,
  };
}

function parseStoredConfig(raw: unknown): LinkedInIntegrationConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const cfg = raw as Partial<LinkedInIntegrationConfig>;
  if (!cfg.accessToken || !cfg.personUrn || !cfg.personId) return null;
  return cfg as LinkedInIntegrationConfig;
}

export async function upsertLinkedInIntegration(
  workspaceId: string,
  config: LinkedInIntegrationConfig,
) {
  return prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId, type: 'linkedin' },
    },
    create: {
      workspaceId,
      type: 'linkedin',
      status: 'connected',
      config,
    },
    update: {
      status: 'connected',
      config,
    },
  });
}

export async function getLinkedInIntegrationConfig(
  workspaceId: string,
): Promise<LinkedInIntegrationConfig | null> {
  const row = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: 'linkedin' } },
  });
  if (!row || row.status !== 'connected') return null;
  return parseStoredConfig(row.config);
}

export async function getLinkedInIntegration(workspaceId: string): Promise<LinkedInStatusPublic> {
  const appConfigured = isLinkedInAppConfigured();
  const row = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: 'linkedin' } },
  });

  if (!row) {
    return {
      connected: false,
      status: appConfigured ? 'disconnected' : 'not_configured',
      appConfigured,
    };
  }

  const cfg = parseStoredConfig(row.config);
  const connected = row.status === 'connected' && Boolean(cfg?.accessToken);

  return {
    connected,
    status: connected ? 'connected' : row.status === 'error' ? 'error' : 'disconnected',
    appConfigured,
    personId: cfg?.personId ?? null,
    personUrnMasked: cfg?.personUrn ? maskUrn(cfg.personUrn) : null,
    scopes: cfg?.scopes ?? [],
    connectedAt: cfg?.connectedAt ?? null,
    expiresAt: cfg?.expiresAt ?? null,
    organizationName: cfg?.organizationName ?? null,
    lastError: cfg?.lastError ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function disconnectLinkedIn(workspaceId: string) {
  const existing = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: 'linkedin' } },
  });
  if (!existing) return null;

  return prisma.integration.update({
    where: { id: existing.id },
    data: {
      status: 'disconnected',
      config: {
        lastError: null,
        disconnectedAt: new Date().toISOString(),
      },
    },
  });
}

export function buildLinkedInConfigFromOAuth(params: {
  tokens: LinkedInTokenResponse;
  personId: string;
  personUrn: string;
  userId?: string;
}): LinkedInIntegrationConfig {
  const scopes = params.tokens.scope
    ? params.tokens.scope.split(/[,\s]+/).filter(Boolean)
    : [...LINKEDIN_SCOPES];
  const expiresAt =
    typeof params.tokens.expires_in === 'number'
      ? new Date(Date.now() + params.tokens.expires_in * 1000).toISOString()
      : null;

  return {
    accessToken: params.tokens.access_token,
    refreshToken: params.tokens.refresh_token ?? null,
    expiresAt,
    personUrn: params.personUrn,
    personId: params.personId,
    scopes,
    connectedAt: new Date().toISOString(),
    connectedByUserId: params.userId,
    lastError: null,
  };
}

export function resolveFrontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URLS?.split(',')[0]?.trim() ||
    'http://localhost:3000'
  );
}
