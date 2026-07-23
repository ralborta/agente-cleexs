'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { login } from '@/lib/api-client';
import { saveAuthSession } from '@/lib/auth-client';
import { PLATFORM_NAME } from '@/lib/branding';
import { buttonPrimaryClassName, FieldLabel, inputClassName } from '@/components/config/settings-section';

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/cleexs';

  const [email, setEmail] = useState('admin@cleexs.net');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Ingresar — ${PLATFORM_NAME}`;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      saveAuthSession(res.token, {
        ...res.user,
        workspaceName: res.user.workspaceName,
      });
      router.replace(next.startsWith('/') ? next : '/cleexs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1220] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.12),_transparent_50%)]" />

      <div className="relative w-full max-w-md rounded-3xl border border-hub-border bg-hub-card/95 p-8 shadow-hub backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-cleexs-blue/30 bg-cleexs-blue/10 px-3 py-1 text-xs font-medium text-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            {PLATFORM_NAME}
          </div>
          <h1 className="text-2xl font-semibold text-white">Centro de Gestión</h1>
          <p className="mt-2 text-sm text-hub-muted">Ingresá para ver resultados y configurar a Teo.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <FieldLabel>Contraseña</FieldLabel>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className={`${buttonPrimaryClassName} w-full`}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-hub-muted">
          Usuario inicial del seed: admin@cleexs.net · demo1234
        </p>
      </div>
    </div>
  );
}
