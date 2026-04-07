import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;

  // A chave de busca agora é composta por três campos
  const { user_login_id, perfil_name, codigo_filial } = req.query;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
  }

  // Validação dos três campos da chave composta
  if (
    !user_login_id ||
    typeof user_login_id !== 'string' ||
    !perfil_name ||
    typeof perfil_name !== 'string' ||
    !codigo_filial ||
    typeof codigo_filial !== 'string'
  ) {
    return res
      .status(400)
      .json({
        error:
          'Os campos user_login_id, perfil_name e codigo_filial são obrigatórios.',
      });
  }

  try {
    const filialId = parseInt(codigo_filial, 10);
    if (isNaN(filialId)) {
      return res
        .status(400)
        .json({ error: 'codigo_filial deve ser um número válido.' });
    }

    const pool = getPgPool();
    client = await pool.connect();

    // 1. Deletar o registro da tabela tb_user_perfil usando a chave composta
    const deleteUserPerfilQuery = `
      DELETE FROM tb_user_perfil
      WHERE user_login_id = $1 AND perfil_name = $2 AND codigo_filial = $3
      RETURNING *;
    `;
    const result = await client.query(deleteUserPerfilQuery, [
      user_login_id,
      perfil_name,
      filialId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: `Registro para user_login_id "${user_login_id}", perfil_name "${perfil_name}" e codigo_filial "${codigo_filial}" não encontrado.`,
      });
    }

    return res.status(200).json({
      message: 'Registro deletado com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro ao deletar registro:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao deletar registro: ' + error.message });
  } finally {
    if (client) client.release();
  }
}
