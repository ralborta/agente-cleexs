import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import agentRoutes from './routes/agents';
import missionRoutes from './routes/missions';
import approvalRoutes from './routes/approvals';
import centroRoutes from './routes/centro';
import configRoutes from './routes/config';
import resultsRoutes from './routes/results';
import contentRoutes from './routes/content';
import cronRoutes from './routes/cron';
import integrationRoutes from './routes/integrations';
import webhookRoutes from './routes/webhooks';
import whatsappRoutes from './routes/whatsapp';
import { startAutonomousScheduler } from './lib/job-scheduler';

async function bootstrap() {
  const server = Fastify({ logger: true });

  const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  await server.register(cors, {
    credentials: true,
    origin: allowedOrigins,
  });
  await server.register(helmet);

  server.get('/health', async () => ({
    status: 'ok',
    service: 'agente-api',
    autonomous: process.env.DISABLE_AUTONOMOUS !== 'true',
    timestamp: new Date().toISOString(),
  }));

  await server.register(agentRoutes, { prefix: '/api/agents' });
  await server.register(missionRoutes, { prefix: '/api/missions' });
  await server.register(approvalRoutes, { prefix: '/api/approvals' });
  await server.register(centroRoutes, { prefix: '/api/centro' });
  await server.register(configRoutes, { prefix: '/api/config' });
  await server.register(resultsRoutes, { prefix: '/api/results' });
  await server.register(contentRoutes, { prefix: '/api/content' });
  await server.register(cronRoutes, { prefix: '/api/cron' });
  await server.register(integrationRoutes, { prefix: '/api/integrations' });
  await server.register(webhookRoutes, { prefix: '/api/webhooks' });
  await server.register(whatsappRoutes, { prefix: '/api/whatsapp' });

  const port = Number(process.env.API_PORT || 4000);
  const host = '0.0.0.0';
  await server.listen({ port, host });
  server.log.info(`API escuchando en http://${host}:${port}`);

  if (process.env.DISABLE_AUTONOMOUS !== 'true') {
    startAutonomousScheduler();
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
