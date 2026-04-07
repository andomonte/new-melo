import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' } = req.query;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const searchTerm = `%${search}%`;

    // Query de busca com filtros e paginação
    const query = `
      SELECT 
        codcli, 
        nome, 
        cpfcgc, 
        CAST(atraso AS INTEGER) AS atraso, 
        CAST(kickback AS INTEGER) AS kickback, 
        CAST(sit_tributaria AS INTEGER) AS sit_tributaria, 
        CAST(codpais AS INTEGER) AS codpais, 
        CAST(codpaiscobr AS INTEGER) AS codpaiscobr, 
        CAST(codigo_filial AS INTEGER) AS codigo_filial
      FROM dbclien
      WHERE 
        codcli ILIKE $1 OR
        nome ILIKE $1 OR
        cpfcgc ILIKE $1
      ORDER BY nome ASC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM dbclien
      WHERE 
        codcli ILIKE $1 OR
        nome ILIKE $1 OR
        cpfcgc ILIKE $1;
    `;

    // Executa as queries em paralelo
    const [result, countResult] = await Promise.all([
      client.query(query, [searchTerm, limit, offset]),
      client.query(countQuery, [searchTerm]),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0', 10);
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    res.status(200).json({
      data: result.rows,
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / limit) : 1,
        currentPage: total > 0 ? Number(page) : 1,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
