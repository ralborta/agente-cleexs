'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AgencySnapshot, PromptRow, RunSummary } from './types';
import { appearancesOf, runsInPeriod, visibilityOf } from './metrics';

/* ------------------------------------------------------------------ */
/* Config de proyecto (localStorage)                                   */
/* ------------------------------------------------------------------ */

export type Oferta = { id: string; name: string; price: string; description: string; status: 'activa' | 'beta' | 'inactiva' };
export type Buyer = { id: string; name: string; description: string; painPoints: string };
export type Tipo = { id: string; name: string; description: string };
export type Marca = { id: string; name: string; domain: string; kind: 'propia' | 'competidor'; aliases: string };
export type ProyectoCfg = {
  name: string;
  domain: string;
  country: string;
  industry: string;
  description: string;
  frequency: 'Diaria' | 'Semanal' | 'Quincenal' | 'Mensual';
};
export type PromptTag = { buyerId?: string; ofertaId?: string };
/** Prompts propios del proyecto (máx. 3). Persistidos en Cleexs (slots portal). */
export type CustomPrompt = {
  id: string;
  /** UUID Cleexs BrandPortalSavedPrompt (si ya está sincronizado) */
  cleexsId?: string | null;
  /** Slot Cleexs 0..2 */
  slot?: number;
  text: string;
  name: string;
  tipoId: string;
  buyerId: string;
  ofertaId: string;
  country: string;
  active: boolean;
  updatedAt: string;
  lastExecutedAt?: string | null;
  resultsCount?: number;
};
export const CUSTOM_PROMPTS_MAX = 3;

/** Programación de corridas (hora + día / fecha). Frecuencia se sincroniza a Cleexs. */
export type RunScheduleCfg = {
  enabled: boolean;
  /** Diaria | Semanal | Quincenal | Mensual | Una vez (fecha) */
  cadence: 'Diaria' | 'Semanal' | 'Quincenal' | 'Mensual' | 'Una vez';
  /** 0=domingo … 6=sábado (para Semanal) */
  weekdays: number[];
  /** Día del mes 1–28 (para Mensual) */
  dayOfMonth: number;
  /** HH:mm 24h */
  time: string;
  /** YYYY-MM-DD (para Una vez, y opcional inicio) */
  date: string;
  timezone: string;
  notes: string;
};

export type Regla = {
  id: string;
  name: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  metric: 'Visibilidad' | 'Share of voice' | 'Posición media';
  condition: 'cae por debajo de' | 'sube por encima de';
  threshold: string;
  channel: string;
  description: string;
};

export type ProjectConfig = {
  ofertas: Oferta[];
  buyers: Buyer[];
  tipos: Tipo[];
  marcas: Marca[];
  proyecto: ProyectoCfg;
  promptTags: Record<string, PromptTag>;
  customPrompts: CustomPrompt[];
  schedule: RunScheduleCfg;
  reglas: Regla[];
};

export type LocalProject = {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  countries: string[];
  ias: string[];
  prompts: string[];
  competitors: string[];
  status: 'borrador' | 'creado';
};

export const DEFAULT_PROJECT_ID = 'cleexs-default';

export const SEED_TIPOS: Tipo[] = [
  { id: 'tipo-informativa', name: 'Informativa', description: 'Consultas para entender un tema, normativa o producto.' },
  { id: 'tipo-recomendacion', name: 'Recomendación', description: 'El usuario pide que la IA recomiende una solución.' },
  { id: 'tipo-percepcion', name: 'Percepción', description: 'Opiniones, reputación y confianza en la marca.' },
  { id: 'tipo-comparativa', name: 'Comparativa', description: 'Comparación directa contra competidores.' },
];

export const DEFAULT_SCHEDULE: RunScheduleCfg = {
  enabled: false,
  cadence: 'Semanal',
  weekdays: [1], // lunes
  dayOfMonth: 1,
  time: '09:00',
  date: '',
  timezone: 'America/Argentina/Buenos_Aires',
  notes: '',
};

export function emptyConfig(name = '', domain = ''): ProjectConfig {
  return {
    ofertas: [],
    buyers: [],
    tipos: SEED_TIPOS,
    marcas: [],
    proyecto: { name, domain, country: '', industry: '', description: '', frequency: 'Semanal' },
    promptTags: {},
    customPrompts: [],
    schedule: { ...DEFAULT_SCHEDULE },
    reglas: [],
  };
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

export type Filters = {
  ia: string[]; // vacío = todas
  buyer: string; // '' = todos
  oferta: string;
  tipo: string;
  pais: string;
  periodo: number | null; // días; null = todo
};
export const DEFAULT_FILTERS: Filters = { ia: [], buyer: '', oferta: '', tipo: '', pais: '', periodo: null };

export const PERIODOS: { label: string; days: number | null }[] = [
  { label: 'Todo el historial', days: null },
  { label: 'Últimos 30 días', days: 30 },
  { label: 'Últimos 90 días', days: 90 },
  { label: 'Últimos 12 meses', days: 365 },
];

const stem = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .slice(0, 7);

/* ------------------------------------------------------------------ */
/* Contexto                                                            */
/* ------------------------------------------------------------------ */

type Persisted = {
  activeProjectId: string;
  projects: LocalProject[];
  configs: Record<string, ProjectConfig>;
};

const LS_KEY = 'cleexs-agency:v1';
const LS_THEME = 'cleexs-agency:theme';

type Theme = 'dark' | 'light';

type SnapshotState = {
  data: AgencySnapshot | null;
  loading: boolean;
  error: string | null;
};

type Ctx = {
  hydrated: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  projects: LocalProject[];
  activeProjectId: string;
  isDefaultProject: boolean;
  setActiveProject: (id: string) => void;
  addProject: (p: Omit<LocalProject, 'id' | 'createdAt'>, cfg?: Partial<ProjectConfig>) => string;
  removeProject: (id: string) => void;
  projectName: string;
  projectDomain: string;
  config: ProjectConfig;
  updateConfig: (patch: Partial<ProjectConfig>) => void;
  snapshot: SnapshotState;
  reload: () => void;
  /** Datos filtrados (null si el proyecto activo no está conectado a Cleexs) */
  data: FilteredData | null;
};

export type FilteredData = {
  snapshot: AgencySnapshot;
  runs: RunSummary[]; // cronológico, con prompts filtrados
  latest: RunSummary | null;
  prompts: PromptRow[];
};

const StoreCtx = createContext<Ctx | null>(null);

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore fuera de StoreProvider');
  return c;
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [theme, setThemeState] = useState<Theme>('dark');
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [persisted, setPersisted] = useState<Persisted>({
    activeProjectId: DEFAULT_PROJECT_ID,
    projects: [],
    configs: {},
  });
  const [snapshot, setSnapshot] = useState<SnapshotState>({ data: null, loading: true, error: null });
  const loadSeq = useRef(0);

  // Hidratar localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        setPersisted({
          activeProjectId: p.activeProjectId || DEFAULT_PROJECT_ID,
          projects: p.projects ?? [],
          configs: p.configs ?? {},
        });
      }
      const t = localStorage.getItem(LS_THEME);
      if (t === 'light' || t === 'dark') setThemeState(t);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persistir
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(persisted));
    } catch {
      /* ignore */
    }
  }, [persisted, hydrated]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(LS_THEME, t);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Snapshot Cleexs
  const reload = useCallback(() => {
    const seq = ++loadSeq.current;
    setSnapshot((s) => ({ ...s, loading: true, error: null }));
    fetch('/api/cleexs/snapshot', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.detail || j?.error || `HTTP ${r.status}`);
        return j as AgencySnapshot;
      })
      .then((data) => seq === loadSeq.current && setSnapshot({ data, loading: false, error: null }))
      .catch((e: Error) => seq === loadSeq.current && setSnapshot({ data: null, loading: false, error: e.message }));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const setFilters = useCallback((patch: Partial<Filters>) => setFiltersState((f) => ({ ...f, ...patch })), []);
  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const { activeProjectId, projects, configs } = persisted;
  const isDefaultProject = activeProjectId === DEFAULT_PROJECT_ID;
  const activeLocal = projects.find((p) => p.id === activeProjectId);

  const projectName = isDefaultProject ? snapshot.data?.brand.name ?? 'Cleexs' : activeLocal?.name ?? 'Proyecto';
  const projectDomain = isDefaultProject ? snapshot.data?.brand.domain ?? 'cleexs.net' : activeLocal?.domain ?? '';

  const config = useMemo<ProjectConfig>(() => {
    const c = configs[activeProjectId];
    const base = emptyConfig(projectName, projectDomain);
    if (!c) return base;
    return {
      ...base,
      ...c,
      customPrompts: Array.isArray(c.customPrompts) ? c.customPrompts.slice(0, CUSTOM_PROMPTS_MAX) : [],
      schedule: { ...DEFAULT_SCHEDULE, ...(c.schedule ?? {}) },
      tipos: c.tipos?.length ? c.tipos : base.tipos,
    };
  }, [configs, activeProjectId, projectName, projectDomain]);

  const updateConfig = useCallback(
    (patch: Partial<ProjectConfig>) =>
      setPersisted((p) => {
        const base = { ...emptyConfig(), ...(p.configs[p.activeProjectId] ?? {}) };
        const next: ProjectConfig = { ...base, ...patch };
        if (patch.customPrompts) {
          next.customPrompts = patch.customPrompts.slice(0, CUSTOM_PROMPTS_MAX);
        }
        return { ...p, configs: { ...p.configs, [p.activeProjectId]: next } };
      }),
    [],
  );

  const setActiveProject = useCallback((id: string) => {
    setPersisted((p) => ({ ...p, activeProjectId: id }));
    setFiltersState(DEFAULT_FILTERS);
  }, []);
  const addProject = useCallback((proj: Omit<LocalProject, 'id' | 'createdAt'>, cfg?: Partial<ProjectConfig>) => {
    const id = uid('proj');
    setPersisted((p) => ({
      ...p,
      projects: [...p.projects, { ...proj, id, createdAt: new Date().toISOString() }],
      configs: { ...p.configs, [id]: { ...emptyConfig(proj.name, proj.domain), ...cfg } },
    }));
    return id;
  }, []);
  const removeProject = useCallback((id: string) => {
    setPersisted((p) => {
      const { [id]: _drop, ...rest } = p.configs;
      void _drop;
      return {
        ...p,
        projects: p.projects.filter((x) => x.id !== id),
        configs: rest,
        activeProjectId: p.activeProjectId === id ? DEFAULT_PROJECT_ID : p.activeProjectId,
      };
    });
  }, []);

  // Datos filtrados
  const data = useMemo<FilteredData | null>(() => {
    const snap = snapshot.data;
    if (!snap || !isDefaultProject) return null;
    const tags = config.promptTags;
    const iaSet = new Set(filters.ia);

    const keepPrompt = (p: PromptRow) => {
      if (filters.tipo && p.type && stem(p.type) !== stem(filters.tipo)) return false;
      if (filters.tipo && !p.type) return false;
      if (filters.buyer && tags[p.promptId]?.buyerId !== filters.buyer) return false;
      if (filters.oferta && tags[p.promptId]?.ofertaId !== filters.oferta) return false;
      return true;
    };

    let runs = runsInPeriod(snap.history, filters.periodo);
    if (filters.pais) runs = runs.filter((r) => (r.country ?? snap.brand.country) === filters.pais);
    if (iaSet.size) {
      const labelOf = (m: string | null) => snap.llms.find((l) => l.model === m)?.label ?? m ?? '';
      runs = runs.filter((r) => iaSet.has(labelOf(r.model)));
    }
    const filteredRuns: RunSummary[] = runs.map((r, i) => {
      const prompts = r.prompts.filter(keepPrompt);
      // Mantener el excerpt solo si existe
      void i;
      return {
        ...r,
        prompts,
        promptsAnalyzed: prompts.length,
        brandInTop3: prompts.filter((p) => p.brandInTop3).length,
        visibilityPct: visibilityOf(prompts),
        appearances: appearancesOf(prompts),
      };
    });
    const latest = filteredRuns[filteredRuns.length - 1] ?? null;
    return { snapshot: snap, runs: filteredRuns, latest, prompts: latest?.prompts ?? [] };
  }, [snapshot.data, isDefaultProject, filters, config.promptTags]);

  const value: Ctx = {
    hydrated,
    theme,
    setTheme,
    filters,
    setFilters,
    resetFilters,
    projects,
    activeProjectId,
    isDefaultProject,
    setActiveProject,
    addProject,
    removeProject,
    projectName,
    projectDomain,
    config,
    updateConfig,
    snapshot,
    reload,
    data,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
