'use client';

import Link from 'next/link';
import { resolvePublicationUrl } from '@/lib/publication-url';
import type { AnalyticsDashboard } from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';

type Props = {
  articles: AnalyticsDashboard['topArticles'];
};

export function TopArticlesPanel({ articles }: Props) {
  if (!articles.length) {
    return <p className="text-sm text-hub-muted">Publicá artículos con Teo para ver rendimiento por pieza.</p>;
  }

  const maxScore = Math.max(...articles.map((a) => a.clicks + a.sessions), 1);

  return (
    <div className="space-y-3">
      {articles.map((article, index) => {
        const score = article.clicks + article.sessions;
        const width = Math.max((score / maxScore) * 100, score > 0 ? 10 : 0);
        const publicUrl = resolvePublicationUrl(article.url, article.slug);

        return (
          <div
            key={`${article.title}-${index}`}
            className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{article.title}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-hub-muted">
                  <span>{formatMetric(article.clicks)} clicks</span>
                  <span>{formatMetric(article.impressions)} impresiones</span>
                  <span>{formatMetric(article.sessions)} visitas</span>
                </div>
              </div>
              {publicUrl ? (
                <Link
                  href={publicUrl}
                  target="_blank"
                  className="shrink-0 text-xs font-semibold text-cleexs-blue hover:underline"
                >
                  Ver →
                </Link>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-hub-border/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cleexs-blue to-teal-400"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
