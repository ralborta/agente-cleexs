'use client';

import { useWorkspaceSlug } from '@/lib/workspace';
import { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw, Upload } from 'lucide-react';
import {
  SettingsSection,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
} from '@/components/config/settings-section';
import {
  fetchSeoFoundations,
  publishLlmsTxt,
  type SeoFoundationsReport,
} from '@/lib/api-client';

function CheckMark({ status }: { status: string }) {
  const cls =
    status === 'ok'
      ? 'text-emerald-400'
      : status === 'warning' || status === 'error'
        ? 'text-amber-300'
        : 'text-slate-400';
  const glyph = status === 'ok' ? '✓' : status === 'warning' || status === 'error' ? '!' : '○';
  return <span className={cls}>{glyph}</span>;
}

export function SeoFoundationsPanel() {
  const workspace = useWorkspaceSlug();
  const [report, setReport] = useState<SeoFoundationsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'audit' | 'publish' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSeoFoundations(workspace);
      setReport(res.foundations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al auditar fundaciones SEO');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAudit() {
    setBusy('audit');
    setMessage(null);
    setError(null);
    try {
      await load();
      setMessage('Auditoría SEO actualizada');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al auditar');
    } finally {
      setBusy(null);
    }
  }

  async function runPublish() {
    setBusy('publish');
    setMessage(null);
    setError(null);
    try {
      const res = await publishLlmsTxt(workspace);
      setReport(res.foundations);
      setMessage(
        `llms.txt publicado en WP (${res.page.url}). Si /llms.txt en raíz aún falla, instalá el mu-plugin y flush permalinks.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al publicar llms.txt');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsSection
      title="Fundaciones SEO"
      description="Sitemap, robots.txt (solo lectura) y llms.txt para AEO — Sprint 5.1"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runAudit}
          disabled={busy !== null || loading}
          className={buttonSecondaryClassName}
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${busy === 'audit' || loading ? 'animate-spin' : ''}`} />
            {busy === 'audit' || loading ? 'Auditando…' : 'Auditar'}
          </span>
        </button>
        <button
          type="button"
          onClick={runPublish}
          disabled={busy !== null}
          className={buttonPrimaryClassName}
        >
          <span className="inline-flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {busy === 'publish' ? 'Publicando…' : 'Publicar llms.txt'}
          </span>
        </button>
      </div>

      {message ? (
        <p className="mb-3 text-sm text-emerald-200">{message}</p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}

      {loading && !report ? (
        <p className="text-sm text-hub-muted">Cargando auditoría…</p>
      ) : report ? (
        <div className="space-y-5">
          <ul className="space-y-2 text-sm">
            {report.checks.map((check) => (
              <li key={check.id} className="flex gap-2">
                <CheckMark status={check.status} />
                <span>
                  <span className="text-slate-200">{check.label}</span>
                  <span className="block text-xs text-hub-muted">{check.detail}</span>
                  {check.url ? (
                    <a
                      href={check.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block text-xs text-sky-300 hover:underline"
                    >
                      {check.url}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {report.robots.suggestions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-hub-muted">
                Sugerencias robots.txt
              </p>
              <ul className="space-y-2 text-sm">
                {report.robots.suggestions.map((s) => (
                  <li key={s.id} className="flex gap-2">
                    <span className={s.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}>
                      {s.severity === 'warning' ? '!' : 'i'}
                    </span>
                    <span className="text-slate-300">{s.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-hub-muted">
                Teo no sobrescribe robots.txt — los cambios son manuales en WP/hosting.
              </p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-hub-muted">
              <FileText className="h-3.5 w-3.5" />
              Vista previa llms.txt
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg border border-hub-border bg-[#0b1220] p-3 text-xs text-slate-300 whitespace-pre-wrap">
              {report.llms.generated}
            </pre>
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-xs text-hub-muted">
            <li>
              Subí{' '}
              <code className="rounded bg-[#0b1220] px-1">docs/wordpress/cleexs-teo-llms-txt.php</code> a{' '}
              <code className="rounded bg-[#0b1220] px-1">mu-plugins/</code>
            </li>
            <li>Publicá llms.txt desde este panel (crea/actualiza la página slug llms-txt)</li>
            <li>WP → Enlaces permanentes → Guardar (una vez) para activar /llms.txt</li>
          </ol>
        </div>
      ) : null}
    </SettingsSection>
  );
}
