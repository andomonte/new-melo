/**
 * GET /api/externo/manifest?c=<codigo_filial>
 * Manifesto do app instalável da Venda Externa por filial: o ícone na tela do celular
 * abre direto em /externo/<codigo> (sem passar pelo login/menu do sistema).
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const c = String(req.query.c || '1').replace(/\D/g, '') || '1';
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(
    JSON.stringify({
      name: 'Venda Externa — Melo',
      short_name: 'Venda Melo',
      description: 'Vendas externas da Melo Peças (celular e tablet, com ou sem internet)',
      id: `/externo/${c}`,
      start_url: `/externo/${c}`,
      scope: '/externo',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f8fafc',
      theme_color: '#1e3a5f',
      lang: 'pt-BR',
      icons: [
        { src: '/images/externo-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/images/externo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/images/externo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }),
  );
}
