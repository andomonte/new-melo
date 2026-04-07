/**
 * API para baixar pendência parcial de um item da ordem de compra
 *
 * POST /api/ordens/[id]/baixar-pendencia
 * Body: { codprod: string, quantidade: number, userId?: string, userName?: string }
 *
 * Baixa quantidade parcial da pendência do item
 * quantidade_fechada += quantidade_baixar
 * quantidade -= quantidade_baixar
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
  const { codprod, quantidade, userId, userName } = req.body;

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

  const quantidadeBaixar = Number(quantidade);

  if (!quantidadeBaixar || quantidadeBaixar <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Quantidade deve ser maior que zero'
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
        message: 'Somente itens de ordens abertas podem ter pendência baixada'
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
    const quantidadeTotal = Number(item.itr_quantidade);
    const quantidadeAtendida = Number(item.itr_quantidade_atendida) || 0;
    const pendenciaDisponivel = quantidadeTotal - quantidadeAtendida;

    // 4. Verificar se item já está fechado
    if (pendenciaDisponivel <= 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Item já se encontra fechado (sem pendência)'
      });
    }

    // 5. Verificar se quantidade a baixar não excede disponível
    if (quantidadeBaixar > pendenciaDisponivel) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Quantidade maior que o disponível. Máximo: ${pendenciaDisponivel}`
      });
    }

    // 6. Verificar se quantidade é igual ao total (deve usar Fechar Item)
    if (quantidadeBaixar === pendenciaDisponivel) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Para baixar toda a pendência, utilize a função "Fechar Item"'
      });
    }

    // 7. Buscar referência do produto para o log
    const prodResult = await client.query(
      `SELECT ref, descr FROM db_manaus.dbprod WHERE codprod = $1`,
      [codprod]
    );
    const prodRef = prodResult.rows[0]?.ref || codprod;
    const prodDescr = prodResult.rows[0]?.descr || '';

    // 8. Atualizar o item: baixar quantidade parcial
    // quantidade_fechada += quantidade_baixar
    // quantidade -= quantidade_baixar
    await client.query(
      `UPDATE db_manaus.cmp_it_requisicao SET
         itr_quantidade_fechada = COALESCE(itr_quantidade_fechada, 0) + $4,
         itr_quantidade = itr_quantidade - $4
       WHERE itr_req_id = $1
         AND itr_req_versao = $2
         AND itr_codprod = $3`,
      [ordem.orc_req_id, ordem.orc_req_versao, codprod, quantidadeBaixar]
    );

    // 9. Registrar histórico
    const userIdFinal = userId || 'SISTEMA';
    const userNameFinal = userName || 'Sistema';

    await registrarHistoricoOrdem(client, {
      orcId: Number(id),
      previousStatus: ordem.orc_status,
      newStatus: ordem.orc_status,
      userId: userIdFinal,
      userName: userNameFinal,
      reason: `Baixou pendência do item ${prodRef} - Qtd: ${quantidadeBaixar}`,
      comments: {
        tipo: 'BAIXAR_PENDENCIA',
        codprod,
        referencia: prodRef,
        descricao: prodDescr,
        quantidade_baixada: quantidadeBaixar,
        quantidade_original: quantidadeTotal,
        quantidade_atendida: quantidadeAtendida,
        pendencia_anterior: pendenciaDisponivel,
        pendencia_nova: pendenciaDisponivel - quantidadeBaixar
      }
    });

    await client.query('COMMIT');
    client.release();

    return res.status(200).json({
      success: true,
      message: `Pendência de ${quantidadeBaixar} unidades baixada com sucesso`,
      data: {
        codprod,
        referencia: prodRef,
        quantidade_baixada: quantidadeBaixar,
        pendencia_restante: pendenciaDisponivel - quantidadeBaixar
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Erro ao baixar pendência:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao baixar pendência',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
