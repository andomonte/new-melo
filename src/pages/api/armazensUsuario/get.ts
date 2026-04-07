import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { filial, login_user_login, grupoId } = req.query;

  if (!filial || typeof filial !== 'string') {
    return res.status(400).json({ error: 'Parâmetro "filial" é obrigatório.' });
  }

  if (!login_user_login || typeof login_user_login !== 'string') {
    return res
      .status(400)
      .json({ error: 'Parâmetro "login_user_login" é obrigatório.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // Primeiro, busca o codigo_filial baseado no nome da filial
    const filialResult = await client.query(
      `SELECT codigo_filial FROM tb_filial WHERE nome_filial = $1`,
      [filial],
    );

    if (filialResult.rows.length === 0) {
      return res.status(404).json({ error: 'Filial não encontrada.' });
    }

    const codigo_filial = filialResult.rows[0].codigo_filial;

    // Query que busca os armazéns vinculados ao usuário na filial específica
    let query = `
      SELECT 
        a.id_armazem, 
        a.nome, 
        a.filial, 
        a.ativo 
      FROM dbarmazem a
      INNER JOIN tb_login_armazem_user au ON a.id_armazem = au.id_armazem
      WHERE a.filial = $1 
        AND au.login_user_login = $2
        AND au.codigo_filial = $3
    `;

    const params: any[] = [filial, login_user_login, codigo_filial];

    // Se grupoId for fornecido, adiciona o filtro
    if (grupoId && typeof grupoId === 'string') {
      query += ` AND au.login_perfil_name = $4`;
      params.push(grupoId);
    }

    query += ` ORDER BY a.nome`;

    const result = await client.query(query, params);

    const armazens: {
      id_armazem: number;
      nome: string;
      filial: string;
      ativo: boolean;
    }[] = result.rows.map((row) => ({
      id_armazem: row.id_armazem,
      nome: row.nome,
      filial: row.filial,
      ativo: row.ativo,
    }));

    res.status(200).json({ data: armazens });
  } catch (error) {
    console.error('Erro ao buscar armazéns:', error);
    res.status(500).json({ error: 'Erro ao buscar armazéns' });
  } finally {
    if (client) client.release();
  }
}
