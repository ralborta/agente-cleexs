'use client';

import Link from 'next/link';
import { BookOpen, Circle, ExternalLink } from 'lucide-react';
import type { ContentClusterSummary } from '@/lib/api-client';

const TYPE_LABEL: Record<string, string> = {
  pillar: 'Pilar',
  faq: 'FAQ',
  checklist: 'Checklist',
  comparison: 'Comparativa',
  how_to: 'How-to',
};

export function EcosystemPanel({ clusters }: { clusters: ContentClusterSummary[] }) {
  const cluster = clusters[0];
  if (!cluster) return null;

  const pillar = cluster.pieces.find((p) => p.role === 'pillar');
  const satellites = cluster.pieces.filter((p) => p.role === 'satellite');

  return (
    <section className="mb-6 rounded-2xl border border-cleexs-blue/25 bg-cleexs-blue/5 p-5 shadow-hub">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cleexs-blue">
            <BookOpen className="h-4 w-4" />
            Ecosistema de contenido
          </div>
          <h3 className="text-lg font-semibold text-white">{cluster.name}</h3>
          {cluster.pillarTopic ? (
            <p className="mt-1 text-sm text-hub-muted">{cluster.pillarTopic}</p>
          ) : null}
        </div>
        <div className="text-right text-xs text-hub-muted">
          <p>{cluster.stats.published} publicadas</p>
          <p>{cluster.stats.total} en cluster</p>
        </div>
      </div>

      {cluster.stats.missingTypes.length > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Teo priorizará satélites faltantes:{' '}
          {cluster.stats.missingTypes.map((t) => TYPE_LABEL[t] ?? t).join(', ')}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-hub-border bg-hub-card/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Pilar</p>
          {pillar ? (
            <PieceRow piece={pillar} />
          ) : (
            <p className="mt-2 text-sm text-hub-muted">Sin pilar asignado aún</p>
          )}
        </div>
        <div className="rounded-xl border border-hub-border bg-hub-card/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cleexs-blue">Satélites</p>
          {satellites.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {satellites.map((piece) => (
                <li key={piece.id}>
                  <PieceRow piece={piece} compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-hub-muted">Sin satélites en el cluster</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-hub-muted">
        Al publicar, Teo agrega una sección <strong className="text-slate-300">En este ecosistema</strong>{' '}
        con links internos entre pilar y satélites.{' '}
        <Link href="/cleexs/monitor" className="text-cleexs-blue underline">
          Lanzar misión
        </Link>
      </p>
    </section>
  );
}

function PieceRow({
  piece,
  compact,
}: {
  piece: ContentClusterSummary['pieces'][number];
  compact?: boolean;
}) {
  const typeLabel = TYPE_LABEL[piece.type] ?? piece.type;
  return (
    <div className={`flex items-start gap-2 ${compact ? '' : 'mt-2'}`}>
      <Circle
        className={`mt-1 h-2 w-2 shrink-0 ${piece.status === 'published' ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-500 text-slate-500'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-medium text-white ${compact ? 'text-sm' : ''}`}>{piece.title}</p>
        <p className="text-xs text-hub-muted">
          {typeLabel} · {piece.status.replace(/_/g, ' ')}
        </p>
      </div>
      {piece.url ? (
        <a
          href={piece.url}
          target="_blank"
          rel="noopener"
          className="shrink-0 text-cleexs-blue hover:text-white"
          aria-label={`Abrir ${piece.title}`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}
