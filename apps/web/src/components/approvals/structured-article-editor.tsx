'use client';

import { inputClassName } from '@/components/config/settings-section';
import type { ArticleDataClient, ArticleSectionClient } from '@/lib/api-client';

type Props = {
  value: ArticleDataClient;
  onChange: (next: ArticleDataClient) => void;
};

function updateSection(
  sections: ArticleSectionClient[],
  index: number,
  patch: Partial<ArticleSectionClient>,
): ArticleSectionClient[] {
  return sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

export function StructuredArticleEditor({ value, onChange }: Props) {
  const setLead = (lead: string) => onChange({ ...value, lead });

  const setSection = (index: number, patch: Partial<ArticleSectionClient>) => {
    onChange({ ...value, sections: updateSection(value.sections, index, patch) });
  };

  const setTableCell = (
    sectionIndex: number,
    rowIndex: number,
    colIndex: number,
    cell: string,
  ) => {
    const section = value.sections[sectionIndex];
    if (!section?.table) return;
    const rows = section.table.rows.map((row, ri) =>
      ri === rowIndex ? row.map((c, ci) => (ci === colIndex ? cell : c)) : row,
    );
    setSection(sectionIndex, { table: { ...section.table, rows } });
  };

  const setTableHeader = (sectionIndex: number, colIndex: number, header: string) => {
    const section = value.sections[sectionIndex];
    if (!section?.table) return;
    const headers = section.table.headers.map((h, i) => (i === colIndex ? header : h));
    setSection(sectionIndex, { table: { ...section.table, headers } });
  };

  const setChartLabel = (sectionIndex: number, labelIndex: number, label: string) => {
    const section = value.sections[sectionIndex];
    if (!section?.chart) return;
    const labels = section.chart.labels.map((l, i) => (i === labelIndex ? label : l));
    setSection(sectionIndex, { chart: { ...section.chart, labels } });
  };

  const setChartValue = (sectionIndex: number, valueIndex: number, num: string) => {
    const section = value.sections[sectionIndex];
    if (!section?.chart?.datasets?.[0]) return;
    const n = Number(num);
    const datasets = section.chart.datasets.map((ds, di) => {
      if (di !== 0) return ds;
      return {
        ...ds,
        data: ds.data.map((v, i) => (i === valueIndex ? (Number.isFinite(n) ? n : 0) : v)),
      };
    });
    setSection(sectionIndex, { chart: { ...section.chart, datasets } });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-slate-200">Lead / respuesta al inicio</label>
        <textarea
          value={value.lead}
          onChange={(e) => setLead(e.target.value)}
          rows={4}
          className={`${inputClassName} mt-2 resize-y`}
        />
      </div>

      {value.sections.map((section, si) => (
        <div
          key={si}
          className="space-y-3 rounded-xl border border-hub-border bg-hub-bg/40 p-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-hub-muted">
            Sección {si + 1}
            {section.table ? ' · tabla' : ''}
            {section.chart ? ' · gráfico' : ''}
          </p>

          <div>
            <label className="text-xs text-slate-300">Título de sección</label>
            <input
              value={section.heading ?? ''}
              onChange={(e) => setSection(si, { heading: e.target.value })}
              className={`${inputClassName} mt-1`}
            />
          </div>

          <div>
            <label className="text-xs text-slate-300">Cuerpo</label>
            <textarea
              value={section.body ?? ''}
              onChange={(e) => setSection(si, { body: e.target.value })}
              rows={5}
              className={`${inputClassName} mt-1 resize-y text-sm`}
            />
          </div>

          {section.callout != null ? (
            <div>
              <label className="text-xs text-slate-300">Callout</label>
              <textarea
                value={section.callout}
                onChange={(e) => setSection(si, { callout: e.target.value })}
                rows={2}
                className={`${inputClassName} mt-1 resize-y text-sm`}
              />
            </div>
          ) : null}

          {section.table ? (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs font-medium text-slate-300">Tabla</p>
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {section.table.headers.map((h, ci) => (
                      <th key={ci} className="border border-hub-border p-1">
                        <input
                          value={h}
                          onChange={(e) => setTableHeader(si, ci, e.target.value)}
                          className="w-full min-w-[6rem] rounded bg-[#0b1220] px-1.5 py-1 text-slate-100"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, ri) => (
                    <tr key={ri}>
                      {section.table!.headers.map((_, ci) => (
                        <td key={ci} className="border border-hub-border p-1">
                          <input
                            value={row[ci] ?? ''}
                            onChange={(e) => setTableCell(si, ri, ci, e.target.value)}
                            className="w-full min-w-[6rem] rounded bg-[#0b1220] px-1.5 py-1 text-slate-100"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.chart ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">
                Gráfico ({section.chart.type})
                {section.chart.title ? ` — ${section.chart.title}` : ''}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.chart.labels.map((label, li) => (
                  <div key={li} className="flex gap-2">
                    <input
                      value={label}
                      onChange={(e) => setChartLabel(si, li, e.target.value)}
                      className={`${inputClassName} flex-1 text-xs`}
                      placeholder="Etiqueta"
                    />
                    <input
                      type="number"
                      value={section.chart!.datasets[0]?.data[li] ?? 0}
                      onChange={(e) => setChartValue(si, li, e.target.value)}
                      className={`${inputClassName} w-24 text-xs`}
                    />
                  </div>
                ))}
              </div>
              {section.chart.sourceNote ? (
                <p className="text-[11px] text-hub-muted">{section.chart.sourceNote}</p>
              ) : null}
            </div>
          ) : null}

          {section.faqs?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">FAQs</p>
              {section.faqs.map((faq, fi) => (
                <div key={fi} className="space-y-1 rounded-lg border border-hub-border/60 p-2">
                  <input
                    value={faq.q}
                    onChange={(e) => {
                      const faqs = section.faqs!.map((f, i) =>
                        i === fi ? { ...f, q: e.target.value } : f,
                      );
                      setSection(si, { faqs });
                    }}
                    className={`${inputClassName} text-xs`}
                    placeholder="Pregunta"
                  />
                  <textarea
                    value={faq.a}
                    onChange={(e) => {
                      const faqs = section.faqs!.map((f, i) =>
                        i === fi ? { ...f, a: e.target.value } : f,
                      );
                      setSection(si, { faqs });
                    }}
                    rows={2}
                    className={`${inputClassName} resize-y text-xs`}
                    placeholder="Respuesta"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
