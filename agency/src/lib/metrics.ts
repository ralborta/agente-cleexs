import type { BrandInfo, CompetitorMention, PromptRow, RunSummary } from './types';

/** "Signatura (signatura.com.ar)" -> "signatura" */
export function keyOf(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

export function displayName(name: string): string {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').trim() || name;
}

export function domainFromName(name: string): string | null {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}

export function pct(n: number, d: number): number | null {
  return d > 0 ? (n / d) * 100 : null;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function visibilityOf(prompts: PromptRow[]): number | null {
  return pct(prompts.filter((p) => p.brandInTop3).length, prompts.length);
}

export function appearancesOf(prompts: PromptRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of prompts) {
    for (const e of p.top3) {
      const k = keyOf(e.name);
      out[k] = (out[k] ?? 0) + 1;
    }
  }
  return out;
}

export type Mentions = {
  brand: { appearances: number; avgPosition: number | null };
  others: CompetitorMention[];
};

/** Menciones top3 para la marca y el resto (competidores directos + emergentes). Nunca inventa datos. */
export function computeMentions(prompts: PromptRow[], brand: BrandInfo): Mentions {
  const compByKey = new Map(brand.competitors.map((c) => [keyOf(c.name), c]));
  const acc = new Map<string, { name: string; appearances: number; posSum: number }>();
  let brandApp = 0;
  let brandPos = 0;

  for (const p of prompts) {
    for (const e of p.top3) {
      if (e.type === 'brand') {
        brandApp += 1;
        brandPos += e.position;
        continue;
      }
      const k = keyOf(e.name);
      const row = acc.get(k) ?? { name: e.name, appearances: 0, posSum: 0 };
      row.appearances += 1;
      row.posSum += e.position;
      acc.set(k, row);
    }
  }

  const others: CompetitorMention[] = [];
  for (const [k, row] of acc) {
    const comp = compByKey.get(k);
    others.push({
      key: k,
      name: comp ? comp.displayName : displayName(row.name),
      domain: comp?.domain ?? domainFromName(row.name),
      kind: comp ? 'directo' : 'emergente',
      appearances: row.appearances,
      avgPosition: row.appearances ? Number((row.posSum / row.appearances).toFixed(2)) : null,
    });
  }
  // Competidores registrados sin apariciones
  for (const [k, comp] of compByKey) {
    if (!acc.has(k)) {
      others.push({
        key: k,
        name: comp.displayName,
        domain: comp.domain,
        kind: 'directo',
        appearances: 0,
        avgPosition: null,
      });
    }
  }
  others.sort((a, b) => b.appearances - a.appearances);

  return {
    brand: {
      appearances: brandApp,
      avgPosition: brandApp ? Number((brandPos / brandApp).toFixed(2)) : null,
    },
    others,
  };
}

/** Share of voice: apariciones de cada entidad sobre el total de apariciones entre marca + seleccionadas */
export function computeSoV(
  mentions: Mentions,
  selectedKeys: string[] | null,
): { key: string; name: string; isBrand: boolean; appearances: number; sov: number | null }[] {
  const sel = selectedKeys ? new Set(selectedKeys) : null;
  const pool = mentions.others.filter((o) => (sel ? sel.has(o.key) : true));
  const total = mentions.brand.appearances + pool.reduce((s, o) => s + o.appearances, 0);
  return [
    { key: '__brand__', name: 'Marca', isBrand: true, appearances: mentions.brand.appearances, sov: pct(mentions.brand.appearances, total) },
    ...pool.map((o) => ({
      key: o.key,
      name: o.name,
      isBrand: false,
      appearances: o.appearances,
      sov: pct(o.appearances, total),
    })),
  ];
}

export function runsInPeriod(runs: RunSummary[], days: number | null): RunSummary[] {
  if (!days) return runs;
  const since = Date.now() - days * 86400000;
  return runs.filter((r) => new Date(r.createdAt).getTime() >= since);
}

export function fmtDate(iso: string, withYear = false): string {
  const d = new Date(iso);
  const base = `${d.getDate()}/${d.getMonth() + 1}`;
  return withYear ? `${base}/${String(d.getFullYear()).slice(2)}` : base;
}
