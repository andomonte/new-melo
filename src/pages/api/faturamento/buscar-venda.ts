// pages/api/faturamento/buscar-venda.ts

import { prisma } from '@/lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

function replacerBigInt(key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nrovenda } = req.query;

  if (!nrovenda || typeof nrovenda !== 'string') {
    return res.status(400).json({ error: 'Número da venda inválido' });
  }

  try {
    const venda = await prisma.dbvenda.findFirst({
      where: {
        nrovenda,
      },
      include: {
        dbclien: true,
      },
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    // Corrige BigInt serializando com JSON.parse/stringify e replacer
    const jsonSafe = JSON.parse(JSON.stringify(venda, replacerBigInt));

    res.status(200).json(jsonSafe);
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
}
