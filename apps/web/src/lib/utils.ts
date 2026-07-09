import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return date.toLocaleDateString('es-AR');
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchCentroDashboard(workspaceSlug: string) {
  const res = await fetch(`${API_URL}/api/centro/${workspaceSlug}`, {
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    throw new Error('No se pudo cargar el centro de gestión');
  }
  return res.json() as Promise<{
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
  }>;
}
