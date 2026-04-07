// pages/api/vendas/dashboard/recent-sales.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { RecentSale } from './dashboardUtils';
import { Meta } from '@/data/vendas/dashboard';

// A resposta agora inclui os dados e os metadados da paginação
type RecentSalesResponse = {
  data: RecentSale[];
  meta: Meta;
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<RecentSalesResponse | { message: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  let client: PoolClient | undefined;
  try {
    // 1. RECEBEMOS OS PARÂMETROS DE PAGINAÇÃO DA REQUISIÇÃO
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 10;
    const offset = (page - 1) * perPage;

    client = await getPgPool().connect();

    // 2. EXECUTAMOS A CONTAGEM TOTAL E A BUSCA DE DADOS EM PARALELO
    const [totalResult, salesResult] = await Promise.all([
      // Query para saber o total de vendas (sempre sem LIMIT/OFFSET)
      client.query('SELECT COUNT(*) FROM dbvenda'),
      // Query que busca a página de dados atual
      client.query(
        `
        SELECT
          v.codvenda, c.nome AS "clientName", TO_CHAR(v.data, 'YYYY-MM-DD') AS "date", v.total,
          CASE
            WHEN v.cancel = 'S' THEN 'Cancelada'
            WHEN v.nronf IS NOT NULL AND v.nronf <> '' THEN 'Faturada'
            ELSE 'Finalizada'
          END AS status
        FROM dbvenda v
        JOIN dbclien c ON v.codcli = c.codcli
        ORDER BY v.data DESC, v.codvenda DESC
        LIMIT $1 OFFSET $2;
        `,
        [perPage, offset], // Usando LIMIT e OFFSET
      ),
    ]);

    const total = parseInt(totalResult.rows[0].count, 10);
    const lastPage = Math.ceil(total / perPage);

    const response: RecentSalesResponse = {
      data: salesResult.rows.map((s: any) => ({
        ...s,
        total: parseFloat(s.total || '0'),
      })),
      meta: {
        total,
        perPage,
        currentPage: page,
        lastPage,
      },
    };

    res.status(200).json(serializeBigInt(response));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [recent-sales]:', error);
    res.status(500).json({ message: 'Erro ao buscar as vendas recentes.' });
  } finally {
    if (client) client.release();
  }
}
