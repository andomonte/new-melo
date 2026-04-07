import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

/**
 * API - Importar Itens Sugeridos para Requisição
 *
 * Insere os itens selecionados da sugestão automática em uma requisição de compra.
 * Marca os itens com:
 * - itr_base_indicacao = 'SUGESTAO'
 * - itr_quantidade_sugerida = quantidade calculada
 * - itr_data_sugestao = data/hora atual
 */

export interface ItemImportar {
  codprod: string;
  quantidade: number;
  precoUnitario: number;
  baseIndicacao: string; // 'SUGESTAO'
}

export interface ImportarRequest {
  reqId: number;
  reqVersao: number;
  itens: ItemImportar[];
}

export interface ImportarResponse {
  success: boolean;
  itensImportados?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportarResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  const { reqId, reqVersao, itens } = req.body as ImportarRequest;

  // Validações
  if (!reqId || !reqVersao || !itens || itens.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros inválidos. Informe: reqId, reqVersao e itens[]'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se a requisição existe
    const checkReq = await client.query(
      `SELECT req_id, req_versao, req_status FROM db_manaus.cmp_requisicao
       WHERE req_id = $1 AND req_versao = $2`,
      [reqId, reqVersao]
    );

    if (checkReq.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: `Requisição ${reqId}/${reqVersao} não encontrada`
      });
    }

    const requisicao = checkReq.rows[0];

    // Verificar se requisição está editável (não pode estar finalizada/cancelada)
    if (['F', 'C', 'X'].includes(requisicao.req_status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Requisição está ${requisicao.req_status === 'F' ? 'finalizada' : 'cancelada'} e não pode ser editada`
      });
    }

    let itensImportados = 0;

    // Inserir cada item
    for (const item of itens) {
      // Verificar se produto existe
      const checkProd = await client.query(
        `SELECT codprod, descr, ref FROM db_manaus.dbprod WHERE codprod = $1 AND excluido = 0`,
        [item.codprod]
      );

      if (checkProd.rows.length === 0) {
        console.warn(`[Importar] Produto ${item.codprod} não encontrado ou excluído, pulando...`);
        continue;
      }

      const produto = checkProd.rows[0];

      // Verificar se item já existe na requisição
      const checkItem = await client.query(
        `SELECT itr_codprod FROM db_manaus.cmp_it_requisicao
         WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3`,
        [reqId, reqVersao, item.codprod]
      );

      if (checkItem.rows.length > 0) {
        console.warn(`[Importar] Item ${item.codprod} já existe na requisição, pulando...`);
        continue;
      }

      // Inserir item
      await client.query(
        `INSERT INTO db_manaus.cmp_it_requisicao (
          itr_req_id,
          itr_req_versao,
          itr_codprod,
          itr_quantidade,
          itr_pr_unitario,
          itr_base_indicacao,
          itr_quantidade_sugerida,
          itr_data_sugestao,
          itr_quantidade_atendida,
          itr_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 0, 'P')`,
        [
          reqId,
          reqVersao,
          item.codprod,
          item.quantidade,
          item.precoUnitario,
          item.baseIndicacao || 'SUGESTAO',
          item.quantidade, // Quantidade sugerida = quantidade importada
        ]
      );

      itensImportados++;
    }

    if (itensImportados === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Nenhum item foi importado (produtos já existem ou não encontrados)'
      });
    }

    // Commit da transação
    await client.query('COMMIT');

    console.log(`[Importar] ${itensImportados} itens importados para requisição ${reqId}/${reqVersao}`);

    return res.status(200).json({
      success: true,
      itensImportados
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Importar] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao importar itens'
    });
  } finally {
    client.release();
  }
}
