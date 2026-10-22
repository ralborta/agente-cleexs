'use client';

import { useEffect, useMemo, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type Category = 'Visibilidad' | 'Reconocimiento' | 'Sentimiento';
type Tab = 'resumen' | 'prompts' | 'competidores' | 'fuentes' | 'historial';

type PromptItem = {
  id: string;
  text: string;
  category: Category;
  tags: string[];
};

type PromptResult = {
  promptId: string;
  model: string;
  mentioned: boolean;
  position: number | null; // 1..5
  sentiment: 'Favorable' | 'Neutral' | 'Comparativo' | null;
  competitors: string[];
  sources: string[];
};

type RunRecord = {
  id: number;
  at: string;
  version: string;
  promptsCount: number;
  models: string[];
  score: number;
  visibilityPct: number;
  top3Pct: number;
  ownSourcesPct: number;
  results: PromptResult[];
  competitorShare: { name: string; pct: number }[];
  sourceShare: { domain: string; pct: number; own: boolean }[];
};

type Project = {
  id: string;
  client: string;
  name: string;
  brand: string;
  market: string;
  competitors: string[];
  competitorPool: string[];
  sourcePool: string[];
  ownDomains: string[];
  prompts: PromptItem[];
  suggestions: PromptItem[];
  version: string;
  history: RunRecord[];
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const MODELS = ['GPT-4o', 'Claude', 'Gemini', 'Perplexity'] as const;
const CATEGORIES: Category[] = ['Visibilidad', 'Reconocimiento', 'Sentimiento'];

function hashCode(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: string, salt: number): number {
  const x = Math.sin(hashCode(seed) * 0.0001 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function runLabel(id: number) {
  return `Corrida #${id}`;
}

/** Score explicable v1: 50% aparición + 30% Top3 + 20% fuentes propias. */
function computeScore(visibilityPct: number, top3Pct: number, ownSourcesPct: number) {
  return Math.round((0.5 * visibilityPct + 0.3 * top3Pct + 0.2 * ownSourcesPct) * 10) / 10;
}

function simulateRun(project: Project, runId: number, driftSeed: number): RunRecord {
  const results: PromptResult[] = [];
  const compCount = new Map<string, number>();
  const srcCount = new Map<string, number>();
  let cells = 0;
  let mentionedCells = 0;
  let top3Cells = 0;
  let ownSourceCells = 0;

  for (const p of project.prompts) {
    for (const model of MODELS) {
      cells += 1;
      const base = seeded(`${project.id}|${p.id}|${model}`, driftSeed);
      const categoryBoost =
        p.category === 'Reconocimiento' ? 0.18 : p.category === 'Visibilidad' ? 0.02 : 0.08;
      const mentioned = base + categoryBoost > 0.38;
      const position = mentioned ? 1 + Math.floor(seeded(`${p.id}|pos|${model}`, driftSeed) * 5) : null;
      if (mentioned) {
        mentionedCells += 1;
        if (position !== null && position <= 3) top3Cells += 1;
      }
      const competitors: string[] = [];
      for (const c of project.competitorPool) {
        if (seeded(`${p.id}|${c}|${model}`, driftSeed + 3) > 0.55) {
          competitors.push(c);
          compCount.set(c, (compCount.get(c) ?? 0) + 1);
        }
      }
      const sources: string[] = [];
      // Perplexity cita más fuentes; el resto, menos.
      const srcThreshold = model === 'Perplexity' ? 0.35 : 0.68;
      for (const d of [...project.ownDomains, ...project.sourcePool]) {
        if (seeded(`${p.id}|src|${d}|${model}`, driftSeed + 7) > srcThreshold) {
          sources.push(d);
          srcCount.set(d, (srcCount.get(d) ?? 0) + 1);
          if (project.ownDomains.includes(d) && mentioned) ownSourceCells += 1;
        }
      }
      results.push({
        promptId: p.id,
        model,
        mentioned,
        position,
        sentiment: mentioned
          ? (['Favorable', 'Neutral', 'Comparativo'] as const)[
              Math.floor(seeded(`${p.id}|sent|${model}`, driftSeed) * 3)
            ]
          : null,
        competitors,
        sources,
      });
    }
  }

  const visibilityPct = cells ? Math.round((mentionedCells / cells) * 1000) / 10 : 0;
  const top3Pct = cells ? Math.round((top3Cells / cells) * 1000) / 10 : 0;
  const ownSourcesPct = mentionedCells
    ? Math.min(100, Math.round((ownSourceCells / mentionedCells) * 1000) / 10)
    : 0;

  const competitorShare = Array.from(compCount.entries())
    .map(([name, n]) => ({ name, pct: Math.round((n / cells) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct);
  // La marca auditada entra al ranking con su visibilidad.
  competitorShare.unshift({ name: project.brand, pct: visibilityPct });
  competitorShare.sort((a, b) => b.pct - a.pct);

  const sourceShare = Array.from(srcCount.entries())
    .map(([domain, n]) => ({
      domain,
      pct: Math.round((n / cells) * 1000) / 10,
      own: project.ownDomains.includes(domain),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  return {
    id: runId,
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    version: project.version,
    promptsCount: project.prompts.length,
    models: [...MODELS],
    score: computeScore(visibilityPct, top3Pct, ownSourcesPct),
    visibilityPct,
    top3Pct,
    ownSourcesPct,
    results,
    competitorShare,
    sourceShare,
  };
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

function p(id: string, text: string, category: Category, tags: string[] = []): PromptItem {
  return { id, text, category, tags };
}

function seedProjects(): Project[] {
  const empliadosPrompts: PromptItem[] = [
    p('e1', 'cuál es el software más fácil para liquidar sueldos pyme en argentina', 'Visibilidad', ['pyme', 'liquidación']),
    p('e2', 'alternativas modernas a bejerman para sueldos', 'Visibilidad', ['migración']),
    p('e3', 'cómo automatizar recibos de sueldo digitales f931', 'Visibilidad', ['compliance', 'afip']),
    p('e4', 'qué es empliados y para quién sirve', 'Reconocimiento', ['marca']),
    p('e5', 'empliados vs bejerman: cuál conviene a una pyme', 'Sentimiento', ['comparativa']),
    p('e6', 'opiniones sobre software de nómina para pymes en argentina', 'Sentimiento', ['percepción']),
  ];
  const empliados: Project = {
    id: 'empliados-ar',
    client: 'Empliados',
    name: 'Argentina · Nómina PyME',
    brand: 'Empliados',
    market: 'Argentina / LatAm',
    competitors: ['Bejerman', 'Nubox'],
    competitorPool: ['Bejerman', 'Nubox', 'Rex+', 'Zetech', 'Workana Payroll', 'Factorial'],
    sourcePool: ['bejerman.com.ar', 'nubox.com', 'rexmas.com', 'iprofesional.com', 'cronista.com'],
    ownDomains: ['empliados.net'],
    prompts: empliadosPrompts,
    suggestions: [
      p('s1', 'mejor software sueldos argentina cct', 'Visibilidad', ['cct']),
      p('s2', 'software de nómina con integración libro de sueldos digital afip', 'Visibilidad', ['afip', 'lsd']),
      p('s3', 'qué tan confiable es empliados para liquidar sueldos', 'Sentimiento', ['confianza']),
    ],
    version: 'EMPLIADOS_v1',
    history: [],
  };
  empliados.history = [
    simulateRun(empliados, 47, 2),
    simulateRun(empliados, 48, 5),
  ];

  const pagoPrompts: PromptItem[] = [
    p('f1', 'mejor plataforma de pagos para pymes en méxico', 'Visibilidad', ['pagos', 'pyme']),
    p('f2', 'qué es pagosimple y qué ofrece', 'Reconocimiento', ['marca']),
    p('f3', 'pagosimple vs clip: cuál conviene más', 'Sentimiento', ['comparativa']),
  ];
  const pago: Project = {
    id: 'pagosimple-mx',
    client: 'PagoSimple',
    name: 'México · Pagos PyME',
    brand: 'PagoSimple',
    market: 'México',
    competitors: ['Clip'],
    competitorPool: ['Clip', 'Mercado Pago', 'Stripe', 'Conekta'],
    sourcePool: ['clip.mx', 'mercadopago.com.mx', 'stripe.com', 'eleconomista.com.mx'],
    ownDomains: ['pagosimple.mx'],
    prompts: pagoPrompts,
    suggestions: [p('s9', 'cómo cobrar con tarjeta sin terminal cara méxico', 'Visibilidad', ['cobro'])],
    version: 'PAGOSIMPLE_v1',
    history: [],
  };
  pago.history = [simulateRun(pago, 12, 3)];

  return [empliados, pago];
}

const LS_KEY = 'cleexs-agency-v1';

/* ------------------------------------------------------------------ */
/* Estilos inline (tema oscuro tipo Stitch)                            */
/* ------------------------------------------------------------------ */

const panel: React.CSSProperties = {
  background: 'rgba(17,24,39,.65)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 14,
  padding: 16,
};
const btnPrimary: React.CSSProperties = {
  background: '#00f2fe',
  color: '#070a11',
  fontWeight: 600,
  borderRadius: 8,
  padding: '8px 14px',
};
const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,.03)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '7px 12px',
};
function pill(color: string): React.CSSProperties {
  return {
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
    borderRadius: 999,
    fontSize: 11,
    padding: '2px 8px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}
const labelMono: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: 11,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
};

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function AgencyPage() {
  const [projects, setProjects] = useState<Project[]>(() => seedProjects());
  const [projectId, setProjectId] = useState('empliados-ar');
  const [tab, setTab] = useState<Tab>('resumen');
  const [flash, setFlash] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [modelFilter, setModelFilter] = useState<string>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('Visibilidad');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Project[];
        if (Array.isArray(parsed) && parsed.length) setProjects(parsed);
      }
    } catch {
      // seed por defecto
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(projects));
    } catch {
      // sin persistencia
    }
  }, [projects]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(t);
  }, [flash]);

  const project = projects.find((x) => x.id === projectId) ?? projects[0]!;
  const latest = project.history[project.history.length - 1] ?? null;
  const previous = project.history.length > 1 ? project.history[project.history.length - 2]! : null;

  const promptById = useMemo(() => new Map(project.prompts.map((x) => [x.id, x])), [project]);

  const filteredResults = useMemo(() => {
    if (!latest) return [];
    return latest.results.filter((r) => {
      if (modelFilter !== 'Todos' && r.model !== modelFilter) return false;
      if (categoryFilter !== 'Todas') {
        const pr = promptById.get(r.promptId);
        if (!pr || pr.category !== categoryFilter) return false;
      }
      return true;
    });
  }, [latest, modelFilter, categoryFilter, promptById]);

  function updateProject(mut: (pr: Project) => Project) {
    setProjects((list) => list.map((x) => (x.id === project.id ? mut(structuredClone(x)) : x)));
  }

  function freezeVersion() {
    updateProject((pr) => {
      const n = (parseInt(pr.version.replace(/\D/g, ''), 10) || 1) + 1;
      const base = pr.version.replace(/_v\d+$/i, '');
      pr.version = `${base}_v${n}`;
      return pr;
    });
    setFlash(`Nueva versión congelada: los próximos resultados quedan identificados con esa versión.`);
  }

  function executeRun() {
    if (running || project.prompts.length === 0) return;
    setRunning(true);
    setFlash('Ejecutando consultas en los modelos habilitados…');
    window.setTimeout(() => {
      updateProject((pr) => {
        const nextId = (pr.history[pr.history.length - 1]?.id ?? 0) + 1;
        const drift = nextId * 3 + 1;
        pr.history = [...pr.history, simulateRun(pr, nextId, drift)];
        return pr;
      });
      setRunning(false);
      setFlash('Corrida completada. Resultados guardados en el historial con su versión de prompts.');
      setTab('resumen');
    }, 1200);
  }

  function addPrompt() {
    const text = newPrompt.trim();
    if (!text) return;
    updateProject((pr) => {
      pr.prompts = [
        { id: `p-${Date.now()}`, text, category: newCategory, tags: [] },
        ...pr.prompts,
      ];
      return pr;
    });
    setNewPrompt('');
    setFlash('Prompt agregado al set (queda en borrador hasta congelar versión).');
  }

  const deltaScore = latest && previous ? Math.round((latest.score - previous.score) * 10) / 10 : null;

  const clients = useMemo(() => Array.from(new Set(projects.map((x) => x.client))), [projects]);

  return (
    <main style={{ minHeight: '100vh', padding: '16px 20px 40px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Cleexs · Agencias</div>
            <div style={{ ...labelMono }}>Visibilidad en respuestas de IA</div>
          </div>
          <span style={pill('#00f2fe')}>Workspace Agencia Demo</span>
          <span style={pill('#8b5cf6')}>{project.version}</span>
        </div>
        <button type="button" style={btnPrimary} disabled={running} onClick={executeRun}>
          {running ? 'Ejecutando…' : '▶ Ejecutar consultas'}
        </button>
      </header>

      {flash ? (
        <div
          role="status"
          style={{
            background: 'rgba(0,242,254,.12)',
            border: '1px solid rgba(0,242,254,.35)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 14,
          }}
        >
          {flash}
        </div>
      ) : null}

      {/* Selectores cliente / proyecto */}
      <div style={{ ...panel, display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ flex: '1 1 200px' }}>
          <span style={labelMono}>Cliente</span>
          <select
            value={project.client}
            onChange={(e) => {
              const first = projects.find((x) => x.client === e.target.value);
              if (first) setProjectId(first.id);
            }}
          >
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: '2 1 260px' }}>
          <span style={labelMono}>Proyecto</span>
          <select value={project.id} onChange={(e) => setProjectId(e.target.value)}>
            {projects
              .filter((x) => x.client === project.client)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <div style={{ flex: '2 1 260px' }}>
          <span style={labelMono}>Contexto</span>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>
            Marca auditada: <b style={{ color: '#dfe2f1' }}>{project.brand}</b> · Mercado: {project.market} ·{' '}
            {project.prompts.length} prompts · {MODELS.join(' · ')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {(
          [
            ['resumen', 'Resumen del proyecto'],
            ['prompts', 'Prompts'],
            ['competidores', 'Competidores'],
            ['fuentes', 'Fuentes'],
            ['historial', 'Historial'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              ...(tab === id ? btnPrimary : btnGhost),
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'resumen' && latest && (
        <section style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div style={panel}>
              <div style={labelMono}>Visibilidad (Score explicable)</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>
                {latest.score}
                <span style={{ fontSize: 15, color: '#9ca3af' }}> / 100</span>
              </div>
              {deltaScore !== null && (
                <span style={pill(deltaScore >= 0 ? '#10b981' : '#fb7185')}>
                  {deltaScore >= 0 ? '+' : ''}
                  {deltaScore} vs corrida anterior
                </span>
              )}
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                Fórmula v1: 50% aparición + 30% Top 3 + 20% fuentes propias.
              </p>
              <svg viewBox="0 0 120 30" style={{ width: '100%', height: 30, marginTop: 6 }} aria-hidden>
                <polyline
                  fill="none"
                  stroke="#00f2fe"
                  strokeWidth="1.8"
                  points={project.history
                    .map((h, i) => {
                      const x = (i / Math.max(project.history.length - 1, 1)) * 120;
                      const y = 27 - (h.score / 100) * 24;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              </svg>
            </div>
            <div style={panel}>
              <div style={labelMono}>Aparición de marca</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{latest.visibilityPct}%</div>
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                Sobre {latest.results.length} respuestas ({latest.promptsCount} prompts × {latest.models.length}{' '}
                modelos).
              </p>
            </div>
            <div style={panel}>
              <div style={labelMono}>Top 3</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6, color: '#00f2fe' }}>{latest.top3Pct}%</div>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Mencionada entre las primeras 3 opciones.</p>
            </div>
            <div style={panel}>
              <div style={labelMono}>Presencia en fuentes</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{latest.ownSourcesPct}%</div>
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                Respuestas con mención que citan dominios propios ({project.ownDomains.join(', ')}).
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div style={panel}>
              <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Comparación de competidores</h3>
              {latest.competitorShare.map((c) => (
                <div key={c.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>
                      {c.name}
                      {c.name === project.brand ? ' · marca auditada' : ''}
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{c.pct}%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, c.pct)}%`,
                        height: '100%',
                        background: c.name === project.brand ? '#00f2fe' : '#8b5cf6',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={panel}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <label style={{ flex: '1 1 140px' }}>
                  <span style={labelMono}>Modelo</span>
                  <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
                    <option>Todos</option>
                    {MODELS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: '1 1 140px' }}>
                  <span style={labelMono}>Categoría</span>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option>Todas</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Detalle por prompt ({filteredResults.length})</h3>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: '#9ca3af' }}>
                      <th>Prompt</th>
                      <th>Modelo</th>
                      <th>Mención</th>
                      <th>Sentimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.slice(0, 14).map((r, i) => (
                      <tr key={`${r.promptId}-${r.model}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                        <td style={{ maxWidth: 320 }}>{promptById.get(r.promptId)?.text ?? r.promptId}</td>
                        <td>
                          <span style={pill('#8b5cf6')}>{r.model}</span>
                        </td>
                        <td>
                          {r.mentioned ? (
                            <span style={pill(r.position !== null && r.position <= 3 ? '#10b981' : '#00f2fe')}>
                              {r.position ? `Top ${r.position}` : 'Mencionada'}
                            </span>
                          ) : (
                            <span style={pill('#fb7185')}>No citada</span>
                          )}
                        </td>
                        <td style={{ color: '#9ca3af' }}>{r.sentiment ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'prompts' && (
        <section style={{ ...panel }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Set de prompts · <span style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{project.version}</span>
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btnGhost} onClick={freezeVersion}>
                Congelar nueva versión
              </button>
              <button type="button" style={btnPrimary} disabled={running} onClick={executeRun}>
                Ejecutar consultas
              </button>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            La agencia define qué monitorear. Las sugerencias de Cleexs son opcionales: se revisan antes de entrar al
            set. Al congelar versión, las corridas siguientes quedan identificadas y el historial es comparable.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            <input
              style={{ flex: '3 1 280px', width: 'auto' }}
              placeholder="Nuevo prompt controlado por la agencia…"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPrompt()}
            />
            <select style={{ flex: '1 1 160px', width: 'auto' }} value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="button" style={btnPrimary} onClick={addPrompt}>
              Agregar
            </button>
          </div>

          {CATEGORIES.map((cat) => {
            const rows = project.prompts.filter((x) => x.category === cat);
            if (!rows.length) return null;
            return (
              <div key={cat} style={{ marginTop: 14 }}>
                <div style={labelMono}>{cat}</div>
                {rows.map((pr) => (
                  <div
                    key={pr.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,.05)',
                      fontSize: 14,
                    }}
                  >
                    <span>{pr.text}</span>
                    <button
                      type="button"
                      style={{ color: '#fb7185', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={() =>
                        updateProject((x) => {
                          x.prompts = x.prompts.filter((y) => y.id !== pr.id);
                          return x;
                        })
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            );
          })}

          {project.suggestions.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={labelMono}>Sugerencias Cleexs (opcionales)</div>
              {project.suggestions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                    fontSize: 14,
                    color: '#cbd5e1',
                  }}
                >
                  <span>
                    {s.text} <span style={pill('#fbbf24')}>{s.category}</span>
                  </span>
                  <button
                    type="button"
                    style={{ color: '#00f2fe', fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={() =>
                      updateProject((x) => {
                        x.prompts = [s, ...x.prompts];
                        x.suggestions = x.suggestions.filter((y) => y.id !== s.id);
                        return x;
                      })
                    }
                  >
                    Agregar al set
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'competidores' && latest && (
        <section style={{ ...panel }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Análisis de competidores</h3>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 0 }}>
            Selección manual en esta versión. Los detectados en respuestas se sugieren para que la agencia decida
            cuáles seguir.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input
              style={{ flex: '1 1 220px', width: 'auto' }}
              placeholder="Agregar competidor a seguir…"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const v = newCompetitor.trim();
                if (!v) return;
                updateProject((x) => {
                  if (!x.competitors.includes(v)) x.competitors = [...x.competitors, v];
                  if (!x.competitorPool.includes(v)) x.competitorPool = [...x.competitorPool, v];
                  return x;
                });
                setNewCompetitor('');
              }}
            />
            <button
              type="button"
              style={btnPrimary}
              onClick={() => {
                const v = newCompetitor.trim();
                if (!v) return;
                updateProject((x) => {
                  if (!x.competitors.includes(v)) x.competitors = [...x.competitors, v];
                  if (!x.competitorPool.includes(v)) x.competitorPool = [...x.competitorPool, v];
                  return x;
                });
                setNewCompetitor('');
              }}
            >
              Seguir
            </button>
          </div>

          <h4 style={{ margin: '10px 0 6px', fontSize: 14 }}>Seguidos</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {project.competitors.map((c) => {
              const share = latest.competitorShare.find((x) => x.name === c);
              return (
                <span key={c} style={pill('#8b5cf6')}>
                  {c}
                  {share ? ` · ${share.pct}%` : ''}
                </span>
              );
            })}
          </div>

          <h4 style={{ margin: '16px 0 6px', fontSize: 14 }}>Detectados en respuestas</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {latest.competitorShare
              .filter((c) => c.name !== project.brand && !project.competitors.includes(c.name))
              .map((c) => (
                <button
                  key={c.name}
                  type="button"
                  style={pill('#fbbf24')}
                  onClick={() =>
                    updateProject((x) => {
                      x.competitors = [...x.competitors, c.name];
                      return x;
                    })
                  }
                >
                  + {c.name} · {c.pct}%
                </button>
              ))}
            {latest.competitorShare.filter((c) => c.name !== project.brand && !project.competitors.includes(c.name))
              .length === 0 && <span style={{ fontSize: 13, color: '#6b7280' }}>Sin nuevos detectados.</span>}
          </div>
        </section>
      )}

      {tab === 'fuentes' && latest && (
        <section style={{ ...panel }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Análisis de fuentes</h3>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 0 }}>
            Dominios citados en las respuestas. No son competidores: son las fuentes que la IA usa para responder.
            Perplexity suele citar más que el resto de los modelos.
          </p>
          {latest.sourceShare.map((s) => (
            <div key={s.domain} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>
                  {s.domain} {s.own ? <span style={pill('#10b981')}>Propia</span> : <span style={pill('#9ca3af')}>Externa</span>}
                </span>
                <span style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{s.pct}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, s.pct)}%`,
                    height: '100%',
                    background: s.own ? '#10b981' : '#8b5cf6',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'historial' && (
        <section style={{ ...panel }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Seguimiento histórico</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: '#9ca3af' }}>
                  <th>Corrida</th>
                  <th>Fecha</th>
                  <th>Versión de prompts</th>
                  <th>Prompts</th>
                  <th>Score</th>
                  <th>Aparición</th>
                  <th>Top 3</th>
                  <th>Comparar</th>
                </tr>
              </thead>
              <tbody>
                {[...project.history].reverse().map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                    <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{runLabel(h.id)}</td>
                    <td>{h.at}</td>
                    <td>
                      <span style={pill('#8b5cf6')}>{h.version}</span>
                    </td>
                    <td>{h.promptsCount}</td>
                    <td>{h.score}</td>
                    <td>{h.visibilityPct}%</td>
                    <td>{h.top3Pct}%</td>
                    <td>
                      <button
                        type="button"
                        style={{ color: compareA === h.id || compareB === h.id ? '#00f2fe' : '#9ca3af', fontSize: 12 }}
                        onClick={() => {
                          if (compareA === null) setCompareA(h.id);
                          else if (compareB === null && h.id !== compareA) setCompareB(h.id);
                          else {
                            setCompareA(h.id);
                            setCompareB(null);
                          }
                        }}
                      >
                        {compareA === h.id ? 'A' : compareB === h.id ? 'B' : 'Elegir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {compareA !== null && compareB !== null && (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              {(() => {
                const a = project.history.find((h) => h.id === compareA);
                const b = project.history.find((h) => h.id === compareB);
                if (!a || !b) return null;
                const d = (x: number, y: number) => {
                  const v = Math.round((x - y) * 10) / 10;
                  return `${v >= 0 ? '+' : ''}${v}`;
                };
                return (
                  <p style={{ color: '#cbd5e1' }}>
                    {runLabel(b.id)} vs {runLabel(a.id)} — Score: <b>{d(b.score, a.score)}</b> · Aparición:{' '}
                    <b>{d(b.visibilityPct, a.visibilityPct)} pp</b> · Top 3: <b>{d(b.top3Pct, a.top3Pct)} pp</b>
                    {a.version !== b.version && (
                      <>
                        {' '}
                        · <span style={pill('#fbbf24')}>Ojo: cambió la versión de prompts ({a.version} → {b.version})</span>
                      </>
                    )}
                  </p>
                );
              })()}
            </div>
          )}
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            Cada corrida conserva prompts y versión utilizados. Si cambia la configuración, la comparación lo señala
            para no atribuir la variación solo al mercado.
          </p>
        </section>
      )}

      <footer style={{ marginTop: 22, fontSize: 12, color: '#6b7280' }}>
        <p>
          Cleexs Agencias · MVP sobre <code>agente-cleexs</code> (EasyPanel). Las corridas de esta demo son simuladas
          y se guardan localmente; el siguiente paso es ejecutarlas contra los modelos reales y persistirlas en base
          de datos. Métricas con fórmula visible y versionado de prompts desde el día uno.
        </p>
      </footer>
    </main>
  );
}
