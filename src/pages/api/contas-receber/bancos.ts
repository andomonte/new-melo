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
        cod_banco as value,
        CONCAT(cod_banco, ' - ', nome) as label,
        nome
      FROM db_manaus.dbbanco
      WHERE 
        CAST(cod_banco AS TEXT) LIKE $1
        OR UPPER(nome) LIKE UPPER($2)
      ORDER BY cod_banco
      LIMIT 50
    `;

    const searchPattern = `%${search}%`;
    const result = await pool.query(query, [searchPattern, searchPattern]);

    return res.status(200).json({
      sucesso: true,
      bancos: result.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar bancos:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar bancos',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
