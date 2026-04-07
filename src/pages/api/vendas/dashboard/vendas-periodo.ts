// pages/api/vendas/dashboard/vendas-periodo.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export type VendasPorPeriodo = {
  vendasDiarias: number;
  vendasSemanais: number;
  vendasMensais: number;
  vendasAnuais: number;
};

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

    const vendasResult = await client.query(
      `
      SELECT
        -- Vendas do dia atual
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data >= $1 AND data < $1::date + interval '1 day'
         AND COALESCE(cancel, 'N') != 'S') AS "vendasDiarias",
        
        -- Vendas da semana atual (domingo a sábado)
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data >= $2 AND data < $2::date + interval '7 days'
         AND COALESCE(cancel, 'N') != 'S') AS "vendasSemanais",
        
        -- Vendas do mês atual
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data >= $3 AND data < $3::date + interval '1 month'
         AND COALESCE(cancel, 'N') != 'S') AS "vendasMensais",
        
        -- Vendas do ano atual
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data >= $4 AND data < $4::date + interval '1 year'
         AND COALESCE(cancel, 'N') != 'S') AS "vendasAnuais"
      `,
      [
        formatDate(inicioHoje),
        formatDate(inicioSemana),
        formatDate(inicioMes),
        formatDate(inicioAno),
      ],
    );

    const vendasRaw = vendasResult.rows[0];
    if (!vendasRaw) throw new Error('Dados de vendas não encontrados');

    const vendasData: VendasPorPeriodo = {
      vendasDiarias: parseFloat(vendasRaw.vendasDiarias || '0'),
      vendasSemanais: parseFloat(vendasRaw.vendasSemanais || '0'),
      vendasMensais: parseFloat(vendasRaw.vendasMensais || '0'),
      vendasAnuais: parseFloat(vendasRaw.vendasAnuais || '0'),
    };

    res.status(200).json(serializeBigInt(vendasData));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [vendas-periodo]:', error);
    res.status(500).json({
      message: 'Erro ao buscar as vendas por período.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
