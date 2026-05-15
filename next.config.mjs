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
