// pages/api/vendas/bloqueadas.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

type VendaBloqueadaComRelacionamentos = {
  [key: string]: any;
  dbclien: {
    codcli: string;
    nome: string | null;
    nomefant: string | null;
  } | null;
  dbitvenda: any[];
};

/**
 * Handler da API para buscar uma lista paginada de vendas bloqueadas (status = 'B').
 * Refatorado para usar a biblioteca 'pg' com SQL puro e funções de agregação JSON.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // A função promete retornar 'void'
  // 1. GARANTIA DE MÉTODO
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return; // <<-- CORREÇÃO APLICADA AQUI
  }

  let client: PoolClient | undefined;

  try {
    // 2. PARÂMETROS DE PAGINAÇÃO
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 10;
    const offset = (page - 1) * perPage;

    const pool = getPgPool();
    client = await pool.connect();

    // 3. CONTAGEM TOTAL DE REGISTROS (PARA PAGINAÇÃO)
    const countQuery = `SELECT COUNT(*) FROM dbvenda WHERE status = 'B';`;
    const totalResult = await client.query(countQuery);
    const total = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / perPage);

    // 4. BUSCA PRINCIPAL DOS DADOS
    const mainQuery = `
      SELECT
        v.*,
        json_build_object(
          'codcli', c.codcli,
          'nome', c.nome,
          'nomefant', c.nomefant
        ) AS dbclien,
        COALESCE(
          (
            SELECT json_agg(it.*)
            FROM dbitvenda it
            WHERE it.codvenda = v.codvenda
          ),
          '[]'::json
        ) AS dbitvenda
      FROM
        dbvenda v
      LEFT JOIN
        dbclien c ON v.codcli = c.codcli
      WHERE
        v.status = 'B'
      ORDER BY
        v.data DESC
      LIMIT $1 OFFSET $2;
    `;

    const salesResult = await client.query(mainQuery, [perPage, offset]);
    const blockedSales: VendaBloqueadaComRelacionamentos[] = salesResult.rows;

    // 5. RESPOSTA FINAL
    res.status(200).json({
      data: serializeBigInt(blockedSales),
      meta: {
        total,
        totalPages,
        currentPage: page,
        perPage,
      },
    });
    // Não precisa de 'return' aqui, pois é a última instrução do try.
  } catch (error) {
    console.error('Erro ao buscar vendas bloqueadas:', error);
    res.status(500).json({
      message: 'Erro interno ao buscar as vendas bloqueadas.',
      error: (error as Error).message,
    });
    return; // <<-- CORREÇÃO APLICADA AQUI (Boa prática para ser explícito)
  } finally {
    if (client) {
      client.release();
    }
  }
}
