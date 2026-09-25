// GET /api/locacoes/produtos?arm_id=&busca=&page=&perPage=
// Lista produtos com qtde disponível no armazém e locações agregadas (por armazém).
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const armId = parseInt(String(req.query.arm_id || ''), 10);
  const busca = String(req.query.busca || '').trim();
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '20'), 10) || 20));

  if (!armId || isNaN(armId)) {
    return res.status(400).json({ error: 'Armazém é obrigatório.' });
  }
  if (busca.length < 2) {
    // Evita varrer 396k produtos — exige um termo de busca (código ou descrição)
    return res.status(200).json({ produtos: [], total: 0, exigeBusca: true });
  }

  try {
    const params: any[] = [armId];
    const where: string[] = [];
    const isNumeric = /^\d+$/.test(busca);
    if (isNumeric) {
      params.push(`${busca}%`);
      where.push(`p.codprod ILIKE $${params.length}`);
    } else {
      params.push(`%${busca}%`);
      const iDescr = params.length;
      params.push(`%${busca}%`);
      const iMarca = params.length;
      where.push(`(p.descr ILIKE $${iDescr} OR m.descr ILIKE $${iMarca})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const baseFrom = `
      FROM db_manaus.dbprod p
      LEFT JOIN db_manaus.dbmarcas m ON m.codmarca = p.codmarca
      LEFT JOIN db_manaus.cad_armazem_produto ap
        ON ap.arp_codprod = p.codprod AND ap.arp_arm_id = $1
      LEFT JOIN (
        SELECT apl_codprod, string_agg(DISTINCT apl_descricao, ', ') as locacoes
        FROM db_manaus.cad_armazem_produto_locacao
        WHERE apl_arm_id = $1
        GROUP BY apl_codprod
      ) loc ON loc.apl_codprod = p.codprod
      ${whereSql}
    `;

    const totalRes = await pool.query(`SELECT COUNT(*) ${baseFrom}`, params);
    const total = parseInt(totalRes.rows[0].count, 10);

    const offset = (page - 1) * perPage;
    const dataRes = await pool.query(
      `SELECT
         p.codprod,
         p.descr,
         COALESCE(m.descr,'') as marca_nome,
         p.multiplo,
         COALESCE(p.unimed,'UN') as unimed,
         COALESCE(ap.arp_qtest,0) - COALESCE(ap.arp_qtest_reservada,0) as qtde_disponivel,
         COALESCE(loc.locacoes,'') as locacoes,
         (SELECT l2.apl_id FROM db_manaus.cad_armazem_produto_locacao l2
            WHERE l2.apl_arm_id = $1 AND l2.apl_codprod = p.codprod
            ORDER BY l2.apl_id LIMIT 1) as loc_id,
         COALESCE((SELECT l3.apl_descricao FROM db_manaus.cad_armazem_produto_locacao l3
            WHERE l3.apl_arm_id = $1 AND l3.apl_codprod = p.codprod
            ORDER BY l3.apl_id LIMIT 1), '') as loc_desc,
         (SELECT COUNT(*) FROM db_manaus.cad_armazem_produto_locacao l4
            WHERE l4.apl_arm_id = $1 AND l4.apl_codprod = p.codprod) as loc_count
       ${baseFrom}
       ORDER BY p.codprod
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset],
    );

    return res.status(200).json({ produtos: dataRes.rows, total });
  } catch (error: any) {
    console.error('Erro ao listar produtos (locações):', error);
    return res.status(500).json({ error: 'Erro ao listar produtos', message: error.message });
  }
}
