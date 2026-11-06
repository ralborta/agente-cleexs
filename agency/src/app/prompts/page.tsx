'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Btn,
  Card,
  ConfigBadge,
  DataGate,
  EmptyState,
  Field,
  GhostBtn,
  Icon,
  Notice,
  PageHeader,
  Pill,
  Select,
  StatCard,
  Table,
  Tabs,
  TextArea,
  TextInput,
} from '@/components/ui';
import {
  csvTemplateContent,
  parsePromptCsv,
  planCsvImport,
  type ImportPlan,
  type ImportSkipped,
} from '@/lib/csv-prompts';
import { displayName, fmtDate, fmtPct, pct } from '@/lib/metrics';
import {
  CUSTOM_PROMPTS_MAX,
  uid,
  useStore,
  type CustomPrompt,
  type FilteredData,
} from '@/lib/store';

type View = 'todos' | 'dentro' | 'fuera';

type MeasureResult = {
  savedPromptId: string;
  responseText: string;
  analysis: unknown;
  executionId?: string;
};

function blankCustom(slot: number): CustomPrompt {
  return {
    id: uid('cprompt'),
    cleexsId: null,
    slot,
    text: '',
    name: '',
    tipoId: '',
    buyerId: '',
    ofertaId: '',
    country: '',
    active: true,
    updatedAt: new Date().toISOString(),
  };
}

function analysisSummary(analysis: unknown): string {
  if (!analysis || typeof analysis !== 'object') return '';
  const a = analysis as Record<string, unknown>;
  if (typeof a.resumen === 'string') return a.resumen;
  if (typeof a.summary === 'string') return a.summary;
  return '';
}

function skipTone(reason: ImportSkipped['reason']): 'amber' | 'red' | 'slate' | 'purple' {
  if (reason === 'malformed' || reason === 'overflow' || reason === 'not_durable') return 'red';
  if (reason === 'empty') return 'slate';
  return 'amber';
}

function CustomPromptsPanel() {
  const { config, updateConfig, isDefaultProject, activeProjectId } = useStore();
  const items = config.customPrompts ?? [];
  const [editing, setEditing] = useState<CustomPrompt | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MeasureResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [liveSlots, setLiveSlots] = useState(5);
  const [csvPlan, setCsvPlan] = useState<ImportPlan | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canAdd = items.length < CUSTOM_PROMPTS_MAX;

  const mergeFromCleexs = (
    prompts: Array<{
      slot: number;
      id: string | null;
      title: string;
      promptText: string;
      updatedAt: string | null;
      lastExecutedAt: string | null;
      resultsCount: number;
    }>,
    live = 5,
  ) => {
    const prev = config.customPrompts ?? [];
    const fromCleexs: CustomPrompt[] = prompts.map((p) => {
      const old = prev.find((x) => x.cleexsId === p.id || x.slot === p.slot);
      return {
        id: old?.id || uid('cprompt'),
        cleexsId: p.id,
        slot: p.slot,
        text: p.promptText,
        name: old?.name || p.title || p.promptText.slice(0, 60),
        tipoId: old?.tipoId || '',
        buyerId: old?.buyerId || '',
        ofertaId: old?.ofertaId || '',
        country: old?.country || '',
        active: old?.active ?? true,
        updatedAt: p.updatedAt || new Date().toISOString(),
        lastExecutedAt: p.lastExecutedAt,
        resultsCount: p.resultsCount,
      };
    });
    // No inventar durabilidad: solo conservamos extras locales si el live ya los tenía listados
    // en una sesión previa; el PUT solo confirma slots < liveMax.
    const syncedSlots = new Set(fromCleexs.map((p) => p.slot));
    const localExtra = prev.filter(
      (p) => typeof p.slot === 'number' && p.slot >= live && !syncedSlots.has(p.slot) && p.text.trim(),
    );
    const next = [...fromCleexs, ...localExtra].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    updateConfig({ customPrompts: next.slice(0, CUSTOM_PROMPTS_MAX) });
    setLiveSlots(live);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Aislamiento: solo el proyecto Cleexs (default) lee/escribe weekly-prompts del brand env.
      if (!isDefaultProject) {
        if (!cancelled) setLoaded(true);
        return;
      }
      try {
        const res = await fetch('/api/cleexs/custom-prompts', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || 'Error al cargar');
        if (!cancelled) {
          mergeFromCleexs(data.prompts || [], Number(data.cleexsLiveSlots) || 5);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefaultProject, activeProjectId]);

  const persistAll = async (next: CustomPrompt[], opts?: { requireCleexs?: boolean }) => {
    const requireCleexs = opts?.requireCleexs ?? false;
    if (!isDefaultProject) {
      updateConfig({ customPrompts: next.slice(0, CUSTOM_PROMPTS_MAX) });
      if (requireCleexs) {
        throw new Error(
          'Este proyecto local no está vinculado a una marca Cleexs: no hay persistencia de servidor. Usá el proyecto Cleexs para importar/guardar prompts durables.',
        );
      }
      return {
        prompts: [] as Array<{ slot: number; promptText: string; id: string | null }>,
        warnings: [
          'Proyecto local: cambios solo en este navegador (sin Cleexs). No se tocó la marca/agencia del servidor.',
        ],
        cleexsLiveSlots: 0,
        localOnly: true as const,
      };
    }
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/cleexs/custom-prompts', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompts: next.map((p, i) => ({
            slot: typeof p.slot === 'number' ? p.slot : i,
            promptText: p.active ? p.text : '',
            select: i === 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al guardar');
      const live = Number(data.cleexsLiveSlots) || 5;
      mergeFromCleexs(data.prompts || [], live);
      if (Array.isArray(data.warnings) && data.warnings.length) {
        setError(data.warnings.join(' · '));
      }
      return {
        ...(data as {
          prompts: Array<{ slot: number; promptText: string; id: string | null }>;
          warnings?: string[];
          cleexsLiveSlots?: number;
        }),
        localOnly: false as const,
      };
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSyncing(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplateContent()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleexs-agency-prompts-plantilla.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPickCsv = async (file: File | null) => {
    setImportReport(null);
    setCsvPlan(null);
    setCsvParseErrors([]);
    setCsvFileName(file?.name ?? null);
    if (!file) return;
    const text = await file.text();
    const parsed = parsePromptCsv(text);
    const hard = parsed.issues.filter((i) => i.rowNumber <= 1);
    if (hard.length && !parsed.rows.length) {
      setCsvParseErrors(hard.map((i) => i.message));
      return;
    }
    const plan = planCsvImport({
      rows: parsed.rows,
      parseIssues: parsed.issues,
      existing: items,
      max: CUSTOM_PROMPTS_MAX,
      // Preview de slots locales siempre hasta 40; la durabilidad real la decide Cleexs en confirm.
      liveMax: isDefaultProject ? liveSlots : CUSTOM_PROMPTS_MAX,
    });
    if (hard.length) setCsvParseErrors(hard.map((i) => i.message));
    setCsvPlan(plan);
  };

  const confirmCsvImport = async () => {
    if (!csvPlan?.toAdd.length) return;
    if (!isDefaultProject) {
      setError(
        'Importación CSV durable solo en el proyecto Cleexs vinculado. No se escribió nada en servidor ni en otro proyecto.',
      );
      return;
    }
    setImporting(true);
    setImportReport(null);
    setError(null);
    const additions: CustomPrompt[] = csvPlan.toAdd.map((row) => ({
      ...blankCustom(row.slot),
      text: row.text,
      name: row.name || row.text.slice(0, 60),
      tipoId: config.tipos[0]?.id ?? '',
    }));
    const next = [...items, ...additions]
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
      .slice(0, CUSTOM_PROMPTS_MAX);
    // Optimistic solo en UI local; el éxito real exige respuesta OK del PUT + relectura.
    updateConfig({ customPrompts: next });
    try {
      const data = await persistAll(next, { requireCleexs: true });
      if (data.localOnly) {
        throw new Error('Importación CSV requiere confirmación Cleexs; no se marcó como éxito.');
      }
      const savedTexts = new Set(
        (data.prompts || []).map((p) => p.promptText.trim().toLowerCase()),
      );
      const confirmed = additions.filter((a) => savedTexts.has(a.text.trim().toLowerCase()));
      const missing = additions.filter((a) => !savedTexts.has(a.text.trim().toLowerCase()));
      // Releer GET para demostrar durabilidad de servidor (no localStorage).
      const refreshed = await fetch('/api/cleexs/custom-prompts', { cache: 'no-store' });
      const list = await refreshed.json();
      if (refreshed.ok) mergeFromCleexs(list.prompts || [], Number(list.cleexsLiveSlots) || liveSlots);

      const parts = [
        `Confirmados en servidor: ${confirmed.length}/${additions.length}.`,
        csvPlan.skipped.length ? `Omitidos/avisados en preview: ${csvPlan.skipped.length}.` : '',
        missing.length
          ? `Sin confirmación durable: ${missing.length} (revisá warnings Cleexs maxSlots=${data.cleexsLiveSlots ?? liveSlots}).`
          : '',
      ].filter(Boolean);
      setImportReport(parts.join(' '));
      if (missing.length || (data.warnings && data.warnings.length)) {
        setError(
          [
            missing.length ? `${missing.length} fila(s) no quedaron en Cleexs.` : '',
            ...(data.warnings || []),
          ]
            .filter(Boolean)
            .join(' · '),
        );
      } else {
        setCsvPlan(null);
        setCsvFileName(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      /* error ya seteado; revertir a GET */
      try {
        const refreshed = await fetch('/api/cleexs/custom-prompts', { cache: 'no-store' });
        const list = await refreshed.json();
        if (refreshed.ok) mergeFromCleexs(list.prompts || [], Number(list.cleexsLiveSlots) || liveSlots);
      } catch {
        /* keep error */
      }
    } finally {
      setImporting(false);
    }
  };

  const startNew = () => {
    if (!canAdd) return;
    const used = new Set(items.map((x) => x.slot).filter((s) => typeof s === 'number'));
    let slot = 0;
    while (used.has(slot) && slot < CUSTOM_PROMPTS_MAX) slot += 1;
    setEditing({
      ...blankCustom(slot),
      tipoId: config.tipos[0]?.id ?? '',
    });
    setIsNew(true);
  };

  const save = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    const row: CustomPrompt = {
      ...editing,
      text,
      name: editing.name.trim() || text.slice(0, 60),
      updatedAt: new Date().toISOString(),
    };
    const next = isNew ? [...items, row] : items.map((x) => (x.id === row.id ? row : x));
    updateConfig({ customPrompts: next.slice(0, CUSTOM_PROMPTS_MAX) });
    try {
      await persistAll(next.slice(0, CUSTOM_PROMPTS_MAX));
      setEditing(null);
      setIsNew(false);
    } catch {
      /* error ya seteado */
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este prompt de Cleexs?')) return;
    const next = items.filter((x) => x.id !== id);
    updateConfig({ customPrompts: next });
    try {
      await persistAll(next);
    } catch {
      /* error ya seteado */
    }
    if (editing?.id === id) {
      setEditing(null);
      setIsNew(false);
    }
  };

  const measure = async (p: CustomPrompt) => {
    if (!isDefaultProject) {
      setError('Medir con IA solo está disponible en el proyecto Cleexs vinculado (aislamiento por marca).');
      return;
    }
    setMeasuringId(p.id);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/cleexs/custom-prompts/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          p.cleexsId
            ? { savedPromptId: p.cleexsId }
            : { slot: p.slot ?? 0, promptText: p.text },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al medir');
      setLastResult({
        savedPromptId: data.savedPromptId,
        responseText: data.responseText,
        analysis: data.analysis,
        executionId: data.executionId,
      });
      const refreshed = await fetch('/api/cleexs/custom-prompts', { cache: 'no-store' });
      const list = await refreshed.json();
      if (refreshed.ok) mergeFromCleexs(list.prompts || [], Number(list.cleexsLiveSlots) || 5);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMeasuringId(null);
    }
  };

  const tipoName = (id: string) => config.tipos.find((t) => t.id === id)?.name ?? '—';

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-fg font-semibold text-sm flex items-center gap-2">
            Prompts propios
            <ConfigBadge
              label={
                isDefaultProject
                  ? `máx. ${CUSTOM_PROMPTS_MAX} · Cleexs live ${liveSlots}`
                  : `máx. ${CUSTOM_PROMPTS_MAX} · proyecto local`
              }
            />
          </h3>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Hasta {CUSTOM_PROMPTS_MAX} prompts. Editá el texto antes de medir; podés saltear o borrar cuando quieras. La
            medición con IA queda en Cleexs/Agency — nada se publica al cliente sin tu OK.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GhostBtn type="button" onClick={downloadTemplate} disabled={syncing || importing} title="Descargar plantilla CSV UTF-8">
            <Icon name="download" className="w-3.5 h-3.5" />
            Plantilla CSV
          </GhostBtn>
          <GhostBtn
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!editing || syncing || importing || !canAdd}
            title="Importar lote CSV"
          >
            <Icon name="upload" className="w-3.5 h-3.5" />
            Importar lote CSV
          </GhostBtn>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onPickCsv(e.target.files?.[0] ?? null)}
          />
          <Btn type="button" onClick={startNew} disabled={!canAdd || !!editing || syncing || importing}>
            <Icon name="plus" className="w-3.5 h-3.5" />
            Agregar prompt ({items.length}/{CUSTOM_PROMPTS_MAX})
          </Btn>
        </div>
      </div>

      {error && <Notice tone="red">{error}</Notice>}
      {importReport && <Notice tone="cyan">{importReport}</Notice>}
      {!isDefaultProject && (
        <Notice tone="amber">
          Proyecto local aislado: no se lee ni escribe la API Cleexs de otra marca/agencia. La importación CSV durable
          requiere el proyecto Cleexs vinculado.
        </Notice>
      )}
      {!loaded && isDefaultProject && <p className="text-xs text-dim mb-3">Sincronizando con Cleexs…</p>}
      {syncing && <p className="text-xs text-accent-cyan mb-3">Guardando en Cleexs…</p>}

      {(csvPlan || csvParseErrors.length > 0) && (
        <div className="rounded-xl border border-line bg-surface2/60 p-4 mb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
              Vista previa CSV{csvFileName ? ` · ${csvFileName}` : ''}
            </div>
            <GhostBtn
              type="button"
              onClick={() => {
                setCsvPlan(null);
                setCsvParseErrors([]);
                setCsvFileName(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Cerrar
            </GhostBtn>
          </div>
          {csvParseErrors.map((msg) => (
            <Notice key={msg} tone="red">
              {msg}
            </Notice>
          ))}
          {csvPlan && (
            <>
              <p className="text-xs text-muted">
                A agregar en slots libres: <span className="text-fg font-medium">{csvPlan.toAdd.length}</span>
                {' · '}
                Slots durables libres antes: {csvPlan.freeDurableSlotsBefore}/{csvPlan.liveMax}
                {' · '}
                Avisos: {csvPlan.skipped.length}
                {!isDefaultProject ? ' · confirmación bloqueada (proyecto local)' : ''}
              </p>
              {csvPlan.toAdd.length > 0 && (
                <Table head={['Fila CSV', 'Slot', 'Prompt']}>
                  {csvPlan.toAdd.map((row) => (
                    <tr key={`add-${row.rowNumber}`}>
                      <td className="py-2 pr-3 text-xs text-muted">{row.rowNumber}</td>
                      <td className="py-2 pr-3 text-xs">{row.slot + 1}</td>
                      <td className="py-2 text-xs text-fg line-clamp-2 whitespace-pre-wrap">{row.text}</td>
                    </tr>
                  ))}
                </Table>
              )}
              {csvPlan.skipped.length > 0 && (
                <Table head={['Fila', 'Motivo', 'Detalle']}>
                  {csvPlan.skipped.map((row) => (
                    <tr key={`skip-${row.rowNumber}-${row.reason}`}>
                      <td className="py-2 pr-3 text-xs text-muted">{row.rowNumber}</td>
                      <td className="py-2 pr-3">
                        <Pill tone={skipTone(row.reason)}>{row.reason}</Pill>
                      </td>
                      <td className="py-2 text-xs text-muted">
                        {row.message}
                        {row.text ? ` · ${row.text.slice(0, 80)}` : ''}
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
              <div className="flex flex-wrap gap-2">
                <Btn
                  type="button"
                  onClick={confirmCsvImport}
                  disabled={!csvPlan.toAdd.length || importing || syncing || !isDefaultProject}
                >
                  <Icon name="check" className="w-3.5 h-3.5" />
                  {importing ? 'Importando…' : `Confirmar importación (${csvPlan.toAdd.length})`}
                </Btn>
                <GhostBtn type="button" onClick={() => fileRef.current?.click()} disabled={importing}>
                  Elegir otro archivo
                </GhostBtn>
              </div>
            </>
          )}
        </div>
      )}

      {!canAdd && !editing && (
        <Notice tone="amber">
          Ya tenés {CUSTOM_PROMPTS_MAX} prompts propios. Editá o borrá uno para agregar otro.
        </Notice>
      )}

      {editing && (
        <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/5 p-4 mb-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
            {isNew ? 'Nuevo prompt' : 'Editar prompt'}
          </div>
          <Field label="Nombre corto (opcional)">
            <TextInput
              value={editing.name}
              placeholder="Ej. Comparativa firma electrónica PyME"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="Texto del prompt" hint="Lo que se le pregunta a la IA">
            <TextArea
              rows={5}
              value={editing.text}
              placeholder="Escribí la consulta completa…"
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Tipo">
              <Select value={editing.tipoId} onChange={(e) => setEditing({ ...editing, tipoId: e.target.value })}>
                <option value="">Sin tipo</option>
                {config.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buyer persona">
              <Select value={editing.buyerId} onChange={(e) => setEditing({ ...editing, buyerId: e.target.value })}>
                <option value="">Sin buyer</option>
                {config.buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Oferta">
              <Select value={editing.ofertaId} onChange={(e) => setEditing({ ...editing, ofertaId: e.target.value })}>
                <option value="">Sin oferta</option>
                {config.ofertas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="País">
              <TextInput
                value={editing.country}
                placeholder="Argentina"
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              className="rounded border-line"
            />
            Activo para próximas corridas
          </label>
          <div className="flex gap-2">
            <Btn type="button" onClick={save} disabled={!editing.text.trim() || syncing}>
              <Icon name="check" className="w-3.5 h-3.5" /> Guardar en Cleexs
            </Btn>
            <GhostBtn
              type="button"
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
            >
              Cancelar
            </GhostBtn>
          </div>
        </div>
      )}

      {items.length === 0 && !editing ? (
        <EmptyState
          icon="chat"
          title="Todavía no hay prompts propios"
          body={`Podés agregar hasta ${CUSTOM_PROMPTS_MAX}. Se guardan y miden en Cleexs (resultados reales).`}
        />
      ) : (
        <Table head={['Prompt', 'Tipo', 'Buyer · Oferta', 'Estado', '']}>
          {items.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="py-3 pr-4 max-w-md">
                <div className="text-fg font-medium">{p.name || 'Sin nombre'}</div>
                <div className="text-[11px] text-dim mt-1 line-clamp-2 whitespace-pre-wrap">{p.text}</div>
                <div className="text-[10px] text-dim mt-1">
                  Slot {(p.slot ?? 0) + 1}
                  {p.lastExecutedAt ? ` · medido ${fmtDate(p.lastExecutedAt, true)}` : ''}
                  {typeof p.resultsCount === 'number' ? ` · ${p.resultsCount} resultados` : ''}
                </div>
              </td>
              <td className="py-3 pr-3">
                <Pill tone="purple">{tipoName(p.tipoId)}</Pill>
                {p.country ? <div className="text-[11px] text-dim mt-1">{p.country}</div> : null}
              </td>
              <td className="py-3 pr-3 text-xs text-muted">
                <div>{config.buyers.find((b) => b.id === p.buyerId)?.name ?? '—'}</div>
                <div>{config.ofertas.find((o) => o.id === p.ofertaId)?.name ?? '—'}</div>
              </td>
              <td className="py-3 pr-3">
                {p.cleexsId ? <Pill tone="green">En Cleexs</Pill> : <Pill tone="amber">Local</Pill>}
              </td>
              <td className="py-3 whitespace-nowrap">
                <div className="flex gap-1">
                  <GhostBtn
                    type="button"
                    onClick={() => measure(p)}
                    disabled={!!measuringId || !!editing || !p.text.trim()}
                    title="Medir ahora (IA real)"
                  >
                    <Icon name={measuringId === p.id ? 'clock' : 'sparkle'} className="w-3.5 h-3.5" />
                  </GhostBtn>
                  <GhostBtn
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setIsNew(false);
                    }}
                    disabled={!!editing || !!measuringId}
                    title="Editar"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                  </GhostBtn>
                  <GhostBtn type="button" onClick={() => remove(p.id)} disabled={!!measuringId} title="Eliminar">
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </GhostBtn>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {measuringId && (
        <Notice tone="cyan">Midiendo en Cleexs con IA real… puede tardar unos segundos.</Notice>
      )}

      {lastResult && (
        <div className="mt-4 rounded-xl border border-line bg-surface2/60 p-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-teal">Resultado real Cleexs</div>
          {analysisSummary(lastResult.analysis) && (
            <p className="text-sm text-fg leading-relaxed">{analysisSummary(lastResult.analysis)}</p>
          )}
          <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {lastResult.responseText}
          </div>
        </div>
      )}
    </Card>
  );
}

function AuditedPrompts({ d }: { d: FilteredData }) {
  const { config, updateConfig } = useStore();
  const { snapshot: snap, latest, prompts } = d;
  const [view, setView] = useState<View>('todos');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ promptId: string; text: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const modelLabel = (m: string | null) => snap.llms.find((l) => l.model === m)?.label ?? m ?? '—';
  const list = useMemo(
    () =>
      prompts.filter((p) => {
        if (view === 'dentro' && !p.brandInTop3) return false;
        if (view === 'fuera' && p.brandInTop3) return false;
        if (q && !(p.text + p.name).toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [prompts, view, q],
  );

  if (!latest) {
    return <EmptyState icon="clock" title="Sin corridas para los filtros actuales" body="Ampliá el período o limpiá los filtros." />;
  }

  const inTop3 = prompts.filter((p) => p.brandInTop3).length;
  const first = prompts.filter((p) => p.brandPosition === 1).length;
  const tipos = new Set(prompts.map((p) => p.type).filter(Boolean));
  const setTag = (promptId: string, patch: { buyerId?: string; ofertaId?: string }) =>
    updateConfig({ promptTags: { ...config.promptTags, [promptId]: { ...config.promptTags[promptId], ...patch } } });

  const setOverride = (promptId: string, patch: { text?: string; name?: string; hidden?: boolean }) => {
    updateConfig({
      promptOverrides: {
        ...config.promptOverrides,
        [promptId]: {
          ...config.promptOverrides[promptId],
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    setBusyId(editing.promptId);
    setErr(null);
    try {
      const res = await fetch(`/api/cleexs/prompts/${editing.promptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          promptText: text,
          name: editing.name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al guardar');
      setOverride(editing.promptId, { text, name: editing.name.trim() || undefined });
      setEditing(null);
    } catch (e) {
      // Igual aplicamos override local para que el listado se actualice ya
      setOverride(editing.promptId, { text, name: editing.name.trim() || undefined });
      setErr(`${(e as Error).message} · cambio aplicado en Agency; Cleexs puede requerir redeploy.`);
      setEditing(null);
    } finally {
      setBusyId(null);
    }
  };

  const removePrompt = async (promptId: string) => {
    if (!confirm('¿Quitar este prompt del listado? Se desactiva en Cleexs para próximas corridas (el historial se conserva).')) {
      return;
    }
    setBusyId(promptId);
    setErr(null);
    try {
      const res = await fetch(`/api/cleexs/prompts/${promptId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al borrar');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setOverride(promptId, { hidden: true });
      setBusyId(null);
      if (editing?.promptId === promptId) setEditing(null);
    }
  };

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Prompts auditados" value={prompts.length} tone="fg" sub={`${tipos.size} tipos distintos`} />
        <StatCard label="Marca en Top 3" value={`${inTop3} / ${prompts.length}`} sub={fmtPct(pct(inTop3, prompts.length))} />
        <StatCard label="Posición #1" value={first} tone="teal" sub={fmtPct(pct(first, prompts.length)) + ' de los prompts'} />
        <StatCard label="Fuera del Top 3" value={prompts.length - inTop3} tone="amber" sub="Oportunidades de mejora" />
      </section>

      {err && <Notice tone="amber">{err}</Notice>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-fg font-semibold text-sm">Prompts corridos (auditados Cleexs)</h3>
            <p className="text-xs text-muted mt-0.5">
              Corrida {fmtDate(latest.createdAt, true)} · editable: cambiar texto, editar o borrar del listado
            </p>
          </div>
          <Tabs<View>
            tabs={[
              { id: 'todos', label: `Todos (${prompts.length})` },
              { id: 'dentro', label: `Marca en Top 3 (${inTop3})` },
              { id: 'fuera', label: `Fuera del Top 3 (${prompts.length - inTop3})` },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <div className="relative w-full sm:w-72 mb-4">
          <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput className="pl-8" placeholder="Buscar por texto o tipo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {editing && (
          <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/5 p-4 mb-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">Editar prompt corrido</div>
            <Field label="Nombre corto">
              <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Texto del prompt">
              <TextArea rows={6} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Btn type="button" onClick={saveEdit} disabled={!editing.text.trim() || busyId === editing.promptId}>
                <Icon name="check" className="w-3.5 h-3.5" /> Guardar cambios
              </Btn>
              <GhostBtn type="button" onClick={() => setEditing(null)}>
                Cancelar
              </GhostBtn>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState title="Ningún prompt coincide" body="Cambiá la vista o la búsqueda." />
        ) : (
          <Table
            head={[
              'Prompt / Consulta',
              'Tipo',
              'Visibilidad',
              'Motor',
              'Competidores en Top 3',
              <span key="t" className="inline-flex items-center gap-1.5">
                Buyer · Oferta <ConfigBadge label="local" />
              </span>,
              '',
            ]}
          >
            {list.map((p) => {
              const rivals = p.top3.filter((e) => e.type !== 'brand');
              const tag = config.promptTags[p.promptId] ?? {};
              const isOpen = open === p.id;
              const edited = !!config.promptOverrides[p.promptId]?.text;
              return (
                <Fragment key={p.id}>
                  <tr className="align-top">
                    <td className="py-3 pr-4 max-w-md">
                      <button type="button" className="text-left" onClick={() => setOpen(isOpen ? null : p.id)}>
                        <div className="text-fg font-medium line-clamp-2 flex items-start gap-1.5">
                          {p.text.split('\n')[1] || p.text.split('\n')[0] || p.name}
                          {edited && <Pill tone="amber">editado</Pill>}
                        </div>
                        <div className="text-[11px] text-dim mt-1">
                          {p.intent ?? p.name} · {isOpen ? 'ocultar detalle' : 'ver detalle'}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone="purple">{p.type ?? '—'}</Pill>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {p.brandInTop3 ? (
                        <Pill tone="green">Top 3 · #{p.brandPosition}</Pill>
                      ) : (
                        <Pill tone="red">Fuera del Top 3</Pill>
                      )}
                      <div className="text-[11px] text-dim mt-1">score {p.score.toFixed(2).replace('.', ',')}</div>
                    </td>
                    <td className="py-3 pr-3">{modelLabel(p.model)}</td>
                    <td className="py-3 pr-3">
                      {rivals.length ? (
                        <div className="flex flex-wrap gap-1">
                          {rivals.map((r) => (
                            <Pill key={r.name} tone="slate">
                              #{r.position} {displayName(r.name)}
                            </Pill>
                          ))}
                        </div>
                      ) : (
                        <span className="text-dim">Ninguno</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <Select value={tag.buyerId ?? ''} onChange={(e) => setTag(p.promptId, { buyerId: e.target.value || undefined })}>
                          <option value="">Sin buyer</option>
                          {config.buyers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </Select>
                        <Select value={tag.ofertaId ?? ''} onChange={(e) => setTag(p.promptId, { ofertaId: e.target.value || undefined })}>
                          <option value="">Sin oferta</option>
                          {config.ofertas.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <GhostBtn
                          type="button"
                          title="Editar / cambiar"
                          disabled={!!busyId || !!editing}
                          onClick={() =>
                            setEditing({
                              promptId: p.promptId,
                              text: p.text,
                              name: p.name || '',
                            })
                          }
                        >
                          <Icon name="edit" className="w-3.5 h-3.5" />
                        </GhostBtn>
                        <GhostBtn
                          type="button"
                          title="Borrar del listado"
                          disabled={!!busyId || !!editing}
                          onClick={() => removePrompt(p.promptId)}
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </GhostBtn>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="pb-4">
                        <div className="rounded-xl bg-surface2 border border-line p-4 space-y-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Prompt ejecutado</div>
                            <pre className="whitespace-pre-wrap text-xs text-fg font-sans">{p.text}</pre>
                          </div>
                          {p.responseExcerpt && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Respuesta de la IA (extracto)</div>
                              <pre className="whitespace-pre-wrap text-xs text-muted font-sans">
                                {p.responseExcerpt}
                                {p.responseExcerpt.length >= 700 ? '…' : ''}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}

function PromptsBody({ d }: { d: FilteredData }) {
  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Prompts"
        badge={<Pill tone="slate">Hasta {CUSTOM_PROMPTS_MAX} propios + auditados Cleexs</Pill>}
        subtitle={`Agregá y editá hasta ${CUSTOM_PROMPTS_MAX} propios (corregí nombres/números antes de medir). Abajo: prompts ya corridos de ${d.snapshot.brand.name}, también editables.`}
      />
      <CustomPromptsPanel />
      <AuditedPrompts d={d} />
    </>
  );
}

export default function Page() {
  const { isDefaultProject, snapshot } = useStore();
  // Si no hay snapshot Cleexs, igual permitimos gestionar prompts propios
  if (!isDefaultProject || snapshot.error || !snapshot.data) {
    return (
      <>
        <PageHeader
          eyebrow="Registro"
          title="Prompts"
          badge={<ConfigBadge label={`máx. ${CUSTOM_PROMPTS_MAX}`} />}
          subtitle={`Agregá y editá hasta ${CUSTOM_PROMPTS_MAX} prompts propios del proyecto.`}
        />
        <CustomPromptsPanel />
        {snapshot.loading ? (
          <EmptyState title="Cargando prompts auditados…" />
        ) : (
          <EmptyState title="Sin corridas Cleexs en este proyecto" body="Los prompts propios igual se guardan y se usan al programar corridas." />
        )}
      </>
    );
  }
  return <DataGate>{(d) => <PromptsBody d={d} />}</DataGate>;
}
