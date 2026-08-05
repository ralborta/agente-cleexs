'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PublicVozPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [topic, setTopic] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Cleexs');
  const [expired, setExpired] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/voice/public/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Link inválido');
        setTopic(data.topic);
        setWorkspaceName(data.workspaceName || 'Cleexs');
        setExpired(Boolean(data.expired));
        setConsumed(Boolean(data.consumed));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const list = quotes
      .split(/\n+/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (list.length < 1) {
      setError('Pegá al menos una frase.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/voice/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotes: list, authorLabel: 'Founder' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
          Voz del founder · {workspaceName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">2–5 frases sobre el tema</h1>
        <p className="mt-2 text-sm text-slate-400">
          Teo las inserta como callouts en el artículo. Si no mandás nada, publica igual.
        </p>
        {topic ? (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
            Tema: <strong>{topic}</strong>
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-slate-400">Cargando…</p>
        ) : expired || consumed ? (
          <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Este link ya no está disponible (vencido o usado). Pedí uno nuevo en el backoffice.
          </p>
        ) : done ? (
          <p className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Listo. Gracias — Teo usará tus frases en la próxima pieza.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <textarea
              value={quotes}
              onChange={(e) => setQuotes(e.target.value)}
              rows={6}
              placeholder={'Una frase por línea.\nEj: Preferimos evidencia antes que hype.'}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
            />
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar frases
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
