import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { CreativePlan, CreativeTemplateConfig, ResolvedDistributionBrand } from './types';
import { FORMAT_SIZES } from './types';
import { buildCreativeHtml } from './templates/layouts';

export type RenderResult = {
  filePath: string;
  absolutePath: string;
  mimeType: string;
  width: number;
  height: number;
  html: string;
  engine: 'playwright' | 'svg_fallback';
};

function assetsRoot(): string {
  return process.env.CREATIVE_ASSETS_DIR?.trim() || path.join(process.cwd(), '.creative-assets');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSvgFallback(
  brand: ResolvedDistributionBrand,
  plan: CreativePlan,
): { svg: string; width: number; height: number } {
  const { width, height } = FORMAT_SIZES[plan.format];
  const headline = escapeXml(plan.headline);
  const sub = escapeXml(plan.subheadline || plan.statLabel || '');
  const cta = escapeXml(plan.cta || '');
  return {
    width,
    height,
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.backgroundColor}"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="28" fill="none" stroke="${brand.primaryColor}" stroke-opacity="0.45" stroke-width="3"/>
  <text x="72" y="110" fill="${brand.accentColor}" font-size="28" font-family="Arial, sans-serif" font-weight="700">${escapeXml(brand.name.toUpperCase())}</text>
  <foreignObject x="72" y="160" width="${width - 144}" height="${height - 320}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#f8fafc">
      <div style="font-size:54px;font-weight:800;line-height:1.1">${headline}</div>
      <div style="margin-top:20px;font-size:26px;color:#cbd5e1;line-height:1.35">${sub}</div>
    </div>
  </foreignObject>
  <rect x="72" y="${height - 140}" rx="28" width="${Math.min(360, 28 + cta.length * 14)}" height="56" fill="${brand.primaryColor}"/>
  <text x="96" y="${height - 102}" fill="#fff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${cta}</text>
</svg>`,
  };
}

async function renderWithPlaywright(
  html: string,
  width: number,
  height: number,
  absolutePath: string,
): Promise<boolean> {
  try {
    // Dynamic import: si no está instalado, fallback SVG.
    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.screenshot({ path: absolutePath, type: 'png' });
      return true;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.warn(
      '[creative] playwright render falló, uso SVG fallback:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function renderCreativeAsset(params: {
  workspaceSlug: string;
  requestId: string;
  brand: ResolvedDistributionBrand;
  template: CreativeTemplateConfig;
  plan: CreativePlan;
}): Promise<RenderResult> {
  const { width, height } = FORMAT_SIZES[params.plan.format];
  const html = buildCreativeHtml(params.brand, params.template, params.plan);
  const hash = createHash('sha1')
    .update(`${params.requestId}:${params.plan.templateKey}:${params.plan.headline}`)
    .digest('hex')
    .slice(0, 12);

  const dir = path.join(assetsRoot(), params.workspaceSlug, params.requestId);
  await mkdir(dir, { recursive: true });

  const pngRel = path.join(params.workspaceSlug, params.requestId, `${hash}.png`);
  const pngAbs = path.join(assetsRoot(), pngRel);
  const ok = await renderWithPlaywright(html, width, height, pngAbs);
  if (ok) {
    await writeFile(path.join(dir, `${hash}.html`), html, 'utf8');
    return {
      filePath: pngRel,
      absolutePath: pngAbs,
      mimeType: 'image/png',
      width,
      height,
      html,
      engine: 'playwright',
    };
  }

  const svgRel = path.join(params.workspaceSlug, params.requestId, `${hash}.svg`);
  const svgAbs = path.join(assetsRoot(), svgRel);
  const svg = buildSvgFallback(params.brand, params.plan);
  await writeFile(svgAbs, svg.svg, 'utf8');
  await writeFile(path.join(dir, `${hash}.html`), html, 'utf8');
  return {
    filePath: svgRel,
    absolutePath: svgAbs,
    mimeType: 'image/svg+xml',
    width,
    height,
    html,
    engine: 'svg_fallback',
  };
}

export function resolveAssetAbsolutePath(filePath: string): string {
  return path.join(assetsRoot(), filePath);
}
