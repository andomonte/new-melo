/**
 * POST /api/importacao/[id]/reverter-fatura
 *
 * Reverte (APAGA) a fatura da nota de nacionalização quando a emissão NÃO foi
 * autorizada (rejeição da SEFAZ), para a DI voltar ao estado re-emitível — assim a
 * próxima tentativa gera uma fatura nova (numeração MAX+1, gap permitido, igual ao
 * faturamento atual).
 *
 * Guardas (crítico): só reverte se a fatura (a) pertence a ESTA DI (importacao_id) e
 * (b) NÃO está autorizada — se houver qualquer dbfat_nfe status '100', a nota existe
 * na SEFAZ e NÃO pode ser apagada (caso de duplicidade/autorizada): responde 409 para
 * o front tratar pela Consulta de Faturas.
 *
 * Apaga, nesta ordem (FKs): dbfat_nfe → dbprodfat → fatura_venda → dbitvenda →
 * dbfatura → dbvenda (o inverso do que gerarFaturaNacionalizacao cria).
 *
 * Body: { codfat }  ·  Resposta: { revertido: boolean, autorizada?: boolean }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const importacaoId = parseInt(String(req.query.id), 10);
  const codfat = String(req.body?.codfat || '').trim();
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });
  if (!codfat) return res.status(400).json({ message: 'codfat não informado' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const schema = (await client.query('SELECT current_schema() AS s')).rows[0].s;

    // (a) a fatura é desta DI?
    const fat = await client.query(
      `SELECT codfat FROM ${schema}.dbfatura WHERE codfat = $1 AND importacao_id = $2`,
      [codfat, importacaoId],
    );
    if (fat.rows.length === 0) {
      return res.status(404).json({ revertido: false, message: 'Fatura não encontrada para esta DI.' });
    }

    // (b) autorizada? (algum dbfat_nfe status 100) → não reverter
    const autorizada = await client.query(
      `SELECT 1 FROM ${schema}.dbfat_nfe WHERE codfat = $1 AND status = '100' LIMIT 1`,
      [codfat],
    );
    if (autorizada.rows.length > 0) {
      return res.status(409).json({
        revertido: false,
        autorizada: true,
        message: 'Fatura autorizada na SEFAZ — não pode ser revertida. Trate pela Consulta de Faturas.',
      });
    }

    const fv = await client.query(
      `SELECT codvenda FROM ${schema}.fatura_venda WHERE codfat = $1`,
      [codfat],
    );
    const codvenda = fv.rows[0]?.codvenda ? String(fv.rows[0].codvenda) : null;

    await client.query('BEGIN');
    await client.query(`DELETE FROM ${schema}.dbfat_nfe WHERE codfat = $1`, [codfat]);
    await client.query(`DELETE FROM ${schema}.dbprodfat WHERE codfat = $1`, [codfat]);
    await client.query(`DELETE FROM ${schema}.fatura_venda WHERE codfat = $1`, [codfat]);
    if (codvenda) await client.query(`DELETE FROM ${schema}.dbitvenda WHERE codvenda = $1`, [codvenda]);
    await client.query(`DELETE FROM ${schema}.dbfatura WHERE codfat = $1`, [codfat]);
    if (codvenda) await client.query(`DELETE FROM ${schema}.dbvenda WHERE codvenda = $1`, [codvenda]);
    await client.query('COMMIT');

    return res.status(200).json({ revertido: true, codfat, codvenda });
  } catch (e: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[reverter-fatura] erro:', e);
    return res.status(500).json({ revertido: false, message: e.message || 'Erro ao reverter a fatura' });
  } finally {
    if (client) client.release();
  }
}
