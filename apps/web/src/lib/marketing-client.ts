/** Cliente del producto standalone Cleexs Marketing (/api/mkt). */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('agente_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('agente_auth_token');
    localStorage.removeItem('agente_auth_user');
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(typeof err.error === 'string' ? err.error : `Error API (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type MktAgent = { key: string; slug: string; name: string; origin: string; route: string; description: string };
export type MktCampaign = {
  id: string; title: string; objective: string; audience: string | null;
  sourceType: string; sourceLabel: string | null; status: string;
  startsAt: string | null; endsAt: string | null; createdAt: string;
  _count?: { offers: number; emails: number };
};
export type MktOffer = {
  id: string; campaignId: string | null; title: string; description: string;
  priceText: string | null; discountText: string | null; terms: string | null;
  channels: string[] | null; status: string; derivedStatus: string;
  startsAt: string | null; endsAt: string | null; createdAt: string;
};
export type MktEmail = {
  id: string; campaignId: string | null; offerId: string | null; segment: string;
  subject: string; preheader: string | null; body: string; ctaText: string | null;
  ctaUrl: string | null; status: string; createdAt: string;
};
export type MktOpportunity = {
  id: string; keyword: string; cluster: string; stage: string; status: string;
  priority: number; opportunityScore: number | null; demandScore: number | null;
  monthlySearches: number | null; intentLabel: string | null;
  gscImpressions: number | null; gscClicks: number | null;
};

export type MktOverview = {
  workspace: string; workspaceName: string; product: string; tagline: string;
  sendingEnabled: boolean; sendingNote: string; agents: MktAgent[];
  summary: {
    campaigns: number; campaignsApprovedOrActive: number; offersActive: number; offersExpired: number;
    emailsDraft: number; emailsApproved: number; opportunitiesOpen: number;
    pieces: number; publications: number; diffusionOpportunities: number;
  };
  campaigns: MktCampaign[]; offers: MktOffer[]; emails: MktEmail[]; opportunities: MktOpportunity[];
};

export const fetchMktOverview = (ws: string) => api<MktOverview>(`/api/mkt/${ws}/overview`);

export type MktVisibilidad = {
  workspace: string;
  google: { impressions: number; clicks: number; searches: number };
  opportunities: MktOpportunity[];
  questions: Array<{ id: string; question: string; cluster: string; stage: string; priority: number; businessFit: number; status: string }>;
};
export const fetchMktVisibilidad = (ws: string) => api<MktVisibilidad>(`/api/mkt/${ws}/visibilidad`);

export type MktContenidos = {
  workspace: string; publications: number; byStatus: Record<string, number>;
  pieces: Array<{ id: string; title: string; type: string; status: string; slug: string | null; keyword: string | null; updatedAt: string; cluster: { name: string } | null; publication: { url: string | null; publishedAt: string | null } | null }>;
};
export const fetchMktContenidos = (ws: string) => api<MktContenidos>(`/api/mkt/${ws}/contenidos`);

export type MktDifusion = {
  workspace: string;
  opportunities: Array<{ id: string; opportunityScore: number; editorialStatus: string; conversation: { url: string; domain: string; title: string | null; topic: string | null }; drafts: Array<{ id: string; status: string }> }>;
  runs: Array<{ id: string; status: string; opportunityCount: number; createdAt: string }>;
};
export const fetchMktDifusion = (ws: string) => api<MktDifusion>(`/api/mkt/${ws}/difusion`);

export type MktResultados = {
  workspace: string;
  counts: { campaigns: number; campaignsByStatus: Record<string, number>; offers: number; offersExpired: number; emailsByStatus: Record<string, number>; pieces: number; piecesByStatus: Record<string, number>; publications: number; diffusionOpportunities: number };
  recommendations: Array<{ level: 'alta' | 'media' | 'baja'; text: string; route: string }>;
};
export const fetchMktResultados = (ws: string) => api<MktResultados>(`/api/mkt/${ws}/resultados`);

export const createMktCampaign = (ws: string, data: { title?: string; objective?: string; audience?: string; opportunityId?: string; startsAt?: string | null; endsAt?: string | null }) =>
  api<{ ok: boolean; campaign: MktCampaign }>(`/api/mkt/${ws}/campaigns`, { method: 'POST', body: JSON.stringify(data) });

export const updateMktCampaign = (ws: string, id: string, data: Partial<{ status: string; title: string; objective: string }>) =>
  api<{ ok: boolean; campaign: MktCampaign }>(`/api/mkt/${ws}/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMktCampaign = (ws: string, id: string) =>
  api<{ ok: boolean }>(`/api/mkt/${ws}/campaigns/${id}`, { method: 'DELETE' });

export const createMktOffer = (ws: string, data: { campaignId?: string | null; title: string; description: string; priceText?: string; discountText?: string; terms?: string; channels?: string[]; startsAt?: string | null; endsAt?: string | null }) =>
  api<{ ok: boolean; offer: MktOffer }>(`/api/mkt/${ws}/offers`, { method: 'POST', body: JSON.stringify(data) });

export const updateMktOffer = (ws: string, id: string, data: Partial<{ status: string }>) =>
  api<{ ok: boolean; offer: MktOffer }>(`/api/mkt/${ws}/offers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMktOffer = (ws: string, id: string) =>
  api<{ ok: boolean }>(`/api/mkt/${ws}/offers/${id}`, { method: 'DELETE' });

export const generateMktEmail = (ws: string, campaignId: string) =>
  api<{ ok: boolean; email: MktEmail; sent: boolean; note: string }>(`/api/mkt/${ws}/campaigns/${campaignId}/generate-email`, { method: 'POST', body: JSON.stringify({}) });

export const updateMktEmail = (ws: string, id: string, data: Partial<{ status: string; subject: string; body: string }>) =>
  api<{ ok: boolean; email: MktEmail }>(`/api/mkt/${ws}/emails/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMktEmail = (ws: string, id: string) =>
  api<{ ok: boolean }>(`/api/mkt/${ws}/emails/${id}`, { method: 'DELETE' });

export type MktCatalogItem = {
  id: string; kind: 'servicio' | 'producto'; name: string; description: string;
  priceText: string | null; audience: string | null; active: boolean; createdAt: string;
};
export type MktGoal = { key: string; label: string };

export const fetchMktCatalog = (ws: string) =>
  api<{ workspace: string; goals: MktGoal[]; items: MktCatalogItem[] }>(`/api/mkt/${ws}/catalog`);

export const createMktCatalogItem = (ws: string, data: { kind: string; name: string; description: string; priceText?: string; audience?: string }) =>
  api<{ ok: boolean; item: MktCatalogItem }>(`/api/mkt/${ws}/catalog`, { method: 'POST', body: JSON.stringify(data) });

export const deleteMktCatalogItem = (ws: string, id: string) =>
  api<{ ok: boolean }>(`/api/mkt/${ws}/catalog/${id}`, { method: 'DELETE' });

export const proposeMktCampaign = (ws: string, data: { catalogItemId: string; goal: string; audience?: string; notes?: string }) =>
  api<{ ok: boolean; campaign: MktCampaign }>(`/api/mkt/${ws}/campaigns/propose`, { method: 'POST', body: JSON.stringify(data) });
