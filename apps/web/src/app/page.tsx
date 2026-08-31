'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getStoredUser } from '@/lib/auth-client';
import { workspaceHref } from '@/lib/workspace';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    const user = getStoredUser();
    if (token && user?.workspaceSlug) {
      router.replace(workspaceHref(user.workspaceSlug));
      return;
    }
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hub-bg text-hub-muted">
      Cargando…
    </div>
  );
}
