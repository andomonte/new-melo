import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PedidosGetParams } from '@/data/pedidos/pedidos';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const {
    page = 1,
    perPage = 10,
    search = '',
    login_user_login = '',
  }: PedidosGetParams = req.query;

  try {
    const pool = getPgPool();
    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Query principal com JOINs
    let query = `
      SELECT
        v.codvenda,
        v.codcli,
        v.data,
        v.operacao,
        v.total,
        v.obs,
        c.nome as cliente_nome,
        COALESCE(json_agg(
          json_build_object(
            'codprod', i.codprod,
            'qtd', i.qtd::numeric,
            'prcompra', i.prcompra::numeric,
            'prmedio', i.prmedio::numeric,
            'comissaovend', i.comissaovend::numeric,
            'comissao_operador', i.comissao_operador::numeric,
            'desconto', i.desconto::numeric,
            'arm_id', i.arm_id::numeric,
            'descr', i.descr
          )
        ) FILTER (WHERE i.codprod IS NOT NULL), '[]') as items
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      LEFT JOIN dbitvenda i ON v.codvenda = i.codvenda
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT v.codvenda) as total
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE 1=1
    `;

    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (LOWER(v.codcli) LIKE LOWER($${paramIndex}) OR LOWER(c.nome) LIKE LOWER($${paramIndex + 1}))`;
      countQuery += ` AND (LOWER(v.codcli) LIKE LOWER($${paramIndex}) OR LOWER(c.nome) LIKE LOWER($${paramIndex + 1}))`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (login_user_login) {
      query += ` AND EXISTS (
        SELECT 1 FROM tb_pedido_user pu
        WHERE pu.codvenda = v.codvenda
        AND pu.login_user_login = $${paramIndex}
      )`;
      countQuery += ` AND EXISTS (
        SELECT 1 FROM tb_pedido_user pu
        WHERE pu.codvenda = v.codvenda
        AND pu.login_user_login = $${paramIndex}
      )`;
      params.push(login_user_login);
      countParams.push(login_user_login);
      paramIndex++;
    }

    query += ` GROUP BY v.codvenda, v.codcli, v.data, v.operacao, v.total, v.obs, c.nome`;
    query += ` ORDER BY v.data DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(itemsPerPage, offset);

    const [pedidosResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const pedidos = pedidosResult.rows.map(pedido => ({
      ...pedido,
      operacao: Number(pedido.operacao),
      items: pedido.items || []
    }));

    const count = parseInt(countResult.rows[0].total);

    res.status(200).json({
      data: pedidos,
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / itemsPerPage) : 1,
        currentPage: count > 0 ? currentPage : 1,
        perPage: itemsPerPage,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
}
