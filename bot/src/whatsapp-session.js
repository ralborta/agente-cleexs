import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = process.env.BOT_SESSION_NAME || "cleexs";

function qrPath() {
  return join(process.cwd(), `${BOT_NAME}.qr.png`);
}

function sessionsDir() {
  return join(process.cwd(), `${BOT_NAME}_sessions`);
}

/** Teléfono desde creds.json (preferido) o device-list-54911….json. */
function phoneFromSessionFiles() {
  const dir = sessionsDir();
  if (!existsSync(dir)) return null;
  try {
    const credsPath = join(dir, "creds.json");
    if (existsSync(credsPath)) {
      const creds = JSON.parse(readFileSync(credsPath, "utf8"));
      const id = creds?.me?.id ? String(creds.me.id).split(":")[0] : "";
      const digits = id.replace(/\D/g, "");
      if (digits.length >= 9) return digits;
    }
    // Fallback: primer device-list (puede haber residuos de contactos).
    const hit = readdirSync(dir).find((f) => /^device-list-\d+\.json$/i.test(f));
    if (!hit) return null;
    const digits = hit.replace(/^device-list-/i, "").replace(/\.json$/i, "");
    return digits.length >= 9 ? digits : null;
  } catch {
    return null;
  }
}

function hasSessionCreds() {
  return existsSync(join(sessionsDir(), "creds.json"));
}

export function getSessionSnapshot(provider) {
  const host = provider?.globalVendorArgs?.host;
  const user = provider?.vendor?.user;
  const phoneFromProvider =
    host?.phone ?? (user?.id ? String(user.id).split(":").shift() : null);
  const phoneFromDisk = phoneFromSessionFiles();
  const phone = phoneFromProvider || phoneFromDisk || null;

  const path = qrPath();
  const qr_available = existsSync(path);
  let qr_updated_at = null;
  if (qr_available) {
    qr_updated_at = statSync(path).mtime.toISOString();
  }

  const creds = hasSessionCreds();
  // Si hay creds + teléfono, la sesión está viva aunque quede un PNG de QR viejo.
  const connected = Boolean(creds && phone);

  let whatsapp = "disconnected";
  if (connected) whatsapp = "connected";
  else if (qr_available || !creds) whatsapp = "awaiting_qr";

  return {
    ok: true,
    service: "cleexs-baileys-bot",
    whatsapp,
    phone: connected ? phone : null,
    qr_available: connected ? false : qr_available,
    qr_updated_at: connected ? null : qr_updated_at,
    auto_reconnect: true,
    reconnect_note:
      "Baileys intenta reconectar solo ante cortes de red. Si la sesión expiró, hay que escanear QR de nuevo. Evitá zero-downtime en wa-bot (conflicto de sesión).",
  };
}

export function readQrPng() {
  // No servir QR si ya hay sesión activa (evita re-escaneos / doble vínculo).
  if (hasSessionCreds() && phoneFromSessionFiles()) return null;
  const path = qrPath();
  if (!existsSync(path)) return null;
  return readFileSync(path);
}
