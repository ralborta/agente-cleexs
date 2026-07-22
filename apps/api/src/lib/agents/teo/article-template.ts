/** Estilos embebidos para artículos en WordPress (no dependen del tema). */
export const ARTICLE_CSS = `
.cleexs-article{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;line-height:1.65;max-width:720px;margin:0 auto}
.cleexs-article__kicker{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;background:#eff6ff;padding:4px 10px;border-radius:999px;margin-bottom:12px}
.cleexs-article__lead{font-size:18px;color:#475569;margin:0 0 28px;line-height:1.6}
.cleexs-article h2{font-size:22px;color:#1e293b;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.cleexs-article h3{font-size:17px;color:#334155;margin:24px 0 8px}
.cleexs-article p{margin:0 0 16px;color:#334155}
.cleexs-article ul,.cleexs-article ol{margin:0 0 20px;padding-left:24px;color:#334155}
.cleexs-article li{margin-bottom:8px}
.cleexs-faq-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:12px}
.cleexs-faq-item strong{display:block;color:#1e293b;margin-bottom:6px}
.cleexs-checklist li{list-style:none;position:relative;padding-left:28px;margin-bottom:10px}
.cleexs-checklist li:before{content:"✓";position:absolute;left:0;color:#2563eb;font-weight:700}
.cleexs-compare-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
.cleexs-compare-table th,.cleexs-compare-table td{border:1px solid #e2e8f0;padding:10px 14px;text-align:left}
.cleexs-compare-table th{background:#eff6ff;color:#1e3a8a}
.cleexs-cta{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-radius:16px;padding:28px 32px;margin:40px 0;text-align:center}
.cleexs-cta h3{color:#fff;margin:0 0 8px;font-size:20px}
.cleexs-cta p{color:#dbeafe;margin:0 0 16px;font-size:15px}
.cleexs-cta a{display:inline-block;background:#fff;color:#2563eb;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none}
.cleexs-meta{font-size:13px;color:#94a3b8;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
.cleexs-example{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin:20px 0}
.cleexs-example strong{display:block;color:#92400e;margin-bottom:6px}
.cleexs-callout{background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;padding:14px 18px;margin:20px 0;color:#1e3a8a}
.cleexs-references{margin:28px 0 0;padding:20px 0 0;border-top:1px solid #e2e8f0}
.cleexs-references h2{font-size:18px;margin:0 0 12px}
.cleexs-references ol{margin:0;padding-left:20px;color:#475569}
.cleexs-references li{margin-bottom:10px}
.cleexs-references a{color:#2563eb;text-decoration:none}
.cleexs-references a:hover{text-decoration:underline}
.cleexs-article a{color:#2563eb;text-decoration:none}
.cleexs-article a:hover{text-decoration:underline}
`.replace(/\s+/g, ' ').trim();

export type ArticleReference = {
  title: string;
  url: string;
  note?: string;
};

export type ArticleExample = {
  title: string;
  body: string;
};

export type ArticleSection = {
  heading?: string;
  body?: string;
  items?: string[];
  faqs?: Array<{ q: string; a: string }>;
  table?: { headers: string[]; rows: string[][] };
  examples?: ArticleExample[];
  callout?: string;
};

export type ArticleData = {
  kicker: string;
  title: string;
  lead: string;
  sections: ArticleSection[];
  pieceType: string;
  references?: ArticleReference[];
  ctaUrl?: string;
  ctaLabel?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convierte markdown básico [texto](url) a enlaces HTML seguros. */
export function renderInlineLinks(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label: string, url: string) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
}

function ctaBlock(data: ArticleData) {
  const url = data.ctaUrl || 'https://app.cleexs.net/diagnostico/crear?url=';
  const label = data.ctaLabel || 'Checkeá tu visibilidad gratis';
  return `
<aside class="cleexs-cta">
  <h3>¿Querés medir tu visibilidad en Google e IA?</h3>
  <p>Cleexs analiza cómo te ven ChatGPT, Google y tus competidores.</p>
  <a href="${url}" target="_blank" rel="noopener">${label}</a>
</aside>`;
}

function renderSection(section: ArticleSection, pieceType: string): string {
  let html = '';
  if (section.heading) {
    html += `<h2>${section.heading}</h2>`;
  }
  if (section.body) {
    html += `<p>${renderInlineLinks(section.body)}</p>`;
  }
  if (section.callout) {
    html += `<div class="cleexs-callout">${renderInlineLinks(section.callout)}</div>`;
  }
  if (section.examples?.length) {
    html += section.examples
      .map(
        (ex) =>
          `<div class="cleexs-example"><strong>${escapeHtml(ex.title)}</strong><p style="margin:0">${renderInlineLinks(ex.body)}</p></div>`,
      )
      .join('');
  }
  if (section.faqs?.length) {
    html += section.faqs
      .map(
        (f) =>
          `<div class="cleexs-faq-item"><strong>${f.q}</strong><p style="margin:0">${f.a}</p></div>`,
      )
      .join('');
  }
  if (section.items?.length) {
    const listClass = pieceType === 'checklist' ? 'cleexs-checklist' : '';
    html += `<ul class="${listClass}">${section.items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  }
  if (section.table) {
    const { headers, rows } = section.table;
    html += `<table class="cleexs-compare-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  return html;
}

function renderReferences(refs: ArticleReference[]): string {
  if (!refs.length) return '';
  const items = refs
    .map((ref) => {
      const note = ref.note ? ` — ${escapeHtml(ref.note)}` : '';
      return `<li><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a>${note}</li>`;
    })
    .join('');
  return `<section class="cleexs-references"><h2>Referencias y lecturas recomendadas</h2><ol>${items}</ol></section>`;
}

export function renderArticleHtml(data: ArticleData): string {
  const sectionsHtml = data.sections.map((s) => renderSection(s, data.pieceType)).join('\n');
  const referencesHtml = data.references?.length ? renderReferences(data.references) : '';
  return `<style>${ARTICLE_CSS}</style>
<article class="cleexs-article">
  <span class="cleexs-article__kicker">${escapeHtml(data.kicker)}</span>
  <p class="cleexs-article__lead">${renderInlineLinks(data.lead)}</p>
  ${sectionsHtml}
  ${referencesHtml}
  ${ctaBlock(data)}
  <p class="cleexs-meta">Por Teo · Agente de contenido Cleexs</p>
</article>`;
}
