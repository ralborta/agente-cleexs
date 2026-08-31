'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthToken, getStoredUser } from '@/lib/auth-client';
import { workspaceHref } from '@/lib/workspace';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const user = getStoredUser();
    if (!token || !user) {
      const fallback = workspaceHref(user?.workspaceSlug || 'cleexs');
      const next = encodeURIComponent(pathname || fallback);
      router.replace(`/login?next=${next}`);
      return;
    }

    // Si la URL es de otro workspace, redirigir al del usuario
    const match = pathname?.match(/^\/([^/]+)/);
    const routeWs = match?.[1];
    if (
      routeWs &&
      routeWs !== 'login' &&
      routeWs !== 'voz' &&
      routeWs !== '_next' &&
      routeWs !== user.workspaceSlug
    ) {
      const rest = pathname?.replace(/^\/[^/]+/, '') || '';
      router.replace(workspaceHref(user.workspaceSlug, rest.replace(/^\//, '')));
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hub-bg text-hub-muted">
        Verificando sesión…
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuthUser() {
  return getStoredUser();
}
