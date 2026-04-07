import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { Funcao } from '@/data/funcoes/funcoes';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { descricao, sigla, usadoEm } = req.body as Funcao;
  let client;

  // Verificação dos campos obrigatórios
  if (!descricao || !sigla) {
    return res
      .status(400)
      .json({ message: 'Descrição e Sigla são obrigatórios.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      INSERT INTO tb_login_functions (descricao, sigla, "usadoEm")
      VALUES ($1, $2, $3)
      RETURNING id_functions, descricao, sigla, "usadoEm";
    `;

    const values = [descricao, sigla, usadoEm || null];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      return res.status(201).json({ data: result.rows[0] });
    } else {
      return res.status(500).json({ message: 'Erro ao criar a função.' });
    }
  } catch (error) {
    console.error('Erro ao criar função:', error);
    return res.status(500).json({
      message: 'Erro ao criar a função. Verifique os dados e tente novamente.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
