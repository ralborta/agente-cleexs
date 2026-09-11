import { existsSync, readFileSync } from 'fs';
import path from 'path';

const CACHE = new Map<string, string>();

function candidates(filename: string): string[] {
  const cwd = process.cwd();
  return [
    path.join(__dirname, 'backgrounds', filename),
    path.join(cwd, 'src/lib/agents/growth/creative/templates/backgrounds', filename),
    path.join(cwd, 'apps/api/src/lib/agents/growth/creative/templates/backgrounds', filename),
    path.join(cwd, 'dist/lib/agents/growth/creative/templates/backgrounds', filename),
    path.join(cwd, 'apps/api/dist/lib/agents/growth/creative/templates/backgrounds', filename),
  ];
}

/** Data URI del fondo de marca (JPEG/PNG en templates/backgrounds). */
export function loadBackgroundDataUri(filename: string): string | null {
  const cached = CACHE.get(filename);
  if (cached) return cached;

  for (const candidate of candidates(filename)) {
    if (!existsSync(candidate)) continue;
    const buf = readFileSync(candidate);
    const mime = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const uri = `data:${mime};base64,${buf.toString('base64')}`;
    CACHE.set(filename, uri);
    return uri;
  }

  console.warn(`[creative] fondo no encontrado: ${filename}`);
  return null;
}
