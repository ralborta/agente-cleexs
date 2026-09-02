/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@agente/shared'],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'agente-cleexs.nivel41.com',
        'agente-cleexs-web.wd75db.easypanel.host',
        'agents.cleexs.net',
      ],
    },
  },
};

module.exports = nextConfig;
