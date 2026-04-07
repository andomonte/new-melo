// pages/api/compras/dashboard/compras-periodo.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { ComprasPorPeriodo } from './dashboardUtils';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    // Data atual para cálculos
    const hoje = new Date();
    const inicioHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    );
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo da semana atual
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);

    // Formatação das datas para PostgreSQL
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    // Inclui status A (Aprovada) e F (Finalizada), exclui valores absurdos de teste
    const comprasResult = await client.query(
      `
      SELECT
        -- Compras do dia atual
        (SELECT COALESCE(SUM(orc_valor_total), 0) FROM db_manaus.cmp_ordem_compra
         WHERE orc_data >= $1 AND orc_data < $1::date + interval '1 day'
         AND orc_status IN ('A', 'F')
         AND orc_valor_total < 100000000) AS "comprasDiarias",

        -- Compras da semana atual
        (SELECT COALESCE(SUM(orc_valor_total), 0) FROM db_manaus.cmp_ordem_compra
         WHERE orc_data >= $2 AND orc_data < $2::date + interval '7 days'
         AND orc_status IN ('A', 'F')
         AND orc_valor_total < 100000000) AS "comprasSemanais",

        -- Compras do mês atual
        (SELECT COALESCE(SUM(orc_valor_total), 0) FROM db_manaus.cmp_ordem_compra
         WHERE orc_data >= $3 AND orc_data < $3::date + interval '1 month'
         AND orc_status IN ('A', 'F')
         AND orc_valor_total < 100000000) AS "comprasMensais",

        -- Compras do ano atual
        (SELECT COALESCE(SUM(orc_valor_total), 0) FROM db_manaus.cmp_ordem_compra
         WHERE orc_data >= $4 AND orc_data < $4::date + interval '1 year'
         AND orc_status IN ('A', 'F')
         AND orc_valor_total < 100000000) AS "comprasAnuais"
      `,
      [
        formatDate(inicioHoje),
        formatDate(inicioSemana),
        formatDate(inicioMes),
        formatDate(inicioAno),
      ],
    );

    const comprasRaw = comprasResult.rows[0];
    if (!comprasRaw) throw new Error('Dados de compras não encontrados');

    const comprasData: ComprasPorPeriodo = {
      comprasDiarias: parseFloat(comprasRaw.comprasDiarias || '0'),
      comprasSemanais: parseFloat(comprasRaw.comprasSemanais || '0'),
      comprasMensais: parseFloat(comprasRaw.comprasMensais || '0'),
      comprasAnuais: parseFloat(comprasRaw.comprasAnuais || '0'),
    };

    res.status(200).json(serializeBigInt(comprasData));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [compras-periodo]:', error);
    res.status(500).json({
      message: 'Erro ao buscar as compras por período.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
