/**
 * POST /api/importacao/post
 * Cria nova importação a partir dos dados do XML da DI
 *
 * Body:
 * - nro_di, data_di, tipo_die, taxa_dolar, total_mercadoria, frete, seguro, thc,
 *   total_cif, ii, ipi, pis_cofins, siscomex, peso_liquido, recinto_aduaneiro,
 *   pais_procedencia, qtd_adicoes, navio, data_entrada_brasil, inscricao_suframa,
 *   anuencia, despachante, freteorigem_total, infraero_porto, carreteiro_eadi,
 *   carreteiro_melo, eadi, contrato_cambio, xml_original
 * - contratos: Array<{ contrato, vl_merc_dolar, moeda }>
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

const INSERT_IMPORTACAO = `
  INSERT INTO db_manaus.dbent_importacao (
    nro_di, data_di, status, tipo_die, taxa_dolar,
    total_mercadoria, frete, seguro, thc, total_cif,
    pis_cofins, ii, ipi, siscomex,
    anuencia, despachante, freteorigem_total, infraero_porto,
    carreteiro_eadi, carreteiro_melo, eadi, contrato_cambio,
    peso_liquido, recinto_aduaneiro, pais_procedencia, qtd_adicoes,
    navio, data_entrada_brasil, inscricao_suframa,
    xml_original, codusr, data_cad
  ) VALUES (
    $1, $2, 'N', $3, $4,
    $5, $6, $7, $8, $9,
    $10, $11, $12, $13,
    $14, $15, $16, $17,
    $18, $19, $20, $21,
    $22, $23, $24, $25,
    $26, $27, $28,
    $29, $30, NOW()
  ) RETURNING id
`;

const INSERT_CONTRATO = `
  INSERT INTO db_manaus.dbent_importacao_contratos (
    id_importacao, contrato, vl_merc_dolar, moeda, taxa_dolar, vl_reais, data
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
`;

const INSERT_ENTRADA = `
  INSERT INTO db_manaus.dbent_importacao_entrada (
    id_importacao, fornecedor_nome
  ) VALUES ($1, $2)
  RETURNING id
`;

const INSERT_ITEM = `
  INSERT INTO db_manaus.dbent_importacao_it_ent (
    id_importacao, id_fatura, descricao, qtd,
    proforma_unit, proforma_total, invoice_unit, invoice_total,
    ncm, unidade, numero_adicao
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  // Usuário vindo do interceptor do axios
  let codusr = 'SISTEMA';
  try {
    const headerData = req.headers['x-user-data'];
    if (headerData) {
      const userData = JSON.parse(decodeURIComponent(headerData as string));
      codusr = userData.usuario || 'SISTEMA';
    }
  } catch { /* ignora */ }

  const body = req.body;

  if (!body.nro_di) {
    return res.status(400).json({ message: 'Nº da DI é obrigatório' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verificar se já existe DI com esse número
    const existente = await client.query(
      'SELECT id FROM db_manaus.dbent_importacao WHERE nro_di = $1',
      [body.nro_di],
    );

    if (existente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `DI ${body.nro_di} já cadastrada (ID: ${existente.rows[0].id})`,
      });
    }

    // Inserir cabeçalho
    const result = await client.query(INSERT_IMPORTACAO, [
      body.nro_di,
      body.data_di || null,
      body.tipo_die || null,
      body.taxa_dolar || 0,
      body.total_mercadoria || 0,
      body.frete || 0,
      body.seguro || 0,
      body.thc || 0,
      body.total_cif || 0,
      body.pis_cofins || 0,
      body.ii || 0,
      body.ipi || 0,
      body.siscomex || 0,
      body.anuencia || 0,
      body.despachante || 0,
      body.freteorigem_total || 0,
      body.infraero_porto || 0,
      body.carreteiro_eadi || 0,
      body.carreteiro_melo || 0,
      body.eadi || 0,
      body.contrato_cambio || 0,
      body.peso_liquido || 0,
      body.recinto_aduaneiro || null,
      body.pais_procedencia || null,
      body.qtd_adicoes || 0,
      body.navio || null,
      body.data_entrada_brasil || null,
      body.inscricao_suframa || null,
      body.xml_original || null,
      codusr,
    ]);

    const importacaoId = result.rows[0].id;

    // Inserir contratos de câmbio
    const taxaDolarDI = parseFloat(body.taxa_dolar) || 0;
    const contratos = body.contratos || [];
    for (const contrato of contratos) {
      const vlMercDolar = parseFloat(contrato.vl_merc_dolar) || 0;
      const vlReais = vlMercDolar * taxaDolarDI;
      await client.query(INSERT_CONTRATO, [
        importacaoId,
        contrato.contrato,
        vlMercDolar,
        contrato.moeda || 'USD',
        taxaDolarDI,
        vlReais,
        contrato.data || null,
      ]);
    }

    // Inserir fornecedores/faturas extraídos do XML + itens
    const fornecedores = body.fornecedores || [];
    for (const f of fornecedores) {
      const entradaResult = await client.query(INSERT_ENTRADA, [
        importacaoId,
        f.fornecedor_nome || '',
      ]);
      const faturaId = entradaResult.rows[0].id;

      // Inserir itens desta fatura
      const itens = f.itens || [];
      for (const item of itens) {
        const qtd = parseFloat(item.qtd) || 0;
        const proformaUnit = parseFloat(item.proforma_unit) || 0;
        const invoiceUnit = parseFloat(item.invoice_unit) || 0;

        await client.query(INSERT_ITEM, [
          importacaoId,
          faturaId,
          item.descricao || '',
          qtd,
          proformaUnit,
          qtd * proformaUnit,
          invoiceUnit,
          qtd * invoiceUnit,
          item.ncm || null,
          item.unidade || null,
          item.numero_adicao || null,
        ]);
      }
    }

    await client.query('COMMIT');

    console.log(`Importação criada: ID=${importacaoId}, DI=${body.nro_di}, user=${codusr}`);

    return res.status(201).json({
      success: true,
      id: importacaoId,
      message: `Importação ${body.nro_di} criada com sucesso`,
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao criar importação:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao criar importação',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
