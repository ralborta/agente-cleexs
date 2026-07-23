import { Suspense } from 'react';
import LoginPageClient from './page.client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-hub-bg text-hub-muted">
          Cargando…
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
