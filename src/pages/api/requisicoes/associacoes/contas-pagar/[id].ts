import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Buscar contas a pagar associadas à requisição
      const contas = await prisma.$queryRaw`
        SELECT
          cp.id,
          cp.titulo_numero,
          cp.valor,
          cp.data_vencimento,
          cp.parcela,
          cp.status,
          cp.observacoes,
          cp.data_pagamento,
          cp.created_at
        FROM contas_pagar cp
        WHERE cp.requisicao_id = ${id}
        ORDER BY cp.parcela, cp.data_vencimento
      ` as any[];

      res.status(200).json({
        success: true,
        contas
      });

    } catch (error) {
      console.error('Erro ao buscar contas a pagar:', error);
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }

  await prisma.$disconnect();
}