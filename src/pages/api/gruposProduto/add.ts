// src/pages/api/gruposProduto/add.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Verifique se a requisição é um POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  // Extrai e normaliza os dados do body
  const { codgpp: codgppRaw, descr: descrRaw } = req.body;

  // Normalização conforme schema: uppercase para codgpp e descr
  const codgpp = codgppRaw?.toString().trim().toUpperCase();
  const descr = descrRaw?.toString().trim().toUpperCase();

  // Validação básica dos dados recebidos
  if (!codgpp || codgpp === '') {
    return res.status(400).json({
      error: 'O código do grupo de produtos (codgpp) é obrigatório.',
      field: 'codgpp',
    });
  }

  if (!descr || descr === '') {
    return res.status(400).json({
      error: 'A descrição do grupo de produtos (descr) é obrigatória.',
      field: 'descr',
    });
  }

  // Validação de formato do codgpp (letras maiúsculas e números apenas)
  if (!/^[A-Z0-9]+$/.test(codgpp)) {
    return res.status(400).json({
      error:
        'Código deve conter apenas letras maiúsculas e números, sem espaços.',
      field: 'codgpp',
    });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia a transação
    await client.query('BEGIN');

    // Verifica duplicatas ANTES de inserir (prevenção mais robusta)
    const checkDuplicate = await client.query(
      `SELECT codgpp, descr FROM dbgpprod WHERE UPPER(codgpp) = $1 OR UPPER(descr) = $2`,
      [codgpp, descr],
    );

    if (checkDuplicate.rows.length > 0) {
      const existing = checkDuplicate.rows[0];
      await client.query('ROLLBACK');

      if (existing.codgpp.toUpperCase() === codgpp) {
        return res.status(409).json({
          // 409 Conflict
          error: `Já existe um grupo de produtos com o código "${codgpp}".`,
          field: 'codgpp',
          existingRecord: existing,
        });
      } else {
        return res.status(409).json({
          error: `Já existe um grupo de produtos com a descrição "${descr}".`,
          field: 'descr',
          existingRecord: existing,
        });
      }
    }

    // Insere o novo grupo de produtos na tabela dbgpprod
    const result = await client.query(
      `INSERT INTO dbgpprod (codgpp, descr) VALUES ($1, $2) RETURNING codgpp, descr`,
      [codgpp, descr],
    );

    const novoGrupo = result.rows[0];

    // Confirma a transação
    await client.query('COMMIT');

    res.status(201).json({
      message: `Grupo de produtos "${novoGrupo.descr}" adicionado com sucesso.`,
      data: novoGrupo,
    });
  } catch (error: any) {
    // Reverte em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('🚨 Erro ao adicionar grupo de produtos:', error);

    // Tratamento detalhado de erros PostgreSQL
    let errorMessage = 'Erro ao adicionar grupo de produtos';
    let field: string | undefined;
    let statusCode = 500;

    if (error.code === '23505') {
      // PostgreSQL unique violation
      statusCode = 409; // Conflict

      // Identifica qual constraint foi violada
      if (error.constraint === 'undbgpproddescr') {
        errorMessage = `Já existe um grupo de produtos com a descrição "${descr}".`;
        field = 'descr';
      } else if (
        error.constraint === 'dbgpprod_pkey' ||
        error.detail?.includes('codgpp')
      ) {
        errorMessage = `Já existe um grupo de produtos com o código "${codgpp}".`;
        field = 'codgpp';
      } else {
        errorMessage = 'Já existe um grupo de produtos com estes dados.';
      }
    } else if (error.code === '23502') {
      // NOT NULL violation
      statusCode = 400;
      errorMessage = `Campo obrigatório não preenchido: ${
        error.column || 'desconhecido'
      }`;
      field = error.column;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      error: errorMessage,
      field,
      code: error.code,
      detail: error.detail,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
