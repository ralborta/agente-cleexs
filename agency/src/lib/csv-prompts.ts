/**
 * Parser liviano de CSV para importar prompts propios.
 * Acepta coma o punto y coma; columnas flexibles (prompt / texto / name / slot…).
 */

export type CsvPromptRow = {
  text: string;
  name?: string;
  tipo?: string;
  buyer?: string;
  oferta?: string;
  country?: string;
  slot?: number;
};

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectSep(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function normKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const TEXT_KEYS = new Set([
  'prompt',
  'prompttext',
  'texto',
  'text',
  'consulta',
  'query',
  'pregunta',
]);
const NAME_KEYS = new Set(['name', 'nombre', 'title', 'titulo', 'label']);
const TIPO_KEYS = new Set(['tipo', 'tipoid', 'type']);
const BUYER_KEYS = new Set(['buyer', 'buyerid', 'buyerpersona', 'persona']);
const OFERTA_KEYS = new Set(['oferta', 'ofertaid', 'offer']);
const COUNTRY_KEYS = new Set(['country', 'pais', 'país']);
const SLOT_KEYS = new Set(['slot', 'orden', 'index', 'n']);

function pick(row: Record<string, string>, keys: Set<string>): string {
  for (const [k, v] of Object.entries(row)) {
    if (keys.has(k) && v.trim()) return v.trim();
  }
  return '';
}

/** Parsea CSV → filas con texto de prompt. Ignora vacíos. */
export function parsePromptsCsv(raw: string): CsvPromptRow[] {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const sep = detectSep(lines[0]);
  const firstCells = splitCsvLine(lines[0], sep).map(normKey);
  const hasHeader = firstCells.some(
    (k) => TEXT_KEYS.has(k) || NAME_KEYS.has(k) || SLOT_KEYS.has(k) || k === 'prompttext',
  );

  let headers: string[];
  let start = 0;
  if (hasHeader) {
    headers = firstCells;
    start = 1;
  } else if (firstCells.length === 1) {
    headers = ['prompt'];
  } else {
    // Sin header: columna 0 = prompt (o slot + prompt)
    const maybeSlot = /^\d+$/.test(splitCsvLine(lines[0], sep)[0] || '');
    headers = maybeSlot ? ['slot', 'prompt'] : ['prompt', ...firstCells.slice(1).map((_, i) => `col${i + 1}`)];
  }

  const rows: CsvPromptRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], sep);
    const map: Record<string, string> = {};
    headers.forEach((h, idx) => {
      map[h] = cells[idx] ?? '';
    });

    let promptText = pick(map, TEXT_KEYS);
    if (!promptText && !hasHeader && cells.length >= 1) {
      // fila sin header reconocible: si col0 es número, texto en col1
      if (/^\d+$/.test(cells[0] || '') && cells[1]) promptText = cells[1].trim();
      else promptText = (cells[0] || '').trim();
    }
    if (!promptText || promptText.length < 3) continue;

    const slotRaw = pick(map, SLOT_KEYS);
    let slot: number | undefined;
    if (slotRaw !== '' && /^\d+$/.test(slotRaw)) {
      const n = Number(slotRaw);
      if (Number.isInteger(n) && n >= 0) slot = n;
    }

    rows.push({
      text: promptText,
      name: pick(map, NAME_KEYS) || undefined,
      tipo: pick(map, TIPO_KEYS) || undefined,
      buyer: pick(map, BUYER_KEYS) || undefined,
      oferta: pick(map, OFERTA_KEYS) || undefined,
      country: pick(map, COUNTRY_KEYS) || undefined,
      slot,
    });
  }

  return rows;
}
