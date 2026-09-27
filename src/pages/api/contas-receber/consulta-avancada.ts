import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Consulta Avançada do Financeiro — Recebimentos (porte de GERAL.FIN_RECEBMENSAL_DINAMICA
 * e FIN_DETALHA_RECEBIMENTO do Delphi). Agrupa por Grupo → Centro → Conta Financeira → Cliente,
 * somando dbreceb.valor_pgto pivotado por MÊS (yyyymm). A conta financeira vem do MOVIMENTO
 * (dbfreceb.fre_cof_id), como no Delphi. Filtra cancel='N'.
 *
 * GET ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&tipo_data=emissao|vencimento|pagamento
 *   → agrupado: { meses:[yyyymm], linhas:[{grupo,centro,cfinanceira,cliente,valores:{ref:total},total}] }
 * GET ...&detalhe=1&cliente=<nome>&cfinanceira=<descricao>
 *   → detalhe: { titulos:[{...}] } — os títulos daquele cliente + conta financeira.
 *
 * Unidade: apenas MAO (db_manaus). As outras unidades MELO usam DBs remotos (datalink) — fora do web.
 */

const COL_DATA: Record<string, string> = {
  emissao: 'rb.dt_emissao',
  vencimento: 'rb.dt_venc',
  pagamento: 'rb.dt_pgto',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });

  const { data_inicio, data_fim, tipo_data, detalhe, cliente, cfinanceira } = req.query;
  const colData = COL_DATA[String(tipo_data || 'emissao').toLowerCase()] || COL_DATA.emissao;
  if (!data_inicio || !data_fim) return res.status(400).json({ erro: 'Informe data_inicio e data_fim.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // ── Detalhe (drill-down por cliente + conta financeira) ──
    if (detalhe) {
      const r = await client.query(
        `SELECT cgcc.gcc_descricao AS grupo, ccc.cec_descricao AS centro, ccf.cof_descricao AS cfinanceira,
                cl.nome AS cliente, f.nroform AS nota, rb.nro_doc AS dup,
                to_char(rb.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
                to_char(rb.dt_venc,'YYYY-MM-DD')    AS dt_venc,
                to_char(rb.dt_pgto,'YYYY-MM-DD')    AS dt_pgto,
                rb.valor_pgto, rb.valor_rec AS valor_pago, rb.rec AS paga
           FROM cad_centro_custo ccc
           JOIN cad_grupo_centro_custo cgcc ON cgcc.gcc_id = ccc.cec_gcc_id
           JOIN cad_conta_financeira ccf ON ccf.cof_cec_id = ccc.cec_id
           JOIN dbfreceb fr ON fr.fre_cof_id = ccf.cof_id
           JOIN dbreceb rb ON rb.cod_receb = fr.cod_receb
           JOIN dbclien cl ON cl.codcli = rb.codcli
           LEFT JOIN dbfatura f ON f.codfat = rb.cod_fat
          WHERE rb.cancel = 'N'
            AND ${colData} BETWEEN $1::date AND $2::date
            AND TRIM(cl.nome) = TRIM($3)
            AND ccf.cof_descricao = $4
          GROUP BY cgcc.gcc_descricao, ccc.cec_descricao, ccf.cof_descricao, cl.nome, f.nroform,
                   rb.nro_doc, rb.dt_emissao, rb.dt_venc, rb.dt_pgto, rb.valor_pgto, rb.valor_rec, rb.rec
          ORDER BY ${colData}`,
        [data_inicio, data_fim, cliente || '', cfinanceira || ''],
      );
      return res.status(200).json({
        titulos: r.rows.map((x: any) => ({
          grupo: x.grupo, centro: x.centro, cfinanceira: x.cfinanceira, cliente: x.cliente,
          nota: x.nota, dup: x.dup, dt_emissao: x.dt_emissao, dt_venc: x.dt_venc, dt_pgto: x.dt_pgto,
          valor_pgto: Number(x.valor_pgto || 0), valor_pago: Number(x.valor_pago || 0),
          pago: x.paga === 'S',
        })),
      });
    }

    // ── Agrupado (Grupo → Centro → CFinanceira → Cliente) × mês ──
    const r = await client.query(
      `SELECT cgcc.gcc_descricao AS grupo, ccc.cec_descricao AS centro, ccf.cof_descricao AS cfinanceira,
              cl.nome AS cliente, to_char(${colData},'YYYYMM') AS ref, SUM(rb.valor_pgto) AS total
         FROM cad_centro_custo ccc
         JOIN cad_grupo_centro_custo cgcc ON cgcc.gcc_id = ccc.cec_gcc_id
         JOIN cad_conta_financeira ccf ON ccf.cof_cec_id = ccc.cec_id
         JOIN dbfreceb fr ON fr.fre_cof_id = ccf.cof_id
         JOIN dbreceb rb ON rb.cod_receb = fr.cod_receb
         JOIN dbclien cl ON cl.codcli = rb.codcli
        WHERE rb.cancel = 'N'
          AND ${colData} BETWEEN $1::date AND $2::date
        GROUP BY cgcc.gcc_descricao, ccc.cec_descricao, ccf.cof_descricao, cl.nome, to_char(${colData},'YYYYMM')
        ORDER BY cgcc.gcc_descricao, ccc.cec_descricao, ccf.cof_descricao, cl.nome`,
      [data_inicio, data_fim],
    );

    // Pivot por (grupo,centro,cfinanceira,cliente) → valores por mês.
    const meses = [...new Set(r.rows.map((x: any) => String(x.ref)).filter(Boolean))].sort();
    const mapa = new Map<string, any>();
    for (const x of r.rows) {
      const chave = `${x.grupo}||${x.centro}||${x.cfinanceira}||${x.cliente}`;
      let linha = mapa.get(chave);
      if (!linha) {
        linha = { grupo: x.grupo, centro: x.centro, cfinanceira: x.cfinanceira, cliente: x.cliente, valores: {}, total: 0 };
        mapa.set(chave, linha);
      }
      const v = Number(x.total || 0);
      linha.valores[String(x.ref)] = (linha.valores[String(x.ref)] || 0) + v;
      linha.total += v;
    }

    return res.status(200).json({ meses, linhas: Array.from(mapa.values()) });
  } catch (error: any) {
    console.error('Erro na consulta avançada de recebimentos:', error);
    return res.status(500).json({ erro: 'Erro na consulta avançada', detalhes: error.message });
  } finally {
    client.release();
  }
}
