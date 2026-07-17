import { createBot, createProvider, createFlow, addKeyword, EVENTS } from "@builderbot/bot";
import { JsonFileDB as Database } from "@builderbot/database-json";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { forwardToAgente, mountFileRoutes } from "./agente-api.js";
import { getSessionSnapshot, readQrPng } from "./whatsapp-session.js";

const PORT = Number(process.env.PORT ?? 3008);
const SESSION_NAME = process.env.BOT_SESSION_NAME?.trim() || "cleexs";
const PUBLIC_BASE =
  process.env.BOT_PUBLIC_URL?.trim() || `http://127.0.0.1:${PORT}`;

/**
 * Patrón Andreu Baileys:
 * - bot reenvía al webhook de la API
 * - la API decide y devuelve { message }
 * - acá se entrega con flowDynamic (mismo socket que recibió el mensaje)
 *
 * Nota: POST /v1/messages queda para envíos async (scores, etc.).
 */
const agenteHandler = async (ctx, { provider, fallBack, flowDynamic }) => {
  try {
    const result = await forwardToAgente(ctx, provider, { publicBaseUrl: PUBLIC_BASE });
    const text =
      result?.message && typeof result.message === "string" ? result.message.trim() : "";
    if (text) {
      await flowDynamic(text);
      return;
    }
    if (result?.code === "assistant_unavailable") {
      await flowDynamic(
        "🙂 Solo puedo ayudarte con Cleexs y tu visibilidad en IA. Pasame la URL de tu empresa (ej. empresa.com).",
      );
    }
  } catch (err) {
    console.error("[cleexs-wa-bot] forward error:", err.message);
    return fallBack(
      "Hubo un problema al procesar tu mensaje. Probá de nuevo en unos segundos.",
    );
  }
};

const agenteFlows = [
  EVENTS.WELCOME,
  EVENTS.MEDIA,
  EVENTS.VOICE_NOTE,
  EVENTS.LOCATION,
  EVENTS.ACTION,
].map((ev) => addKeyword(ev).addAction(agenteHandler));

const main = async () => {
  const adapterFlow = createFlow(agenteFlows);
  const adapterProvider = createProvider(Provider, {
    name: SESSION_NAME,
    version: [2, 3000, 1035824857],
    groupsIgnore: true,
  });
  const adapterDB = new Database({ filename: process.env.BOT_DB_PATH || "db.json" });

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  mountFileRoutes(adapterProvider.server);

  async function sendComposing(number) {
    const phone = String(number ?? "").replace(/\D/g, "");
    if (phone.length < 9) return false;
    const jid = `${phone}@s.whatsapp.net`;
    await adapterProvider.sendPresenceUpdate(jid, "composing");
    return true;
  }

  adapterProvider.server.post("/v1/typing", async (req, res) => {
    const { number } = req.body ?? {};
    try {
      const ok = await sendComposing(number);
      if (!ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "number inválido" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    } catch (err) {
      console.error("[cleexs-wa-bot] typing error:", err.message);
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message || "WhatsApp no conectado" }));
    }
  });

  /** Envío async desde la API (mismo contrato Andreu). */
  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body ?? {};
      await bot.sendMessage(number, message || " ", { media: urlMedia ?? null });
      return res.end(JSON.stringify({ status: "ok" }));
    }),
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body ?? {};
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    }),
  );

  adapterProvider.server.get("/health", (_req, res) => {
    const snap = getSessionSnapshot(adapterProvider);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snap));
  });

  adapterProvider.server.get("/v1/whatsapp/status", (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getSessionSnapshot(adapterProvider)));
  });

  adapterProvider.server.get("/v1/whatsapp/qr", (_req, res) => {
    const snap = getSessionSnapshot(adapterProvider);
    if (snap.whatsapp === "connected") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ ok: false, error: "Ya conectado — no hay QR (no re-escanees)." }),
      );
    }
    const buf = readQrPng();
    if (!buf?.length) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "QR no disponible aún" }));
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    });
    res.end(buf);
  });

  /**
   * Página HTML con QR auto-actualizable.
   * NO usar "/" — Baileys Provider pisa "/" con el PNG crudo (QR estático / viejo).
   */
  const sendQrPage = (_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cleexs WhatsApp — QR</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    .ok { color: #0a7a2f; font-weight: 600; }
    .warn { color: #a15c00; font-weight: 600; }
    .bad { color: #b00020; font-weight: 600; }
    img { width: 280px; height: 280px; display: block; margin: 1rem 0; border: 1px solid #ddd; }
    ul { padding-left: 1.2rem; line-height: 1.45; }
  </style>
</head>
<body>
  <h1>Cleexs WhatsApp</h1>
  <p id="status">Cargando estado…</p>
  <img id="qr" alt="QR WhatsApp" hidden />
  <ul>
    <li>Escaneá <strong>solo el QR que ves ahora</strong> (se renueva solo).</li>
    <li>Si tarda &gt; 40 s, <strong>esperá el QR nuevo</strong>; no uses uno viejo.</li>
    <li>Cuando diga conectado, <strong>no vuelvas a escanear</strong>.</li>
    <li>No uses el PNG de la raíz <code>/</code> ni el QR del admin Cleexs.</li>
  </ul>
  <script>
    const statusEl = document.getElementById('status');
    const qrEl = document.getElementById('qr');
    let lastQrAt = null;

    async function tick() {
      try {
        const res = await fetch('/v1/whatsapp/status?t=' + Date.now(), { cache: 'no-store' });
        const s = await res.json();
        if (s.whatsapp === 'connected') {
          statusEl.className = 'ok';
          statusEl.textContent = 'Conectado: ' + (s.phone || 'OK') + ' — no escanees otro QR.';
          qrEl.hidden = true;
          qrEl.removeAttribute('src');
          return;
        }
        if (s.qr_available) {
          const ageSec = s.qr_updated_at
            ? Math.max(0, Math.round((Date.now() - new Date(s.qr_updated_at).getTime()) / 1000))
            : null;
          if (ageSec != null && ageSec > 50) {
            statusEl.className = 'bad';
            statusEl.textContent = 'QR vencido (~' + ageSec + 's). Esperá el nuevo; no escanees este.';
          } else {
            statusEl.className = 'warn';
            statusEl.textContent = 'Escaneá este QR ya' + (ageSec != null ? ' (edad ' + ageSec + 's)' : '') + '.';
          }
          if (s.qr_updated_at !== lastQrAt) {
            lastQrAt = s.qr_updated_at;
            qrEl.hidden = false;
            qrEl.src = '/v1/whatsapp/qr?t=' + encodeURIComponent(s.qr_updated_at || Date.now());
          }
        } else {
          statusEl.className = 'warn';
          statusEl.textContent = 'Esperando QR…';
          qrEl.hidden = true;
        }
      } catch (e) {
        statusEl.className = 'bad';
        statusEl.textContent = 'No pude leer el estado del bot.';
      }
    }
    tick();
    setInterval(tick, 2500);
  </script>
</body>
</html>`);
  };
  adapterProvider.server.get("/vincular", sendQrPage);
  adapterProvider.server.get("/qr", sendQrPage);

  httpServer(PORT);
  console.log(`[cleexs-wa-bot] WhatsApp Baileys escuchando en :${PORT}`);
  console.log(`[cleexs-wa-bot] API Agente → ${process.env.AGENTE_API_URL || "http://localhost:4000"}`);
};

main().catch((err) => {
  console.error("[cleexs-wa-bot] fatal:", err);
  process.exit(1);
});
