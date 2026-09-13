'use client';

import Link from 'next/link';
import { resolvePublicationUrl } from '@/lib/publication-url';
import type { AnalyticsDashboard } from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type Props = {
  articles: AnalyticsDashboard['topArticles'];
};

export function TopArticlesPanel({ articles }: Props) {
  if (!articles.length) {
    return (
      <p className="rounded-xl border border-dashed border-hub-border px-3 py-8 text-center text-sm text-hub-muted">
        Publicá artículos con Teo para ver rendimiento por pieza.
      </p>
    );
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
            className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 p-4 transition hover:border-cleexs-blue/35"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                  <p className="truncate text-sm font-medium text-white">{article.title}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-hub-muted">
                  <Badge variant="info">{formatMetric(article.clicks)} clicks</Badge>
                  <Badge variant="secondary">{formatMetric(article.impressions)} impr.</Badge>
                  <Badge variant="outline">{formatMetric(article.sessions)} visitas</Badge>
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
            <Progress value={width} className="mt-3" />
          </div>
        );
      })}
    </div>
  );
}
