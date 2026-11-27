/**
 * GET /api/devolucao/list
 * Devoluções de compra (fat_devolucao, tipo ENTRADA) — as iniciadas no web pela alocação
 * e o histórico importado do Delphi.
 *
 * Query params:
 * - busca: nº da devolução, entrada, NF, fornecedor/cliente ou obs
 * - status: ABERTA (aguardando emissão da NF, inclusive faturada com NF não autorizada) | FINALIZADA | CANCELADA
 * - origem: WEB | ORACLE
 * - page / limit
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// Devolução do web faturada cuja NF não foi autorizada (ex.: falha na transmissão): continua pendente.
const NF_PENDENTE = `(d.dev_origem = 'WEB' AND d.dev_status = 'F' AND d.dev_codfat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbfat_nfe n WHERE n.codfat = d.dev_codfat AND n.status = '100'))`;

const FILTRO_STATUS: Record<string, string> = {
  ABERTA: `d.dev_cancel = 'N' AND (d.dev_status = 'A' OR ${NF_PENDENTE})`,
  FINALIZADA: `d.dev_cancel = 'N' AND d.dev_status IN ('F','E') AND NOT ${NF_PENDENTE}`,
  CANCELADA: `d.dev_cancel = 'S'`,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const busca = String(req.query.busca || '').trim();
  const status = String(req.query.status || '');
  const origem = String(req.query.origem || '');
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  const offset = (page - 1) * limit;

  const pool = getPgPool(filial);

  try {
    const conds: string[] = [`d.dev_tipodoc = 'ENTRADA'`];
    const params: any[] = [];
    if (FILTRO_STATUS[status]) conds.push(FILTRO_STATUS[status]);
    if (origem === 'WEB' || origem === 'ORACLE') {
      params.push(origem);
      conds.push(`d.dev_origem = $${params.length}`);
    }
    if (busca) {
      params.push(`%${busca}%`);
      const p = `$${params.length}`;
      conds.push(`(d.dev_id::text ILIKE ${p} OR d.dev_coddoc ILIKE ${p} OR d.dev_obs ILIKE ${p}
                   OR f.nome ILIKE ${p} OR c.nome ILIKE ${p} OR ne.nnf::text ILIKE ${p} OR e.nroform ILIKE ${p})`);
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const from = `
      FROM fat_devolucao d
      LEFT JOIN dbent e ON e.codent = d.dev_coddoc
      LEFT JOIN dbcredor f ON f.cod_credor = e.cod_credor
      LEFT JOIN dbclien c ON c.codcli = d.dev_coddest
      LEFT JOIN dbnfe_ent ne ON ne.codnfe_ent = d.dev_codnfe_ent`;

    const total = Number((await pool.query(`SELECT COUNT(*) AS n ${from} ${where}`, params)).rows[0].n);
    const abertas = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM fat_devolucao d WHERE d.dev_tipodoc = 'ENTRADA' AND d.dev_cancel = 'N' AND d.dev_origem = 'WEB' AND (d.dev_status = 'A' OR ${NF_PENDENTE})`,
    )).rows[0].n);

    const dados = await pool.query(
      `SELECT d.dev_id::text AS id, d.dev_coddoc AS numero_entrada, d.dev_data AS created_at,
              d.dev_status, d.dev_cancel, d.dev_origem AS origem, d.dev_obs AS observacao,
              d.dev_codfat, d.dev_destino, d.dev_matricula,
              COALESCE(f.nome, c.nome) AS fornecedor, d.dev_coddest AS codcli,
              COALESCE(ne.nnf::text, NULLIF(ltrim(e.nroform,'0'),'')) AS nfe_numero, d.dev_program AS programa,
              (SELECT COUNT(*) FROM fat_it_devolucao i WHERE i.itd_dev_id = d.dev_id AND COALESCE(i.itd_quant_devolvida,0) > 0) AS total_itens,
              (SELECT COALESCE(SUM(i.itd_quant_devolvida),0) FROM fat_it_devolucao i WHERE i.itd_dev_id = d.dev_id) AS qtd_total_devolucao,
              (SELECT r.der_codigo FROM fat_devolucao_registro r WHERE r.der_dev_id = d.dev_id AND r.der_documento = 'VENDA' LIMIT 1) AS codvenda,
              CASE WHEN d.dev_cancel = 'S' THEN 'CANCELADA'
                   WHEN d.dev_status = 'A' THEN 'ABERTA'
                   WHEN ${NF_PENDENTE} THEN 'NF_PENDENTE'
                   ELSE 'FINALIZADA' END AS status
         ${from} ${where}
        ORDER BY (d.dev_cancel = 'N' AND d.dev_origem = 'WEB' AND (d.dev_status = 'A' OR ${NF_PENDENTE})) DESC, d.dev_data DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      data: dados.rows,
      abertasWeb: abertas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('Erro ao listar devoluções:', error);
    return res.status(500).json({ message: error.message || 'Erro ao listar devoluções' });
  }
}
