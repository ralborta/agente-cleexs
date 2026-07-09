const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : err.error || 'Error API');
  }
  return res.json() as Promise<T>;
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
  };
};

export async function fetchApprovals(workspace: string) {
  return api<{ approvals: Approval[]; pendingCount: number }>(
    `/api/approvals?workspace=${workspace}&status=pending`,
  );
}

export async function approvePiece(id: string, wpStatus: 'draft' | 'publish' = 'draft') {
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
      piece: { title: string; type: string };
    }>;
  }>(`/api/results/${workspace}`);
}

export async function fetchPieces(workspace: string) {
  return api<{ pieces: Array<{ id: string; title: string; type: string; status: string; slug: string | null }> }>(
    `/api/content/pieces?workspace=${workspace}`,
  );
}
