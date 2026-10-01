// src/pages/api/caixa/datas-movimento.ts
//
// Lista os DIAS (YYYY-MM-DD) de um mês em que a conta teve movimento de caixa
// (há sessão em caixa_sessao). Serve para o calendário do "Movimento do Caixa"
// destacar em negrito as datas que realmente geram comprovante.
//
// Mesma fonte do comprovante (movimentos-caixa): getPgPool() + caixa_sessao,
// agregando pelo dia da abertura no fuso de Manaus.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const conta = String(req.query.conta || '').trim();
  const mes = String(req.query.mes || '').trim(); // YYYY-MM
  if (!conta || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ ok: false, erro: 'Informe a conta e o mês (YYYY-MM).' });
  }

  const primeiro = `${mes}-01`;
  try {
    const q = await getPgPool().query(
      `SELECT DISTINCT to_char((aberto_em AT TIME ZONE 'America/Manaus')::date, 'YYYY-MM-DD') AS dia
         FROM caixa_sessao
        WHERE cod_conta = $1
          AND (aberto_em AT TIME ZONE 'America/Manaus')::date >= $2::date
          AND (aberto_em AT TIME ZONE 'America/Manaus')::date <  ($2::date + interval '1 month')
        ORDER BY dia`,
      [conta, primeiro],
    );
    return res.status(200).json({ ok: true, datas: q.rows.map((r) => r.dia) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
}
