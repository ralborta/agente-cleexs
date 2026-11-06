import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CSV_TEST_FIXTURE_MARKER,
  csvTemplateContent,
  parsePromptCsv,
  planCsvImport,
  promptTextFromRow,
  tokenizeCsv,
} from './csv-prompts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '__fixtures__');

describe('tokenizeCsv / parsePromptCsv', () => {
  it('strips BOM and parses UTF-8 accents', () => {
    const bom = '\uFEFF';
    const csv = `${bom}prompt\n"¿Cuál es la mejor opción?"\n`;
    const parsed = parsePromptCsv(csv);
    assert.equal(parsed.issues.length, 0);
    assert.equal(parsed.rows.length, 1);
    assert.equal(promptTextFromRow(parsed.rows[0]), '¿Cuál es la mejor opción?');
  });

  it('detects semicolon delimiter', () => {
    const csv = 'prompt;name\n"Hola, mundo";"Saludo"\n';
    const parsed = parsePromptCsv(csv);
    assert.equal(parsed.delimiter, ';');
    assert.equal(parsed.rows[0].values.prompt, 'Hola, mundo');
    assert.equal(parsed.rows[0].values.name, 'Saludo');
  });

  it('keeps commas inside quotes and quoted newlines', () => {
    const csv = 'prompt\n"Línea 1, con coma\ny salto"\n"otra"\n';
    const matrix = tokenizeCsv(csv, ',');
    assert.equal(matrix.length, 3);
    assert.equal(matrix[1][0], 'Línea 1, con coma\ny salto');
  });

  it('reports missing prompt column', () => {
    const parsed = parsePromptCsv('titulo\n"x"\n');
    assert.ok(parsed.issues.some((i) => /prompt/i.test(i.message)));
  });

  it('reports unclosed quotes as malformed', () => {
    const parsed = parsePromptCsv('prompt\n"sin cerrar\n');
    assert.ok(parsed.issues.some((i) => /comillas/i.test(i.message)));
  });

  it('loads synthetic fixture file', () => {
    const raw = readFileSync(join(fixtures, 'prompts-import-sample.csv'), 'utf8');
    assert.ok(raw.includes(CSV_TEST_FIXTURE_MARKER));
    const parsed = parsePromptCsv(raw);
    assert.equal(parsed.issues.filter((i) => i.rowNumber === 0).length, 0);
    assert.ok(parsed.rows.length >= 3);
  });
});

describe('planCsvImport', () => {
  it('fills free slots without overwriting existing', () => {
    const parsed = parsePromptCsv(
      [
        'prompt',
        `${CSV_TEST_FIXTURE_MARKER} uno`,
        `${CSV_TEST_FIXTURE_MARKER} dos`,
      ].join('\n'),
    );
    const plan = planCsvImport({
      rows: parsed.rows,
      existing: [{ slot: 0, text: 'ya ocupado' }],
      max: 40,
      liveMax: 40,
    });
    assert.equal(plan.toAdd.length, 2);
    assert.equal(plan.toAdd[0].slot, 1);
    assert.equal(plan.toAdd[1].slot, 2);
    assert.ok(!plan.toAdd.some((x) => x.slot === 0));
  });

  it('counts limit against existing + imports (overflow not silent)', () => {
    const lines = ['prompt'];
    for (let i = 0; i < 5; i++) lines.push(`${CSV_TEST_FIXTURE_MARKER} extra ${i}`);
    const parsed = parsePromptCsv(lines.join('\n'));
    const existing = Array.from({ length: 38 }, (_, i) => ({
      slot: i,
      text: `existente ${i}`,
    }));
    const plan = planCsvImport({
      rows: parsed.rows,
      existing,
      max: 40,
      liveMax: 40,
    });
    assert.equal(plan.toAdd.length, 2);
    assert.equal(plan.skipped.filter((s) => s.reason === 'overflow').length, 3);
  });

  it('flags duplicates and empties explicitly', () => {
    // Fila con celda vacía explícita (""): las líneas en blanco puras no son filas de datos.
    const parsed = parsePromptCsv(
      [
        'prompt',
        `${CSV_TEST_FIXTURE_MARKER} same`,
        '""',
        `${CSV_TEST_FIXTURE_MARKER} same`,
      ].join('\n'),
    );
    const plan = planCsvImport({
      rows: parsed.rows,
      existing: [{ slot: 0, text: `${CSV_TEST_FIXTURE_MARKER} same` }],
      max: 40,
      liveMax: 5,
    });
    assert.equal(plan.toAdd.length, 0);
    assert.ok(plan.skipped.some((s) => s.reason === 'empty'));
    assert.ok(plan.skipped.some((s) => s.reason === 'duplicate_existing'));
    assert.ok(plan.skipped.some((s) => s.reason === 'duplicate_csv'));
  });

  it('does not pretend slots beyond liveMax are durable', () => {
    const lines = ['prompt'];
    for (let i = 0; i < 6; i++) lines.push(`${CSV_TEST_FIXTURE_MARKER} live ${i}`);
    const parsed = parsePromptCsv(lines.join('\n'));
    const plan = planCsvImport({
      rows: parsed.rows,
      existing: [],
      max: 40,
      liveMax: 5,
    });
    assert.equal(plan.toAdd.length, 5);
    assert.ok(plan.toAdd.every((x) => x.slot < 5));
    assert.equal(plan.skipped.filter((s) => s.reason === 'not_durable').length, 1);
  });

  it('isolates planning per existing set (other project)', () => {
    const parsed = parsePromptCsv(`prompt\n${CSV_TEST_FIXTURE_MARKER} solo\n`);
    const projA = planCsvImport({
      rows: parsed.rows,
      existing: [{ slot: 0, text: 'A' }],
      max: 40,
      liveMax: 40,
    });
    const projB = planCsvImport({
      rows: parsed.rows,
      existing: [],
      max: 40,
      liveMax: 40,
    });
    assert.equal(projA.toAdd[0].slot, 1);
    assert.equal(projB.toAdd[0].slot, 0);
  });
});

describe('csvTemplateContent', () => {
  it('starts with BOM and prompt header', () => {
    const t = csvTemplateContent();
    assert.equal(t.charCodeAt(0), 0xfeff);
    assert.match(t, /^.\s*prompt/m);
  });
});
