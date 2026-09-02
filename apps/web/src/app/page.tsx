'use client';

import { useEffect } from 'react';
import { getAuthToken, getStoredUser } from '@/lib/auth-client';
import { workspaceHref } from '@/lib/workspace';

export default function HomePage() {
  useEffect(() => {
    const token = getAuthToken();
    const user = getStoredUser();
    if (token && user?.workspaceSlug) {
      window.location.replace(workspaceHref(user.workspaceSlug));
      return;
    }
    window.location.replace('/login');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hub-bg text-hub-muted">
      Cargando…
    </div>
  );
}
