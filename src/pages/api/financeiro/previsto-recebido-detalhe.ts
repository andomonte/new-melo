// src/pages/api/financeiro/previsto-recebido-detalhe.ts
//
// Drill-down do relatório Previsto × Recebido: lista os títulos da COORTE de um dia D
// (data de fluxo = D), filtrando por:
//   tipo=previsto → todos os títulos previstos para D
//   tipo=recebido → os que já tiveram recebimento (valor recebido > 0)
//   tipo=saldo    → os que ainda faltam (saldo em aberto > 0)

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { montarFeriados, retornaDiaFluxo, dataFluxoISO, type Feriado } from '@/lib/fluxo-caixa/diaFluxo';

const FILTRO_COF = `NOT (cof.cof_cec_id IN (12) OR cof.cof_id IN (237,238))`;
const FILTRO_GCC = `gcc.gcc_id <> 19`;
const num = (v: any) => (v == null ? 0 : Number(v)) || 0;
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const ano = parseInt(String(req.query.ano || ''), 10);
  const mes = parseInt(String(req.query.mes || ''), 10);
  const dia = parseInt(String(req.query.dia || ''), 10);
  const tipo = String(req.query.tipo || 'previsto').toLowerCase(); // previsto | recebido | saldo

  if (!ano || !mes || !dia || !['previsto', 'recebido', 'saldo'].includes(tipo)) {
    return res.status(400).json({ ok: false, erro: 'Parâmetros inválidos (ano, mes, dia, tipo).' });
  }
  const dataD = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  const pool = getPgPool();
  try {
    const ferRows = await pool.query<Feriado>(`SELECT to_char(data,'YYYY-MM-DD') AS data, tipo, fixo FROM dbferiado`);
    const feriados = montarFeriados(ferRows.rows);

    const { rows } = await pool.query(
      `SELECT r.cod_receb AS codigo, cli.nome, r.nro_doc,
              to_char(r.dt_venc,'YYYY-MM-DD')          AS dt_venc,
              to_char(r.dtvenc_previsao,'YYYY-MM-DD')  AS dtvenc_previsao,
              COALESCE(r.valor_pgto,0)                                  AS previsto,
              LEAST(COALESCE(r.valor_rec,0), COALESCE(r.valor_pgto,0))  AS recebido,
              r.rec AS pago,
              to_char(COALESCE(r.dtvenc_previsao, r.dt_venc),'YYYY-MM-DD') AS base
       FROM dbreceb r
       JOIN dbclien cli ON cli.codcli = r.codcli
       JOIN cad_conta_financeira   cof ON r.rec_cof_id = cof.cof_id AND ${FILTRO_COF}
       JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
       JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
       WHERE r.cancel = 'N'
         AND COALESCE(r.dtvenc_previsao, r.dt_venc) >= ($1::date - INTERVAL '6 days')
         AND COALESCE(r.dtvenc_previsao, r.dt_venc) <= $1::date`,
      [dataD]
    );

    const titulos = rows
      .filter((r) => dataFluxoISO(retornaDiaFluxo(String(r.base).slice(0, 10), feriados)) === dataD)
      .map((r) => {
        const previsto = r2(num(r.previsto));
        const recebido = r2(num(r.recebido));
        const saldo = r2(previsto - recebido);
        return {
          codigo: String(r.codigo), nome: r.nome || '', nro_doc: r.nro_doc || '',
          dt_venc: r.dt_venc, dtvenc_previsao: r.dtvenc_previsao,
          previsto, recebido, saldo, pago: r.pago === 'S' ? 'S' : 'N',
        };
      })
      .filter((t) => (tipo === 'recebido' ? t.recebido > 0.005 : tipo === 'saldo' ? t.saldo > 0.005 : true))
      .sort((a, b) => (tipo === 'recebido' ? b.recebido - a.recebido : tipo === 'saldo' ? b.saldo - a.saldo : b.previsto - a.previsto));

    const total = titulos.reduce(
      (t, x) => { t.previsto += x.previsto; t.recebido += x.recebido; t.saldo += x.saldo; return t; },
      { previsto: 0, recebido: 0, saldo: 0 }
    );

    return res.status(200).json({
      ok: true, ano, mes, dia, data: dataD, tipo,
      titulos, total: { previsto: r2(total.previsto), recebido: r2(total.recebido), saldo: r2(total.saldo) },
    });
  } catch (e: any) {
    console.error('[financeiro/previsto-recebido-detalhe] erro:', e?.message);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao detalhar títulos.' });
  }
}
