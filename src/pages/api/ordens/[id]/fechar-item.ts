/**
 * API para fechar um item da ordem de compra
 *
 * POST /api/ordens/[id]/fechar-item
 * Body: { codprod: string, userId?: string, userName?: string }
 *
 * Fecha toda a pendência do item (quantidade = quantidade_atendida)
 * Move a diferença para quantidade_fechada
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { codprod, userId, userName } = req.body;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem inválido'
    });
  }

  if (!codprod) {
    return res.status(400).json({
      success: false,
      message: 'Código do produto é obrigatório'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar dados da ordem
    const ordemResult = await client.query(
      `SELECT orc_id, orc_req_id, orc_req_versao, orc_status
       FROM db_manaus.cmp_ordem_compra
       WHERE orc_id = $1`,
      [id]
    );

    if (ordemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const ordem = ordemResult.rows[0];

    // 2. Verificar se ordem está liberada (status A = Aberta)
    if (ordem.orc_status !== 'A') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Somente itens de ordens abertas podem ser fechados'
      });
    }

    // 3. Buscar item da requisição
    const itemResult = await client.query(
      `SELECT
         itr_codprod,
         itr_quantidade,
         itr_quantidade_atendida,
         COALESCE(itr_quantidade_fechada, 0) as itr_quantidade_fechada,
         itr_pr_unitario
       FROM db_manaus.cmp_it_requisicao
       WHERE itr_req_id = $1
         AND itr_req_versao = $2
         AND itr_codprod = $3`,
      [ordem.orc_req_id, ordem.orc_req_versao, codprod]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado na ordem'
      });
    }

    const item = itemResult.rows[0];
    const quantidade = Number(item.itr_quantidade);
    const quantidadeAtendida = Number(item.itr_quantidade_atendida) || 0;
    const quantidadeFechada = Number(item.itr_quantidade_fechada) || 0;
    const pendencia = quantidade - quantidadeAtendida;

    // 4. Verificar se item já está fechado
    if (pendencia <= 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Item já se encontra fechado (sem pendência)'
      });
    }

    // 5. Buscar referência do produto para o log
    const prodResult = await client.query(
      `SELECT ref, descr FROM db_manaus.dbprod WHERE codprod = $1`,
      [codprod]
    );
    const prodRef = prodResult.rows[0]?.ref || codprod;
    const prodDescr = prodResult.rows[0]?.descr || '';

    // 6. Atualizar o item: fechar toda a pendência
    // quantidade_fechada += (quantidade - quantidade_atendida)
    // quantidade = quantidade_atendida
    await client.query(
      `UPDATE db_manaus.cmp_it_requisicao SET
         itr_quantidade_fechada = COALESCE(itr_quantidade_fechada, 0) + (itr_quantidade - COALESCE(itr_quantidade_atendida, 0)),
         itr_quantidade = COALESCE(itr_quantidade_atendida, 0)
       WHERE itr_req_id = $1
         AND itr_req_versao = $2
         AND itr_codprod = $3`,
      [ordem.orc_req_id, ordem.orc_req_versao, codprod]
    );

    // 7. Verificar se todos os itens da ordem estão fechados
    const pendentesResult = await client.query(
      `SELECT COUNT(*) as count
       FROM db_manaus.cmp_it_requisicao
       WHERE itr_req_id = $1
         AND itr_req_versao = $2
         AND itr_quantidade > COALESCE(itr_quantidade_atendida, 0)`,
      [ordem.orc_req_id, ordem.orc_req_versao]
    );

    const itensPendentes = Number(pendentesResult.rows[0].count);

    // 8. Se não há mais itens pendentes, fechar a ordem
    if (itensPendentes === 0) {
      await client.query(
        `UPDATE db_manaus.cmp_ordem_compra SET orc_status = 'F' WHERE orc_id = $1`,
        [id]
      );
    }

    // 9. Registrar histórico
    const userIdFinal = userId || 'SISTEMA';
    const userNameFinal = userName || 'Sistema';

    await registrarHistoricoOrdem(client, {
      orcId: Number(id),
      previousStatus: ordem.orc_status,
      newStatus: itensPendentes === 0 ? 'F' : ordem.orc_status,
      userId: userIdFinal,
      userName: userNameFinal,
      reason: `Fechou item ${prodRef}`,
      comments: {
        tipo: 'FECHAR_ITEM',
        codprod,
        referencia: prodRef,
        descricao: prodDescr,
        quantidade_original: quantidade,
        quantidade_atendida: quantidadeAtendida,
        quantidade_fechada: pendencia,
        ordem_fechada: itensPendentes === 0
      }
    });

    await client.query('COMMIT');
    client.release();

    return res.status(200).json({
      success: true,
      message: `Item ${prodRef} fechado com sucesso`,
      data: {
        codprod,
        referencia: prodRef,
        quantidade_fechada: pendencia,
        ordem_fechada: itensPendentes === 0
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Erro ao fechar item:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao fechar item',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
