import { createBot, createProvider, createFlow, addKeyword, EVENTS } from "@builderbot/bot";
import { JsonFileDB as Database } from "@builderbot/database-json";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { forwardToAgente, mountFileRoutes } from "./agente-api.js";
import { getSessionSnapshot, readQrPng } from "./whatsapp-session.js";

const PORT = Number(process.env.PORT ?? 3008);
const SESSION_NAME = process.env.BOT_SESSION_NAME?.trim() || "cleexs";
const PUBLIC_BASE =
  process.env.BOT_PUBLIC_URL?.trim() || `http://127.0.0.1:${PORT}`;

const agenteHandler = async (ctx, { provider, fallBack }) => {
  try {
    const result = await forwardToAgente(ctx, provider, { publicBaseUrl: PUBLIC_BASE });
    if (result?.message && typeof result.message === "string" && result.message.trim()) {
      return result.message;
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
    const buf = readQrPng();
    if (!buf?.length) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "QR no disponible aún" }));
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });

  adapterProvider.server.get("/", (_req, res) => {
    const buf = readQrPng();
    if (!buf?.length) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        "<html><body><p>QR no listo. Si WhatsApp está desconectado, esperá unos segundos y recargá.</p></body></html>",
      );
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });

  httpServer(PORT);
  console.log(`[cleexs-wa-bot] WhatsApp Baileys escuchando en :${PORT}`);
  console.log(`[cleexs-wa-bot] API Agente → ${process.env.AGENTE_API_URL || "http://localhost:4000"}`);
};

main().catch((err) => {
  console.error("[cleexs-wa-bot] fatal:", err);
  process.exit(1);
});
