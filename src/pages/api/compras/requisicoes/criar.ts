import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface RequisicaoData {
  tipo: string;
  cod_fornecedor: string;
  cod_comprador: string;
  entrega_em: number;
  destinado_para: number;
  condicoes_pagto?: string;
  observacao?: string;
  previsao_chegada?: string;
}

interface RequisicaoCriada {
  req_id: number;
  req_versao: number;
  req_id_composto: string;
  req_data: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RequisicaoCriada | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    tipo,
    cod_fornecedor,
    cod_comprador,
    entrega_em,
    destinado_para,
    condicoes_pagto,
    observacao,
    previsao_chegada
  }: RequisicaoData = req.body;

  // Validações básicas
  if (!tipo || !cod_fornecedor || !cod_comprador || !entrega_em || !destinado_para) {
    return res.status(400).json({ 
      error: 'Campos obrigatórios: tipo, cod_fornecedor, cod_comprador, entrega_em, destinado_para' 
    });
  }

  try {
    const client = await pool.connect();

    // Validar se o fornecedor existe (BUG-005 fix)
    const fornecedorCheck = await client.query(
      'SELECT cod_credor FROM db_manaus.dbcredor WHERE cod_credor = $1',
      [cod_fornecedor]
    );
    if (fornecedorCheck.rows.length === 0) {
      client.release();
      return res.status(400).json({ error: `Fornecedor nao encontrado: ${cod_fornecedor}` });
    }

    // Validar se o comprador existe (BUG-005 fix)
    const compradorCheck = await client.query(
      'SELECT codcomprador FROM db_manaus.dbcompradores WHERE codcomprador = $1',
      [cod_comprador]
    );
    if (compradorCheck.rows.length === 0) {
      client.release();
      return res.status(400).json({ error: `Comprador nao encontrado: ${cod_comprador}` });
    }

    // Gerar próximo ID
    const nextIdResult = await client.query(`
      SELECT COALESCE(MAX(req_id), 0) + 1 as next_id
      FROM cmp_requisicao
    `);
    const nextId = nextIdResult.rows[0].next_id;
    
    // Gerar ID composto (formato: TIPOMMDDANOXXXXX)
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const sequence = String(nextId).padStart(5, '0');
    const reqIdComposto = `${tipo}${month}${day}${year}${sequence}`;
    
    // Inserir requisição
    const insertQuery = `
      INSERT INTO cmp_requisicao (
        req_id,
        req_versao,
        req_id_composto,
        req_data,
        req_status,
        req_tipo,
        req_cod_credor,
        req_codcomprador,
        req_unm_id_entrega,
        req_unm_id_destino,
        req_cond_pagto,
        req_observacao,
        req_previsao_chegada,
        req_situacao
      ) VALUES (
        $1, 1, $2, NOW(), 'P', $3, $4, $5, $6, $7, $8, $9, $10, 1
      )
      RETURNING 
        req_id, 
        req_versao, 
        req_id_composto, 
        to_char(req_data, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as req_data
    `;
    
    const result = await client.query<RequisicaoCriada>(insertQuery, [
      nextId,
      reqIdComposto,
      tipo,
      cod_fornecedor,
      cod_comprador,
      entrega_em,
      destinado_para,
      condicoes_pagto || null,
      observacao || null,
      previsao_chegada || null
    ]);
    
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Falha ao criar requisição' });
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar requisição:', err);
    res.status(500).json({ error: 'Falha ao criar requisição de compra.' });
  }
}