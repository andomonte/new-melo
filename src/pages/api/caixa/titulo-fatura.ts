import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/caixa/titulo-fatura?codfat=
 * Retorna o título em aberto (dbreceb) gerado pela fatura, para o Caixa dar baixa
 * logo após faturar a pré-venda. Escolhe o título não recebido/não cancelado.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const codfat = String(req.query.codfat || '').trim();
  if (!codfat) return res.status(400).json({ erro: 'Informe codfat.' });
  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `SELECT cod_receb, codcli, valor_pgto, valor_rec, forma_fat, dt_venc, rec
         FROM db_manaus.dbreceb
        WHERE cod_fat = $1 AND COALESCE(rec,'N') = 'N' AND COALESCE(cancel,'N') = 'N'
        ORDER BY cod_receb
        LIMIT 1`,
      [codfat],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ erro: 'Título da fatura não encontrado (ou já recebido).' });
    }
    const t = r.rows[0];
    return res.status(200).json({
      cod_receb: t.cod_receb,
      codcli: t.codcli,
      valor_pgto: Number(t.valor_pgto || 0),
      valor_rec: Number(t.valor_rec || 0),
      forma_fat: t.forma_fat,
      dt_venc: t.dt_venc,
    });
  } catch (error: any) {
    console.error('Erro ao buscar título da fatura:', error);
    return res.status(500).json({ erro: 'Erro ao buscar título da fatura', detalhes: error.message });
  } finally {
    client.release();
  }
}
