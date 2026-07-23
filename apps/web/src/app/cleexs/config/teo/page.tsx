'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { AutomationPanel } from '@/components/config/automation-panel';
import {
  FieldLabel,
  SettingsSection,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  inputClassName,
} from '@/components/config/settings-section';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  fetchTeoConfig,
  updateTeoConfig,
  type AutomationStatus,
  type TeoConfigResponse,
} from '@/lib/api-client';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

export default function TeoConfigPage() {
  const [data, setData] = useState<TeoConfigResponse | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [tone, setTone] = useState('');
  const [frequency, setFrequency] = useState('2/semana');
  const [requireApproval, setRequireApproval] = useState(true);
  const [automation, setAutomation] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTeoConfig('cleexs');
      setData(res);
      setTopics(Array.isArray(res.config?.topics) ? (res.config.topics as string[]) : []);
      setTone(res.config?.tone ?? '');
      setFrequency(res.config?.frequency ?? '2/semana');
      setRequireApproval(!(res.config?.autoPublish ?? false));
      setAutomation(res.automation);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addTopic() {
    const value = newTopic.trim();
    if (!value || topics.includes(value)) return;
    setTopics((prev) => [...prev, value]);
    setNewTopic('');
  }

  function removeTopic(topic: string) {
    setTopics((prev) => prev.filter((t) => t !== topic));
  }

  async function handleSave() {
    if (topics.length === 0) {
      setError('Agregá al menos un tema.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await updateTeoConfig('cleexs', {
        topics,
        tone: tone.trim() || undefined,
        frequency,
        autoPublish: !requireApproval,
      });
      setAutomation(res.automation);
      setMessage('Configuración guardada. Teo usará estas reglas en las próximas misiones.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const presets = data?.frequencyPresets ?? [
    { value: '1/semana', label: '1 pieza por semana' },
    { value: '2/semana', label: '2 piezas por semana' },
    { value: '3/semana', label: '3 piezas por semana' },
  ];

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">Configuración</p>
        <h2 className="mt-1 text-3xl font-semibold text-white">Temas y reglas — {TEO_AUTHOR_NAME}</h2>
        <p className="mt-2 max-w-2xl text-sm text-hub-muted">
          Definí el territorio editorial una vez. Con esto Teo planifica, escribe y deja piezas listas de forma
          autónoma.
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

      {loading ? (
        <p className="text-hub-muted">Cargando configuración…</p>
      ) : (
        <div className="space-y-6">
          <AutomationPanel automation={automation} />

          <SettingsSection
            title="Temas prioritarios"
            description="Teo elige aleatoriamente entre estos temas al crear misiones autónomas."
          >
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-2 rounded-full border border-cleexs-blue/30 bg-cleexs-blue/10 px-3 py-1.5 text-sm text-blue-100"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => removeTopic(topic)}
                    className="text-blue-200 hover:text-white"
                    aria-label={`Quitar ${topic}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                placeholder="Ej. visibilidad en IA"
                className={`${inputClassName} max-w-sm`}
              />
              <button type="button" onClick={addTopic} className={buttonSecondaryClassName}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Agregar tema
                </span>
              </button>
            </div>
          </SettingsSection>

          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsSection title="Tono de voz" description="Guía editorial para todos los artículos.">
              <FieldLabel hint="Profesional, claro, orientado a PyMEs…">
                Descripción del tono
              </FieldLabel>
              <textarea
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                rows={4}
                className={`${inputClassName} resize-y`}
              />
            </SettingsSection>

            <SettingsSection title="Ritmo y publicación">
              <FieldLabel hint="El scheduler usa esto para calcular cuándo crear la próxima misión.">
                Frecuencia de contenido
              </FieldLabel>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className={inputClassName}
              >
                {presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-hub-border/70 bg-[#0b1220]/40 px-4 py-4">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-hub-border bg-[#0b1220] text-cleexs-blue"
                />
                <span>
                  <span className="block text-sm font-medium text-white">Requiere aprobación humana</span>
                  <span className="mt-1 block text-xs text-hub-muted">
                    Recomendado en piloto. Teo genera y vos aprobás antes de publicar en WordPress.
                  </span>
                </span>
              </label>
            </SettingsSection>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className={buttonPrimaryClassName}>
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </span>
            </button>
            <button type="button" onClick={load} className={buttonSecondaryClassName}>
              Recargar
            </button>
          </div>
        </div>
      )}
    </CentroShell>
  );
}
