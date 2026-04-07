// src/pages/api/requisicoesCompra/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const rawFilter = req.query.filter;
  const filter =
    typeof rawFilter === 'string'
      ? rawFilter
      : Array.isArray(rawFilter)
      ? rawFilter[0]
      : '';

  // usa o tipo certo e os campos reais do modelo cmp_requisicao
  const where: any = filter
    ? {
        OR: [
          { req_id_composto: { contains: filter, mode: 'insensitive' } },
          { req_cod_credor: { contains: filter, mode: 'insensitive' } },
          { req_codcomprador: { contains: filter, mode: 'insensitive' } },
        ],
      }
    : {};

  try {
    // Return empty data for now since this API isn't properly configured
    const data: any[] = [];
    res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao buscar requisições:', error);
    res.status(500).json({
      error: 'Erro ao buscar requisições de compra.',
      details: (error as Error).message,
    });
  }
}
