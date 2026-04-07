// API para adicionar múltiplos itens em lote com histórico agrupado
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { gerarDetalhesAdicaoItensEmLote, type ProdutoInfo } from '@/lib/compras/historicoHelper';

interface BatchItemRequest {
  req_id: number | string;
  req_versao: number;
  userId?: string;
  userName?: string;
  items: Array<{
    codprod: string;
    quantidade: number;
    preco_unitario: number;
    observacao?: string;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { req_id, req_versao, items, userId, userName } = req.body as BatchItemRequest;

  if (!req_id || !req_versao || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'req_id, req_versao e items são obrigatórios'
    });
  }

  // Validar cada item
  for (const item of items) {
    if (!item.codprod || item.codprod.length !== 6) {
      return res.status(400).json({
        success: false,
        message: `codprod deve ter exatamente 6 caracteres: ${item.codprod}`
      });
    }
    if (!item.quantidade || item.quantidade <= 0) {
      return res.status(400).json({
        success: false,
        message: `Quantidade deve ser maior que zero para o produto ${item.codprod}`
      });
    }
    if (!item.preco_unitario || item.preco_unitario <= 0) {
      return res.status(400).json({
        success: false,
        message: `Preço unitário deve ser maior que zero para o produto ${item.codprod}`
      });
    }
  }

  const userIdFinal = userId || 'sistema';
  const userNameFinal = userName || 'Sistema';
  const req_id_num = Number(req_id);
  const req_versao_num = Number(req_versao);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Buscar informações dos produtos para o histórico
    const codprods = items.map(i => i.codprod);
    const produtosQuery = `
      SELECT codprod, descr, ref, codmarca as marca
      FROM db_manaus.dbprod
      WHERE codprod = ANY($1)
    `;
    const produtosResult = await client.query(produtosQuery, [codprods]);
    const produtosMap = new Map(produtosResult.rows.map(p => [p.codprod, p]));

    // Inserir todos os itens
    const insertedItems: any[] = [];
    const produtosInfo: ProdutoInfo[] = [];

    for (const item of items) {
      const preco_total = item.quantidade * item.preco_unitario;

      const insertSql = `
        INSERT INTO db_manaus.cmp_it_requisicao (
          itr_req_id, itr_req_versao, itr_codprod, itr_quantidade,
          itr_pr_unitario, itr_base_indicacao, itr_quantidade_atendida
        ) VALUES ($1, $2, $3, $4, $5, $6, 0)
        ON CONFLICT (itr_req_id, itr_req_versao, itr_codprod)
        DO UPDATE SET
          itr_quantidade = cmp_it_requisicao.itr_quantidade + EXCLUDED.itr_quantidade,
          itr_pr_unitario = EXCLUDED.itr_pr_unitario,
          itr_base_indicacao = EXCLUDED.itr_base_indicacao
        RETURNING *
      `;

      const { rows } = await client.query(insertSql, [
        req_id_num,
        req_versao_num,
        item.codprod,
        item.quantidade,
        item.preco_unitario,
        item.observacao || ''
      ]);

      insertedItems.push(rows[0]);

      // Adicionar info do produto para o histórico
      const produtoDb = produtosMap.get(item.codprod);
      produtosInfo.push({
        codprod: item.codprod,
        descr: produtoDb?.descr || 'Produto não encontrado',
        ref: produtoDb?.ref,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_total: preco_total
      });
    }

    // Buscar status atual da requisição
    const statusQuery = `
      SELECT req_status
      FROM db_manaus.cmp_requisicao
      WHERE req_id = $1 AND req_versao = $2
    `;
    const statusResult = await client.query(statusQuery, [req_id_num, req_versao_num]);
    const currentStatus = statusResult.rows[0]?.req_status || 'P';

    // Gerar comentário agrupado para o histórico
    const historicoComment = gerarDetalhesAdicaoItensEmLote(produtosInfo);

    // Inserir UMA ÚNICA entrada no histórico
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
      `${items.length} item(ns) adicionado(s)`,
      historicoComment
    ]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `${items.length} item(ns) adicionado(s) com sucesso`,
      data: insertedItems,
      summary: {
        total: items.length,
        totalValue: produtosInfo.reduce((sum, p) => sum + (p.preco_total || 0), 0)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao adicionar itens em lote:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao adicionar itens'
    });
  } finally {
    client.release();
  }
}
