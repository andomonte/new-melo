// Financeiro > Arquivos > Operador Caixa
// Delphi: Formularios/OPERADOR CAIXA/UniOperador_Caixa.pas (package CAIXA.OPERADOR),
// que amarra uma CONTA (dbconta) a um USUÁRIO. No web essa amarração já mora em
// tb_user_perfil.cod_conta (migration 032), por perfil e filial — então aqui a
// "inclusão" é preencher cod_conta numa linha existente de tb_user_perfil.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { SELECT_OPERADOR } from '@/lib/financeiro/operadorCaixa';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') return listar(req, res);
  if (req.method === 'POST') {
    const body = req.body ?? {};
    const ehListagem = 'page' in body || 'filtros' in body || 'search' in body;
    return ehListagem ? listar(req, res) : vincular(req, res);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

async function listar(req: NextApiRequest, res: NextApiResponse) {
  const source = req.method === 'POST' ? req.body : req.query;
  const page = Math.max(1, Number(source.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(source.perPage) || 10));
  const search = String(source.search ?? '').trim();

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    const params: any[] = [];
    // Só as linhas com conta preenchida são "operadores de caixa" — é o que a
    // tela do Delphi lista (spNavega_operador).
    let where = 'WHERE p.cod_conta IS NOT NULL';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.user_login_id ILIKE $1 OR p.cod_conta ILIKE $1
                      OR c.nro_conta ILIKE $1 OR p.nome_filial ILIKE $1)`;
    }

    const total = Number(
      (
        await client.query(
          `SELECT COUNT(*) AS n
           FROM tb_user_perfil p
           LEFT JOIN dbconta c ON c.cod_conta = p.cod_conta
           ${where}`,
          params,
        )
      ).rows[0].n,
    );

    const { rows } = await client.query(
      `SELECT ${SELECT_OPERADOR}
       FROM tb_user_perfil p
       LEFT JOIN dbconta c ON c.cod_conta = p.cod_conta
       ${where}
       ORDER BY p.user_login_id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, (page - 1) * perPage],
    );

    return res.status(200).json({
      data: rows,
      meta: {
        total,
        perPage,
        currentPage: total > 0 ? page : 1,
        lastPage: total > 0 ? Math.ceil(total / perPage) : 1,
        firstPage: 1,
      },
    });
  } catch (erro: any) {
    console.error('Erro ao listar operadores de caixa:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function vincular(req: NextApiRequest, res: NextApiResponse) {
  const usuario = String(req.body?.usuario ?? '').trim();
  const perfil = String(req.body?.perfil ?? '').trim();
  const filial = Number(req.body?.codigo_filial);
  const conta = String(req.body?.cod_conta ?? '').trim();

  // btnSalvarClick do Delphi valida conta e usuário antes de chamar a procedure.
  if (!usuario) return res.status(400).json({ error: 'Usuário inválido.' });
  if (!perfil) return res.status(400).json({ error: 'Perfil do usuário inválido.' });
  if (!Number.isFinite(filial)) return res.status(400).json({ error: 'Filial inválida.' });
  if (!conta) return res.status(400).json({ error: 'Conta inválida.' });

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    const existe = await client.query(
      'SELECT 1 FROM dbconta WHERE cod_conta = $1 LIMIT 1',
      [conta],
    );
    if (!existe.rows.length) {
      return res.status(400).json({ error: 'Conta inválida.' });
    }

    const { rows } = await client.query(
      `UPDATE tb_user_perfil p
       SET cod_conta = $4
       WHERE p.user_login_id = $1 AND p.perfil_name = $2 AND p.codigo_filial = $3
       RETURNING p.user_login_id || '|' || p.perfil_name || '|' || p.codigo_filial AS id,
                 p.user_login_id AS usuario, p.perfil_name AS perfil,
                 p.codigo_filial AS codigo_filial, p.nome_filial AS filial,
                 p.cod_conta AS cod_conta`,
      [usuario, perfil, filial, conta],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: 'Usuário não possui este perfil nesta filial.' });
    }

    return res.status(201).json(rows[0]);
  } catch (erro: any) {
    console.error('Erro ao vincular operador de caixa:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}
