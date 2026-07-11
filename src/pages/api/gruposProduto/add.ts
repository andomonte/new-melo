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
  const {
    codgpp: codgppRaw,
    descr: descrRaw,
    codseg,
    codcomprador,
    codgpc,
    bloquear_preco,
    diasreposicao,
    ramonegocio,
    p_comercial,
    v_marketing,
  } = req.body;

  // Normalização conforme schema: uppercase para codgpp e descr
  let codgpp = codgppRaw?.toString().trim().toUpperCase() || '';
  const descr = descrRaw?.toString().trim().toUpperCase();

  // Demais campos do cadastro (igual ao Delphi)
  const segVal = codseg ? String(codseg).trim() : null;
  // Comprador: quando não informado, grava o padrão '000' (COMPRA ANTIGA),
  // igual ao Delphi.
  const compVal = codcomprador ? String(codcomprador).trim() : '000';
  const gpcVal = codgpc ? String(codgpc).trim() : null;
  const bloqVal = bloquear_preco === 'S' ? 'S' : 'N';
  const ramoVal = ramonegocio === 'S' ? 'S' : 'N';
  const diasVal = Number.isFinite(Number(diasreposicao))
    ? Math.trunc(Number(diasreposicao))
    : 0;
  const pcomVal = Number.isFinite(Number(p_comercial))
    ? Math.trunc(Number(p_comercial))
    : 0;
  const vmktVal = Number.isFinite(Number(v_marketing))
    ? Number(v_marketing)
    : 0;

  if (!descr || descr === '') {
    return res.status(400).json({
      error: 'A descrição do grupo de produtos (descr) é obrigatória.',
      field: 'descr',
    });
  }

  // Segmento é obrigatório (igual ao Delphi).
  if (!segVal) {
    return res.status(400).json({
      error: 'O Segmento é obrigatório.',
      field: 'codseg',
    });
  }

  // Código é gerado automaticamente quando não informado (igual ao Delphi).
  // Se informado, valida o formato.
  if (codgpp && !/^[A-Z0-9]+$/.test(codgpp)) {
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

    // Gera o próximo código numérico (zero-padded a 5) quando não informado
    if (!codgpp) {
      const maxRes = await client.query(
        `SELECT codgpp FROM dbgpprod WHERE codgpp ~ '^[0-9]+$'
         ORDER BY CAST(codgpp AS INTEGER) DESC LIMIT 1`,
      );
      const maxNum = maxRes.rows[0]?.codgpp
        ? parseInt(maxRes.rows[0].codgpp, 10)
        : 0;
      codgpp = String(maxNum + 1).padStart(5, '0');
    }

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

    // Insere o novo grupo. Descontos/comissões/margens = 0 (igual ao Delphi).
    const result = await client.query(
      `INSERT INTO dbgpprod (
         codgpp, descr, codseg, codcomprador, codgpc, bloquear_preco,
         diasreposicao, ramonegocio, p_comercial, v_marketing,
         comgpp, comgpptmk, comgppextmk,
         descbalcao, dscrev30, dscrev45, dscrev60,
         dscrv30, dscrv45, dscrv60, dscbv30, dscbv45, dscbv60,
         dscpv30, dscpv45, dscpv60,
         margem_min_venda, margem_med_venda, margem_ide_venda
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         0,0,0, 0,0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0
       ) RETURNING codgpp, descr`,
      [
        codgpp,
        descr,
        segVal,
        compVal,
        gpcVal,
        bloqVal,
        diasVal,
        ramoVal,
        pcomVal,
        vmktVal,
      ],
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
