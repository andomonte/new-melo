// pages/api/cadastro-operadoras/[codopera].ts
// GET / PUT / DELETE de uma operadora de cartão (dbopera). Catálogo central (db_manaus).
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';

const TABLE = 'dbopera';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const codopera = String(req.query.codopera || '').trim();
  if (!codopera) return res.status(400).json({ error: 'codopera é obrigatório.' });

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    if (req.method === 'GET') {
      const r = await client.query(
        `SELECT o.codopera, o.descr, o.txopera, o.pzopera, o.cond_pagto, o.desativado, o.codcli,
                c.nome AS nome_cliente
           FROM ${TABLE} o LEFT JOIN dbclien c ON c.codcli = o.codcli
          WHERE o.codopera = $1`,
        [codopera],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Operadora não encontrada.' });
      return res.status(200).json(r.rows[0]);
    }

    if (req.method === 'PUT') {
      const { descr, txopera, pzopera, cond_pagto, codcli, desativado } = req.body;
      if (!descr || !String(descr).trim()) {
        return res.status(400).json({ error: 'A descrição é obrigatória.' });
      }
      const r = await client.query(
        `UPDATE ${TABLE}
            SET descr = $2, txopera = $3, pzopera = $4, cond_pagto = $5, codcli = $6, desativado = $7
          WHERE codopera = $1 RETURNING *`,
        [
          codopera,
          String(descr).trim(),
          txopera != null && txopera !== '' ? Number(txopera) : 0,
          pzopera != null && pzopera !== '' ? parseInt(pzopera) : 0,
          cond_pagto || null,
          codcli || null,
          desativado != null ? parseInt(desativado) || 0 : 0,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Operadora não encontrada.' });
      return res.status(200).json(r.rows[0]);
    }

    if (req.method === 'PATCH') {
      // Ativar/Inativar sem editar o resto (desativado: 0 = ativo, 1 = inativo).
      const desativado = parseInt(req.body?.desativado) || 0;
      const r = await client.query(
        `UPDATE ${TABLE} SET desativado = $2 WHERE codopera = $1 RETURNING *`,
        [codopera, desativado],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Operadora não encontrada.' });
      return res.status(200).json(r.rows[0]);
    }

    if (req.method === 'DELETE') {
      const r = await client.query(`DELETE FROM ${TABLE} WHERE codopera = $1`, [codopera]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Operadora não encontrada.' });
      return res.status(200).json({ sucesso: true });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: any) {
    console.error('Erro na operadora:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
}
