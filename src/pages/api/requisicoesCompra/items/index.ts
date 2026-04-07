// src/pages/api/requisicoesCompra/items/index.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import type { RequisitionItem } from '@/components/corpo/comprador/RequisicoesCompra/types';
import {
  gerarDetalhesAdicaoItem,
  gerarDetalhesRemocaoItem,
  gerarDetalhesEdicaoItem,
  type ProdutoInfo
} from '@/lib/compras/historicoHelper';

interface RawRequisitionItem {
  id?: number;
  req_id: number;
  req_versao: number;
  item_seq: number;
  codprod: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacao?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  quantidade_sugerida?: number;
  base_indicacao?: string;

  // Joined product data
  produto_descr?: string;
  produto_marca?: string;
  produto_ref?: string;
  produto_aplicacao?: string;
  produto_estoque?: number;
  produto_prcompra?: number;
  produto_prvenda?: number;
  produto_unimed?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | {
        data: RequisitionItem[];
        meta?: {
          total: number;
          lastPage: number;
          currentPage: number;
          perPage: number;
        };
      }
    | { error: string }
  >,
) {
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    } else if (req.method === 'POST') {
      return await handlePost(req, res);
    } else if (req.method === 'PUT') {
      return await handlePut(req, res);
    } else if (req.method === 'DELETE') {
      return await handleDelete(req, res);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}

// GET - List items for a requisition
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { req_id, req_versao } = req.query;

  if (!req_id || !req_versao) {
    return res.status(400).json({ 
      error: 'req_id and req_versao are required'
    });
  }

  const sql = `
    SELECT
      ri.itr_req_id as req_id,
      ri.itr_req_versao as req_versao,
      ri.itr_codprod as codprod,
      ri.itr_quantidade as quantidade,
      ri.itr_pr_unitario as preco_unitario,
      (ri.itr_quantidade * ri.itr_pr_unitario) as preco_total,
      ri.itr_base_indicacao as observacao,
      ri.itr_quantidade_atendida as quantidade_atendida,
      ri.itr_quantidade_sugerida as quantidade_sugerida,
      ri.itr_base_indicacao as base_indicacao,
      'ativo' as status,
      CURRENT_TIMESTAMP as created_at,
      CURRENT_TIMESTAMP as updated_at,

      -- Product data
      p.descr as produto_descr,
      p.codmarca as produto_marca,
      p.ref as produto_ref,
      '' as produto_aplicacao,
      COALESCE(p.qtest, 0) as produto_estoque,
      COALESCE(p.prcompra, 0) as produto_prcompra,
      COALESCE(p.prvenda, 0) as produto_prvenda,
      p.unimed as produto_unimed

    FROM db_manaus.cmp_it_requisicao ri
    LEFT JOIN db_manaus.dbprod p ON p.codprod = ri.itr_codprod
    WHERE ri.itr_req_id = $1 AND ri.itr_req_versao = $2
    ORDER BY ri.itr_codprod ASC
  `;

  const client = await pool.connect();
  const { rows } = await client.query<RawRequisitionItem>(sql, [req_id, req_versao]);
  client.release();

  // Map to RequisitionItem format
  const items: RequisitionItem[] = rows.map((row) => ({
    // id não é mais retornado - usar codprod como identificador
    req_id: row.req_id,
    req_versao: row.req_versao,
    item_seq: 0, // Campo deprecado, manter por compatibilidade
    codprod: row.codprod,
    quantidade: row.quantidade,
    preco_unitario: row.preco_unitario,
    preco_total: row.preco_total,
    observacao: row.observacao,
    status: row.status,
    quantidade_atendida: row.quantidade_atendida,
    quantidade_sugerida: row.quantidade_sugerida,
    base_indicacao: row.base_indicacao,
    created_at: row.created_at,
    updated_at: row.updated_at,
    produto: row.produto_descr ? {
      codprod: row.codprod,
      descr: row.produto_descr,
      marca: row.produto_marca || '',
      ref: row.produto_ref,
      aplicacao: row.produto_aplicacao,
      estoque: row.produto_estoque || 0,
      prcompra: row.produto_prcompra || 0,
      prvenda: row.produto_prvenda || 0,
      unimed: row.produto_unimed,
    } : undefined,
  }));

  return res.status(200).json({ data: items });
}

// POST - Create new item
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/requisicoesCompra/items - Body received:', JSON.stringify(req.body, null, 2));

  const {
    req_id,
    req_versao,
    codprod,
    quantidade,
    preco_unitario,
    observacao,
    userId,
    userName,
  } = req.body;

  // Usar dados do usuário recebidos ou fallback para sistema
  const userIdFinal = userId || 'sistema';
  const userNameFinal = userName || 'Sistema';

  // Convert string values to appropriate types
  const req_id_num = Number(req_id);
  const req_versao_num = Number(req_versao);
  const quantidade_num = Number(quantidade);
  const preco_unitario_num = Number(preco_unitario);

  console.log('POST - Extracted values:', { req_id, req_versao, codprod, quantidade, preco_unitario, observacao });
  console.log('POST - Converted values:', { req_id_num, req_versao_num, quantidade_num, preco_unitario_num });

  if (!req_id || !req_versao || !codprod || !quantidade || !preco_unitario) {
    console.log('POST - Validation failed:', { req_id, req_versao, codprod, quantidade, preco_unitario });
    return res.status(400).json({ 
      error: 'req_id, req_versao, codprod, quantidade, and preco_unitario are required',
      received: { req_id, req_versao, codprod, quantidade, preco_unitario }
    });
  }

  // Additional validation for converted numbers
  if (isNaN(req_id_num) || isNaN(req_versao_num) || isNaN(quantidade_num) || isNaN(preco_unitario_num)) {
    console.log('POST - Number validation failed:', { req_id_num, req_versao_num, quantidade_num, preco_unitario_num });
    return res.status(400).json({
      error: 'req_id, req_versao, quantidade, and preco_unitario must be valid numbers',
      received: { req_id, req_versao, quantidade, preco_unitario }
    });
  }

  // Validate price is greater than zero
  if (preco_unitario_num <= 0) {
    console.log('POST - Price validation failed: preco_unitario must be greater than zero');
    return res.status(400).json({
      error: 'Preço unitário deve ser maior que zero',
      received: { preco_unitario: preco_unitario_num }
    });
  }

  // Validate quantity is greater than zero
  if (quantidade_num <= 0) {
    console.log('POST - Quantity validation failed: quantidade must be greater than zero');
    return res.status(400).json({
      error: 'Quantidade deve ser maior que zero',
      received: { quantidade: quantidade_num }
    });
  }

  // Validate codprod length - must be exactly 6 characters
  if (codprod.length !== 6) {
    return res.status(400).json({
      error: `codprod must be exactly 6 characters, received: ${codprod} (${codprod.length} characters)`
    });
  }

  const preco_total = quantidade_num * preco_unitario_num;
  
  const sql = `
    INSERT INTO db_manaus.cmp_it_requisicao (
      itr_req_id, itr_req_versao, itr_codprod, itr_quantidade, 
      itr_pr_unitario, itr_base_indicacao, itr_quantidade_atendida
    ) VALUES ($1, $2, $3, $4, $5, $6, 0)
    RETURNING *
  `;

  console.log('POST - About to execute SQL:', sql);
  console.log('POST - SQL parameters:', [req_id_num, req_versao_num, codprod, quantidade_num, preco_unitario_num, observacao || '']);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert the item
    const { rows } = await client.query(sql, [
      req_id_num,
      req_versao_num,
      codprod,
      quantidade_num,
      preco_unitario_num,
      observacao || ''
    ]);
    console.log('POST - Successfully inserted item:', rows[0]);

    // Fetch product info for history
    const produtoQuery = `
      SELECT descr, codmarca as marca
      FROM db_manaus.dbprod
      WHERE codprod = $1
    `;
    const produtoResult = await client.query(produtoQuery, [codprod]);
    const produto = produtoResult.rows[0];

    // Generate detailed history comment
    const produtoInfo: ProdutoInfo = {
      codprod: codprod,
      descr: produto?.descr || 'Produto não encontrado',
      quantidade: quantidade_num,
      preco_unitario: preco_unitario_num,
      preco_total: preco_total
    };
    const historicoComment = gerarDetalhesAdicaoItem(produtoInfo);

    // Get current requisition status
    const statusQuery = `
      SELECT req_status
      FROM db_manaus.cmp_requisicao
      WHERE req_id = $1 AND req_versao = $2
    `;
    const statusResult = await client.query(statusQuery, [req_id_num, req_versao_num]);
    const currentStatus = statusResult.rows[0]?.req_status || 'P';

    // Insert history record
    const historicoSql = `
      INSERT INTO db_manaus.cmp_requisicao_historico (
        req_id, req_versao, previous_status, new_status,
        user_id, user_name, reason, comments, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    await client.query(historicoSql, [
      req_id_num,
      req_versao_num,
      currentStatus,
      currentStatus,
      userIdFinal,
      userNameFinal,
      'Item adicionado',
      historicoComment
    ]);

    await client.query('COMMIT');
    client.release();

    return res.status(201).json({ data: [rows[0]] });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('POST - Error inserting item:', error);
    console.error('POST - Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      detail: (error as any)?.detail
    });
    throw error; // Re-throw to be caught by outer handler
  }
}

// PUT - Update existing item
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const {
    req_id,
    req_versao,
    codprod,
    quantidade,
    preco_unitario,
    observacao,
    userId,
    userName,
  } = req.body;

  // Usar dados do usuário recebidos ou fallback para sistema
  const userIdFinal = userId || 'sistema';
  const userNameFinal = userName || 'Sistema';

  if (!req_id || !req_versao || !codprod) {
    return res.status(400).json({ error: 'req_id, req_versao and codprod are required' });
  }

  // Validate price is greater than zero if being updated
  if (preco_unitario !== undefined && Number(preco_unitario) <= 0) {
    return res.status(400).json({
      error: 'Preço unitário deve ser maior que zero',
      received: { preco_unitario }
    });
  }

  // Validate quantity is greater than zero if being updated
  if (quantidade !== undefined && Number(quantidade) <= 0) {
    return res.status(400).json({
      error: 'Quantidade deve ser maior que zero',
      received: { quantidade }
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current item values
    const currentQuery = `
      SELECT
        ri.itr_codprod as codprod,
        ri.itr_quantidade as quantidade,
        ri.itr_pr_unitario as preco_unitario,
        ri.itr_base_indicacao as observacao,
        p.descr as descr
      FROM db_manaus.cmp_it_requisicao ri
      LEFT JOIN db_manaus.dbprod p ON p.codprod = ri.itr_codprod
      WHERE ri.itr_req_id = $1 AND ri.itr_req_versao = $2 AND ri.itr_codprod = $3
    `;
    const currentResult = await client.query(currentQuery, [req_id, req_versao, codprod]);

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Item not found' });
    }

    const currentItem = currentResult.rows[0];

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    if (quantidade !== undefined) {
      updates.push(`itr_quantidade = $${valueIndex++}`);
      values.push(quantidade);
    }

    if (preco_unitario !== undefined) {
      updates.push(`itr_pr_unitario = $${valueIndex++}`);
      values.push(preco_unitario);
    }

    if (observacao !== undefined) {
      updates.push(`itr_base_indicacao = $${valueIndex++}`);
      values.push(observacao);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add WHERE clause parameters
    values.push(req_id, req_versao, codprod);

    const sql = `
      UPDATE db_manaus.cmp_it_requisicao
      SET ${updates.join(', ')}
      WHERE itr_req_id = $${valueIndex++}
        AND itr_req_versao = $${valueIndex++}
        AND itr_codprod = $${valueIndex}
      RETURNING *
    `;

    const { rows } = await client.query(sql, values);

    // Track what changed for history
    const camposAlterados: any = {};

    if (quantidade !== undefined && Number(quantidade) !== Number(currentItem.quantidade)) {
      camposAlterados.quantidade = {
        anterior: Number(currentItem.quantidade),
        novo: Number(quantidade)
      };
    }

    if (preco_unitario !== undefined && Number(preco_unitario) !== Number(currentItem.preco_unitario)) {
      camposAlterados.preco_unitario = {
        anterior: Number(currentItem.preco_unitario),
        novo: Number(preco_unitario)
      };
    }

    if (observacao !== undefined && observacao !== currentItem.observacao) {
      camposAlterados.observacao = {
        anterior: currentItem.observacao || '',
        novo: observacao
      };
    }

    // Only create history if something actually changed
    if (Object.keys(camposAlterados).length > 0) {
      // Generate detailed history comment
      const produtoInfo: ProdutoInfo = {
        codprod: currentItem.codprod,
        descr: currentItem.descr || 'Produto não encontrado'
      };
      const historicoComment = gerarDetalhesEdicaoItem(produtoInfo, camposAlterados);

      // Get current requisition status
      const statusQuery = `
        SELECT req_status
        FROM db_manaus.cmp_requisicao
        WHERE req_id = $1 AND req_versao = $2
      `;
      const statusResult = await client.query(statusQuery, [req_id, req_versao]);
      const currentStatus = statusResult.rows[0]?.req_status || 'P';

      // Insert history record
      const historicoSql = `
        INSERT INTO db_manaus.cmp_requisicao_historico (
          req_id, req_versao, previous_status, new_status,
          user_id, user_name, reason, comments, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `;
      await client.query(historicoSql, [
        req_id,
        req_versao,
        currentStatus,
        currentStatus,
        userIdFinal,
        userNameFinal,
        'Item editado',
        historicoComment
      ]);
    }

    await client.query('COMMIT');
    client.release();

    return res.status(200).json({ data: [rows[0]] });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('PUT - Error updating item:', error);
    throw error;
  }
}

// DELETE - Remove item
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const { req_id, req_versao, codprod, userId, userName } = req.query;

  // Usar dados do usuário recebidos ou fallback para sistema
  const userIdFinal = (userId as string) || 'sistema';
  const userNameFinal = (userName as string) || 'Sistema';

  if (!req_id || !req_versao || !codprod) {
    return res.status(400).json({ error: 'req_id, req_versao and codprod are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch item info before deletion
    const itemQuery = `
      SELECT
        ri.itr_codprod as codprod,
        ri.itr_quantidade as quantidade,
        ri.itr_pr_unitario as preco_unitario,
        (ri.itr_quantidade * ri.itr_pr_unitario) as preco_total,
        p.descr as descr
      FROM db_manaus.cmp_it_requisicao ri
      LEFT JOIN db_manaus.dbprod p ON p.codprod = ri.itr_codprod
      WHERE ri.itr_req_id = $1 AND ri.itr_req_versao = $2 AND ri.itr_codprod = $3
    `;
    const itemResult = await client.query(itemQuery, [req_id, req_versao, codprod]);

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Delete the item
    const deleteSql = `
      DELETE FROM db_manaus.cmp_it_requisicao
      WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
      RETURNING *
    `;
    const { rows } = await client.query(deleteSql, [req_id, req_versao, codprod]);

    // Generate detailed history comment
    const produtoInfo: ProdutoInfo = {
      codprod: item.codprod,
      descr: item.descr || 'Produto não encontrado',
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      preco_total: item.preco_total
    };
    const historicoComment = gerarDetalhesRemocaoItem(produtoInfo);

    // Get current requisition status
    const statusQuery = `
      SELECT req_status
      FROM db_manaus.cmp_requisicao
      WHERE req_id = $1 AND req_versao = $2
    `;
    const statusResult = await client.query(statusQuery, [req_id, req_versao]);
    const currentStatus = statusResult.rows[0]?.req_status || 'P';

    // Insert history record
    const historicoSql = `
      INSERT INTO db_manaus.cmp_requisicao_historico (
        req_id, req_versao, previous_status, new_status,
        user_id, user_name, reason, comments, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    await client.query(historicoSql, [
      req_id,
      req_versao,
      currentStatus,
      currentStatus,
      userIdFinal,
      userNameFinal,
      'Item removido',
      historicoComment
    ]);

    await client.query('COMMIT');
    client.release();

    return res.status(200).json({ data: [rows[0]] });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('DELETE - Error removing item:', error);
    throw error;
  }
}