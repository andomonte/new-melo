const nextConfig = {
  reactStrictMode: false,
  output: 'standalone', // Necessário para Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["oracledb", "puppeteer"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
      };
    }
    // 'canvas' é dependência OPCIONAL do qrcode (só usada no browser; no Node o
    // toDataURL usa PNG interno). Alias falso silencia o "Can't resolve 'canvas'".
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};

export default nextConfig;
