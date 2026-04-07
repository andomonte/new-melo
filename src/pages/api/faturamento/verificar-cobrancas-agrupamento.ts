import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfats } = req.body;

  if (!codfats || !Array.isArray(codfats) || codfats.length === 0) {
    return res.status(400).json({ error: 'Lista de faturas é obrigatória.' });
  }

  const client = await getPgPool().connect();

  try {
    // Verificar se todas as faturas pertencem ao mesmo cliente
    const faturasQuery = `
      SELECT codfat, codcli, cobranca
      FROM dbfatura
      WHERE codfat = ANY($1)
    `;
    const faturasResult = await client.query(faturasQuery, [codfats]);

    if (faturasResult.rows.length !== codfats.length) {
      return res
        .status(400)
        .json({ error: 'Uma ou mais faturas não foram encontradas.' });
    }

    // Verificar se todas as faturas pertencem ao mesmo cliente
    const clientes = [...new Set(faturasResult.rows.map((f) => f.codcli))];
    if (clientes.length > 1) {
      return res
        .status(400)
        .json({ error: 'Todas as faturas devem pertencer ao mesmo cliente.' });
    }

    // Verificar se alguma fatura já tem cobrança gerada e foi paga
    const faturasComCobranca = faturasResult.rows.filter(
      (f) => f.cobranca === 'S',
    );
    if (faturasComCobranca.length > 0) {
      // Verificar se as cobranças foram pagas
      const codfatsComCobranca = faturasComCobranca.map((f) => f.codfat);
      const cobrancasQuery = `
        SELECT cod_fat, dt_pgto
        FROM dbreceb
        WHERE cod_fat = ANY($1) AND cancel = 'N' AND dt_pgto IS NOT NULL
      `;
      const cobrancasResult = await client.query(cobrancasQuery, [
        codfatsComCobranca,
      ]);

      if (cobrancasResult.rows.length > 0) {
        return res.status(200).json({
          sucesso: false,
          error: 'Não é possível agrupar faturas com cobranças já pagas.',
          cobrancasPagas: cobrancasResult.rows,
        });
      }
    }

    return res.status(200).json({
      sucesso: true,
      message: 'Faturas válidas para agrupamento.',
      faturas: faturasResult.rows,
    });
  } catch (error) {
    console.error('Erro ao verificar cobranças para agrupamento:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao verificar cobranças para agrupamento.' });
  } finally {
    client.release();
  }
}
