/**
 * GET /api/importacao/[id]  - Retorna dados completos (cabeçalho + contratos + entradas + itens)
 * PUT /api/importacao/[id]  - Atualiza cabeçalho + contratos (delete all + re-insert)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

// --- GET Queries ---

const QUERY_CABECALHO = `
  SELECT *
  FROM db_manaus.dbent_importacao
  WHERE id = $1
`;

const QUERY_CONTRATOS = `
  SELECT *
  FROM db_manaus.dbent_importacao_contratos
  WHERE id_importacao = $1
  ORDER BY id
`;

const QUERY_ENTRADAS = `
  SELECT *
  FROM db_manaus.dbent_importacao_entrada
  WHERE id_importacao = $1
  ORDER BY id
`;

const QUERY_ITENS = `
  SELECT *
  FROM db_manaus.dbent_importacao_it_ent
  WHERE id_importacao = $1
  ORDER BY numero_adicao, codprod
`;

// --- PUT Queries ---

const UPDATE_CABECALHO = `
  UPDATE db_manaus.dbent_importacao SET
    nro_di = $2,
    data_di = $3,
    tipo_die = $4,
    taxa_dolar = $5,
    total_mercadoria = $6,
    frete = $7,
    seguro = $8,
    thc = $9,
    total_cif = $10,
    pis = $11,
    cofins = $12,
    pis_cofins = $13,
    ii = $14,
    ipi = $15,
    icms_st = $16,
    anuencia = $17,
    siscomex = $18,
    contrato_cambio = $19,
    despachante = $20,
    freteorigem_total = $21,
    infraero_porto = $22,
    carreteiro_eadi = $23,
    carreteiro_melo = $24,
    eadi = $25,
    peso_liquido = $26,
    recinto_aduaneiro = $27,
    pais_procedencia = $28,
    qtd_adicoes = $29,
    navio = $30,
    data_entrada_brasil = $31,
    inscricao_suframa = $32,
    updated_at = NOW()
  WHERE id = $1 AND status = 'N'
  RETURNING id
`;

const DELETE_CONTRATOS = `
  DELETE FROM db_manaus.dbent_importacao_contratos
  WHERE id_importacao = $1
`;

const INSERT_CONTRATO = `
  INSERT INTO db_manaus.dbent_importacao_contratos (
    id_importacao, contrato, data, taxa_dolar, vl_merc_dolar, vl_reais, moeda, id_titulo_pagar
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

const UPDATE_ENTRADA = `
  UPDATE db_manaus.dbent_importacao_entrada SET
    cod_credor = $2,
    fornecedor_nome = $3,
    cod_cliente = $4,
    cod_comprador = $5
  WHERE id = $1
`;

const INSERT_ENTRADA = `
  INSERT INTO db_manaus.dbent_importacao_entrada (
    id_importacao, cod_credor, fornecedor_nome, cod_cliente, cod_comprador
  ) VALUES ($1, $2, $3, $4, $5)
  RETURNING id
`;

const DELETE_ITENS_BY_FATURA = `
  DELETE FROM db_manaus.dbent_importacao_it_ent
  WHERE id_importacao = $1 AND id_fatura = $2
`;

const INSERT_ITEM = `
  INSERT INTO db_manaus.dbent_importacao_it_ent (
    id_importacao, id_fatura, codprod, descricao, qtd,
    proforma_unit, proforma_total, invoice_unit, invoice_total,
    ncm, unidade, numero_adicao, id_orc
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = parseInt(req.query.id as string, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  if (req.method === 'GET') {
    return handleGet(pool, id, res);
  }

  if (req.method === 'PUT') {
    return handlePut(pool, id, req, res);
  }

  return res.status(405).json({ message: 'Método não permitido' });
}

async function handleGet(pool: any, id: number, res: NextApiResponse) {
  try {
    const [cabResult, contratosResult, entradasResult, itensResult] = await Promise.all([
      pool.query(QUERY_CABECALHO, [id]),
      pool.query(QUERY_CONTRATOS, [id]),
      pool.query(QUERY_ENTRADAS, [id]),
      pool.query(QUERY_ITENS, [id]),
    ]);

    if (cabResult.rows.length === 0) {
      return res.status(404).json({ message: `Importação #${id} não encontrada` });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...cabResult.rows[0],
        contratos: contratosResult.rows,
        entradas: entradasResult.rows,
        itens: itensResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar importação:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao buscar importação',
    });
  }
}

async function handlePut(pool: any, id: number, req: NextApiRequest, res: NextApiResponse) {
  const body = req.body;
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se a importação existe e está editável (status = 'N')
    const check = await client.query(
      'SELECT id, status FROM db_manaus.dbent_importacao WHERE id = $1',
      [id],
    );

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Importação #${id} não encontrada` });
    }

    if (check.rows[0].status !== 'N') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Importação #${id} não pode ser editada (status: ${check.rows[0].status})`,
      });
    }

    // Atualizar cabeçalho
    const result = await client.query(UPDATE_CABECALHO, [
      id,
      body.nro_di || null,
      body.data_di || null,
      body.tipo_die || null,
      body.taxa_dolar || 0,
      body.total_mercadoria || 0,
      body.frete || 0,
      body.seguro || 0,
      body.thc || 0,
      body.total_cif || 0,
      body.pis || 0,
      body.cofins || 0,
      body.pis_cofins || 0,
      body.ii || 0,
      body.ipi || 0,
      body.icms_st || 0,
      body.anuencia || 0,
      body.siscomex || 0,
      body.contrato_cambio || 0,
      body.despachante || 0,
      body.freteorigem_total || 0,
      body.infraero_porto || 0,
      body.carreteiro_eadi || 0,
      body.carreteiro_melo || 0,
      body.eadi || 0,
      body.peso_liquido || 0,
      body.recinto_aduaneiro || null,
      body.pais_procedencia || null,
      body.qtd_adicoes || 0,
      body.navio || null,
      body.data_entrada_brasil || null,
      body.inscricao_suframa || null,
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Não foi possível atualizar a importação' });
    }

    // Contratos: delete all + re-insert (mesma lógica do Oracle DEL/INC_IMPORTACAO_CONTRATOS)
    if (body.contratos !== undefined) {
      await client.query(DELETE_CONTRATOS, [id]);

      const contratos = body.contratos || [];
      for (const c of contratos) {
        await client.query(INSERT_CONTRATO, [
          id,
          c.contrato || '',
          c.data || null,
          c.taxa_dolar || 0,
          c.vl_merc_dolar || 0,
          c.vl_reais || ((c.vl_merc_dolar || 0) * (c.taxa_dolar || 0)),
          c.moeda || 'USD',
          c.id_titulo_pagar || null,
        ]);
      }
    }

    // Faturas (entradas): update existentes, insert novas, + itens
    if (body.faturas !== undefined) {
      const faturas = body.faturas || [];
      for (const fatura of faturas) {
        let faturaId = fatura.id;

        if (faturaId) {
          // Fatura existente: atualizar dados da entrada
          await client.query(UPDATE_ENTRADA, [
            faturaId,
            fatura.cod_credor || null,
            fatura.fornecedor_nome || null,
            fatura.cod_cliente || null,
            fatura.cod_comprador || null,
          ]);

          // Deletar itens antigos desta fatura
          await client.query(DELETE_ITENS_BY_FATURA, [id, faturaId]);
        } else {
          // Nova fatura: inserir entrada
          const entradaResult = await client.query(INSERT_ENTRADA, [
            id,
            fatura.cod_credor || null,
            fatura.fornecedor_nome || null,
            fatura.cod_cliente || null,
            fatura.cod_comprador || null,
          ]);
          faturaId = entradaResult.rows[0].id;
        }

        // Inserir itens (re-insert ou novos)
        const itens = fatura.itens || [];
        for (const item of itens) {
          const qtd = parseFloat(item.qtd) || 0;
          const proformaUnit = parseFloat(item.proforma_unit) || 0;
          const invoiceUnit = parseFloat(item.invoice_unit) || 0;

          await client.query(INSERT_ITEM, [
            id,
            faturaId,
            item.codprod || null,
            item.descricao || '',
            qtd,
            proformaUnit,
            qtd * proformaUnit,
            invoiceUnit,
            qtd * invoiceUnit,
            item.ncm || null,
            item.unidade || null,
            item.numero_adicao || null,
            item.id_orc || null,
          ]);
        }
      }
    }

    await client.query('COMMIT');

    console.log(`Importação atualizada: ID=${id}, DI=${body.nro_di}`);

    return res.status(200).json({
      success: true,
      message: `Importação atualizada com sucesso`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar importação:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao atualizar importação',
    });
  } finally {
    client.release();
  }
}
