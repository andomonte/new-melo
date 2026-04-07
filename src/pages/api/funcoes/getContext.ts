// pages/api/grupoFuncoes/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let client: PoolClient | undefined;

  const login_user_login = String(req.query.login_user_login ?? '').trim();
  const grupoId = req.query.grupoId ? String(req.query.grupoId).trim() : null;
  const codigo_filial =
    req.query.codigo_filial !== undefined &&
    req.query.codigo_filial !== null &&
    String(req.query.codigo_filial).trim() !== ''
      ? Number(req.query.codigo_filial)
      : null;

  if (!login_user_login) {
    return res
      .status(400)
      .json({ message: 'Parâmetro login_user_login é obrigatório.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    // União de ids do PERFIL e do USUÁRIO (filtrando por filial se informado)
    const sql = `
      WITH perfil_funcs AS (
        SELECT lap.id_functions
        FROM tb_login_access_perfil lap
        WHERE ($1::text IS NOT NULL AND $1::text <> '')
          AND lap.login_perfil_name = $1
      ),
      user_funcs AS (
        SELECT lau.id_functions
        FROM tb_login_access_user lau
        WHERE lau.login_user_login = $2
          AND ($3::int IS NULL OR lau.codigo_filial = $3)
          -- se grupoId for informado, aceitamos registros do usuário
          -- com esse perfil OU sem perfil associado (NULL)
          AND ($1::text IS NULL OR lau.login_perfil_name = $1 OR lau.login_perfil_name IS NULL)
      ),
      all_ids AS (
        SELECT id_functions FROM perfil_funcs
        UNION
        SELECT id_functions FROM user_funcs
      )
      SELECT f.id_functions, f.descricao, f.sigla, f."usadoEm"
      FROM all_ids a
      JOIN tb_login_functions f
        ON f.id_functions::bigint = a.id_functions -- id no functions é int; access_* é bigint
      ORDER BY f.descricao ASC;
    `;

    const params = [grupoId, login_user_login, codigo_filial];
    const result = await client.query(sql, params);

    const data = result.rows.map((r) => ({
      id_functions: r.id_functions, // bigint
      descricao: r.descricao,
      sigla: r.sigla,
      usadoEm: r.usadoEm,
    }));

    // Mantém compatibilidade com seu fetchFuncoes (string[])
    // prioriza sigla; se não houver, usa descricao
    const funcoes: string[] = data.map((d) =>
      d.sigla && String(d.sigla).trim() ? String(d.sigla) : String(d.descricao),
    );

    return res.status(200).json(
      serializeBigInt({
        funcoes,
        data,
        count: data.length,
        meta: {
          hasPerfil: Boolean(grupoId),
          filtradoPorFilial: codigo_filial !== null,
        },
      }),
    );
  } catch (error: any) {
    console.error('[grupoFuncoes/get] Erro:', error?.message || error);
    return res.status(500).json({
      message: 'Erro ao buscar funções.',
      error: error?.message || String(error),
    });
  } finally {
    if (client) client.release();
  }
}
