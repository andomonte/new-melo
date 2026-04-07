import { prisma } from '@/lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

function sanitizeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value))
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const {
      codvenda,
      nrovenda,
      codcli,
      data,
      total,
      // campos extras são ignorados aqui
    } = req.body;

    if (!codvenda || !nrovenda || !codcli || !data || total === undefined) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
    }

    try {
      const novaVenda = await prisma.dbvenda.create({
        data: {
          codvenda,
          nrovenda,
          codcli,
          data: new Date(data),
          total: parseFloat(total),
          tipo: 'P',
          status: '1',
          cancel: 'N',
        },
      });

      return res.status(201).json(sanitizeBigInt(novaVenda));
    } catch (error) {
      console.error('Erro ao cadastrar venda:', error);
      return res.status(500).json({ error: 'Erro ao cadastrar venda' });
    }
  }

  else if (req.method === 'PUT') {
    const {
      codvenda,
      nrovenda,
      codcli,
      data,
      total,
    } = req.body;

    if (!codvenda) {
      return res.status(400).json({ error: 'Código da venda é obrigatório' });
    }

    try {
      const vendaAtualizada = await prisma.dbvenda.update({
        where: { codvenda },
        data: {
          nrovenda,
          codcli,
          data: data ? new Date(data) : undefined,
          total: total !== undefined ? parseFloat(total) : undefined,
        },
      });

      return res.status(200).json(sanitizeBigInt(vendaAtualizada));
    } catch (error) {
      console.error('Erro ao atualizar venda:', error);
      return res.status(500).json({ error: 'Erro ao atualizar venda' });
    }
  }

  else if (req.method === 'DELETE') {
    const { codvenda } = req.query;

    if (!codvenda || typeof codvenda !== 'string') {
      return res.status(400).json({ error: 'Código da venda inválido' });
    }

    try {
      await prisma.dbvenda.delete({
        where: { codvenda },
      });

      return res.status(200).json({ message: 'Venda excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      return res.status(500).json({ error: 'Erro ao excluir venda' });
    }
  }

  else {
    return res.status(405).json({ error: 'Método não permitido' });
  }
}
