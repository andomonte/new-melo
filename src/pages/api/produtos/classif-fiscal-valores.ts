import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Retorna os conjuntos de valores fiscais (IPI, PIS, COFINS, MVA/agregado)
 * associados a uma Classificação Fiscal (NCM), lidos de dbclassificacao_fiscal.
 * Usa DISTINCT: linhas repetidas com os mesmos valores viram um único
 * conjunto; se o NCM tiver valores divergentes, retorna mais de um conjunto
 * para o usuário escolher.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const ncm = String(req.query.ncm ?? '').trim();
  if (!ncm) {
    return res.status(200).json({ valores: [] });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT
              COALESCE(ipi, 0)      AS ipi,
              COALESCE(pis, 0)      AS pis,
              COALESCE(cofins, 0)   AS cofins,
              COALESCE(agregado, 0) AS agregado,
              descricao
         FROM dbclassificacao_fiscal
        WHERE ncm = $1
        ORDER BY ipi, pis, cofins, agregado`,
      [ncm],
    );

    return res.status(200).json({ valores: serializeBigInt(result.rows) });
  } catch (error: any) {
    console.error('Erro ao buscar valores da classificação fiscal:', error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
