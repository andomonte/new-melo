const nextConfig = {
  reactStrictMode: false,
  output: 'standalone', // Necessário para Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Aumentar limite de resposta das API Routes para 10MB (padrão é 4MB)
  api: {
    responseLimit: '10mb',
  },
  experimental: {
    serverComponentsExternalPackages: ["oracledb"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
      };
    }
    return config;
  },
};

export default nextConfig;
