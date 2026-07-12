import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Resolve um NCM na tabela db_manaus.dbclassificacao_fiscal e devolve PIS,
 * COFINS e AGREGADO (MVA) — usado pelo "Aplicar a todos" da Classificação
 * Fiscal em "Alterar Campos Lista" (equivale ao dmConsulta.Consulta_Codigo(26)
 * do Delphi, que preenche PIS/COFINS/PercSubst a partir do NCM).
 *
 * GET /api/produtos/resolver-ncm?ncm=85158090
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const ncmDigitos =
    typeof req.query.ncm === 'string' ? req.query.ncm.replace(/\D/g, '') : '';

  if (ncmDigitos.length < 8) {
    return res.status(400).json({ error: 'NCM inválido' });
  }

  const client = await getPgPool().connect();
  try {
    // compara só os dígitos, tolerando NCM gravado com ou sem pontuação
    const r = await client.query(
      `SELECT ncm, ipi, pis, cofins, agregado, descricao
         FROM db_manaus.dbclassificacao_fiscal
        WHERE regexp_replace(ncm, '\\D', '', 'g') = $1
        LIMIT 1`,
      [ncmDigitos],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'NCM não localizado' });
    }
    const row = r.rows[0];
    res.status(200).json({
      ncm: ncmDigitos,
      pis: Number(row.pis) || 0,
      cofins: Number(row.cofins) || 0,
      agregado: Number(row.agregado) || 0,
      ipi: Number(row.ipi) || 0,
      descricao: row.descricao || '',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
