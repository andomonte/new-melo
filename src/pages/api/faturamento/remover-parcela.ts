import { NextApiRequest, NextApiResponse } from 'next';
import { removerParcelaPagamento } from '@/utils/parcelasPagamento';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string' || isNaN(Number(id))) {
      return res.status(400).json({
        error: 'Parâmetro id é obrigatório e deve ser numérico'
      });
    }

    await removerParcelaPagamento(Number(id));

    return res.status(200).json({
      message: 'Parcela removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover parcela:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}