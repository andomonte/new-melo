import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // Verifica se o usuário existe e bloqueia a linha durante a transação
    const exists = await client.query(
      'SELECT login_user_login FROM tb_login_user WHERE login_user_login = $1 FOR UPDATE',
      [id],
    );
    if (exists.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // 1) Funções do usuário por filial
    const delAccessUser = await client.query(
      'DELETE FROM tb_login_access_user WHERE login_user_login = $1',
      [id],
    );

    // 2) Armazéns do usuário por filial
    const delArmazemUser = await client.query(
      'DELETE FROM tb_login_armazem_user WHERE login_user_login = $1',
      [id],
    );

    // 3) Pedidos do usuário (remover histórico - opcional)
    const delPedidos = await client.query(
      'DELETE FROM tb_pedido_user WHERE login_user_login = $1',
      [id],
    );

    // 4) Vínculos usuário-perfil+filial (com codvend)
    const delUserPerfil = await client.query(
      'DELETE FROM tb_user_perfil WHERE user_login_id = $1',
      [id],
    );

    // 5) Filiais do usuário
    const delFiliais = await client.query(
      'DELETE FROM tb_login_filiais WHERE login_user_login = $1',
      [id],
    );

    // 6) Usuário
    const delUser = await client.query(
      'DELETE FROM tb_login_user WHERE login_user_login = $1',
      [id],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Usuário deletado com sucesso.',
      deleted: {
        tb_login_access_user: delAccessUser.rowCount ?? 0,
        tb_login_armazem_user: delArmazemUser.rowCount ?? 0,
        tb_pedido_user: delPedidos.rowCount ?? 0,
        tb_user_perfil: delUserPerfil.rowCount ?? 0,
        tb_login_filiais: delFiliais.rowCount ?? 0,
        tb_login_user: delUser.rowCount ?? 0,
      },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao deletar usuário:', error);
    return res.status(500).json({ error: 'Erro ao deletar usuário.' });
  } finally {
    if (client) client.release();
  }
}
