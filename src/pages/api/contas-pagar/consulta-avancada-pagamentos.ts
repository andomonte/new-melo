import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Consulta Avançada do Financeiro — PAGAMENTOS (porte fiel de GERAL.FIN_PAGAMENSAL_DINAMICA
 * e FIN_DETALHA_PAGAMENTO do Delphi). Agrupa por Grupo → Centro → Conta Financeira →
 * Fornecedor, somando dbpgto.valor_pgto pivotado por MÊS (yyyymm). Conta financeira do
 * pagamento = dbpgto.pag_cof_id; credor via INNER dbcredor (só fornecedor, como o Delphi).
 * Filtra cancel='N'; para tipo_data=pagamento filtra paga='S' (como a SP).
 *
 * GET ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&tipo_data=emissao|vencimento|pagamento
 *   → agrupado: { meses:[yyyymm], linhas:[{grupo,centro,cfinanceira,credor,valores:{ref:total},total}] }
 * GET ...&detalhe=1&credor=<nome>&cfinanceira=<descricao>
 *   → detalhe: { titulos:[{...}] }
 *
 * Unidade: apenas MAO (db_manaus).
 */

const COL_DATA: Record<string, string> = {
  emissao: 'p.dt_emissao',
  vencimento: 'p.dt_venc',
  pagamento: 'p.dt_pgto',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });

  const { data_inicio, data_fim, tipo_data, detalhe, credor, cfinanceira } = req.query;
  const td = String(tipo_data || 'emissao').toLowerCase();
  const colData = COL_DATA[td] || COL_DATA.emissao;
  if (!data_inicio || !data_fim) return res.status(400).json({ erro: 'Informe data_inicio e data_fim.' });
  // Fiel à SP: filtrando por DATA DE PAGAMENTO, só títulos pagos.
  const filtroPaga = td === 'pagamento' ? `AND COALESCE(p.paga,'N') = 'S'` : '';

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // ── Detalhe (drill-down por fornecedor + conta financeira) ──
    if (detalhe) {
      const r = await client.query(
        `SELECT cgcc.gcc_descricao AS grupo, ccc.cec_descricao AS centro, ccf.cof_descricao AS cfinanceira,
                cr.nome AS credor, p.nro_nf AS nota, p.nro_dup AS dup, p.cod_pgto, p.obs,
                to_char(p.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
                to_char(p.dt_venc,'YYYY-MM-DD')    AS dt_venc,
                to_char(p.dt_pgto,'YYYY-MM-DD')    AS dt_pgto,
                COALESCE(p.valor_pgto,0) AS valor_pgto, COALESCE(p.valor_pago,0) AS valor_pago,
                COALESCE(p.paga,'N') AS paga
           FROM dbpgto p
           JOIN cad_conta_financeira ccf ON ccf.cof_id = p.pag_cof_id
           JOIN cad_centro_custo ccc ON ccc.cec_id = ccf.cof_cec_id
           JOIN cad_grupo_centro_custo cgcc ON cgcc.gcc_id = ccc.cec_gcc_id
           JOIN dbcredor cr ON cr.cod_credor = p.cod_credor
          WHERE COALESCE(p.cancel,'N') = 'N' ${filtroPaga}
            AND ${colData} BETWEEN $1::date AND $2::date
            AND RTRIM(LTRIM(cr.nome)) = TRIM($3)
            AND ccf.cof_descricao = $4
          ORDER BY ${colData}`,
        [data_inicio, data_fim, credor || '', cfinanceira || ''],
      );
      return res.status(200).json({
        titulos: r.rows.map((x: any) => ({
          grupo: x.grupo, centro: x.centro, cfinanceira: x.cfinanceira, credor: x.credor,
          nota: x.nota, dup: x.dup, cod_pgto: x.cod_pgto, obs: x.obs,
          dt_emissao: x.dt_emissao, dt_venc: x.dt_venc, dt_pgto: x.dt_pgto,
          valor_pgto: Number(x.valor_pgto || 0), valor_pago: Number(x.valor_pago || 0),
          pago: x.paga === 'S',
        })),
      });
    }

    // ── Agrupado (Grupo → Centro → CFinanceira → Fornecedor) × mês ──
    const r = await client.query(
      `SELECT cgcc.gcc_descricao AS grupo, ccc.cec_descricao AS centro, ccf.cof_descricao AS cfinanceira,
              cr.nome AS credor, to_char(${colData},'YYYYMM') AS ref, SUM(COALESCE(p.valor_pgto,0)) AS total
         FROM dbpgto p
         JOIN cad_conta_financeira ccf ON ccf.cof_id = p.pag_cof_id
         JOIN cad_centro_custo ccc ON ccc.cec_id = ccf.cof_cec_id
         JOIN cad_grupo_centro_custo cgcc ON cgcc.gcc_id = ccc.cec_gcc_id
         JOIN dbcredor cr ON cr.cod_credor = p.cod_credor
        WHERE COALESCE(p.cancel,'N') = 'N' ${filtroPaga}
          AND ${colData} BETWEEN $1::date AND $2::date
        GROUP BY cgcc.gcc_descricao, ccc.cec_descricao, ccf.cof_descricao, cr.nome, to_char(${colData},'YYYYMM')
        ORDER BY cgcc.gcc_descricao, ccc.cec_descricao, ccf.cof_descricao, cr.nome`,
      [data_inicio, data_fim],
    );

    const meses = [...new Set(r.rows.map((x: any) => String(x.ref)).filter(Boolean))].sort();
    const mapa = new Map<string, any>();
    for (const x of r.rows) {
      const chave = `${x.grupo}||${x.centro}||${x.cfinanceira}||${x.credor}`;
      let linha = mapa.get(chave);
      if (!linha) {
        linha = { grupo: x.grupo, centro: x.centro, cfinanceira: x.cfinanceira, credor: x.credor, valores: {}, total: 0 };
        mapa.set(chave, linha);
      }
      const v = Number(x.total || 0);
      linha.valores[String(x.ref)] = (linha.valores[String(x.ref)] || 0) + v;
      linha.total += v;
    }

    return res.status(200).json({ meses, linhas: Array.from(mapa.values()) });
  } catch (error: any) {
    console.error('Erro na consulta avançada de pagamentos:', error);
    return res.status(500).json({ erro: 'Erro na consulta avançada', detalhes: error.message });
  } finally {
    client.release();
  }
}
