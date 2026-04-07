import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const { search = '' } = req.query;
  try {
    const result = await pool.query(
      `SELECT codcomprador, nome
       FROM db_manaus.dbcompradores
       WHERE codcomprador LIKE $1 OR UPPER(nome) LIKE UPPER($2)
       ORDER BY codcomprador
       LIMIT 20`,
      [`%${search}%`, `%${search}%`]
    );
    const compradores = result.rows.map(row => ({
      value: row.codcomprador,
      label: `${row.codcomprador} - ${row.nome}`
    }));
    res.json({ compradores });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar compradores', details: error });
  }
}
