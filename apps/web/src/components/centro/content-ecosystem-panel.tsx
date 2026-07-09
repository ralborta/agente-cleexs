import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Cog,
  FileText,
  HelpCircle,
  Hourglass,
  Layers,
  ListChecks,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RadarPieceData = {
  id: string;
  title: string;
  type: string;
  status: 'published' | 'approval' | 'working' | 'refresh';
  impact: 'alto' | 'medio' | 'bajo';
};

export type ContentRadarData = {
  agentName: string;
  agentActive: boolean;
  agentWorking: boolean;
  pieces: RadarPieceData[];
  stats: {
    active: number;
    published: number;
    approval: number;
    working: number;
    refresh: number;
  };
};

type PieceStatus = RadarPieceData['status'];
type ImpactLevel = RadarPieceData['impact'];

type LayoutPiece = RadarPieceData & {
  icon: LucideIcon;
  x: number;
  y: number;
};

const STATUS = {
  published: {
    label: 'Publicado',
    color: '#22C55E',
    glow: 'rgba(34, 197, 94, 0.35)',
    badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  },
  approval: {
    label: 'Aprobación',
    color: '#F97316',
    glow: 'rgba(249, 115, 22, 0.35)',
    badge: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  },
  working: {
    label: 'En producción',
    color: '#2563EB',
    glow: 'rgba(37, 99, 235, 0.35)',
    badge: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  },
  refresh: {
    label: 'A refrescar',
    color: '#94A3B8',
    glow: 'rgba(148, 163, 184, 0.25)',
    badge: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  },
} as const;

const IMPACT_LABEL: Record<ImpactLevel, string> = {
  alto: 'Impacto alto',
  medio: 'Impacto medio',
  bajo: 'Impacto bajo',
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  faq: HelpCircle,
  checklist: ListChecks,
  comparison: BarChart3,
  pillar: BookOpen,
  glossary: BookOpen,
  definition: BookOpen,
  how_to: ListChecks,
  case_study: FileText,
  landing: FileText,
  calculator: BarChart3,
  other: FileText,
};

function iconForType(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? FileText;
}

function layoutPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 50 + Math.cos(angle) * 38,
      y: 52 + Math.sin(angle) * 34,
    };
  });
}

function toLayoutPieces(pieces: RadarPieceData[]): LayoutPiece[] {
  const positions = layoutPositions(pieces.length);
  return pieces.map((piece, i) => ({
    ...piece,
    icon: iconForType(piece.type),
    x: positions[i]?.x ?? 50,
    y: positions[i]?.y ?? 20,
  }));
}

function RadarNode({ piece }: { piece: LayoutPiece }) {
  const cfg = STATUS[piece.status];
  const Icon = piece.icon;

  return (
    <div
      className="absolute z-10 w-[148px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-[#0f172a]/90 p-3 backdrop-blur-sm transition hover:scale-[1.02]"
      style={{
        left: `${piece.x}%`,
        top: `${piece.y}%`,
        borderColor: `${cfg.color}55`,
        boxShadow: `0 0 24px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{piece.title}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[11px]" style={{ color: cfg.color }}>
        <TrendingUp className="h-3 w-3" />
        {IMPACT_LABEL[piece.impact]}
      </p>
    </div>
  );
}

const EMPTY_RADAR: ContentRadarData = {
  agentName: 'Teo',
  agentActive: true,
  agentWorking: false,
  pieces: [],
  stats: { active: 0, published: 0, approval: 0, working: 0, refresh: 0 },
};

export function ContentEcosystemPanel({ data = EMPTY_RADAR }: { data?: ContentRadarData }) {
  const pieces = toLayoutPieces(data.pieces);
  const cx = 50;
  const cy = 52;

  const stats = [
    { label: 'piezas activas', value: data.stats.active, icon: Layers, color: 'text-white' },
    { label: 'publicadas', value: data.stats.published, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'en aprobación', value: data.stats.approval, icon: Hourglass, color: 'text-orange-400' },
    { label: 'en producción', value: data.stats.working, icon: Cog, color: 'text-blue-400' },
    { label: 'a refrescar', value: data.stats.refresh, icon: RefreshCw, color: 'text-slate-400' },
  ];

  const hubLabel = data.agentWorking ? 'Trabajando' : data.agentActive ? 'Agente activo' : 'Inactivo';
  const hubColor = data.agentWorking ? '#2563EB' : data.agentActive ? '#22C55E' : '#94A3B8';

  return (
    <section className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hub-border px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-hub-muted">
            Mapa operativo de Teo
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">Radar de Contenido IA</h3>
          <p className="mt-1 max-w-md text-sm text-hub-muted">
            Teo organiza, prioriza y actualiza piezas para mejorar la visibilidad AEO.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-hub-muted">
          {(Object.entries(STATUS) as [PieceStatus, (typeof STATUS)[PieceStatus]][]).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-5 mt-4 aspect-[16/10] min-h-[320px] overflow-hidden rounded-xl border border-hub-border bg-[#0a101c]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {[18, 32, 46].map((r) => (
            <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(51, 65, 85, 0.45)" strokeWidth="0.25" />
          ))}
          {pieces.map((piece) => (
            <line
              key={`line-${piece.id}`}
              x1={cx}
              y1={cy}
              x2={piece.x}
              y2={piece.y + 4}
              stroke={STATUS[piece.status].color}
              strokeWidth="0.35"
              strokeOpacity="0.55"
            />
          ))}
        </svg>

        <div
          className="absolute left-1/2 top-[52%] z-20 flex h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 bg-[#0f172a]/95 text-center backdrop-blur-sm"
          style={{
            borderColor: `${hubColor}99`,
            boxShadow: `0 0 40px ${hubColor}55, inset 0 0 20px ${hubColor}14`,
          }}
        >
          <span className="text-lg font-bold text-white">{data.agentName}</span>
          <span className="text-[11px] font-medium" style={{ color: hubColor }}>
            {hubLabel}
          </span>
          <Activity className="mt-1 h-4 w-4" style={{ color: hubColor }} strokeWidth={2.5} />
        </div>

        {pieces.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
            <p className="max-w-xs text-sm text-hub-muted">
              Sin piezas todavía. Lanzá una misión desde{' '}
              <span className="text-white">Resultados</span> para que Teo genere contenido.
            </p>
          </div>
        ) : (
          pieces.map((piece) => <RadarNode key={piece.id} piece={piece} />)
        )}
      </div>

      <div className="mx-5 mb-5 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hub-border bg-[#111827]/80 px-4 py-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${stat.color}`} strokeWidth={2} />
              <span className="text-sm font-semibold text-white">{stat.value}</span>
              <span className="text-xs text-hub-muted">{stat.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
