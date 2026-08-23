import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

// Retorna o comprador vinculado ao usuário de login por filial
// (tb_user_perfil.codcomprador), já com o nome resolvido em dbcompradores.
// Usado para pré-preencher o comprador automaticamente na Confirmação da NFe
// e na Requisição, conforme o login e a filial ativa.
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const login = String(req.query.login || '').trim();
  const filial = String(req.query.filial || '').trim(); // nome_filial (opcional)
  if (!login) {
    res.status(400).json({ error: 'login obrigatório.' });
    return;
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool();
    client = await pool.connect();

    const { rows } = await client.query(
      `SELECT up.codcomprador, c.nome
         FROM tb_user_perfil up
         LEFT JOIN dbcompradores c
           ON c.codcomprador = up.codcomprador
        WHERE up.user_login_id = $1
          AND up.codcomprador IS NOT NULL
          AND ($2 = '' OR UPPER(up.nome_filial) = UPPER($2))
        ORDER BY up.codcomprador
        LIMIT 1`,
      [login, filial],
    );

    const row = rows[0];
    if (!row || !row.codcomprador) {
      res.status(200).json({ codcomprador: null, nome: null });
      return;
    }

    res.status(200).json({
      codcomprador: String(row.codcomprador),
      nome: row.nome ?? null,
    });
  } catch (error) {
    console.error('Erro ao buscar comprador do login:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
