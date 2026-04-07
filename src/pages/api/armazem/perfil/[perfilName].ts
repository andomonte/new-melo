import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial not provided in cookie.' });
  }

  const { perfilName } = req.query;

  if (!perfilName || typeof perfilName !== 'string') {
    return res.status(400).json({ error: 'Perfil name is required.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      SELECT a.id_armazem, a.nome, a.filial, a.ativo, a.data_cadastro,
             a.logradouro, a.numero, a.complemento, a.bairro,
             a.cep, a.municipio, a.uf, a.inscricaoestadual
      FROM tb_login_armazem_perfil ap
      INNER JOIN dbarmazem a ON ap.id_armazem = a.id_armazem
      WHERE ap.login_perfil_name = $1
      ORDER BY a.nome;
    `;

    const { rows } = await client.query(query, [perfilName]);

    return res.status(200).json({ data: rows });
  } catch (error: any) {
    console.error('Erro ao buscar armazéns do perfil:', error);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar armazéns do perfil.' });
  } finally {
    if (client) client.release();
  }
}
