// src/pages/api/fluxo-caixa/reagendar.ts
//
// Reagenda a previsão de um título (porte de GERAL.FLUXOCXX3.ATUALIZA_ATRASADOS).
//   Entrada (E): grava dbreceb.dtvenc_previsao
//   Saída  (S): grava dbpgto.dt_venc
// Só Manaus (ORIGEM='MAO') — que é o único banco do web hoje.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const { tipo_op, codigo, nova_data } = req.body || {};
  const tOp = String(tipo_op || '').toUpperCase();

  if (!['E', 'S'].includes(tOp) || !codigo || !nova_data || !/^\d{4}-\d{2}-\d{2}$/.test(String(nova_data))) {
    return res.status(400).json({ ok: false, erro: 'Parâmetros inválidos (tipo_op, codigo, nova_data YYYY-MM-DD).' });
  }

  const pool = getPgPool();
  try {
    const sql = tOp === 'E'
      ? `UPDATE dbreceb SET dtvenc_previsao = $1::date WHERE cod_receb = $2`
      : `UPDATE dbpgto  SET dt_venc = $1::date WHERE cod_pgto = $2`;
    const r = await pool.query(sql, [nova_data, String(codigo)]);
    if (!r.rowCount) return res.status(404).json({ ok: false, erro: 'Título não encontrado.' });
    return res.status(200).json({ ok: true, atualizado: r.rowCount });
  } catch (e: any) {
    console.error('[fluxo-caixa/reagendar] erro:', e?.message);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao reagendar.' });
  }
}
