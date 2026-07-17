import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = process.env.BOT_SESSION_NAME || "cleexs";

function qrPath() {
  return join(process.cwd(), `${BOT_NAME}.qr.png`);
}

export function getSessionSnapshot(provider) {
  const host = provider?.globalVendorArgs?.host;
  const user = provider?.vendor?.user;
  const phone =
    host?.phone ?? (user?.id ? String(user.id).split(":").shift() : null);
  const path = qrPath();
  const qr_available = existsSync(path);
  let qr_updated_at = null;
  if (qr_available) {
    qr_updated_at = statSync(path).mtime.toISOString();
  }

  // Si hay QR fresco, la sesión no está lista aunque quede phone en memoria.
  const qrFresh =
    qr_available &&
    qr_updated_at &&
    Date.now() - new Date(qr_updated_at).getTime() < 3 * 60_000;

  let whatsapp = "disconnected";
  if (qrFresh) whatsapp = "awaiting_qr";
  else if (phone) whatsapp = "connected";
  else if (qr_available) whatsapp = "awaiting_qr";

  const connected = whatsapp === "connected";

  return {
    ok: true,
    service: "cleexs-baileys-bot",
    whatsapp,
    phone: connected ? phone ?? null : null,
    qr_available,
    qr_updated_at,
    auto_reconnect: true,
    reconnect_note:
      "Baileys intenta reconectar solo ante cortes de red. Si la sesión expiró, hay que escanear QR de nuevo. Evitá zero-downtime en wa-bot (conflicto de sesión).",
  };
}

export function readQrPng() {
  const path = qrPath();
  if (!existsSync(path)) return null;
  return readFileSync(path);
}
