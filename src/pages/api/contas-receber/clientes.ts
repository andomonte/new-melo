import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { search = '' } = req.query;

    const query = `
      SELECT 
        codcli as value,
        CONCAT(codcli, ' - ', nome) as label,
        nome
      FROM db_manaus.dbclien
      WHERE (
          CAST(codcli AS TEXT) LIKE $1
          OR UPPER(nome) LIKE UPPER($2)
        )
      ORDER BY nome
      LIMIT 50
    `;

    const searchPattern = `%${search}%`;
    const result = await pool.query(query, [searchPattern, searchPattern]);

    return res.status(200).json({
      sucesso: true,
      clientes: result.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar clientes',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
