// src/pages/api/fluxo-caixa/detalhe.ts
//
// Drill-down do Fluxo de Caixa (porte de GERAL.FLUXOCXX3.CONSULTA_DETALHADA_TITULOS).
// Lista os títulos individuais por trás de uma célula (ATRASADOS ou DIAxx) para
// uma linha do grid (TIPO_OP + TIPO_MOV + CONTA FINANCEIRA). Usa a MESMA
// classificação do endpoint mensal, garantindo que os títulos batam com a célula.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { montarFeriados, retornaDiaFluxoPgto, dataFluxoISO, type Feriado } from '@/lib/fluxo-caixa/diaFluxo';
import { calcularJanela, bucketAberto, baterAlvo } from '@/lib/fluxo-caixa/cenario';

const FILTRO_COF = `NOT (cof.cof_cec_id IN (12) OR cof.cof_id IN (237,238))`;
const FILTRO_GCC = `gcc.gcc_id <> 19`;
const MODELO = `CASE WHEN cof.cof_operacional = 'S' THEN 'OP' ELSE 'NOP' END`;
const CC_RECEBER = `CASE WHEN gcc.gcc_id = 15 THEN gcc.gcc_descricao || ' - ' || COALESCE(cli.claspgto,'') ELSE gcc.gcc_descricao END`;

const num = (v: any) => (v == null ? 0 : Number(v)) || 0;

interface Titulo {
  codigo: string; nome: string; nro_doc: string | null;
  valor_pgto: number; valor_rec: number;
  dtvenc_previsao: string | null; dt_emissao: string | null; dt_pgto: string | null; dt_venc: string | null;
  origem: string; pago: string; src: 'ABERTO' | 'REALIZADO';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const tipo_op = String(req.query.tipo_op || '').toUpperCase(); // 'E' | 'S'
  const tipo_mov = String(req.query.tipo_mov || '').toUpperCase(); // 'OP' | 'NOP'
  const cc = String(req.query.cc || '');
  const alvo = String(req.query.alvo || ''); // 'ATRASADOS' | número do dia
  const ano = parseInt(String(req.query.ano || ''), 10);
  const mes = parseInt(String(req.query.mes || ''), 10);

  if (!['E', 'S'].includes(tipo_op) || !['OP', 'NOP'].includes(tipo_mov) || !cc || !alvo || !ano || !mes) {
    return res.status(400).json({ ok: false, erro: 'Parâmetros inválidos.' });
  }

  const pool = getPgPool();
  const janela = calcularJanela(ano, mes);
  const ehAtrasados = alvo === 'ATRASADOS';
  const diaISO = ehAtrasados ? null : `${janela.primeiroDia.slice(0, 8)}${String(parseInt(alvo, 10)).padStart(2, '0')}`;

  try {
    const titulos: Titulo[] = [];
    const vistos = new Set<string>();
    const push = (t: Titulo) => { if (!vistos.has(t.codigo)) { vistos.add(t.codigo); titulos.push(t); } };

    if (tipo_op === 'E') {
      // ---- Abertos (rec='N') ----
      const ab = await pool.query(`
        SELECT r.cod_receb AS codigo, cli.nome, r.nro_doc,
               r.valor_pgto, r.valor_rec,
               to_char(r.dtvenc_previsao,'YYYY-MM-DD') AS dtvenc_previsao,
               to_char(r.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
               to_char(r.dt_pgto,'YYYY-MM-DD') AS dt_pgto,
               to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
               r.rec AS pago,
               to_char(COALESCE(r.dtvenc_previsao, r.dt_venc),'YYYY-MM-DD') AS flow
        FROM dbreceb r
        JOIN dbclien cli ON cli.codcli = r.codcli
        JOIN cad_conta_financeira   cof ON r.rec_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE r.cancel = 'N' AND r.rec = 'N'
          AND (${MODELO}) = $1 AND (${CC_RECEBER}) = $2
          AND COALESCE(r.dtvenc_previsao, r.dt_venc) IS NOT NULL`, [tipo_mov, cc]);
      for (const r of ab.rows) {
        const bkt = bucketAberto(String(r.flow).slice(0, 10), janela);
        if (baterAlvo(bkt, alvo)) push({ ...linhaReceb(r), src: 'ABERTO' });
      }

      // ---- Realizado (baixas no dia) ----
      if (!ehAtrasados && janela.cenario !== 'FUTURO') {
        const rz = await pool.query(`
          SELECT DISTINCT r.cod_receb AS codigo, cli.nome, r.nro_doc,
                 r.valor_pgto, r.valor_rec,
                 to_char(r.dtvenc_previsao,'YYYY-MM-DD') AS dtvenc_previsao,
                 to_char(r.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
                 to_char(r.dt_pgto,'YYYY-MM-DD') AS dt_pgto,
                 to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
                 r.rec AS pago
          FROM dbfreceb fr
          JOIN dbreceb r ON r.cod_receb = fr.cod_receb
          LEFT JOIN dbfrecebdatafluxo df ON df.cod_receb = fr.cod_receb AND df.cod_freceb = fr.cod_freceb
          JOIN dbclien cli ON cli.codcli = r.codcli
          JOIN cad_conta_financeira   cof ON fr.fre_cof_id = cof.cof_id AND ${FILTRO_COF}
          JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
          JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
          WHERE r.cancel = 'N' AND fr.sf <> 'C'
            AND (${MODELO}) = $1 AND (${CC_RECEBER}) = $2
            AND COALESCE(df.data_fluxo, fr.dt_pgto)::date = $3::date`, [tipo_mov, cc, diaISO]);
        for (const r of rz.rows) push({ ...linhaReceb(r), src: 'REALIZADO' });
      }
    } else {
      // ================= SAÍDAS =================
      const ferRows = await pool.query<Feriado>(`SELECT to_char(data,'YYYY-MM-DD') AS data, tipo, fixo FROM dbferiado`);
      const feriados = montarFeriados(ferRows.rows);

      // ---- Abertos (paga='N') ----
      const ab = await pool.query(`
        SELECT r.cod_pgto AS codigo, COALESCE(cr.nome, tr.nome) AS nome, r.nro_nf AS nro_doc,
               r.valor_pgto, r.valor_pago AS valor_rec,
               to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
               to_char(r.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
               to_char(r.dt_pgto,'YYYY-MM-DD') AS dt_pgto,
               to_char(dfp.data_previsao,'YYYY-MM-DD') AS prev,
               r.paga AS pago
        FROM dbpgto r
        LEFT JOIN dbpgtodatafluxo dfp ON dfp.cod_pgto = r.cod_pgto
        LEFT JOIN dbcredor cr ON cr.cod_credor = r.cod_credor AND r.cod_transp IS NULL
        LEFT JOIN dbtransp tr ON tr.codtransp = r.cod_transp AND r.cod_credor IS NULL
        JOIN cad_conta_financeira   cof ON r.pag_cof_id = cof.cof_id AND ${FILTRO_COF}
        JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
        JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
        WHERE r.cancel = 'N' AND r.paga = 'N' AND r.dt_venc IS NOT NULL
          AND (${MODELO}) = $1 AND gcc.gcc_descricao = $2`, [tipo_mov, cc]);
      for (const r of ab.rows) {
        const prev = r.prev ? String(r.prev).slice(0, 10) : null;
        const flow = prev || dataFluxoISO(retornaDiaFluxoPgto(String(r.dt_venc).slice(0, 10), feriados));
        const bkt = bucketAberto(flow, janela);
        if (baterAlvo(bkt, alvo)) push({ ...linhaPagar(r), src: 'ABERTO' });
      }

      // ---- Realizado (pagos no dia) ----
      if (!ehAtrasados && janela.cenario !== 'FUTURO') {
        const rz = await pool.query(`
          SELECT r.cod_pgto AS codigo, COALESCE(cr.nome, tr.nome) AS nome, r.nro_nf AS nro_doc,
                 r.valor_pgto, r.valor_pago AS valor_rec,
                 to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
                 to_char(r.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
                 to_char(r.dt_pgto,'YYYY-MM-DD') AS dt_pgto,
                 r.paga AS pago
          FROM dbpgto r
          LEFT JOIN dbcredor cr ON cr.cod_credor = r.cod_credor AND r.cod_transp IS NULL
          LEFT JOIN dbtransp tr ON tr.codtransp = r.cod_transp AND r.cod_credor IS NULL
          JOIN cad_conta_financeira   cof ON r.pag_cof_id = cof.cof_id AND ${FILTRO_COF}
          JOIN cad_centro_custo       cec ON cof.cof_cec_id = cec.cec_id
          JOIN cad_grupo_centro_custo gcc ON cec.cec_gcc_id = gcc.gcc_id AND ${FILTRO_GCC}
          WHERE r.cancel = 'N' AND r.paga = 'S' AND r.dt_pgto::date = $3::date
            AND (${MODELO}) = $1 AND gcc.gcc_descricao = $2`, [tipo_mov, cc, diaISO]);
        for (const r of rz.rows) push({ ...linhaPagar(r), src: 'REALIZADO' });
      }
    }

    // ordena por data de venc/previsão
    titulos.sort((a, b) => String(a.dt_venc || '').localeCompare(String(b.dt_venc || '')));

    return res.status(200).json({
      ok: true,
      tipo_op, tipo_mov, cc, alvo, cenario: janela.cenario,
      total: titulos.length,
      titulos,
    });
  } catch (e: any) {
    console.error('[fluxo-caixa/detalhe] erro:', e?.message, e?.stack);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao detalhar títulos.' });
  }
}

function linhaReceb(r: any): Omit<Titulo, 'src'> {
  return {
    codigo: String(r.codigo), nome: r.nome || '', nro_doc: r.nro_doc,
    valor_pgto: num(r.valor_pgto), valor_rec: num(r.valor_rec),
    dtvenc_previsao: r.dtvenc_previsao, dt_emissao: r.dt_emissao, dt_pgto: r.dt_pgto, dt_venc: r.dt_venc,
    origem: 'MAO', pago: r.pago === 'S' ? 'S' : 'N',
  };
}

function linhaPagar(r: any): Omit<Titulo, 'src'> {
  return {
    codigo: String(r.codigo), nome: r.nome || '', nro_doc: r.nro_doc,
    valor_pgto: num(r.valor_pgto), valor_rec: num(r.valor_rec),
    dtvenc_previsao: r.dt_venc, dt_emissao: r.dt_emissao, dt_pgto: r.dt_pgto, dt_venc: r.dt_venc,
    origem: 'MAO', pago: r.pago === 'S' ? 'S' : 'N',
  };
}
