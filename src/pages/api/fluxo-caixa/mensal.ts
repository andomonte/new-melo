// src/pages/api/fluxo-caixa/mensal.ts
//
// Fluxo de Caixa — modo MENSAL (colunas = dias do mês + bucket ATRASADOS).
// Porte fiel de GERAL.FLUXOCXX3 (POPULA_TMP_FLUXO_TITULOS + CONSULTA_TITULOS_AVENCER),
// bloco MAO (filial ativa = schema do pool, igual Contas a Pagar/Receber).
//
// Cenários (por mês selecionado vs mês atual):
//   PASSADO : Realizado (baixas do mês) + Atrasados (abertos com previsão <= fim do mês)
//   ATUAL   : Realizado (mês) + Atrasados (previsão < hoje) + Projeção (hoje..fim do mês)
//   FUTURO  : só Projeção (previsão dentro do mês)
//
// Adaptações ao PostgreSQL (db_manaus):
//   - dbrecebdatafluxo NÃO existe → usa dbreceb.dtvenc_previsao (mantido pelo MELOSYS).
//   - dbpgtodatafluxo está desatualizado → calcula o dia útil de pagáveis em JS
//     (RETORNA_DIA_FLUXO_PGTO), ver src/lib/fluxo-caixa/diaFluxo.ts.
//   - Contabilização (Total Entradas/Saídas, Resultado Diário/Acumulado), que no
//     Delphi só existe no Excel, é calculada aqui/servidor.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import {
  montarFeriados,
  retornaDiaFluxoPgto,
  dataFluxoISO,
  type Feriado,
} from '@/lib/fluxo-caixa/diaFluxo';
import { calcularJanela, bucketAberto } from '@/lib/fluxo-caixa/cenario';

// Exclusões fiéis ao FLUXOCXX3 (mesmas em todos os cenários).
const FILTRO_COF = `NOT (cof.cof_cec_id IN (12) OR cof.cof_id IN (237,238))`;
const FILTRO_GCC = `gcc.gcc_id <> 19`;

type Bucket = { atrasados: number; dias: Record<number, number> };
type Linha = { tipo_op: 'E' | 'S'; tipo_mov: 'OP' | 'NOP'; cc: string } & Bucket;

const novoBucket = (): Bucket => ({ atrasados: 0, dias: {} });
const num = (v: any) => (v == null ? 0 : Number(v)) || 0;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const ano = parseInt(String(req.query.ano || ''), 10);
  const mes = parseInt(String(req.query.mes || ''), 10);
  const saldoInicial = num(req.query.saldo_inicial);

  if (!ano || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ ok: false, erro: 'Informe mes (1-12) e ano.' });
  }

  const pool = getPgPool();

  // Janela do mês + cenário (compartilhado com o endpoint de detalhe)
  const janela = calcularJanela(ano, mes);
  const { cenario, diasNoMes, primeiroDia, ultimoDia } = janela;

  const addBucket = (l: Linha, flowISO: string, valor: number) => {
    if (!valor) return;
    const bkt = bucketAberto(flowISO, janela);
    if (bkt === 'ATRASADOS') l.atrasados += valor;
    else if (typeof bkt === 'number') l.dias[bkt] = (l.dias[bkt] || 0) + valor;
  };

  const ccReceber = `CASE WHEN gcc.gcc_id = 15 THEN gcc.gcc_descricao || ' - ' || COALESCE(cli.claspgto,'') ELSE gcc.gcc_descricao END`;
  const modelo = `CASE WHEN cof.cof_operacional = 'S' THEN 'OP' ELSE 'NOP' END`;

  try {
    // Índice de linhas por chave "tipo|modelo|cc"
    const mapa = new Map<string, Linha>();
    const chave = (t: string, m: string, cc: string) => `${t}|${m}|${cc}`;
    const linhaDe = (t: 'E' | 'S', m: 'OP' | 'NOP', cc: string): Linha => {
      const k = chave(t, m, cc);
      let l = mapa.get(k);
      if (!l) {
        l = { tipo_op: t, tipo_mov: m, cc, ...novoBucket() };
        mapa.set(k, l);
      }
      return l;
    };
    const addDia = (l: Linha, dia: number, v: number) => {
      l.dias[dia] = (l.dias[dia] || 0) + v;
    };

    // ---- Feriados (p/ dia útil dos pagáveis) ----
    const ferRows = await pool.query<Feriado>(
      `SELECT to_char(data,'YYYY-MM-DD') AS data, tipo, fixo FROM dbferiado`
    );
    const feriados = montarFeriados(ferRows.rows);

    const querRealizado = cenario !== 'FUTURO';
    const querAbertos = true; // atrasados e/ou projeção existem em todos os cenários

    // =========================================================================
    // ENTRADAS — Realizado (baixas de recebimento no mês)
    // =========================================================================
    if (querRealizado) {
      const sql = `
        SELECT ${modelo} AS modelo,
               ${ccReceber} AS cc,
               to_char(COALESCE(df.data_fluxo, fr.dt_pgto),'YYYY-MM-DD') AS d,
               SUM(fr.valor) AS valor
        FROM dbfreceb fr
        JOIN dbreceb r  ON r.cod_receb = fr.cod_receb
        LEFT JOIN dbfrecebdatafluxo df ON df.cod_receb = fr.cod_receb AND df.cod_freceb = fr.cod_freceb
        JOIN dbclien cli ON cli.codcli = r.codcli
        JOIN cad_conta_financeira   cof ON fr.fre_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE r.cancel = 'N' AND fr.sf <> 'C'
          AND COALESCE(df.data_fluxo, fr.dt_pgto) >= $1::date
          AND COALESCE(df.data_fluxo, fr.dt_pgto) <= $2::date
        GROUP BY 1,2,3`;
      const { rows } = await pool.query(sql, [primeiroDia, ultimoDia]);
      for (const r of rows) {
        const dia = parseInt(String(r.d).slice(8, 10), 10);
        addDia(linhaDe('E', r.modelo, r.cc), dia, num(r.valor));
      }
    }

    // =========================================================================
    // SAÍDAS — Realizado (títulos pagos no mês)
    // =========================================================================
    if (querRealizado) {
      const sql = `
        SELECT ${modelo} AS modelo,
               gcc.gcc_descricao AS cc,
               to_char(p.dt_pgto,'YYYY-MM-DD') AS d,
               SUM(p.valor_pago) AS valor
        FROM dbpgto p
        JOIN cad_conta_financeira   cof ON p.pag_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE p.cancel = 'N' AND p.paga = 'S'
          AND p.dt_pgto >= $1::date AND p.dt_pgto <= $2::date
        GROUP BY 1,2,3`;
      const { rows } = await pool.query(sql, [primeiroDia, ultimoDia]);
      for (const r of rows) {
        const dia = parseInt(String(r.d).slice(8, 10), 10);
        addDia(linhaDe('S', r.modelo, r.cc), dia, num(r.valor));
      }
    }

    // =========================================================================
    // ENTRADAS — Abertas (rec='N'): atrasados + projeção
    // flow = dtvenc_previsao (já ajustada pelo MELOSYS) ou dt_venc
    // =========================================================================
    if (querAbertos) {
      const sql = `
        SELECT ${modelo} AS modelo,
               ${ccReceber} AS cc,
               to_char(COALESCE(r.dtvenc_previsao, r.dt_venc),'YYYY-MM-DD') AS flow,
               SUM(CASE WHEN (r.valor_pgto - r.valor_rec) < 0 THEN r.valor_rec
                        ELSE (r.valor_pgto - r.valor_rec) END) AS valor
        FROM dbreceb r
        JOIN dbclien cli ON cli.codcli = r.codcli
        JOIN cad_conta_financeira   cof ON r.rec_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE r.cancel = 'N' AND r.rec = 'N'
          AND COALESCE(r.dtvenc_previsao, r.dt_venc) IS NOT NULL
        GROUP BY 1,2,3`;
      const { rows } = await pool.query(sql);
      for (const r of rows) {
        const flow = String(r.flow).slice(0, 10);
        addBucket(linhaDe('E', r.modelo, r.cc), flow, num(r.valor));
      }
    }

    // =========================================================================
    // SAÍDAS — Abertas (paga='N'): atrasados + projeção
    // flow = dbpgtodatafluxo.data_previsao (raro no PG) OU dia útil calculado
    // de dt_venc (RETORNA_DIA_FLUXO_PGTO). Poucas linhas → calcula por título.
    // =========================================================================
    if (querAbertos) {
      const sql = `
        SELECT ${modelo} AS modelo,
               gcc.gcc_descricao AS cc,
               to_char(p.dt_venc,'YYYY-MM-DD') AS dtvenc,
               to_char(dfp.data_previsao,'YYYY-MM-DD') AS prev,
               p.valor_pgto AS valor
        FROM dbpgto p
        LEFT JOIN dbpgtodatafluxo dfp ON dfp.cod_pgto = p.cod_pgto
        JOIN cad_conta_financeira   cof ON p.pag_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE p.cancel = 'N' AND p.paga = 'N' AND p.dt_venc IS NOT NULL`;
      const { rows } = await pool.query(sql);
      for (const r of rows) {
        const prev = r.prev ? String(r.prev).slice(0, 10) : null;
        const flow = prev || dataFluxoISO(retornaDiaFluxoPgto(String(r.dtvenc).slice(0, 10), feriados));
        addBucket(linhaDe('S', r.modelo, r.cc), flow, num(r.valor));
      }
    }

    // ---- Monta seções + contabilização ----
    const linhas = Array.from(mapa.values());
    // ordena: Entradas primeiro, depois Saídas; dentro, OP antes de NOP; depois cc
    const ordModelo = (m: string) => (m === 'OP' ? 0 : 1);
    const secao = (t: 'E' | 'S') =>
      linhas
        .filter((l) => l.tipo_op === t && (l.atrasados !== 0 || Object.keys(l.dias).length > 0))
        .sort((a, b) => ordModelo(a.tipo_mov) - ordModelo(b.tipo_mov) || a.cc.localeCompare(b.cc));

    const gruposE = secao('E');
    const gruposS = secao('S');

    const totalDe = (grps: Linha[]): Bucket => {
      const t = novoBucket();
      for (const g of grps) {
        t.atrasados += g.atrasados;
        for (const [d, v] of Object.entries(g.dias)) t.dias[+d] = (t.dias[+d] || 0) + v;
      }
      return t;
    };
    const totalEntradas = totalDe(gruposE);
    const totalSaidas = totalDe(gruposS);

    // Resultado Diário = Entradas − Saídas
    const resultadoDiario = novoBucket();
    resultadoDiario.atrasados = totalEntradas.atrasados - totalSaidas.atrasados;
    for (let d = 1; d <= diasNoMes; d++) {
      const v = (totalEntradas.dias[d] || 0) - (totalSaidas.dias[d] || 0);
      if (v !== 0) resultadoDiario.dias[d] = v;
    }

    // Resultado Acumulado = Saldo Inicial + Σ resultado diário (inclui atrasados como abertura)
    const resultadoAcumulado = novoBucket();
    let acc = saldoInicial + resultadoDiario.atrasados;
    resultadoAcumulado.atrasados = acc;
    for (let d = 1; d <= diasNoMes; d++) {
      acc += resultadoDiario.dias[d] || 0;
      resultadoAcumulado.dias[d] = acc;
    }

    return res.status(200).json({
      ok: true,
      modo: 'mensal',
      ano,
      mes,
      cenario,
      diasNoMes,
      saldoInicial,
      entradas: { grupos: gruposE, total: totalEntradas },
      saidas: { grupos: gruposS, total: totalSaidas },
      resultadoDiario,
      resultadoAcumulado,
      geradoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[fluxo-caixa/mensal] erro:', e?.message, e?.stack);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao gerar fluxo de caixa.' });
  }
}
