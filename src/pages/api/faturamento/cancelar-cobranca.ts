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

    try {
      // 🛡️ REGRA (espelha o Delphi — título rec='S'): NÃO cancelar cobrança que já
      // possui parcela PAGA. Marcador de pago no web: dt_pgto ou valor_pgto > 0.
      const pagas = await client.query(
        `SELECT COUNT(*)::int AS n
           FROM dbreceb
          WHERE cod_fat = $1
            AND (cancel IS NULL OR cancel <> 'S')
            AND (dt_pgto IS NOT NULL OR (valor_pgto IS NOT NULL AND valor_pgto > 0))`,
        [codfat],
      );
      const qtdPagas = pagas.rows[0]?.n ?? 0;
      if (qtdPagas > 0) {
        return res.status(409).json({
          error: `Cobrança não pode ser cancelada: já possui ${qtdPagas} parcela(s) paga(s).`,
        });
      }

      // Atualiza o campo 'cobranca' na fatura para 'N'
      await client.query(
        `UPDATE dbfatura
         SET cobranca = 'N'
         WHERE codfat = $1`,
        [codfat],
      );

      // Marca as parcelas (não pagas) como canceladas
      await client.query(
        `UPDATE dbreceb
         SET cancel = 'S'
         WHERE cod_fat = $1`,
        [codfat],
      );

      return res.status(200).json({ message: 'Cobrança cancelada com sucesso.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao cancelar cobrança:', error);
    return res.status(500).json({ error: 'Erro ao cancelar cobrança.' });
  }
}
