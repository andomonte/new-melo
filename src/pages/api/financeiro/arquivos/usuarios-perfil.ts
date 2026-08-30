// Lookup de usuários para a tela Financeiro > Arquivos > Operador Caixa.
// Equivale ao Consulta(51) do Delphi (dmConsulta.CONSULTA.USUARIO_*), que abre
// a lista de usuários para escolher quem será o operador.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const search = String(req.query.search ?? '').trim();
  const client = await getPgPool().connect();
  try {
    const params: any[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE p.user_login_id ILIKE $1 OR p.perfil_name ILIKE $1
               OR p.nome_filial ILIKE $1`;
    }

    const { rows } = await client.query(
      `SELECT p.user_login_id || '|' || p.perfil_name || '|' || p.codigo_filial AS id,
              p.user_login_id AS usuario,
              p.perfil_name   AS perfil,
              p.codigo_filial AS codigo_filial,
              p.nome_filial   AS filial,
              p.cod_conta     AS cod_conta
       FROM tb_user_perfil p
       ${where}
       ORDER BY p.user_login_id, p.codigo_filial
       LIMIT 500`,
      params,
    );

    return res.status(200).json({ data: rows });
  } catch (erro: any) {
    console.error('Erro ao listar usuários/perfis:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client.release();
  }
}
