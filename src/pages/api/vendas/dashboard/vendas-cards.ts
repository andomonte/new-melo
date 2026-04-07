// pages/api/vendas/dashboard/vendas-cards.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export type VendasCardsData = {
  vendasDiarias: number;
  vendasSemanais: number;
  vendasMensais: number;
  vendasAnuais: number;
};

const formatDateForPG = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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

    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 7);

    const inicioMes = new Date(hoje);
    inicioMes.setDate(hoje.getDate() - 30);

    const inicioAno = new Date(hoje);
    inicioAno.setFullYear(hoje.getFullYear() - 1);

    // Formatando datas
    const hojeStr = formatDateForPG(hoje);
    const inicioSemanaStr = formatDateForPG(inicioSemana);
    const inicioMesStr = formatDateForPG(inicioMes);
    const inicioAnoStr = formatDateForPG(inicioAno);

    const vendasResult = await client.query(
      `
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data = $1 AND COALESCE(cancel, 'N') != 'S') AS "vendasDiarias",
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data BETWEEN $2 AND $1 AND COALESCE(cancel, 'N') != 'S') AS "vendasSemanais",
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data BETWEEN $3 AND $1 AND COALESCE(cancel, 'N') != 'S') AS "vendasMensais",
        (SELECT COALESCE(SUM(total), 0) FROM dbvenda 
         WHERE data BETWEEN $4 AND $1 AND COALESCE(cancel, 'N') != 'S') AS "vendasAnuais";
      `,
      [hojeStr, inicioSemanaStr, inicioMesStr, inicioAnoStr],
    );

    const vendasRaw = vendasResult.rows[0];
    if (!vendasRaw) throw new Error('Dados de vendas não encontrados');

    const vendasData: VendasCardsData = {
      vendasDiarias: parseFloat(vendasRaw.vendasDiarias || '0'),
      vendasSemanais: parseFloat(vendasRaw.vendasSemanais || '0'),
      vendasMensais: parseFloat(vendasRaw.vendasMensais || '0'),
      vendasAnuais: parseFloat(vendasRaw.vendasAnuais || '0'),
    };

    res.status(200).json(serializeBigInt(vendasData));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [vendas-cards]:', error);
    res.status(500).json({
      message: 'Erro ao buscar os dados de vendas por período.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
