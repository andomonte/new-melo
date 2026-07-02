import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Crédito Temporário - operações por registro (id).
 *
 * DELETE -> cancela o crédito (status='C', igual ao Delphi)
 * PATCH  -> altera limite e/ou data de vencimento
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const { id } = req.query;
  const idNum = Number(Array.isArray(id) ? id[0] : id);
  if (!idNum) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  const pool = getPgPool(filial);

  // ---------- CANCELAR ----------
  if (req.method === 'DELETE') {
    try {
      const result = await pool.query(
        "UPDATE dbclien_creditotmp SET status = 'C' WHERE id = $1 AND status = 'A' RETURNING id",
        [idNum],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'Não existe crédito temporário ativo a ser removido.' });
      }
      return res.status(200).json({ ok: true, id: idNum });
    } catch (error: any) {
      console.error('Erro ao remover crédito temporário:', error.message);
      return res
        .status(500)
        .json({ error: 'Erro ao remover crédito temporário', detail: error.message });
    }
  }

  // ---------- ALTERAR ----------
  if (req.method === 'PATCH') {
    const { limite, datavencimento } = req.body || {};
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (limite !== undefined && limite !== null && limite !== '') {
      const limiteNum = Number(limite);
      if (!limiteNum || limiteNum <= 0) {
        return res.status(400).json({ error: 'Limite inválido.' });
      }
      sets.push(`limite = $${i++}`);
      values.push(limiteNum);
    }

    if (datavencimento) {
      const venc = new Date(`${String(datavencimento).slice(0, 10)}T00:00:00`);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (isNaN(venc.getTime()) || venc < hoje) {
        return res.status(400).json({ error: 'Data de vencimento incorreta.' });
      }
      sets.push(`datavencimento = $${i++}`);
      values.push(venc);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nada para alterar.' });
    }

    values.push(idNum);
    try {
      const result = await pool.query(
        `UPDATE dbclien_creditotmp SET ${sets.join(', ')}
          WHERE id = $${i} AND status = 'A'
          RETURNING id, codcli, data, datavencimento, limite, limite_usado, status`,
        values,
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'Crédito temporário ativo não encontrado.' });
      }
      return res.status(200).json(serializeBigInt(result.rows[0]));
    } catch (error: any) {
      console.error('Erro ao alterar crédito temporário:', error.message);
      return res
        .status(500)
        .json({ error: 'Erro ao alterar crédito temporário', detail: error.message });
    }
  }

  res.setHeader('Allow', ['DELETE', 'PATCH']);
  return res.status(405).json({ error: 'Método não permitido' });
}
