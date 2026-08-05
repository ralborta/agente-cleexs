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
        refreshReason?: string | null;
        lastRefreshMission?: { id: string; status: string; createdAt: string } | null;
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
    content: { excerpt?: string; html?: string; markdown?: string } | null;
    mission?: { agent?: { name: string; slug: string } | null } | null;
  };
};

export async function fetchApprovals(workspace: string) {
  return api<{ approvals: Approval[]; pendingCount: number }>(
    `/api/approvals?workspace=${workspace}&status=pending`,
  );
}

export async function updateApprovalPiece(
  approvalId: string,
  data: { title?: string; excerpt?: string; markdown?: string },
) {
  return api<{ ok: boolean; piece: Approval['piece'] & { content: Approval['piece']['content'] } }>(
    `/api/approvals/${approvalId}/piece`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function approvePiece(
  id: string,
  wpStatus: 'draft' | 'publish' = 'publish',
  notes?: string,
) {
  return api<{ ok: boolean; wordpress: { externalId: string; url: string; status: string } }>(
    `/api/approvals/${id}/approve`,
    { method: 'POST', body: JSON.stringify({ wpStatus, notes: notes?.trim() || undefined }) },
  );
}

export async function rejectPiece(id: string, notes?: string) {
  return api<{ ok: boolean }>(`/api/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes?.trim() || undefined }),
  });
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
      cluster?: { id: string; name: string } | null;
      publication?: { url: string | null; publishedAt: string | null } | null;
      mission?: { agent?: { name: string; slug: string } | null } | null;
    }>;
  }>(`/api/content/pieces?workspace=${workspace}`);
}

export type ContentClusterSummary = {
  id: string;
  name: string;
  pillarTopic: string | null;
  pieces: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    slug: string | null;
    keyword: string | null;
    url: string | null;
    role: 'pillar' | 'satellite';
  }>;
  stats: {
    total: number;
    published: number;
    missingTypes: string[];
  };
};

export async function fetchContentClusters(workspace: string) {
  return api<{ workspace: string; clusters: ContentClusterSummary[] }>(
    `/api/content/clusters?workspace=${workspace}`,
  );
}

export async function bootstrapContentClusters(workspace: string) {
  return api<{ workspace: string; assigned: number; clusters: ContentClusterSummary[] }>(
    `/api/content/clusters/bootstrap`,
    { method: 'POST', body: JSON.stringify({ workspace }) },
  );
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
  branding?: import('@agente/shared').BrandKit | null;
  updatedAt?: string;
};

export type BrandKit = import('@agente/shared').BrandKit;
export type BrandTemplateId = import('@agente/shared').BrandTemplateId;
export { DEFAULT_BRAND_KIT } from '@agente/shared';

export type AutomationStatus = {
  schedulerEnabled: boolean;
  tickIntervalMs: number;
  intervalDays: number;
  frequency: string | null;
  autoPublish: boolean;
  topicsConfigured: boolean;
  activeMissions: number;
  eligibleForNext: boolean;
  nextEligibleAt?: string;
  hoursUntilNext?: number;
  cronBackup?: {
    apiBaseUrl: string;
    autonomousTick: string;
    metricsSync: string;
    refresherScan: string;
    header: string;
  };
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
  branding: BrandKit;
  automation: AutomationStatus | null;
  frequencyPresets: Array<{ value: string; label: string }>;
  brandTemplates: Array<{ id: BrandTemplateId; label: string }>;
};

export async function fetchTeoConfig(workspace: string) {
  return api<TeoConfigResponse>(`/api/config/${workspace}/agents/teo`);
}

export async function fetchBrandPreview(workspace: string) {
  return api<{ html: string; branding: BrandKit }>(
    `/api/config/${workspace}/agents/teo/brand-preview`,
  );
}

export async function updateTeoConfig(
  workspace: string,
  data: Partial<Pick<AgentConfig, 'tone' | 'topics' | 'frequency' | 'autoPublish'>> & {
    branding?: Partial<BrandKit>;
  },
) {
  return api<{ config: AgentConfig; branding: BrandKit; automation: AutomationStatus }>(
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

export async function triggerSchedulerTick(workspace: string) {
  return api<{
    ok: boolean;
    workspace: string;
    result: {
      opportunities?: { created: number; workspaces: number };
      demand?: { workspaces: number; scored: number; imported: number };
      questions?: { workspaces: number; created: number };
      missions: { spawned: number; missionIds: string[] };
      metrics: { synced: number; workspaces: string[] };
      refresher: { missionsSpawned: number; candidates: number };
    };
    automation: AutomationStatus;
  }>(`/api/integrations/${workspace}/trigger-scheduler`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function testWordPressIntegration(workspace: string) {
  return api<{ wordpress: { ok?: boolean; connected?: boolean; user?: string; error?: string } }>(
    `/api/integrations/${workspace}/wordpress/test`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export type WordPressSetupCheck = {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'pending';
  detail: string;
};

export type WordPressSetupReport = {
  configured: boolean;
  checks: WordPressSetupCheck[];
  cssSnippetPath: string;
  manualSteps: string[];
};

export async function fetchWordPressSetup(workspace: string) {
  return api<{ workspace: string; setup: WordPressSetupReport }>(
    `/api/integrations/${workspace}/wordpress/setup`,
  );
}

export type IndexingPage = {
  pieceId: string;
  title: string;
  url: string;
  publishedAt: string | null;
  indexed: boolean;
  coverageState: string | null;
  verdict: string;
  lastCrawlTime: string | null;
};

export type IndexingReport = {
  configured: boolean;
  checkedAt: string | null;
  summary: { total: number; indexed: number; pending: number };
  pages: IndexingPage[];
};

export async function fetchIndexingStatus(workspace: string, force = false) {
  return api<{ workspace: string; indexing: IndexingReport }>(
    `/api/integrations/${workspace}/indexing${force ? '?force=true' : ''}`,
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

export type RefresherScanResult = {
  workspace: string;
  scanned: number;
  candidates: number;
  marked: number;
  cleared: number;
  googleConfigured: boolean;
  topCandidate: {
    pieceId: string;
    title: string;
    reason: string;
    priority: number;
  } | null;
  mission?: {
    skipped: boolean;
    reason?: string;
    missionId?: string;
  } | null;
};

export async function runRefresherScan(workspace: string, spawn = true) {
  return api<RefresherScanResult>(`/api/integrations/${workspace}/refresher-scan`, {
    method: 'POST',
    body: JSON.stringify({ spawn }),
  });
}

export async function retryRefreshPiece(workspace: string, pieceId: string) {
  return api<{
    workspace: string;
    pieceId: string;
    mission: {
      skipped: boolean;
      reason?: string;
      missionId?: string;
    };
  }>(`/api/integrations/${workspace}/refresher-retry`, {
    method: 'POST',
    body: JSON.stringify({ pieceId }),
  });
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

export type FunnelStage = 'tofu' | 'mofu' | 'bofu';
export type KeywordOpportunityStatus =
  | 'idea'
  | 'queued'
  | 'in_progress'
  | 'covered'
  | 'discarded';

export type KeywordOpportunity = {
  id: string;
  seedKeyword: string;
  keyword: string;
  cluster: string;
  stage: FunnelStage;
  intent: string | null;
  intentLabel: string | null;
  status: KeywordOpportunityStatus;
  priority: number;
  source: string;
  notes: string | null;
  gscImpressions: number | null;
  gscClicks: number | null;
  demandScore: number | null;
  scoreReason: string | null;
  scoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KeywordQuestionStatus =
  | 'idea'
  | 'queued'
  | 'in_progress'
  | 'covered'
  | 'discarded';

export type KeywordQuestion = {
  id: string;
  cluster: string;
  question: string;
  stage: FunnelStage;
  intent: string | null;
  intentLabel: string | null;
  businessFit: number;
  priority: number;
  status: KeywordQuestionStatus;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunitiesResponse = {
  workspace: string;
  opportunities: KeywordOpportunity[];
  questions: KeywordQuestion[];
  seeds: string[];
  clusters: string[];
  summary: {
    total: number;
    byStage: { tofu: number; mofu: number; bofu: number };
    byStatus: Record<string, number>;
  };
  questionsSummary?: {
    total: number;
    byCluster: Record<string, number>;
    byStatus: Record<string, number>;
  };
};

export async function fetchOpportunities(
  workspace: string,
  filters?: { status?: string; stage?: string; cluster?: string; seed?: string },
) {
  const params = new URLSearchParams({ workspace });
  if (filters?.status) params.set('status', filters.status);
  if (filters?.stage) params.set('stage', filters.stage);
  if (filters?.cluster) params.set('cluster', filters.cluster);
  if (filters?.seed) params.set('seed', filters.seed);
  return api<OpportunitiesResponse>(`/api/opportunities?${params.toString()}`);
}

export async function ingestOpportunitySeeds(
  workspace: string,
  seeds: string[],
  expand = true,
) {
  return api<OpportunitiesResponse & { ok: boolean; created: number; skipped: number; source: string }>(
    '/api/opportunities/seeds',
    {
      method: 'POST',
      body: JSON.stringify({ workspace, seeds, expand }),
    },
  );
}

export async function updateOpportunity(
  id: string,
  data: Partial<{
    status: KeywordOpportunityStatus;
    priority: number;
    notes: string | null;
    cluster: string;
    stage: FunnelStage;
    intentLabel: string | null;
  }>,
) {
  return api<{ ok: boolean; opportunity: KeywordOpportunity }>(`/api/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateKeywordQuestion(
  id: string,
  data: Partial<{
    status: KeywordQuestionStatus;
    priority: number;
    notes: string | null;
  }>,
) {
  return api<{ ok: boolean; question: KeywordQuestion }>(`/api/opportunities/questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function generateOpportunityQuestions(workspace: string) {
  return api<{
    ok: boolean;
    created: number;
    clusters: number;
    source: string;
    questions: KeywordQuestion[];
  }>('/api/opportunities/questions/generate', {
    method: 'POST',
    body: JSON.stringify({ workspace }),
  });
}

export async function deleteOpportunity(id: string) {
  return api<{ ok: boolean }>(`/api/opportunities/${id}`, { method: 'DELETE' });
}

export function pieceAuthorName(
  piece: { mission?: { agent?: { name: string } | null } | null },
  fallback = 'Teo',
) {
  return piece.mission?.agent?.name ?? fallback;
}

export { resolvePublicationUrl } from './publication-url';
