import { brandCssTokens, formatAuthorLine, type BrandKit } from '../../branding/brand-kit';
import { DEFAULT_BRAND_KIT } from '@agente/shared';
import { buildQuickChartUrl, type ChartSpec } from './charts';

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
  chart?: ChartSpec;
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
  /** ISO. Fija la fecha del hero para que un re-render no la mueva. */
  publishedAt?: string;
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

export function buildArticleCss(kit: BrandKit = DEFAULT_BRAND_KIT): string {
  const t = brandCssTokens(kit);
  const ctaBg =
    t.templateId === 'minimal'
      ? t.primary
      : `linear-gradient(135deg,${t.primary},${t.secondary})`;
  const ctaTextSoft = t.templateId === 'minimal' ? '#f8fafc' : t.primaryText;

  return `
.cleexs-article{font-family:${t.fontFamily};color:#0f172a;line-height:1.65;max-width:720px;margin:0 auto}
.cleexs-article__brand{margin-bottom:20px}
.cleexs-article__brand img{max-height:48px;width:auto;display:block}
.cleexs-article__kicker{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${t.primary};background:${t.primarySoft};padding:4px 10px;border-radius:999px;margin-bottom:12px}
.cleexs-article__lead{font-size:18px;color:#475569;margin:0 0 28px;line-height:1.6}
.cleexs-article h2{font-size:22px;color:#1e293b;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.cleexs-article h3{font-size:17px;color:#334155;margin:24px 0 8px}
.cleexs-article p{margin:0 0 16px;color:#334155}
.cleexs-article ul,.cleexs-article ol{margin:0 0 20px;padding-left:24px;color:#334155}
.cleexs-article li{margin-bottom:8px}
.cleexs-faq-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:12px}
.cleexs-faq-item strong{display:block;color:#1e293b;margin-bottom:6px}
.cleexs-checklist li{list-style:none;position:relative;padding-left:28px;margin-bottom:10px}
.cleexs-checklist li:before{content:"✓";position:absolute;left:0;color:${t.primary};font-weight:700}
.cleexs-compare-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
.cleexs-compare-table th,.cleexs-compare-table td{border:1px solid #e2e8f0;padding:10px 14px;text-align:left}
.cleexs-compare-table th{background:${t.primarySoft};color:${t.secondary}}
.cleexs-cta{background:${ctaBg};color:#fff;border-radius:16px;padding:28px 32px;margin:40px 0;text-align:center}
.cleexs-cta h3{color:#fff;margin:0 0 8px;font-size:20px}
.cleexs-cta p{color:${ctaTextSoft};margin:0 0 16px;font-size:15px}
.cleexs-cta a{display:inline-block;background:#fff;color:${t.primary};font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none}
.cleexs-meta{font-size:13px;color:#94a3b8;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
.cleexs-chart{margin:24px 0;text-align:center}
.cleexs-chart img{max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0}
.cleexs-chart figcaption{font-size:12px;color:#94a3b8;margin-top:8px;font-style:italic}
.cleexs-example{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin:20px 0}
.cleexs-example strong{display:block;color:#92400e;margin-bottom:6px}
.cleexs-callout{background:${t.primarySoft};border-left:4px solid ${t.primary};border-radius:0 12px 12px 0;padding:14px 18px;margin:20px 0;color:${t.secondary}}
.cleexs-references{margin:28px 0 0;padding:20px 0 0;border-top:1px solid #e2e8f0}
.cleexs-references h2{font-size:18px;margin:0 0 12px}
.cleexs-references ol{margin:0;padding-left:20px;color:#475569}
.cleexs-references li{margin-bottom:10px}
.cleexs-references a{color:${t.primary};text-decoration:none}
.cleexs-references a:hover{text-decoration:underline}
.cleexs-ecosystem{margin:32px 0;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
.cleexs-ecosystem h2{font-size:18px;margin:0 0 8px;border:none;padding:0}
.cleexs-ecosystem__list{margin:12px 0 0;padding-left:20px}
.cleexs-ecosystem__tag{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-left:6px}
.cleexs-article a{color:${t.primary};text-decoration:none}
.cleexs-article a:hover{text-decoration:underline}
`.replace(/\s+/g, ' ').trim();
}

function ctaBlock(data: ArticleData, kit: BrandKit) {
  const url = data.ctaUrl || kit.cta?.url || DEFAULT_BRAND_KIT.cta?.url || '#';
  const label = data.ctaLabel || kit.cta?.label || DEFAULT_BRAND_KIT.cta?.label || 'Contactanos';
  const headline = kit.cta?.headline || DEFAULT_BRAND_KIT.cta?.headline || '';
  const body = kit.cta?.body || DEFAULT_BRAND_KIT.cta?.body || '';
  return `
<aside class="cleexs-cta">
  <h3>${escapeHtml(headline)}</h3>
  <p>${escapeHtml(body)}</p>
  <a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>
</aside>`;
}

function brandHeader(kit: BrandKit): string {
  if (kit.templateId !== 'corporate' || !kit.logoUrl) return '';
  return `<header class="cleexs-article__brand"><img src="${escapeHtml(kit.logoUrl)}" alt="${escapeHtml(kit.brandName ?? 'Logo')}" /></header>`;
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
  if (section.chart) {
    const chart = section.chart;
    const chartUrl = buildQuickChartUrl(chart);
    const caption = [chart.title, chart.sourceNote].filter(Boolean).join(' — ');
    html += `<figure class="cleexs-chart"><img src="${escapeHtml(chartUrl)}" alt="${escapeHtml(chart.title || 'Gráfico')}" loading="lazy" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
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
    html += `<ul class="${listClass}">${section.items.map((i) => `<li>${renderInlineLinks(i)}</li>`).join('')}</ul>`;
  }
  if (section.table?.headers?.length && section.table.rows?.length) {
    const { headers, rows } = section.table;
    html += `<table class="cleexs-compare-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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

/* ------------------------------------------------------------------ *
 * Template "editorial": hero oscuro, secciones numeradas y bloques
 * destacados. Usa su propia clase raíz (.cleexs-editorial) para no
 * heredar el CSS legacy de .cleexs-article cargado en el tema de WP.
 * ------------------------------------------------------------------ */

const EDITORIAL_INK = '#04182b';

export function buildEditorialCss(kit: BrandKit = DEFAULT_BRAND_KIT): string {
  const t = brandCssTokens(kit);
  // El hero ya muestra título, autor y fecha: se oculta la cabecera del tema
  // (Astra imprime .entry-header) para que no aparezcan dos veces.
  return `
body.single-post .entry-header{display:none}
.cleexs-editorial{font-family:${t.fontFamily};color:#1f2937;line-height:1.75;font-size:17px;max-width:780px;margin:0 auto}
.cleexs-editorial *{box-sizing:border-box}
.cleexs-editorial__hero{position:relative;overflow:hidden;background:linear-gradient(135deg,${EDITORIAL_INK} 0%,#061527 55%,#0a2340 100%);border-radius:20px;padding:44px 44px 40px;margin:0 0 44px}
.cleexs-editorial__hero:after{content:"";position:absolute;right:-70px;top:-70px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,${t.primary}59,transparent 70%);pointer-events:none}
.cleexs-editorial__kicker{position:relative;z-index:1;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7aa5f5;margin:0 0 18px}
.cleexs-editorial__title{position:relative;z-index:1;font-size:38px;line-height:1.18;font-weight:800;letter-spacing:-.02em;color:#fff;margin:0 0 24px}
.cleexs-editorial__author{position:relative;z-index:1;display:flex;align-items:center;gap:12px;margin:0 0 26px}
.cleexs-editorial__avatar{flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${t.primary},${t.secondary});color:#fff;font-weight:700;font-size:17px;line-height:44px;text-align:center;overflow:hidden}
.cleexs-editorial__avatar img{width:100%;height:100%;object-fit:cover;display:block}
.cleexs-editorial__author-name{font-size:14px;font-weight:700;color:#fff;line-height:1.35}
.cleexs-editorial__author-role{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8fa8c8;line-height:1.35}
.cleexs-editorial__lead{position:relative;z-index:1;font-size:17px;line-height:1.7;color:#c7d5e6;margin:0 0 14px}
.cleexs-editorial__lead:last-child{margin-bottom:0}
.cleexs-editorial__section{margin:0 0 44px}
.cleexs-editorial__section-head{display:flex;gap:18px;align-items:flex-start;margin:0 0 22px;padding-bottom:16px;border-bottom:1px solid #e8ecf3}
.cleexs-editorial__num{flex:0 0 auto;font-size:40px;font-weight:800;line-height:1;letter-spacing:-.03em;color:#cfdcf3}
.cleexs-editorial h2{font-size:24px;line-height:1.32;font-weight:700;color:#0b2545;margin:0;padding:0;border:none}
.cleexs-editorial p{margin:0 0 18px;color:#374151}
.cleexs-editorial a{color:${t.primary};text-decoration:none}
.cleexs-editorial a:hover{text-decoration:underline}
.cleexs-editorial__list{list-style:none;margin:0 0 24px;padding:0;counter-reset:cxitem}
.cleexs-editorial__list li{counter-increment:cxitem;position:relative;padding-left:46px;margin:0 0 16px;color:#374151}
.cleexs-editorial__list li:before{content:counter(cxitem);position:absolute;left:0;top:2px;width:28px;height:28px;border-radius:8px;background:${t.primarySoft};color:${t.primary};font-size:13px;font-weight:700;line-height:28px;text-align:center}
.cleexs-editorial__list b{color:#0b2545}
.cleexs-editorial__check{list-style:none;margin:0 0 24px;padding:0}
.cleexs-editorial__check li{position:relative;padding-left:32px;margin:0 0 12px;color:#374151}
.cleexs-editorial__check li:before{content:"✓";position:absolute;left:0;top:0;color:${t.primary};font-weight:800}
.cleexs-editorial__quote{border-left:4px solid ${t.primary};background:#f5f8ff;border-radius:0 14px 14px 0;padding:18px 22px;margin:26px 0;color:#1e3a5f;font-style:italic}
.cleexs-editorial__note{display:flex;gap:14px;align-items:flex-start;background:#eaf0fe;border:1px solid #d5dffd;border-radius:14px;padding:18px 20px;margin:22px 0}
.cleexs-editorial__note-icon{flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:${t.primary};color:#fff;font-size:15px;font-weight:700;font-style:italic;line-height:26px;text-align:center}
.cleexs-editorial__note strong{display:block;font-size:15px;color:#0b2545;margin:0 0 4px}
.cleexs-editorial__note p{margin:0;font-size:15px;color:#334155}
.cleexs-editorial__faq{background:#fbfcfe;border:1px solid #e8ecf3;border-radius:14px;padding:16px 20px;margin:0 0 12px}
.cleexs-editorial__faq strong{display:block;color:#0b2545;margin:0 0 6px}
.cleexs-editorial__table-wrap{overflow-x:auto;margin:24px 0}
.cleexs-editorial__table{width:100%;border-collapse:collapse;font-size:14px}
.cleexs-editorial__table th{background:#f3f6fc;color:#0b2545;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;text-align:left;padding:12px 14px;border-bottom:2px solid #dfe6f3}
.cleexs-editorial__table td{padding:12px 14px;border-bottom:1px solid #edf1f7;color:#374151;vertical-align:top}
.cleexs-editorial__table td:first-child{font-weight:600;color:#0b2545}
.cleexs-editorial__table tr:last-child td{border-bottom:none}
.cleexs-editorial__fig{margin:26px 0;text-align:center}
.cleexs-editorial__fig img{max-width:100%;height:auto;border-radius:14px;border:1px solid #e8ecf3}
.cleexs-editorial__fig figcaption{margin-top:10px;font-size:12px;color:#8494ad}
.cleexs-editorial__refs{margin:40px 0 0;padding:26px 28px;background:#f7f9fc;border-radius:16px}
.cleexs-editorial__refs h2{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin:0 0 14px}
.cleexs-editorial__refs ol{margin:0;padding-left:20px}
.cleexs-editorial__refs li{margin:0 0 10px;font-size:14px;color:#475569}
.cleexs-editorial__cta{background:linear-gradient(135deg,${EDITORIAL_INK},#0a2340);border-radius:18px;padding:34px 32px;margin:36px 0 0;text-align:center}
.cleexs-editorial__cta h3{margin:0 0 8px;font-size:21px;font-weight:700;color:#fff}
.cleexs-editorial__cta p{margin:0 0 20px;font-size:15px;color:#b9cbe3}
.cleexs-editorial__cta a{display:inline-block;background:${t.primary};color:#fff;font-weight:700;padding:13px 28px;border-radius:10px;text-decoration:none}
.cleexs-editorial .cleexs-ecosystem{margin:32px 0 0;padding:24px 26px;background:#f7f9fc;border:1px solid #e8ecf3;border-radius:16px}
.cleexs-editorial .cleexs-ecosystem h2{font-size:16px;margin:0 0 6px}
.cleexs-editorial .cleexs-ecosystem p{font-size:14px;color:#64748b;margin:0}
.cleexs-editorial .cleexs-ecosystem__list{margin:14px 0 0;padding-left:20px;font-size:14px}
.cleexs-editorial .cleexs-ecosystem__list li{margin:0 0 8px}
.cleexs-editorial .cleexs-ecosystem__tag{margin-left:6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8}
.cleexs-editorial .cleexs-meta{margin:28px 0 0;padding-top:18px;border-top:1px solid #e8ecf3;font-size:13px;color:#94a3b8}
@media (max-width:640px){
.cleexs-editorial{font-size:16px}
.cleexs-editorial__hero{padding:28px 22px;border-radius:16px;margin-bottom:32px}
.cleexs-editorial__title{font-size:27px}
.cleexs-editorial__section-head{gap:12px}
.cleexs-editorial__num{font-size:28px}
.cleexs-editorial h2{font-size:20px}
.cleexs-editorial__refs,.cleexs-editorial__cta{padding:22px 20px}
}
`.replace(/\s+/g, ' ').trim();
}

function parseAuthor(kit: BrandKit): { name: string; role: string } {
  const [first, ...rest] = formatAuthorLine(kit)
    .split('·')
    .map((part) => part.trim());
  const name = (first ?? '').replace(/^por\s+/i, '').trim() || kit.brandName || 'Redacción';
  const role = rest.join(' · ') || `Equipo ${kit.brandName ?? ''}`.trim();
  return { name, role };
}

function formatHeroDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return valid
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

/** Resalta la entradilla ("Concepto: explicación") como en el diseño de referencia. */
function renderEditorialListItem(text: string): string {
  const html = renderInlineLinks(text);
  const match = /^([^:<]{3,70}):\s+([\s\S]+)$/.exec(html);
  if (!match) return `<li>${html}</li>`;
  return `<li><b>${match[1]}:</b> ${match[2]}</li>`;
}

/** El modelo suele numerar los títulos ("2. Diagnóstico"); el template ya pone su número. */
function stripLeadingNumber(heading: string): string {
  return heading.replace(/^\s*\d{1,2}\s*[.)–-]\s+/, '');
}

function renderEditorialSection(section: ArticleSection, index: number, pieceType: string): string {
  const parts: string[] = [];

  if (section.heading) {
    parts.push(
      `<div class="cleexs-editorial__section-head"><span class="cleexs-editorial__num">${String(index).padStart(2, '0')}.</span><h2>${stripLeadingNumber(section.heading)}</h2></div>`,
    );
  }
  if (section.body) {
    parts.push(`<p>${renderInlineLinks(section.body)}</p>`);
  }
  if (section.callout) {
    parts.push(`<div class="cleexs-editorial__quote">${renderInlineLinks(section.callout)}</div>`);
  }
  if (section.chart) {
    const chartUrl = buildQuickChartUrl(section.chart);
    const caption = [section.chart.title, section.chart.sourceNote].filter(Boolean).join(' — ');
    parts.push(
      `<figure class="cleexs-editorial__fig"><img src="${escapeHtml(chartUrl)}" alt="${escapeHtml(section.chart.title || 'Gráfico')}" loading="lazy" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`,
    );
  }
  if (section.examples?.length) {
    parts.push(
      section.examples
        .map(
          (ex) =>
            `<div class="cleexs-editorial__note"><span class="cleexs-editorial__note-icon">i</span><div><strong>${escapeHtml(ex.title)}</strong><p>${renderInlineLinks(ex.body)}</p></div></div>`,
        )
        .join(''),
    );
  }
  if (section.faqs?.length) {
    parts.push(
      section.faqs
        .map(
          (f) =>
            `<div class="cleexs-editorial__faq"><strong>${f.q}</strong><p style="margin:0">${f.a}</p></div>`,
        )
        .join(''),
    );
  }
  if (section.items?.length) {
    const useCheck = pieceType === 'checklist';
    const cls = useCheck ? 'cleexs-editorial__check' : 'cleexs-editorial__list';
    const items = section.items
      .map((item) => (useCheck ? `<li>${renderInlineLinks(item)}</li>` : renderEditorialListItem(item)))
      .join('');
    parts.push(`<${useCheck ? 'ul' : 'ol'} class="${cls}">${items}</${useCheck ? 'ul' : 'ol'}>`);
  }
  if (section.table?.headers?.length && section.table.rows?.length) {
    const { headers, rows } = section.table;
    parts.push(
      `<div class="cleexs-editorial__table-wrap"><table class="cleexs-editorial__table"><thead><tr>${headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join('')}</tr></thead><tbody>${rows
        .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    );
  }

  return `<section class="cleexs-editorial__section">${parts.join('')}</section>`;
}

function renderEditorialArticle(data: ArticleData, kit: BrandKit): string {
  const author = parseAuthor(kit);
  const kicker = [data.kicker, formatHeroDate(data.publishedAt)].filter(Boolean).join(' · ');
  const avatar = kit.logoUrl
    ? `<img src="${escapeHtml(kit.logoUrl)}" alt="${escapeHtml(author.name)}" />`
    : escapeHtml(author.name.charAt(0).toUpperCase());

  const leadHtml = data.lead
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="cleexs-editorial__lead">${renderInlineLinks(p)}</p>`)
    .join('');

  let numbered = 0;
  const sectionsHtml = data.sections
    .map((section) => {
      if (section.heading) numbered += 1;
      return renderEditorialSection(section, numbered, data.pieceType);
    })
    .join('\n');

  const references = data.references?.length
    ? `<section class="cleexs-editorial__refs"><h2>Fuentes y lecturas recomendadas</h2><ol>${data.references
        .map(
          (ref) =>
            `<li><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a>${ref.note ? ` — ${escapeHtml(ref.note)}` : ''}</li>`,
        )
        .join('')}</ol></section>`
    : '';

  const ctaUrl = data.ctaUrl || kit.cta?.url || DEFAULT_BRAND_KIT.cta?.url || '#';
  const ctaLabel = data.ctaLabel || kit.cta?.label || DEFAULT_BRAND_KIT.cta?.label || 'Contactanos';
  const ctaHeadline = kit.cta?.headline || DEFAULT_BRAND_KIT.cta?.headline || '';
  const ctaBody = kit.cta?.body || DEFAULT_BRAND_KIT.cta?.body || '';

  return `<style>${buildEditorialCss(kit)}</style>
<article class="cleexs-editorial">
  <header class="cleexs-editorial__hero">
    <p class="cleexs-editorial__kicker">${escapeHtml(kicker)}</p>
    <h1 class="cleexs-editorial__title">${escapeHtml(data.title)}</h1>
    <div class="cleexs-editorial__author">
      <span class="cleexs-editorial__avatar">${avatar}</span>
      <span>
        <span class="cleexs-editorial__author-name">${escapeHtml(author.name)}</span><br />
        <span class="cleexs-editorial__author-role">${escapeHtml(author.role)}</span>
      </span>
    </div>
    ${leadHtml}
  </header>
  ${sectionsHtml}
  ${references}
  <aside class="cleexs-editorial__cta">
    <h3>${escapeHtml(ctaHeadline)}</h3>
    <p>${escapeHtml(ctaBody)}</p>
    <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener">${escapeHtml(ctaLabel)}</a>
  </aside>
  <p class="cleexs-meta">${escapeHtml(formatAuthorLine(kit))}</p>
</article>`;
}

export function renderArticleHtml(data: ArticleData, kit: BrandKit = DEFAULT_BRAND_KIT): string {
  if (kit.templateId === 'editorial') {
    return renderEditorialArticle(data, kit);
  }

  const sectionsHtml = data.sections.map((s) => renderSection(s, data.pieceType)).join('\n');
  const referencesHtml = data.references?.length ? renderReferences(data.references) : '';
  const css = buildArticleCss(kit);
  return `<style>${css}</style>
<article class="cleexs-article">
  ${brandHeader(kit)}
  <span class="cleexs-article__kicker">${escapeHtml(data.kicker)}</span>
  <p class="cleexs-article__lead">${renderInlineLinks(data.lead)}</p>
  ${sectionsHtml}
  ${referencesHtml}
  ${ctaBlock(data, kit)}
  <p class="cleexs-meta">${escapeHtml(formatAuthorLine(kit))}</p>
</article>`;
}

/** Muestra estática para preview en el backoffice. */
export function renderBrandPreviewHtml(kit: BrandKit): string {
  const sample: ArticleData = {
    kicker: kit.brandName ?? 'Tu marca',
    title: 'Vista previa del artículo',
    lead: 'Así se verán los artículos publicados en WordPress con la línea gráfica configurada.',
    pieceType: 'how_to',
    sections: [
      {
        heading: 'Sección de ejemplo',
        body: 'Texto con [enlace de muestra](https://example.com) y un insight accionable.',
        callout: 'Los callouts usan el color primario de tu marca.',
      },
      {
        heading: 'Checklist',
        items: ['Primer punto accionable', 'Segundo punto accionable'],
      },
    ],
  };
  return renderArticleHtml(sample, kit);
}

/** CSS legacy (Cleexs default) — usado en tests. */
export const ARTICLE_CSS = buildArticleCss(DEFAULT_BRAND_KIT);
