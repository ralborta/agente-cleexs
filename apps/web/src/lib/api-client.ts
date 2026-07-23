const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('agente_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/api/auth/login')) {
    localStorage.removeItem('agente_auth_token');
    localStorage.removeItem('agente_auth_user');
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : err.error || 'Error API');
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Credenciales inválidas');
  }
  return data as {
    token: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      workspaceId: string;
      workspaceSlug: string;
      workspaceName?: string;
    };
  };
}

export async function fetchCentroDashboard(workspaceSlug: string) {
  return api<{
    workspace: { id: string; name: string; slug: string };
    kpis: Array<{ label: string; value: number; hint?: string; trend?: string }>;
    agentsOnline: Array<{ slug: string; name: string; status: string }>;
    activity: Array<{
      id: string;
      agent: string;
      role: string | null;
      message: string;
      level: string;
      createdAt: string;
    }>;
    contentRadar: {
      agentName: string;
      agentActive: boolean;
      agentWorking: boolean;
      pieces: Array<{
        id: string;
        title: string;
        type: string;
        status: 'published' | 'approval' | 'working' | 'refresh';
        impact: 'alto' | 'medio' | 'bajo';
      }>;
      stats: {
        active: number;
        published: number;
        approval: number;
        working: number;
        refresh: number;
      };
    };
  }>(`/api/centro/${workspaceSlug}`);
}

export type Approval = {
  id: string;
  status: string;
  createdAt: string;
  piece: {
    id: string;
    title: string;
    type: string;
    slug: string | null;
    content: { excerpt?: string; html?: string } | null;
    mission?: { agent?: { name: string; slug: string } | null } | null;
  };
};

export async function fetchApprovals(workspace: string) {
  return api<{ approvals: Approval[]; pendingCount: number }>(
    `/api/approvals?workspace=${workspace}&status=pending`,
  );
}

export async function approvePiece(id: string, wpStatus: 'draft' | 'publish' = 'publish') {
  return api<{ ok: boolean; wordpress: { externalId: string; url: string; status: string } }>(
    `/api/approvals/${id}/approve`,
    { method: 'POST', body: JSON.stringify({ wpStatus }) },
  );
}

export async function rejectPiece(id: string) {
  return api<{ ok: boolean }>(`/api/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({}) });
}

export async function createMission(workspaceSlug: string) {
  return api<{ mission: { id: string; title: string }; executing: boolean }>(
    '/api/missions',
    { method: 'POST', body: JSON.stringify({ workspaceSlug, autoExecute: true }) },
  );
}

export async function fetchResults(workspace: string) {
  return api<{
    summary: {
      publications: number;
      completedMissions: number;
      pendingApprovals: number;
      totalImpressions: number;
      totalSessions: number;
    };
    piecesByStatus: Array<{ status: string; count: number }>;
    recentPublications: Array<{
      id: string;
      url: string | null;
      publishedAt: string | null;
      piece: {
        title: string;
        slug: string | null;
        type: string;
        mission?: { agent?: { name: string } | null } | null;
      };
    }>;
  }>(`/api/results/${workspace}`);
}

export async function fetchPieces(workspace: string) {
  return api<{
    pieces: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      slug: string | null;
      updatedAt: string;
      publication?: { url: string | null; publishedAt: string | null } | null;
      mission?: { agent?: { name: string; slug: string } | null } | null;
    }>;
  }>(`/api/content/pieces?workspace=${workspace}`);
}

export async function fetchAnalytics(workspace: string, period: 7 | 30 | 90 = 30) {
  return api<import('./analytics-types').AnalyticsDashboard>(
    `/api/analytics/${workspace}?period=${period}`,
  );
}

export type AgentConfig = {
  id: string;
  tone: string | null;
  topics: string[] | null;
  frequency: string | null;
  autoPublish: boolean;
  updatedAt?: string;
};

export type AutomationStatus = {
  schedulerEnabled: boolean;
  tickIntervalMs: number;
  intervalDays: number;
  frequency: string | null;
  autoPublish: boolean;
  topicsConfigured: boolean;
  activeMissions: number;
  eligibleForNext: boolean;
  lastMission: {
    id: string;
    title: string;
    status: string;
    trigger: string;
    createdAt: string;
  } | null;
  lastMetricsSync: string | null;
};

export type TeoConfigResponse = {
  workspace: { slug: string; name: string };
  agent: { slug: string; name: string };
  config: AgentConfig | null;
  automation: AutomationStatus | null;
  frequencyPresets: Array<{ value: string; label: string }>;
};

export async function fetchTeoConfig(workspace: string) {
  return api<TeoConfigResponse>(`/api/config/${workspace}/agents/teo`);
}

export async function updateTeoConfig(
  workspace: string,
  data: Partial<Pick<AgentConfig, 'tone' | 'topics' | 'frequency' | 'autoPublish'>>,
) {
  return api<{ config: AgentConfig; automation: AutomationStatus }>(
    `/api/config/${workspace}/agents/teo`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export type IntegrationsOverview = {
  workspace: { slug: string; name: string };
  wordpress: {
    configured: boolean;
    connected?: boolean;
    site?: string;
    user?: string;
  };
  google: {
    configured: boolean;
    gscSiteUrl: string | null;
    ga4PropertyId: string | null;
    serviceAccountEmail: string | null;
  };
  integrations: {
    wordpress: { status: string; updatedAt: string } | null;
    gsc: { status: string; updatedAt: string; config: unknown } | null;
    ga4: { status: string; updatedAt: string; config: unknown } | null;
  };
  automation: AutomationStatus;
};

export async function fetchIntegrationsOverview(workspace: string) {
  return api<IntegrationsOverview>(`/api/integrations/${workspace}/overview`);
}

export async function testWordPressIntegration(workspace: string) {
  return api<{ wordpress: { ok?: boolean; connected?: boolean; user?: string; error?: string } }>(
    `/api/integrations/${workspace}/wordpress/test`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function testGoogleIntegration(workspace: string) {
  return api<{
    google: {
      connected?: boolean;
      gsc?: { ok?: boolean };
      ga4?: { ok?: boolean };
      error?: string;
    };
  }>(`/api/integrations/${workspace}/google/test`, { method: 'POST', body: JSON.stringify({}) });
}

export async function syncMetrics(workspace: string) {
  return api<{ ok?: boolean; snapshotsWritten?: number; message?: string; automation: AutomationStatus }>(
    `/api/integrations/${workspace}/metrics-sync`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export type Mission = {
  id: string;
  title: string;
  objective: string;
  status: string;
  trigger: string;
  createdAt: string;
  updatedAt: string;
  agent: { slug: string; name: string };
  workspace: { slug: string; name: string };
  steps: Array<{ id: string; role: string; status: string; createdAt: string }>;
  _count: { pieces: number; activities: number };
};

export async function fetchMissions(workspace: string, status?: string) {
  const params = new URLSearchParams({ workspace, agent: 'teo' });
  if (status) params.set('status', status);
  return api<{ missions: Mission[] }>(`/api/missions?${params.toString()}`);
}

export type ActivityItem = {
  id: string;
  agent: string;
  agentSlug: string;
  role: string | null;
  level: string;
  message: string;
  missionId: string | null;
  missionTitle: string | null;
  missionStatus: string | null;
  createdAt: string;
};

export async function fetchActivity(workspace: string, take = 50) {
  return api<{ activities: ActivityItem[] }>(`/api/activity?workspace=${workspace}&take=${take}`);
}

export function pieceAuthorName(
  piece: { mission?: { agent?: { name: string } | null } | null },
  fallback = 'Teo',
) {
  return piece.mission?.agent?.name ?? fallback;
}

export { resolvePublicationUrl } from './publication-url';
