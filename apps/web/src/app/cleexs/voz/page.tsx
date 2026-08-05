'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Link2, Mic2 } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  addFounderVoiceQuotes,
  createFounderVoiceInvite,
  fetchFounderVoice,
  type FounderVoiceNote,
} from '@/lib/api-client';

export default function VozFounderPage() {
  const [notes, setNotes] = useState<FounderVoiceNote[]>([]);
  const [invites, setInvites] = useState<Array<{ id: string; topic: string | null; url: string; expiresAt: string }>>([]);
  const [summary, setSummary] = useState<{ available: number; used: number } | null>(null);
  const [topic, setTopic] = useState('');
  const [quotesText, setQuotesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFounderVoice('cleexs');
      setNotes(res.notes);
      setInvites(res.openInvites);
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const quotes = quotesText
      .split(/\n+/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (!quotes.length) {
      setError('Pegá al menos una frase (una por línea).');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await addFounderVoiceQuotes('cleexs', {
        topic: topic.trim() || undefined,
        quotes,
        authorLabel: 'Founder Cleexs',
      });
      setQuotesText('');
      setMessage(`Guardadas ${res.created} frase(s). Teo las usará solo en la próxima pieza.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite() {
    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createFounderVoiceInvite('cleexs', topic.trim() || undefined);
      setLastLink(res.url);
      setMessage('Link mágico listo (24h). Compartilo con el founder — no hace falta login.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el link');
    } finally {
      setInviting(false);
    }
  }

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">
          Diferencial humano
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-white">Voz del founder</h2>
        <p className="mt-2 max-w-2xl text-sm text-hub-muted">
          Teo escribe solo. Si el founder deja 2–5 frases, aparecen como callouts en el artículo. Si no,
          publica igual: nunca bloquea.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-hub-border bg-hub-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-hub-muted">Disponibles</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary?.available ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-hub-border bg-hub-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-hub-muted">Ya usadas</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary?.used ?? 0}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-cleexs-blue" />
          <h3 className="text-sm font-semibold text-white">Pegá frases (opcional)</h3>
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Tema (opcional) — ej. AEO, branding, Cleexs"
          className="mb-3 w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-cleexs-blue/40 focus:ring-2"
        />
        <textarea
          value={quotesText}
          onChange={(e) => setQuotesText(e.target.value)}
          rows={5}
          placeholder={'Una frase por línea.\nEj: En Cleexs medimos antes de opinar.\nEj: La IA sin evidencia es solo ruido.'}
          className="w-full rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-sm text-white outline-none ring-cleexs-blue/40 focus:ring-2"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-cleexs-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar en el banco
          </button>
          <button
            type="button"
            disabled={inviting}
            onClick={handleInvite}
            className="inline-flex items-center gap-2 rounded-xl border border-hub-border px-4 py-2.5 text-sm text-slate-200 disabled:opacity-60"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Generar link mágico (24h)
          </button>
        </div>
        {lastLink ? (
          <p className="mt-3 break-all rounded-xl border border-hub-border bg-[#0b1220] px-3 py-2 text-xs text-slate-300">
            {lastLink}
          </p>
        ) : null}
      </section>

      {invites.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-hub-border bg-hub-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Links abiertos</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {invites.map((inv) => (
              <li key={inv.id} className="break-all">
                <span className="text-hub-muted">{inv.topic || 'Sin tema'} · </span>
                <a href={inv.url} className="text-cleexs-blue hover:underline" target="_blank" rel="noreferrer">
                  {inv.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card">
        <div className="border-b border-hub-border px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Banco de frases</h3>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-hub-muted">Cargando…</p>
        ) : notes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-hub-muted">Todavía no hay frases. Teo puede escribir igual.</p>
        ) : (
          <ul className="divide-y divide-hub-border/70">
            {notes.slice(0, 40).map((n) => (
              <li key={n.id} className="px-4 py-3 text-sm">
                <p className="text-slate-100">“{n.quote}”</p>
                <p className="mt-1 text-xs text-hub-muted">
                  {n.topic || 'sin tema'} · {n.status} · {n.authorLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </CentroShell>
  );
}
