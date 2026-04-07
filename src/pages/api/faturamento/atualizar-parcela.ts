import { NextApiRequest, NextApiResponse } from 'next';
import { atualizarParcelaPagamento } from '@/utils/parcelasPagamento';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { id, dia } = req.body;

    if (!id || typeof id !== 'number') {
      return res.status(400).json({
        error: 'Parâmetro id é obrigatório e deve ser numérico'
      });
    }

    if (typeof dia !== 'number' || dia < 0) {
      return res.status(400).json({
        error: 'Parâmetro dia é obrigatório e deve ser numérico positivo'
      });
    }

    // Atualiza a parcela e recalcula automaticamente a data de vencimento
    await atualizarParcelaPagamento(id, dia);

    return res.status(200).json({
      message: 'Parcela atualizada com sucesso. Data de vencimento recalculada automaticamente.'
    });
  } catch (error) {
    console.error('Erro ao atualizar parcela:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}