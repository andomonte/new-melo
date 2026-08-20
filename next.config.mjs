import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Versão do sistema mostrada na tela de login — para conferir se o deploy está atualizado.
// Prioridade: build-arg GIT_SHA (deploy) → git local (dev; no Docker o .git é ignorado) →
// versão do package.json. O BUILD_TIME é gerado AGORA (na hora do build) e é o indicador
// mais confiável de "está atualizado": a cada rebuild ele muda.
function resolverVersao() {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 8);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* .git ausente (Docker) — cai no package.json */
  }
  try {
    return JSON.parse(readFileSync('./package.json', 'utf8')).version || 'dev';
  } catch {
    return 'dev';
  }
}

const APP_VERSION = resolverVersao();
const BUILD_TIME = new Date().toISOString();

const nextConfig = {
  reactStrictMode: false,
  output: 'standalone', // Necessário para Docker
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },
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
