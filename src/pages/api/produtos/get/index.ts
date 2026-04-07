import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { page = '1', perPage = '10', search = '' } = req.query;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Construir a cláusula WHERE (com alias p. para uso na query principal)
    const whereConditions: string[] = ['p.excluido = 0'];
    const whereConditionsCount: string[] = ['excluido = 0'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Busca geral
    if (search && typeof search === 'string' && search.trim()) {
      whereConditions.push(
        `(p.codprod ILIKE $${paramIndex} OR p.descr ILIKE $${paramIndex} OR p.ref ILIKE $${paramIndex})`,
      );
      whereConditionsCount.push(
        `(codprod ILIKE $${paramIndex} OR descr ILIKE $${paramIndex} OR ref ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const whereClauseCount = `WHERE ${whereConditionsCount.join(' AND ')}`;

    // Buscar os produtos com contagem de armazéns
    const produtosQuery = `
      SELECT p.*,
        COALESCE((
          SELECT COUNT(DISTINCT cap.arp_arm_id)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod AND COALESCE(cap.arp_qtest, 0) > 0
        ), 0) as qtd_armazens
      FROM db_manaus.dbprod p
      ${whereClause}
      ORDER BY p.descr
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;

    queryParams.push(offset, itemsPerPage);
    const produtosResult = await client.query(produtosQuery, queryParams);

    // Contar o total
    const countQuery = `
      SELECT COUNT(*) as total FROM db_manaus.dbprod
      ${whereClauseCount}
    `;

    const countParams = queryParams.slice(0, -2); // Remove offset e limit
    const countResult = await client.query(countQuery, countParams);

    const produtos = produtosResult.rows;
    const count = parseInt(countResult.rows[0].total, 10);

    console.log(`✅ API GET - Retornando ${produtos.length} produtos de ${count} total`);
    if (produtos.length > 0) {
      console.log('✅ Campos:', Object.keys(produtos[0]));
    }

    res.status(200).json({
      data: produtos.map((produto) => serializeBigInt(produto)),
      meta: {
        total: count,
        lastPage: Math.max(1, Math.ceil(count / itemsPerPage)),
        currentPage: Math.max(1, currentPage),
        perPage: itemsPerPage,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar produtos:', error);
    res.status(500).json({
      error: 'Erro ao buscar produtos',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
