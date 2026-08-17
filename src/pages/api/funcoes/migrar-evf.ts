// API de migração one-time: cria a função EVF e associa ao grupo adm
// Chamar GET /api/funcoes/migrar-evf para executar
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verificar se a função EVF já existe
    const existing = await client.query(
      `SELECT id_functions FROM tb_login_functions WHERE sigla = 'EVF'`,
    );

    let idFuncao: number;

    if (existing.rows.length > 0) {
      idFuncao = existing.rows[0].id_functions;
    } else {
      // 2. Criar a função EVF
      const insertResult = await client.query(
        `INSERT INTO tb_login_functions (descricao, sigla, "usadoEm")
         VALUES ('Editar Venda Finalizada', 'EVF', 'Central de Vendas V2')
         RETURNING id_functions`,
      );
      idFuncao = insertResult.rows[0].id_functions;
    }

    // 3. Associar ao grupo adm (se ainda não estiver)
    const existingAssoc = await client.query(
      `SELECT 1 FROM tb_login_access_perfil
       WHERE login_perfil_name = 'adm' AND id_functions = $1`,
      [idFuncao],
    );

    if (existingAssoc.rows.length === 0) {
      await client.query(
        `INSERT INTO tb_login_access_perfil (login_perfil_name, id_functions)
         VALUES ('adm', $1)`,
        [idFuncao],
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Função EVF criada e associada ao grupo adm com sucesso.',
      id_functions: idFuncao,
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[migrar-evf] Erro:', error?.message || error);
    return res.status(500).json({
      message: 'Erro ao migrar função EVF.',
      error: error?.message || String(error),
    });
  } finally {
    if (client) client.release();
  }
}
