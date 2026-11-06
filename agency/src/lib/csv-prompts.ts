/**
 * Importación CSV de prompts propios (portal Agency).
 * Parsing UTF-8 con BOM, delimitador ,/; y campos citados (RFC 4180-ish).
 * La asignación a slots y la persistencia las decide el caller (API Cleexs).
 */

export const CSV_PROMPT_COLUMN = 'prompt';
export const CSV_NAME_COLUMN = 'name';

export type CsvDelimiter = ',' | ';';

export type CsvRow = {
  /** 1-based data row (header = line 1 conceptually; first data row = 2) */
  rowNumber: number;
  values: Record<string, string>;
  cells: string[];
};

export type CsvParseIssue = {
  rowNumber: number;
  message: string;
};

export type CsvParseResult = {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: CsvRow[];
  issues: CsvParseIssue[];
};

export type ImportSkipReason =
  | 'empty'
  | 'duplicate_csv'
  | 'duplicate_existing'
  | 'overflow'
  | 'not_durable'
  | 'malformed';

export type ImportPlanItem = {
  rowNumber: number;
  text: string;
  name: string;
  slot: number;
};

export type ImportSkipped = {
  rowNumber: number;
  text: string;
  reason: ImportSkipReason;
  message: string;
};

export type ImportPlan = {
  toAdd: ImportPlanItem[];
  skipped: ImportSkipped[];
  freeSlotsBefore: number;
  freeDurableSlotsBefore: number;
  max: number;
  liveMax: number;
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): CsvDelimiter {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < headerLine.length; i++) {
    const c = headerLine[i];
    if (c === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (c === ',') commas += 1;
    if (c === ';') semis += 1;
  }
  return semis > commas ? ';' : ',';
}

/** Tokenizer RFC 4180: comillas dobles escapadas, saltos dentro de campos citados. */
export function tokenizeCsv(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  /** Caracteres de la fila actual (así "" cuenta aunque el valor quede vacío). */
  let lineRawLen = 0;
  const src = stripBom(text);

  const endRow = () => {
    row.push(cell);
    cell = '';
    // Solo omitir líneas totalmente vacías (entre saltos). Filas con "" se conservan.
    if (lineRawLen > 0) rows.push(row);
    row = [];
    lineRawLen = 0;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c !== '\n' && c !== '\r') lineRawLen += 1;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
          lineRawLen += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n') {
      endRow();
      continue;
    }
    if (c === '\r') {
      continue;
    }
    cell += c;
  }
  if (lineRawLen > 0 || cell.length > 0 || row.length > 0) endRow();
  if (inQuotes) {
    throw new Error('CSV malformado: comillas sin cerrar');
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parsePromptCsv(text: string): CsvParseResult {
  const issues: CsvParseIssue[] = [];
  const cleaned = stripBom(text ?? '');
  if (!cleaned.trim()) {
    return { delimiter: ',', headers: [], rows: [], issues: [{ rowNumber: 0, message: 'Archivo vacío' }] };
  }

  const firstLineEnd = (() => {
    let inQuotes = false;
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (c === '"') {
        if (inQuotes && cleaned[i + 1] === '"') {
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && (c === '\n' || c === '\r')) return i;
    }
    return cleaned.length;
  })();

  const delimiter = detectDelimiter(cleaned.slice(0, firstLineEnd));

  let matrix: string[][];
  try {
    matrix = tokenizeCsv(cleaned, delimiter);
  } catch (e) {
    return {
      delimiter,
      headers: [],
      rows: [],
      issues: [{ rowNumber: 0, message: (e as Error).message }],
    };
  }

  if (!matrix.length) {
    return { delimiter, headers: [], rows: [], issues: [{ rowNumber: 0, message: 'Sin filas' }] };
  }

  const headers = matrix[0].map((h) => h.trim());
  const normHeaders = headers.map(normalizeHeader);
  const promptIdx = normHeaders.findIndex((h) => h === CSV_PROMPT_COLUMN || h === 'texto' || h === 'consulta');
  if (promptIdx < 0) {
    issues.push({
      rowNumber: 1,
      message: `Falta columna obligatoria "${CSV_PROMPT_COLUMN}" (también acepta texto/consulta)`,
    });
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    const rowNumber = i + 1;
    if (cells.length !== headers.length) {
      issues.push({
        rowNumber,
        message: `Columnas esperadas ${headers.length}, encontradas ${cells.length}`,
      });
    }
    const values: Record<string, string> = {};
    headers.forEach((h, idx) => {
      values[normalizeHeader(h) || `col${idx}`] = (cells[idx] ?? '').trim();
    });
    rows.push({ rowNumber, values, cells });
  }

  return { delimiter, headers, rows, issues };
}

export function promptTextFromRow(row: CsvRow): string {
  return (
    row.values[CSV_PROMPT_COLUMN] ||
    row.values.texto ||
    row.values.consulta ||
    ''
  ).trim();
}

export function promptNameFromRow(row: CsvRow): string {
  const name = (row.values[CSV_NAME_COLUMN] || row.values.nombre || '').trim();
  if (name) return name;
  const text = promptTextFromRow(row);
  return text.slice(0, 60);
}

function normDup(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Planifica agregar textos CSV en slots libres sin pisar existentes.
 * Prefiere slots durables (< liveMax). Overflow / no durables quedan en skipped (no silenciosos).
 */
export function planCsvImport(opts: {
  rows: CsvRow[];
  parseIssues?: CsvParseIssue[];
  existing: Array<{ slot?: number; text: string }>;
  max?: number;
  liveMax?: number;
}): ImportPlan {
  const max = opts.max ?? 40;
  const liveMax = Math.max(0, Math.min(opts.liveMax ?? max, max));
  const skipped: ImportSkipped[] = [];
  const toAdd: ImportPlanItem[] = [];

  for (const issue of opts.parseIssues ?? []) {
    if (issue.rowNumber <= 1) continue;
    skipped.push({
      rowNumber: issue.rowNumber,
      text: '',
      reason: 'malformed',
      message: issue.message,
    });
  }

  const usedSlots = new Set<number>();
  for (const e of opts.existing) {
    if (typeof e.slot === 'number' && e.slot >= 0 && e.slot < max && e.text.trim()) {
      usedSlots.add(e.slot);
    }
  }

  const freeSlots: number[] = [];
  const freeDurable: number[] = [];
  for (let s = 0; s < max; s++) {
    if (!usedSlots.has(s)) {
      freeSlots.push(s);
      if (s < liveMax) freeDurable.push(s);
    }
  }
  const freeSlotsBefore = freeSlots.length;
  const freeDurableSlotsBefore = freeDurable.length;

  const existingNorm = new Set(
    opts.existing.filter((e) => e.text.trim()).map((e) => normDup(e.text)),
  );
  const csvSeen = new Set<string>();

  const malformedRows = new Set(
    (opts.parseIssues ?? []).filter((i) => i.rowNumber > 1).map((i) => i.rowNumber),
  );

  for (const row of opts.rows) {
    if (malformedRows.has(row.rowNumber)) continue;

    const text = promptTextFromRow(row);
    if (!text) {
      skipped.push({
        rowNumber: row.rowNumber,
        text: '',
        reason: 'empty',
        message: 'Fila vacía (sin texto en columna prompt)',
      });
      continue;
    }

    const key = normDup(text);
    if (csvSeen.has(key)) {
      skipped.push({
        rowNumber: row.rowNumber,
        text,
        reason: 'duplicate_csv',
        message: 'Duplicado dentro del CSV',
      });
      continue;
    }
    csvSeen.add(key);

    if (existingNorm.has(key)) {
      skipped.push({
        rowNumber: row.rowNumber,
        text,
        reason: 'duplicate_existing',
        message: 'Ya existe en el proyecto (mismo texto)',
      });
      continue;
    }

    const durableSlot = freeDurable.shift();
    if (durableSlot !== undefined) {
      freeSlots.splice(freeSlots.indexOf(durableSlot), 1);
      toAdd.push({
        rowNumber: row.rowNumber,
        text,
        name: promptNameFromRow(row),
        slot: durableSlot,
      });
      existingNorm.add(key);
      continue;
    }

    // Sin slot durable: no fingir persistencia. Reportar explícitamente.
    if (liveMax < max && freeSlots.length > 0) {
      const slot = freeSlots.shift()!;
      skipped.push({
        rowNumber: row.rowNumber,
        text,
        reason: 'not_durable',
        message: `Sin slot durable (Cleexs live maxSlots=${liveMax}; slot libre ${slot} no se guardaría en servidor)`,
      });
      continue;
    }

    skipped.push({
      rowNumber: row.rowNumber,
      text,
      reason: 'overflow',
      message: `Límite ${max} alcanzado (ocupados + pendientes de import)`,
    });
  }

  return {
    toAdd,
    skipped,
    freeSlotsBefore,
    freeDurableSlotsBefore,
    max,
    liveMax,
  };
}

/** Contenido de plantilla UTF-8 con BOM para Excel. */
export function csvTemplateContent(): string {
  const bom = '\uFEFF';
  return (
    bom +
    [
      'prompt',
      '"¿Cuál es la mejor solución de firma electrónica para PyMEs en Argentina?"',
      '"Compará alternativas de onboarding digital; incluí precio y soporte."',
      '"Recomendame herramientas de facturación electrónica, con pros y contras"',
    ].join('\n') +
    '\n'
  );
}

/** Prefijo sintético para fixtures de prueba (nunca datos de usuario). */
export const CSV_TEST_FIXTURE_MARKER = '[CSV-TEST-FIXTURE-575b]';
