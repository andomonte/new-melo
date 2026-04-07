// pages/api/vendas/dashboard/get.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

// ============================================================================
// TIPAGEM DOS DADOS DE SAÍDA
// ============================================================================
type KpiData = {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  newClients: number;
};

type TopSellingProduct = {
  codprod: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
};

type RecentSale = {
  codvenda: string;
  clientName: string;
  date: string;
  total: number;
  status: 'Faturada' | 'Finalizada' | 'Cancelada';
};

type SalesOverviewDataPoint = {
  label: string;
  revenue: number;
};

type DashboardData = {
  kpi: KpiData;
  topProducts: TopSellingProduct[];
  recentSales: RecentSale[];
  salesOverview: SalesOverviewDataPoint[];
};

// ============================================================================
// FUNÇÃO AUXILIAR PARA CALCULAR PERÍODOS (VERSÃO CORRIGIDA)
// ============================================================================
const getDateRange = (
  range: string,
): { startDate: Date; endDate: Date; trunc: 'day' | 'month' | 'year' } => {
  const endDate = new Date();
  const startDate = new Date();
  let trunc: 'day' | 'month' | 'year' = 'day';

  switch (range) {
    case 'hoje':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'ultima_semana':
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'ultimos_30_dias':
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'ultimo_trimestre':
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      trunc = 'month';
      break;
    case 'ultimo_ano':
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      trunc = 'month';
      break;
    case 'todo_periodo': // <-- LÓGICA CORRIGIDA APLICADA AQUI
      startDate.setFullYear(1970, 0, 1); // Define uma data de início bem antiga
      startDate.setHours(0, 0, 0, 0);
      trunc = 'year'; // Agrupa por ano para uma visão geral mais limpa
      break;
    default:
      // Mantém 'ultimos_30_dias' como um padrão seguro
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
  }

  return { startDate, endDate, trunc };
};

// ============================================================================
// HANDLER PRINCIPAL DA API
// ============================================================================
// ============================================================================
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { range = 'ultimos_30_dias' } = req.query as { range?: string };
    // Renomeei o retorno para 'initialTrunc' para evitar confusão
    const { startDate, endDate, trunc: initialTrunc } = getDateRange(range);

    // A variável 'finalTrunc' será a que efetivamente usaremos na query
    let finalTrunc = initialTrunc;

    client = await getPgPool().connect();

    // LÓGICA DE AGRUPAMENTO DINÂMICO (APENAS PARA 'todo_periodo')
    if (range === 'todo_periodo') {
      const salesSpanResult = await client.query(
        `SELECT MIN(data) as "firstSale", MAX(data) as "lastSale" FROM dbvenda WHERE data IS NOT NULL`,
      );

      // Adicionando uma checagem de segurança para evitar crash se a tabela estiver vazia
      const salesSpan = salesSpanResult.rows[0];

      if (salesSpan && salesSpan.firstSale && salesSpan.lastSale) {
        const diffTime = Math.abs(
          new Date(salesSpan.lastSale).getTime() -
            new Date(salesSpan.firstSale).getTime(),
        );
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 90) {
          finalTrunc = 'day';
        } else if (diffDays <= 730) {
          finalTrunc = 'month';
        } else {
          finalTrunc = 'year';
        }
      }
    }

    // --- QUERIES EXECUTADAS EM PARALELO ---
    const [
      kpiResult,
      topProductsResult,
      recentSalesResult,
      salesOverviewResult,
    ] = await Promise.all([
      // 1. Query para os KPIs (sem alteração)
      client.query(
        `
        WITH SalesData AS (
          SELECT total FROM dbvenda
          WHERE data BETWEEN $1 AND $2 AND COALESCE(cancel, 'N') != 'S'
        )
        SELECT
          (SELECT COALESCE(SUM(total), 0) FROM SalesData) AS "totalRevenue",
          (SELECT COUNT(*) FROM SalesData) AS "totalSales",
          (SELECT COUNT(*) FROM dbclien WHERE datacad BETWEEN $1 AND $2) AS "newClients";
        `,
        [startDate, endDate],
      ),

      // 2. Query para os Top 5 Produtos (sem alteração)
      client.query(
        `
        SELECT
          p.codprod, p.descr AS "productName", SUM(i.qtd)::int AS "quantitySold",
          SUM(i.qtd * i.prunit) AS "totalRevenue"
        FROM dbvenda v
        JOIN dbitvenda i ON v.codvenda = i.codvenda
        JOIN dbprod p ON i.codprod = p.codprod
        WHERE v.data BETWEEN $1 AND $2 AND COALESCE(v.cancel, 'N') != 'S'
        GROUP BY p.codprod, p.descr ORDER BY "totalRevenue" DESC LIMIT 5;
        `,
        [startDate, endDate],
      ),

      // 3. Query para as Vendas Recentes (sem alteração)
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
        WHERE v.data BETWEEN $1 AND $2
        ORDER BY v.data DESC, v.codvenda DESC LIMIT 10;
        `,
        [startDate, endDate],
      ),

      // 4. Query para a Visão Geral (USA A VARIÁVEL FINAL)
      client.query(
        `
        SELECT
          TO_CHAR(DATE_TRUNC($3, data), 'YYYY-MM-DD') AS label,
          COALESCE(SUM(total), 0) AS revenue
        FROM dbvenda
        WHERE data BETWEEN $1 AND $2 AND COALESCE(cancel, 'N') != 'S'
        GROUP BY label ORDER BY label ASC;
        `,
        [startDate, endDate, finalTrunc], // <-- Usando a variável final e correta
      ),
    ]);

    // O restante do código para processar os dados não precisa de alteração.
    const kpiRaw = kpiResult.rows[0];
    if (!kpiRaw) {
      throw new Error('Dados de KPI não encontrados');
    }
    const totalSales = parseInt(kpiRaw.totalSales || '0', 10);
    const totalRevenue = parseFloat(kpiRaw.totalRevenue || '0');
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const dashboardData: DashboardData = {
      kpi: {
        totalRevenue,
        totalSales,
        newClients: parseInt(kpiRaw.newClients || '0', 10),
        averageTicket,
      },
      topProducts: topProductsResult.rows.map((p: any) => ({
        ...p,
        totalRevenue: parseFloat(p.totalRevenue || '0'),
      })),
      recentSales: recentSalesResult.rows.map((s: any) => ({
        ...s,
        total: parseFloat(s.total || '0'),
      })),
      salesOverview: salesOverviewResult.rows.map((row: any) => ({
        ...row,
        revenue: parseFloat(row.revenue || '0'),
      })),
    };

    res.status(200).json(serializeBigInt(dashboardData));
  } catch (error) {
    // ESTE LOG É O MAIS IMPORTANTE
    console.error('❌ ERRO NO BACKEND:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name,
    });

    res.status(500).json({
      message: 'Erro interno ao buscar os dados do dashboard.',
      error: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
