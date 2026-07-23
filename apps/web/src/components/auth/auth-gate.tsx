'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthToken, getStoredUser } from '@/lib/auth-client';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      const next = encodeURIComponent(pathname || '/cleexs');
      router.replace(`/login?next=${next}`);
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
