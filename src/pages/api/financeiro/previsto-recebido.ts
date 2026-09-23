// src/pages/api/financeiro/previsto-recebido.ts
//
// Relatório "Previsto × Recebido (Atrasados)" — por dia do mês.
// COORTE por dia de fluxo: para cada dia D, olha os títulos a receber cuja DATA DE FLUXO
// (RETORNA_DIA_FLUXO = D+1 dia útil, igual ao Fluxo de Caixa) cai em D, e mostra:
//   Previsto = Σ valor_pgto (o que era esperado receber no dia D)
//   Recebido = Σ LEAST(valor_rec, valor_pgto) (quanto desses títulos já foi recebido — mesmo
//              que pago depois; cap no previsto p/ não contar juros como "recebido do previsto")
//   Atrasado/Saldo = Previsto − Recebido (o que era pra entrar em D e não entrou)
// Dias sem previsão ficam de fora. Mesmos filtros de conta financeira do Fluxo de Caixa.

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
  if (!ano || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ ok: false, erro: 'Informe mes (1-12) e ano.' });
  }

  const mm = String(mes).padStart(2, '0');
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDia = `${ano}-${mm}-01`;
  const ultimoDia = `${ano}-${mm}-${String(diasNoMes).padStart(2, '0')}`;
  const hojeISO = new Date().toISOString().slice(0, 10);

  const pool = getPgPool();
  try {
    // Feriados p/ RETORNA_DIA_FLUXO (mesma regra do Fluxo de Caixa)
    const ferRows = await pool.query<Feriado>(
      `SELECT to_char(data,'YYYY-MM-DD') AS data, tipo, fixo FROM dbferiado`
    );
    const feriados = montarFeriados(ferRows.rows);

    // Coorte: títulos a receber por data-base (dtvenc_previsao ou dt_venc). Janela alargada
    // 6 dias antes (o D+1 dia útil pode empurrar um vencimento de fim de mês anterior p/ cá).
    const { rows } = await pool.query(
      `SELECT to_char(COALESCE(r.dtvenc_previsao, r.dt_venc),'YYYY-MM-DD') AS base,
              SUM(COALESCE(r.valor_pgto,0))                                 AS previsto,
              SUM(LEAST(COALESCE(r.valor_rec,0), COALESCE(r.valor_pgto,0))) AS recebido
       FROM dbreceb r
       JOIN cad_conta_financeira   cof ON r.rec_cof_id = cof.cof_id AND ${FILTRO_COF}
       JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
       JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
       WHERE r.cancel = 'N'
         AND COALESCE(r.dtvenc_previsao, r.dt_venc) >= ($1::date - INTERVAL '6 days')
         AND COALESCE(r.dtvenc_previsao, r.dt_venc) <= $2::date
       GROUP BY 1`,
      [primeiroDia, ultimoDia]
    );

    // Acumula por dia de FLUXO dentro do mês
    const porDia = new Map<number, { previsto: number; recebido: number }>();
    for (const row of rows) {
      const fluxoISO = dataFluxoISO(retornaDiaFluxo(String(row.base).slice(0, 10), feriados));
      if (fluxoISO < primeiroDia || fluxoISO > ultimoDia) continue;
      const dia = parseInt(fluxoISO.slice(8, 10), 10);
      const acc = porDia.get(dia) || { previsto: 0, recebido: 0 };
      acc.previsto += num(row.previsto);
      acc.recebido += num(row.recebido);
      porDia.set(dia, acc);
    }

    // Monta as linhas (só dias com previsto ou recebido), marcando passado/hoje/futuro
    const linhas = Array.from(porDia.entries())
      .map(([dia, v]) => {
        const previsto = r2(v.previsto);
        const recebido = r2(v.recebido);
        const saldo = r2(previsto - recebido);
        const dataISO = `${ano}-${mm}-${String(dia).padStart(2, '0')}`;
        const situacao = dataISO < hojeISO ? 'ATRASADO' : dataISO === hojeISO ? 'HOJE' : 'A_VENCER';
        return {
          dia,
          data: dataISO,
          previsto,
          recebido,
          saldo,                       // Previsto − Recebido
          pct_recebido: previsto > 0 ? r2((recebido / previsto) * 100) : 0,
          situacao,                    // saldo de dia passado = atrasado; futuro = a vencer
        };
      })
      .filter((l) => l.previsto !== 0 || l.recebido !== 0)
      .sort((a, b) => a.dia - b.dia);

    const total = linhas.reduce(
      (t, l) => {
        t.previsto += l.previsto;
        t.recebido += l.recebido;
        t.saldo += l.saldo;
        if (l.situacao === 'ATRASADO') t.atrasado += l.saldo;
        else t.aVencer += l.saldo;
        return t;
      },
      { previsto: 0, recebido: 0, saldo: 0, atrasado: 0, aVencer: 0 }
    );
    (Object.keys(total) as (keyof typeof total)[]).forEach((k) => (total[k] = r2(total[k])));

    return res.status(200).json({
      ok: true,
      ano,
      mes,
      diasNoMes,
      hoje: hojeISO,
      linhas,
      total,
      geradoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[financeiro/previsto-recebido] erro:', e?.message, e?.stack);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao gerar o relatório de previsto × recebido.' });
  }
}
