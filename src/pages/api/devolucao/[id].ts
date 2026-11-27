/**
 * GET /api/devolucao/[id]
 * Devolução de compra (fat_devolucao) com itens, pré-pedido e documentos gerados.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id) || !/^\d+$/.test(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const cookies = parseCookies({ req });
  const pool = getPgPool(cookies.filial_melo || 'MANAUS');

  try {
    const cab = await pool.query(
      `SELECT d.dev_id::text AS id, d.dev_coddoc AS numero_entrada, d.dev_data AS created_at,
              d.dev_status, d.dev_cancel, d.dev_origem AS origem, d.dev_obs AS observacao,
              d.dev_codfat, d.dev_destino, d.dev_cfop, d.dev_matricula, d.dev_nomeusr,
              d.dev_nomeusr_cancel, d.dev_dt_cancel, d.dev_totalprod,
              d.dev_coddest AS codcli, c.nome AS cliente,
              f.cod_credor, f.nome AS fornecedor,
              COALESCE(ne.nnf::text, NULLIF(ltrim(e.nroform,'0'),'')) AS nfe_numero, COALESCE(ne.serie::text, e.serie) AS nfe_serie,
              d.dev_program AS programa, d.dev_pedido AS pedido,
              CASE WHEN d.dev_cancel = 'S' THEN 'CANCELADA'
                   WHEN d.dev_status = 'A' THEN 'ABERTA'
                   WHEN (d.dev_origem = 'WEB' AND d.dev_status = 'F' AND d.dev_codfat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbfat_nfe n WHERE n.codfat = d.dev_codfat AND n.status = '100')) THEN 'NF_PENDENTE'
                   ELSE 'FINALIZADA' END AS status
         FROM fat_devolucao d
         LEFT JOIN dbent e ON e.codent = d.dev_coddoc
         LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor
         LEFT JOIN dbclien c ON c.codcli = d.dev_coddest
         LEFT JOIN dbnfe_ent ne ON ne.codnfe_ent = d.dev_codnfe_ent
        WHERE d.dev_id = $1`, [id]);
    if (!cab.rows.length) return res.status(404).json({ message: 'Devolução não encontrada' });

    const itens = await pool.query(
      `SELECT i.itd_id AS id, i.itd_codprod AS produto_cod, p.descr AS produto_nome, p.ref,
              COALESCE(p.unimed,'UN') AS unidade, i.itd_codreq AS codreq, i.itd_arm_id AS arm_id,
              i.itd_quant_original AS qtd_esperada, i.itd_quant_devolvida AS qtd_devolucao,
              COALESCE(i.itd_quant_original,0) - COALESCE(i.itd_quant_devolvida,0) AS qtd_recebida,
              i.itd_motivo AS motivo, i.itd_prunit AS prunit, i.itd_codvenda2 AS codvenda,
              TRIM(ca.arm_descricao) AS armazem,
              (SELECT string_agg(DISTINCT trim(l.apl_descricao), ' / ') FROM cad_armazem_produto_locacao l
                WHERE l.apl_codprod = i.itd_codprod AND l.apl_arm_id = i.itd_arm_id
                  AND trim(COALESCE(l.apl_descricao,'')) <> '') AS localizacao
         FROM fat_it_devolucao i
         LEFT JOIN dbprod p ON p.codprod = i.itd_codprod
         LEFT JOIN cad_armazem ca ON ca.arm_id = i.itd_arm_id
        WHERE i.itd_dev_id = $1 AND COALESCE(i.itd_quant_devolvida,0) > 0
        ORDER BY i.itd_id`, [id]);

    const registros = await pool.query(
      `SELECT r.der_documento AS documento, r.der_codigo AS codigo,
              v.nrovenda, v.status AS venda_status
         FROM fat_devolucao_registro r
         LEFT JOIN dbvenda v ON r.der_documento = 'VENDA' AND v.codvenda = r.der_codigo
        WHERE r.der_dev_id = $1 ORDER BY r.id`, [id]);

    // NF de devolução: número da fatura + última tentativa na SEFAZ (autorizada ou rejeitada).
    let nf: any = null;
    if (cab.rows[0].dev_codfat) {
      nf = (await pool.query(
        `SELECT f.codfat, f.nroform, f.serie, f.totalnf, n.status, n.motivo, n.chave, n.numprotocolo
           FROM dbfatura f
           LEFT JOIN LATERAL (SELECT status, motivo, chave, numprotocolo FROM dbfat_nfe
                               WHERE codfat = f.codfat
                               ORDER BY (status = '100') DESC, "data" DESC LIMIT 1) n ON true
          WHERE f.codfat = $1`, [cab.rows[0].dev_codfat])).rows[0] ?? null;
    }

    return res.status(200).json({
      success: true,
      data: { ...cab.rows[0], itens: itens.rows, registros: registros.rows, nf },
    });
  } catch (error: any) {
    console.error('Erro ao buscar devolução:', error);
    return res.status(500).json({ message: error.message || 'Erro ao buscar devolução' });
  }
}
