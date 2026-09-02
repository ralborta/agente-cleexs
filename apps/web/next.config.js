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
  async rewrites() {
    const api = (
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000'
    ).replace(/\/$/, '');
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/health', destination: `${api}/health` },
    ];
  },
};

module.exports = nextConfig;
