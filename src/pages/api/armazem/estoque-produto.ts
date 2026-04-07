import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

/**
 * API para buscar estoque de produtos por armazém
 *
 * GET /api/armazem/estoque-produto?codprods=000001,000002&armId=1
 * ou
 * POST /api/armazem/estoque-produto
 * Body: { codprods: string[], armId?: number }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let codprods: string[] = [];
  let armId: number | undefined;

  if (req.method === 'GET') {
    const codprodsParam = req.query.codprods;
    if (typeof codprodsParam === 'string') {
      codprods = codprodsParam.split(',').filter(Boolean);
    }
    if (req.query.armId) {
      armId = parseInt(req.query.armId as string, 10);
    }
  } else if (req.method === 'POST') {
    codprods = req.body.codprods || [];
    armId = req.body.armId;
  } else {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (codprods.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um código de produto' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    // Busca estoque dos produtos em todos os armazéns ou em um armazém específico
    let query = `
      SELECT
        cap.arp_arm_id,
        ca.arm_descricao,
        cap.arp_codprod,
        dp.descr as produto_descr,
        COALESCE(cap.arp_qtest, 0) as qtest,
        COALESCE(cap.arp_qtest_reservada, 0) as qtest_reservada,
        COALESCE(cap.arp_qtest, 0) - COALESCE(cap.arp_qtest_reservada, 0) as qtest_disponivel,
        cap.arp_bloqueado
      FROM cad_armazem_produto cap
      INNER JOIN cad_armazem ca ON ca.arm_id = cap.arp_arm_id
      INNER JOIN dbprod dp ON dp.codprod = cap.arp_codprod
      WHERE cap.arp_codprod = ANY($1::text[])
    `;

    const params: any[] = [codprods];

    if (armId) {
      query += ` AND cap.arp_arm_id = $2`;
      params.push(armId);
    }

    query += ` ORDER BY cap.arp_codprod, ca.arm_descricao`;

    const result = await client.query(query, params);

    // Agrupa por produto
    const estoquePorProduto: Record<string, any> = {};

    for (const row of result.rows) {
      const codprod = row.arp_codprod;
      if (!estoquePorProduto[codprod]) {
        estoquePorProduto[codprod] = {
          codprod,
          descr: row.produto_descr,
          armazens: [],
        };
      }

      estoquePorProduto[codprod].armazens.push({
        armId: Number(row.arp_arm_id),
        armDescricao: row.arm_descricao,
        qtest: Number(row.qtest),
        qtestReservada: Number(row.qtest_reservada),
        qtestDisponivel: Number(row.qtest_disponivel),
        bloqueado: row.arp_bloqueado === 'S',
      });
    }

    return res.status(200).json({
      data: Object.values(estoquePorProduto),
    });

  } catch (error: any) {
    console.error('Erro ao buscar estoque:', error);
    return res.status(500).json({
      error: 'Erro ao buscar estoque',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
