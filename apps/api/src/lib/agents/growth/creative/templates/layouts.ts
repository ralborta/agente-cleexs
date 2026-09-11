import type { CreativePlan, CreativeTemplateConfig, ResolvedDistributionBrand } from '../types';
import { FORMAT_SIZES } from '../types';
import { loadBackgroundDataUri } from './backgrounds';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function brandFooter(brand: ResolvedDistributionBrand): string {
  return `
    <div class="footer">
      <div class="brand-name">${esc(brand.name)}</div>
      ${brand.website ? `<div class="brand-url">${esc(brand.website.replace(/^https?:\/\//, ''))}</div>` : ''}
    </div>
  `;
}

function shell(
  brand: ResolvedDistributionBrand,
  template: CreativeTemplateConfig,
  plan: CreativePlan,
  body: string,
): string {
  const size = FORMAT_SIZES[plan.format];
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${size.width}px;
    height: ${size.height}px;
    overflow: hidden;
    font-family: ${brand.fontPrimary};
    background: ${brand.backgroundColor};
    color: #f8fafc;
  }
  .canvas {
    width: ${size.width}px;
    height: ${size.height}px;
    padding: ${plan.format === 'linkedin_landscape' ? '48px 56px' : '64px 72px'};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background:
      radial-gradient(circle at top right, ${brand.primaryColor}33, transparent 42%),
      linear-gradient(160deg, ${brand.backgroundColor} 0%, #111827 100%);
    border: 2px solid ${brand.primaryColor}55;
  }
  .eyebrow {
    font-size: 22px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${brand.accentColor};
    font-weight: 700;
    margin-bottom: 28px;
  }
  .headline {
    font-size: ${plan.format === 'linkedin_landscape' ? '54px' : '64px'};
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.02em;
    max-width: 18ch;
  }
  .sub {
    margin-top: 24px;
    font-size: 28px;
    line-height: 1.35;
    color: #cbd5e1;
    max-width: 28ch;
    font-family: ${brand.fontSecondary};
  }
  .cta {
    display: inline-flex;
    align-items: center;
    margin-top: 36px;
    padding: 16px 28px;
    border-radius: 999px;
    background: ${brand.primaryColor};
    color: white;
    font-size: 24px;
    font-weight: 700;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 1px solid #334155;
    padding-top: 22px;
    margin-top: 28px;
  }
  .brand-name { font-size: 22px; font-weight: 700; color: #e2e8f0; }
  .brand-url { font-size: 18px; color: #94a3b8; }
  .list { margin-top: 28px; display: grid; gap: 14px; }
  .list-item {
    display: flex; gap: 14px; align-items: flex-start;
    font-size: 26px; line-height: 1.3; color: #e2e8f0;
  }
  .bullet {
    flex-shrink: 0; width: 28px; height: 28px; margin-top: 4px;
    border-radius: 999px; background: ${brand.accentColor};
  }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; }
  .panel {
    border-radius: 24px; padding: 28px; min-height: 220px;
    background: #0b1220cc; border: 1px solid #334155;
  }
  .panel h3 { font-size: 22px; color: ${brand.accentColor}; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.08em; }
  .panel p { font-size: 28px; line-height: 1.3; font-weight: 650; }
  .stat {
    font-size: 140px; line-height: 0.9; font-weight: 900; color: ${brand.accentColor};
    letter-spacing: -0.04em;
  }
  .quote {
    font-size: 48px; line-height: 1.2; font-weight: 700;
    max-width: 16ch;
  }
  .quote::before { content: "“"; color: ${brand.primaryColor}; margin-right: 4px; }
</style>
</head>
<body>
  <div class="canvas" data-template="${esc(template.templateKey)}" data-category="${esc(template.category)}">
    ${body}
    ${brandFooter(brand)}
  </div>
</body>
</html>`;
}

function brandPhotoShell(
  brand: ResolvedDistributionBrand,
  template: CreativeTemplateConfig,
  plan: CreativePlan,
  bgUri: string,
): string {
  const size = FORMAT_SIZES[plan.format];
  const isSol = template.templateKey.includes('sol');
  const purple = isSol ? '#6B21A8' : '#7C3AED';
  const headlineColor = isSol ? '#1e1b4b' : '#2e1065';
  const ctaText = plan.cta?.trim() || brand.defaultCta || 'Leer más';

  // Zonas calibradas al hueco blanco de cada fondo.
  const zones = isSol
    ? {
        textTop: '22%',
        textLeft: '4.5%',
        textWidth: '42%',
        headlineSize: 46,
        subSize: 22,
        ctaTop: '48%',
        ctaLeft: '4.5%',
      }
    : {
        textTop: '16%',
        textLeft: '5.5%',
        textWidth: '46%',
        headlineSize: 52,
        subSize: 24,
        ctaTop: '52%',
        ctaLeft: '5.5%',
      };

  const eyebrow = isSol ? 'SOL · AGENTES IA' : 'EMPLIADOS.NET';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${size.width}px;
    height: ${size.height}px;
    overflow: hidden;
    font-family: Inter, "Segoe UI", Arial, sans-serif;
    background: #fff;
  }
  .frame {
    position: relative;
    width: ${size.width}px;
    height: ${size.height}px;
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
  .text-zone {
    position: absolute;
    top: ${zones.textTop};
    left: ${zones.textLeft};
    width: ${zones.textWidth};
    z-index: 2;
  }
  .eyebrow {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 999px;
    background: ${isSol ? '#ede9fe' : 'transparent'};
    color: ${isSol ? purple : '#334155'};
    font-size: ${isSol ? 16 : 18}px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }
  .cover-cat {
    position: absolute;
    top: 12.5%;
    left: 5.5%;
    width: 42%;
    height: 36px;
    background: #ffffff;
    z-index: 1;
  }
  .headline {
    color: ${headlineColor};
    font-size: ${zones.headlineSize}px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .sub {
    margin-top: 16px;
    color: #475569;
    font-size: ${zones.subSize}px;
    line-height: 1.35;
    font-weight: 500;
    max-width: 28ch;
  }
  .cta {
    position: absolute;
    top: ${zones.ctaTop};
    left: ${zones.ctaLeft};
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    border-radius: 999px;
    background: linear-gradient(90deg, ${purple}, #9333ea);
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    box-shadow: 0 10px 28px ${purple}55;
  }
</style>
</head>
<body>
  <div class="frame" data-template="${esc(template.templateKey)}">
    <img class="bg" src="${bgUri}" alt="" />
    ${isSol ? '' : '<div class="cover-cat" aria-hidden="true"></div>'}
    <div class="text-zone">
      <div class="eyebrow">${esc(eyebrow)}</div>
      <div class="headline">${esc(plan.headline)}</div>
      ${plan.subheadline ? `<div class="sub">${esc(plan.subheadline)}</div>` : ''}
    </div>
    <div class="cta">${esc(ctaText)} →</div>
  </div>
</body>
</html>`;
}

export function buildCreativeHtml(
  brand: ResolvedDistributionBrand,
  template: CreativeTemplateConfig,
  plan: CreativePlan,
): string {
  if (template.layout === 'brand_photo_left' && template.backgroundAsset) {
    const bgUri = loadBackgroundDataUri(template.backgroundAsset);
    if (bgUri) {
      return brandPhotoShell(brand, template, plan, bgUri);
    }
    // Sin fondo: cae al tipográfico.
  }

  const cta = plan.cta ? `<div class="cta">${esc(plan.cta)}</div>` : '';

  if (template.layout === 'stat_focus') {
    return shell(
      brand,
      template,
      plan,
      `
      <div>
        <div class="eyebrow">${esc(brand.name)} · ${esc(template.category)}</div>
        <div class="stat">${esc(plan.statValue || '—')}</div>
        <div class="sub">${esc(plan.statLabel || plan.subheadline || '')}</div>
        ${plan.headline ? `<div class="headline" style="margin-top:28px;font-size:42px">${esc(plan.headline)}</div>` : ''}
        ${cta}
      </div>`,
    );
  }

  if (template.layout === 'quote_focus') {
    return shell(
      brand,
      template,
      plan,
      `
      <div>
        <div class="eyebrow">${esc(brand.name)} · insight</div>
        <div class="quote">${esc(plan.quote || plan.headline)}</div>
        ${plan.subheadline ? `<div class="sub">${esc(plan.subheadline)}</div>` : ''}
        ${cta}
      </div>`,
    );
  }

  if (template.layout === 'split_vertical') {
    return shell(
      brand,
      template,
      plan,
      `
      <div>
        <div class="eyebrow">${esc(template.category.replace('_', ' '))}</div>
        ${plan.headline ? `<div class="headline">${esc(plan.headline)}</div>` : ''}
        <div class="split">
          <div class="panel"><h3>A</h3><p>${esc(plan.leftLabel || '')}</p></div>
          <div class="panel"><h3>B</h3><p>${esc(plan.rightLabel || '')}</p></div>
        </div>
        ${cta}
      </div>`,
    );
  }

  if (template.layout === 'list_stack') {
    const items = (plan.bodyLines || [])
      .map((line) => `<div class="list-item"><span class="bullet"></span><span>${esc(line)}</span></div>`)
      .join('');
    return shell(
      brand,
      template,
      plan,
      `
      <div>
        <div class="eyebrow">${esc(template.category.replace('_', ' '))}</div>
        <div class="headline">${esc(plan.headline)}</div>
        <div class="list">${items}</div>
        ${cta}
      </div>`,
    );
  }

  if (template.layout === 'cta_band') {
    return shell(
      brand,
      template,
      plan,
      `
      <div style="display:flex;flex-direction:column;justify-content:center;flex:1">
        <div class="eyebrow">${esc(brand.name)}</div>
        <div class="headline">${esc(plan.headline)}</div>
        <div style="margin-top:40px">${cta}</div>
      </div>`,
    );
  }

  // center_stack + cover_hero + brand_photo fallback tipográfico
  return shell(
    brand,
    template,
    plan,
    `
    <div>
      <div class="eyebrow">${esc(brand.name)} · ${esc(template.category.replace(/_/g, ' '))}</div>
      <div class="headline">${esc(plan.headline)}</div>
      ${plan.subheadline ? `<div class="sub">${esc(plan.subheadline)}</div>` : ''}
      ${cta}
    </div>`,
  );
}
