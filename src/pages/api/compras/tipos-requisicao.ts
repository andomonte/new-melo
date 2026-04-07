import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface TipoRequisicao {
  id: string;
  nome: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TipoRequisicao[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let client;
  try {
    client = await pool.connect();

    // Buscar tipos de requisição diretamente do banco
    const result = await client.query(`
      SELECT DISTINCT ret_id as id, ret_descricao as nome
      FROM db_manaus.cmp_requisicao_tipo
      ORDER BY ret_descricao
    `);

    const tipos: TipoRequisicao[] = result.rows.map(row => ({
      id: row.id,
      nome: row.nome
    }));

    res.status(200).json(tipos);
  } catch (err) {
    console.error('Erro ao buscar tipos de requisição:', err);
    res.status(500).json({ error: 'Falha ao buscar tipos de requisição.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}