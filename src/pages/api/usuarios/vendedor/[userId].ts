// pages/api/usuarios/vendedor/[userId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'ID do usuário é obrigatório' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // Busca o vendedor associado ao usuário na filial atual
    const query = `
      SELECT 
        up.codvend,
        up.perfil_name,
        up.nome_filial,
        up.codigo_filial,
        v.nome as vendedor_nome
      FROM tb_user_perfil up
      LEFT JOIN dbvend v ON up.codvend = v.codvend
      WHERE up.user_login_id = $1 
        AND up.codvend IS NOT NULL
      LIMIT 1;
    `;

    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Vendedor não encontrado para este usuário',
        codvend: null,
      });
      return;
    }

    const vendedorInfo = result.rows[0];

    res.status(200).json({
      codvend: vendedorInfo.codvend,
      vendedor_nome: vendedorInfo.vendedor_nome,
      perfil_name: vendedorInfo.perfil_name,
      nome_filial: vendedorInfo.nome_filial,
      codigo_filial: vendedorInfo.codigo_filial,
    });
  } catch (error) {
    console.error('Erro ao buscar vendedor do usuário:', error);
    res.status(500).json({
      error: 'Erro interno ao buscar vendedor do usuário',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
