const nodes = [
  { id: 'pillar', label: 'Guía AEO', x: 50, y: 48, status: 'published' },
  { id: 'faq', label: 'FAQ visibilidad IA', x: 22, y: 28, status: 'approval' },
  { id: 'cmp', label: 'Comparativa', x: 78, y: 30, status: 'working' },
  { id: 'chk', label: 'Checklist', x: 24, y: 72, status: 'published' },
  { id: 'gls', label: 'Glosario', x: 76, y: 70, status: 'refresh' },
];

const statusColor: Record<string, string> = {
  published: '#22C55E',
  approval: '#F97316',
  working: '#2563EB',
  refresh: '#94A3B8',
};

export function ContentEcosystemPanel() {
  return (
    <section className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
            Ecosistema de contenido
          </p>
          <h3 className="text-lg font-semibold text-white">Visibilidad AEO</h3>
        </div>
        <div className="flex gap-3 text-xs text-hub-muted">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cleexs-blue" /> En producción</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cleexs-orange" /> Aprobación</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-400" /> Publicado</span>
        </div>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-hub-border bg-[#111b2e]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <line x1="50" y1="48" x2="22" y2="28" stroke="#334155" strokeWidth="0.4" />
          <line x1="50" y1="48" x2="78" y2="30" stroke="#334155" strokeWidth="0.4" />
          <line x1="50" y1="48" x2="24" y2="72" stroke="#334155" strokeWidth="0.4" />
          <line x1="50" y1="48" x2="76" y2="70" stroke="#334155" strokeWidth="0.4" />
          {nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.id === 'pillar' ? 5.5 : 4}
                fill={statusColor[node.status]}
                opacity={0.95}
              />
              <text
                x={node.x}
                y={node.y + (node.id === 'pillar' ? 10 : 8)}
                textAnchor="middle"
                fontSize="3.2"
                fill="#CBD5E1"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
