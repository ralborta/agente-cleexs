'use client';

import type { ReactNode } from 'react';
import { Card, CardTitle, ConfigBadge, Field, Notice, PageHeader, Pill, Select, TextArea, TextInput } from '@/components/ui';
import { fmtDate } from '@/lib/metrics';
import { useStore, type ProyectoCfg } from '@/lib/store';

export default function Page() {
  const { config, updateConfig, snapshot, isDefaultProject, projectName, projectDomain, projects, activeProjectId, removeProject } = useStore();
  const snap = isDefaultProject ? snapshot.data : null;
  const p = config.proyecto;
  const set = (patch: Partial<ProyectoCfg>) => updateConfig({ proyecto: { ...p, ...patch } });
  const local = projects.find((x) => x.id === activeProjectId);

  const kv = (k: string, v: ReactNode) => (
    <div className="flex justify-between gap-4 py-2 border-b border-line/70 last:border-0">
      <span className="text-dim">{k}</span>
      <span className="text-fg text-right break-all">{v ?? '—'}</span>
    </div>
  );

  return (
    <>
      <PageHeader eyebrow="Registro · Proyecto" title={`Ficha del proyecto: ${projectName}`} subtitle="Parámetros del proyecto. Los datos de identidad vienen de Cleexs; los ajustes editables se guardan localmente." badge={<ConfigBadge />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardTitle right={snap ? <Pill tone="green">Cleexs API</Pill> : <Pill tone="amber">Proyecto local</Pill>}>Identidad de marca</CardTitle>
          <div className="text-xs">
            {kv('Nombre', projectName)}
            {kv('Dominio', projectDomain || '—')}
            {snap && (
              <>
                {kv('Brand ID', <code className="text-[11px]">{snap.brand.id}</code>)}
                {kv('País', snap.brand.country)}
                {kv('Industria', snap.brand.industry)}
                {kv('Aliases', snap.brand.aliases.join(', ') || '—')}
                {kv('Competidores registrados', snap.brand.competitors.length)}
                {kv('Última corrida', snap.latestRun ? `${fmtDate(snap.latestRun.createdAt, true)} · ${snap.latestRun.runType} · ${snap.latestRun.status}` : 'sin corridas')}
                {kv('Modelo', snap.latestRun?.model ?? '—')}
                {kv('Origen de Visibilidad', snap.visibilitySource === 'brandInTop3Pct' ? '% de prompts con la marca en Top 3' : snap.visibilitySource === 'score' ? 'score medio de prompts' : 'sin datos')}
                {kv('API', snap.apiUrl)}
              </>
            )}
            {local && (
              <>
                {kv('Creado', fmtDate(local.createdAt, true))}
                {kv('Estado', local.status)}
                {kv('Países', local.countries.join(', ') || '—')}
                {kv('IAs', local.ias.join(', ') || '—')}
                {kv('Prompts definidos', local.prompts.length)}
                {kv('Competidores', local.competitors.join(', ') || '—')}
              </>
            )}
          </div>
          {local && (
            <button
              type="button"
              className="mt-4 text-xs text-red-400 hover:underline"
              onClick={() => confirm('¿Eliminar este proyecto local?') && removeProject(local.id)}
            >
              Eliminar proyecto local
            </button>
          )}
        </Card>

        <Card>
          <CardTitle right={<ConfigBadge label="Editable · local" />}>Ajustes del proyecto</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre visible"><TextInput value={p.name} placeholder={projectName} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Dominio"><TextInput value={p.domain} placeholder={projectDomain} onChange={(e) => set({ domain: e.target.value })} /></Field>
            <Field label="País"><TextInput value={p.country} placeholder={snap?.brand.country ?? ''} onChange={(e) => set({ country: e.target.value })} /></Field>
            <Field label="Industria"><TextInput value={p.industry} placeholder={snap?.brand.industry ?? ''} onChange={(e) => set({ industry: e.target.value })} /></Field>
            <Field label="Frecuencia deseada de análisis" hint="Referencia interna: la cadencia real la define Cleexs.">
              <Select value={p.frequency} onChange={(e) => set({ frequency: e.target.value as ProyectoCfg['frequency'] })}>
                {['Diaria', 'Semanal', 'Quincenal', 'Mensual'].map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notas / descripción"><TextArea value={p.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            </div>
          </div>
          <p className="text-[11px] text-dim mt-3">Los cambios se guardan automáticamente en este navegador.</p>
        </Card>
      </div>

      <div className="mt-5"><Notice tone="cyan">
        Integraciones con proveedores de IA, cuotas y webhooks se administran en Cleexs; esta app no almacena claves ni credenciales.
      </Notice></div>
    </>
  );
}
