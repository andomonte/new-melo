// Endpoint temporário para debug - verificar se item existe na requisição
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { req_id, req_versao, codprod } = req.query;

  if (!req_id || !req_versao) {
    return res.status(400).json({ error: 'req_id e req_versao são obrigatórios' });
  }

  try {
    const client = await pool.connect();

    // Listar todos os itens da requisição
    const sql = `
      SELECT
        itr_codprod as codprod,
        itr_quantidade as quantidade,
        itr_pr_unitario as preco_unitario,
        p.descr as produto_descr
      FROM db_manaus.cmp_it_requisicao ri
      LEFT JOIN db_manaus.dbprod p ON p.codprod = ri.itr_codprod
      WHERE ri.itr_req_id = $1 AND ri.itr_req_versao = $2
      ORDER BY ri.itr_codprod
    `;

    const { rows } = await client.query(sql, [req_id, req_versao]);
    client.release();

    // Se codprod foi especificado, verificar se existe
    if (codprod) {
      const itemExiste = rows.some(r => r.codprod === codprod);
      return res.json({
        req_id,
        req_versao,
        codprod_buscado: codprod,
        item_existe: itemExiste,
        total_itens: rows.length,
        itens: rows.map(r => ({ codprod: r.codprod, descr: r.produto_descr }))
      });
    }

    return res.json({
      req_id,
      req_versao,
      total_itens: rows.length,
      itens: rows
    });
  } catch (error) {
    console.error('Erro ao verificar item:', error);
    return res.status(500).json({
      error: 'Erro ao verificar',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
