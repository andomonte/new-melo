import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/validar-gp?codgp=X
 *
 * Espelha TCOBRANCA.VALIDA_COBRANCA_GP — diz se o GP ainda é OPERÁVEL (pode alterar
 * prazo / remover fatura / desagrupar). Usado pela UI para validar ANTES de abrir a tela
 * e já mostrar o motivo, em vez de deixar o usuário chegar no fim e tomar erro.
 *
 * Retorna { operavel: boolean, motivo: string | null }.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const codgp = String(req.query.codgp || '').trim();
  if (!codgp) return res.status(400).json({ erro: 'Informe o codgp.' });

  const client = await getPgPool().connect();
  try {
    const val = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE bradesco='S') AS registrados,
         COUNT(*) FILTER (WHERE COALESCE(valor_rec,0)>0 OR rec='S' OR dt_pgto IS NOT NULL) AS recebidos,
         COUNT(*) FILTER (WHERE dt_venc < CURRENT_DATE) AS vencidos
       FROM dbreceb
      WHERE codgp=$1 AND cod_fat IS NULL AND (cancel IS NULL OR cancel<>'S')`,
      [codgp],
    );
    const v = val.rows[0] || {};
    let motivo: string | null = null;
    if (Number(v.recebidos) > 0)
      motivo = 'A cobrança agrupada possui título recebido (total ou parcial).';
    else if (Number(v.registrados) > 0)
      motivo = 'A cobrança agrupada possui título registrado no banco (Bradesco).';
    else if (Number(v.vencidos) > 0)
      motivo = 'A cobrança agrupada possui título vencido.';

    return res.status(200).json({ codgp, operavel: !motivo, motivo });
  } catch (error: any) {
    return res.status(500).json({ erro: 'Erro ao validar o grupo.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
