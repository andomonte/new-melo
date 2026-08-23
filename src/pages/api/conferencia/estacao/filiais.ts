import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

/** Filiais disponíveis para a Estação de Conferência (tb_login_filiais, central MANAUS). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const pool = getPgPool('MANAUS');
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const r = await client.query(
      `SELECT DISTINCT lf.nome_filial, lf.codigo_filial,
              (tf.codigo_acesso IS NOT NULL AND tf.codigo_acesso <> '') AS exige_codigo
         FROM tb_login_filiais lf
         LEFT JOIN tb_filial tf ON tf.nome_filial = lf.nome_filial
        WHERE lf.nome_filial IS NOT NULL AND lf.nome_filial <> ''
        ORDER BY lf.nome_filial`,
    );
    return res.status(200).json({ filiais: r.rows });
  } catch (error) {
    console.error('Erro em conferencia/estacao/filiais:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
