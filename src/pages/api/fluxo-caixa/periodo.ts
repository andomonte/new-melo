// src/pages/api/fluxo-caixa/periodo.ts
//
// Fluxo de Caixa — modo PERÍODO (colunas = meses do intervalo).
// Porte de GERAL.FLUXOCXX3.CONSULTA_TITULOS_MES + FLUXO_MENSAL_PREVISAO (bloco MAO):
// projeção pura (previsto) — títulos EM ABERTO posicionados pelo MÊS da previsão,
// SEM bucket ATRASADOS. Valor = valor_pgto (como no Delphi período).
//
// Colunas por mês; linhas TIPO_OP × TIPO_MOV × ContaFinanceira. A contabilização
// (Total/Resultado Diário/Acumulado) é montada no cliente, igual ao mensal.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { montarFeriados, retornaDiaFluxo, retornaDiaFluxoPgto, dataFluxoISO, type Feriado } from '@/lib/fluxo-caixa/diaFluxo';

const FILTRO_COF = `NOT (cof.cof_cec_id IN (12) OR cof.cof_id IN (237,238))`;
const FILTRO_GCC = `gcc.gcc_id <> 19`;
const MODELO = `CASE WHEN cof.cof_operacional = 'S' THEN 'OP' ELSE 'NOP' END`;
const CC_RECEBER = `CASE WHEN gcc.gcc_id = 15 THEN gcc.gcc_descricao || ' - ' || COALESCE(cli.claspgto,'') ELSE gcc.gcc_descricao END`;
const MESES_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const num = (v: any) => (v == null ? 0 : Number(v)) || 0;

interface Grupo { tipo_op: 'E' | 'S'; tipo_mov: 'OP' | 'NOP'; cc: string; valores: number[] }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const mesIni = parseInt(String(req.query.mes_ini || ''), 10);
  const anoIni = parseInt(String(req.query.ano_ini || ''), 10);
  const mesFim = parseInt(String(req.query.mes_fim || ''), 10);
  const anoFim = parseInt(String(req.query.ano_fim || ''), 10);

  if (!mesIni || !anoIni || !mesFim || !anoFim || mesIni < 1 || mesIni > 12 || mesFim < 1 || mesFim > 12) {
    return res.status(400).json({ ok: false, erro: 'Informe mês/ano de início e fim.' });
  }
  const chaveIni = anoIni * 12 + (mesIni - 1);
  const chaveFim = anoFim * 12 + (mesFim - 1);
  if (chaveFim < chaveIni) return res.status(400).json({ ok: false, erro: 'O fim do período é anterior ao início.' });
  if (chaveFim - chaveIni > 59) return res.status(400).json({ ok: false, erro: 'O período máximo é de 5 anos (60 meses).' });

  // Lista de meses do intervalo ('YYYY-MM' + rótulo)
  const meses: { key: string; label: string }[] = [];
  for (let c = chaveIni; c <= chaveFim; c++) {
    const a = Math.floor(c / 12);
    const m = (c % 12) + 1;
    meses.push({ key: `${a}-${String(m).padStart(2, '0')}`, label: `${MESES_ABBR[m - 1]}/${a}` });
  }
  const idxMes = new Map(meses.map((mm, i) => [mm.key, i]));
  const primeiroDia = `${meses[0].key}-01`;
  const ultAno = Math.floor(chaveFim / 12);
  const ultMes = (chaveFim % 12) + 1;
  const ultimoDia = `${ultAno}-${String(ultMes).padStart(2, '0')}-${new Date(ultAno, ultMes, 0).getDate()}`;

  const pool = getPgPool();
  try {
    const mapa = new Map<string, Grupo>();
    const grupoDe = (t: 'E' | 'S', m: 'OP' | 'NOP', cc: string): Grupo => {
      const k = `${t}|${m}|${cc}`;
      let g = mapa.get(k);
      if (!g) { g = { tipo_op: t, tipo_mov: m, cc, valores: new Array(meses.length).fill(0) }; mapa.set(k, g); }
      return g;
    };
    const addMes = (g: Grupo, mesKey: string, v: number) => {
      const i = idxMes.get(mesKey);
      if (i != null) g.valores[i] += v;
    };

    // Feriados (p/ RETORNA_DIA_FLUXO das entradas e RETORNA_DIA_FLUXO_PGTO das saídas)
    const ferRows = await pool.query<Feriado>(`SELECT to_char(data,'YYYY-MM-DD') AS data, tipo, fixo FROM dbferiado`);
    const feriados = montarFeriados(ferRows.rows);

    // ===== ENTRADAS (dbreceb aberto). Data de fluxo = RETORNA_DIA_FLUXO(base) → mês. =====
    const ent = await pool.query(`
      SELECT ${MODELO} AS modelo, ${CC_RECEBER} AS cc,
             to_char(COALESCE(r.dtvenc_previsao, r.dt_venc),'YYYY-MM-DD') AS base,
             SUM(r.valor_pgto) AS valor
      FROM dbreceb r
      JOIN dbclien cli ON cli.codcli = r.codcli
      JOIN cad_conta_financeira   cof ON r.rec_cof_id = cof.cof_id AND ${FILTRO_COF}
      JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
      JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
      WHERE r.cancel = 'N' AND r.rec = 'N'
        AND COALESCE(r.dtvenc_previsao, r.dt_venc) >= ($1::date - INTERVAL '4 days')
        AND COALESCE(r.dtvenc_previsao, r.dt_venc) <= $2::date
      GROUP BY 1,2,3`, [primeiroDia, ultimoDia]);
    for (const r of ent.rows) {
      const mesKey = dataFluxoISO(retornaDiaFluxo(String(r.base).slice(0, 10), feriados)).slice(0, 7);
      if (idxMes.has(mesKey)) addMes(grupoDe('E', r.modelo, r.cc), mesKey, num(r.valor));
    }

    // ===== SAÍDAS (dbpgto aberto, por mês da previsão; dia útil calculado em JS) =====
    const sai = await pool.query(`
      SELECT ${MODELO} AS modelo, gcc.gcc_descricao AS cc,
             to_char(p.dt_venc,'YYYY-MM-DD') AS dtvenc,
             to_char(dfp.data_previsao,'YYYY-MM-DD') AS prev,
             p.valor_pgto AS valor
      FROM dbpgto p
      LEFT JOIN dbpgtodatafluxo dfp ON dfp.cod_pgto = p.cod_pgto
      JOIN cad_conta_financeira   cof ON p.pag_cof_id = cof.cof_id AND ${FILTRO_COF}
      JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
      JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
      WHERE p.cancel = 'N' AND p.paga = 'N' AND p.dt_venc IS NOT NULL`);
    for (const r of sai.rows) {
      const prev = r.prev ? String(r.prev).slice(0, 10) : null;
      const flow = prev || dataFluxoISO(retornaDiaFluxoPgto(String(r.dtvenc).slice(0, 10), feriados));
      const mesKey = flow.slice(0, 7);
      if (idxMes.has(mesKey)) addMes(grupoDe('S', r.modelo, r.cc), mesKey, num(r.valor));
    }

    // ===== monta seções + totais =====
    const zeros = () => new Array(meses.length).fill(0);
    const somaArr = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] || 0));
    const subArr = (a: number[], b: number[]) => a.map((v, i) => v - (b[i] || 0));

    const grupos = Array.from(mapa.values()).filter((g) => g.valores.some((v) => v !== 0));
    const ordMov = (m: string) => (m === 'NOP' ? 0 : 1);
    const sec = (t: 'E' | 'S') => grupos.filter((g) => g.tipo_op === t)
      .sort((a, b) => ordMov(a.tipo_mov) - ordMov(b.tipo_mov) || a.cc.localeCompare(b.cc));
    const gruposE = sec('E');
    const gruposS = sec('S');
    const totalDe = (gs: Grupo[]) => gs.reduce((acc, g) => somaArr(acc, g.valores), zeros());
    const totalE = totalDe(gruposE);
    const totalS = totalDe(gruposS);
    const resultadoDiario = subArr(totalE, totalS);

    return res.status(200).json({
      ok: true,
      modo: 'periodo',
      colunas: meses,
      entradas: { grupos: gruposE, total: totalE },
      saidas: { grupos: gruposS, total: totalS },
      resultadoDiario,
      geradoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[fluxo-caixa/periodo] erro:', e?.message, e?.stack);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao gerar o fluxo de caixa (período).' });
  }
}
