'use client';

import type { ReactNode } from 'react';
import { Card, CardTitle, ComingSoon, PageHeader, Pill, StatCard, Table } from './ui';

export type PlaceholderSection = { title: string; hint?: string; head: string[]; what: string };

/**
 * Estructura de pantalla Stitch sin datos inventados: tarjetas y tablas con sus
 * columnas reales y un estado vacío honesto hasta que exista backend en Cleexs.
 */
export default function Placeholder({
  eyebrow,
  title,
  subtitle,
  badge,
  stats = [],
  sections = [],
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  stats?: { label: string; hint?: string }[];
  sections?: PlaceholderSection[];
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        badge={badge ?? <Pill tone="slate">Próximamente con datos Cleexs</Pill>}
        actions={actions}
      />
      {stats.length > 0 && (
        <section className={`grid grid-cols-2 ${stats.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} hint={s.hint} value="—" tone="fg" sub="Sin datos aún" />
          ))}
        </section>
      )}
      {children}
      <div className="space-y-5">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardTitle hint={s.hint}>{s.title}</CardTitle>
            <Table head={s.head}>{null}</Table>
            <div className="mt-4">
              <ComingSoon what={s.what} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
