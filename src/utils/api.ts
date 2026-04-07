// Funções utilitárias para APIs
export function getBaseUrl(): string {
  // Em produção (Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Em desenvolvimento ou outras plataformas
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Fallback para localhost (apenas desenvolvimento)
  return 'http://localhost:3000';
}

// Função para obter a URL completa de uma API
export function getApiUrl(endpoint: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}
