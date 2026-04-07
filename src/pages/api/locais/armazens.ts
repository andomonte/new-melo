import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    const cookies = parseCookies({ req });
    const filial = cookies.filial_melo;

    if (!filial) {
      return res.status(400).json({ error: 'Filial não informada no cookie.' });
    }

    let client: PoolClient | undefined;
    try {
      const pool = getPgPool(filial);
      client = await pool.connect();

      // Buscar todos os armazéns ativos ordenados por nome
      const query = `
        SELECT 
          id_armazem,
          nome,
          filial,
          ativo
        FROM dbarmazem
        WHERE ativo = true
        ORDER BY nome ASC;
      `;

      const result = await client.query(query);

      res.status(200).json({
        data: result.rows,
      });
    } catch (error: any) {
      console.error('Erro ao buscar armazéns:', error);
      res.status(500).json({
        error: 'Erro interno do servidor ao buscar armazéns',
        message: error.message,
      });
    } finally {
      if (client) client.release();
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Método ${req.method} não permitido`);
  }
}
