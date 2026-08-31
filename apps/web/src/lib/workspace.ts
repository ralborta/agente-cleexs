'use client';

import { useParams } from 'next/navigation';
import { getStoredUser } from '@/lib/auth-client';

/** Slug del workspace desde la URL (`/[workspace]/...`) o la sesión. */
export function useWorkspaceSlug(): string {
  const params = useParams();
  const fromRoute = typeof params?.workspace === 'string' ? params.workspace : null;
  const fromAuth = getStoredUser()?.workspaceSlug;
  return (fromRoute || fromAuth || 'cleexs').trim().toLowerCase();
}

export function getWorkspaceSlug(): string {
  return (getStoredUser()?.workspaceSlug || 'cleexs').trim().toLowerCase();
}

/** Href dentro del portal del workspace activo. path vacío = home del workspace. */
export function workspaceHref(workspace: string, path = ''): string {
  const slug = workspace.trim().toLowerCase() || 'cleexs';
  const clean = path.replace(/^\/+/, '');
  return clean ? `/${slug}/${clean}` : `/${slug}`;
}
