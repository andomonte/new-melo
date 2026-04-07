import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { Funcao } from '@/data/funcoes/funcoes';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id_functions, descricao }: Funcao = req.body;
  let client;

  if (!id_functions || !descricao) {
    res.status(400).json({ error: 'ID e Descrição são Obrigatórios.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      UPDATE tb_login_functions
      SET descricao = $1
      WHERE id_functions = $2
      RETURNING id_functions, descricao, codigo_filial, "usadoEm", sigla;
    `;

    const values = [descricao, Number(id_functions)];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json({ data: result.rows[0] });
    } else {
      res
        .status(404)
        .json({ error: 'Função não encontrada ou não atualizada.' });
    }
  } catch (error) {
    console.error('Erro ao atualizar função:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar a função.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
