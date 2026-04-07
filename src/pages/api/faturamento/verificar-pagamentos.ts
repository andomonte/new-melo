import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat } = req.query;

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: 'Código da fatura é obrigatório.' });
  }

  try {
    const client = await getPgPool().connect();

    // Verifica se existem parcelas não canceladas com data de pagamento ou valor pago
    const query = `
      SELECT COUNT(*) as total_pagamentos
      FROM dbreceb
      WHERE cod_fat = $1
        AND (cancel IS NULL OR cancel != 'S')
        AND (dt_pgto IS NOT NULL OR (valor_pgto IS NOT NULL AND valor_pgto > 0))
    `;

    const result = await client.query(query, [codfat]);
    const temPagamentos = parseInt(result.rows[0].total_pagamentos) > 0;

    client.release();

    res.status(200).json({
      temPagamentos,
      totalPagamentos: parseInt(result.rows[0].total_pagamentos),
    });
  } catch (error) {
    console.error('Erro ao verificar pagamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
