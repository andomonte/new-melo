import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat } = req.body;

  if (!codfat) {
    return res.status(400).json({ error: 'Código da fatura é obrigatório.' });
  }

  try {
    const client = await getPgPool().connect();

    // Atualiza o campo 'cobranca' na fatura para 'N'
    await client.query(
      `UPDATE dbfatura
       SET cobranca = 'N'
       WHERE codfat = $1`,
      [codfat],
    );

    // Marca as parcelas como canceladas
    await client.query(
      `UPDATE dbreceb
       SET cancel = 'S'
       WHERE cod_fat = $1`,
      [codfat],
    );

    client.release();

    return res.status(200).json({ message: 'Cobrança cancelada com sucesso.' });
  } catch (error) {
    console.error('Erro ao cancelar cobrança:', error);
    return res.status(500).json({ error: 'Erro ao cancelar cobrança.' });
  }
}
