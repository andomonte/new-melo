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

    // Buscar os produtos com subqueries para nomes (evita conflito de colunas com JOINs)
    const produtosQuery = `
      SELECT p.*,
        COALESCE((SELECT m.descr FROM dbmarcas m WHERE m.codmarca = p.codmarca LIMIT 1), '') as marca_nome,
        COALESCE((SELECT gf.descr FROM dbgpfunc gf WHERE gf.codgpf = p.codgpf LIMIT 1), '') as grupo_funcao_nome,
        COALESCE((SELECT gp.descr FROM dbgpprod gp WHERE gp.codgpp = p.codgpp LIMIT 1), '') as grupo_produto_nome,
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

    const count = parseInt(countResult.rows[0].total, 10);

    // Enriquecer dados: mostrar "código - nome" como Delphi faz
    const produtos = produtosResult.rows.map((p: any) => {
      if (p.marca_nome) p.codmarca = `${p.codmarca} - ${p.marca_nome}`;
      if (p.grupo_funcao_nome) p.codgpf = `${p.codgpf} - ${p.grupo_funcao_nome}`;
      if (p.grupo_produto_nome) p.codgpp = `${p.codgpp} - ${p.grupo_produto_nome}`;
      // Remover colunas auxiliares
      delete p.marca_nome;
      delete p.grupo_funcao_nome;
      delete p.grupo_produto_nome;
      return p;
    });

    res.status(200).json({
      data: produtos.map((produto: any) => serializeBigInt(produto)),
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
