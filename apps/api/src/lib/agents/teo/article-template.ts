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
`.replace(/\s+/g, ' ').trim();

export type ArticleSection = {
  heading?: string;
  body?: string;
  items?: string[];
  faqs?: Array<{ q: string; a: string }>;
  table?: { headers: string[]; rows: string[][] };
};

export type ArticleData = {
  kicker: string;
  title: string;
  lead: string;
  sections: ArticleSection[];
  pieceType: string;
  ctaUrl?: string;
  ctaLabel?: string;
};

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
    html += `<p>${section.body}</p>`;
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

export function renderArticleHtml(data: ArticleData): string {
  const sectionsHtml = data.sections.map((s) => renderSection(s, data.pieceType)).join('\n');
  return `<style>${ARTICLE_CSS}</style>
<article class="cleexs-article">
  <span class="cleexs-article__kicker">${data.kicker}</span>
  <p class="cleexs-article__lead">${data.lead}</p>
  ${sectionsHtml}
  ${ctaBlock(data)}
  <p class="cleexs-meta">Por Teo · Agente de contenido Cleexs</p>
</article>`;
}
