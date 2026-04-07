import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { gerarProximoIdOrdem } from '@/lib/compras/ordemCompraHelper';
import { registrarCriacaoOrdem } from '@/lib/compras/ordemHistoricoHelper';

interface GerarOrdemRequest {
  requisitionId: number;
  version: number;
  fornecedor?: string;
  valorTotal?: number;
  userId?: string;
  userName?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { requisitionId, version, fornecedor, valorTotal, userId, userName } = req.body as GerarOrdemRequest;
  const userIdFinal = userId || 'SISTEMA';
  const userNameFinal = userName || 'Sistema';
  
  if (!requisitionId || !version) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID da requisição e versão são obrigatórios' 
    });
  }

  try {
    const client = await pool.connect();
    
    // Verificar se a requisição existe e está aprovada
    const checkResult = await client.query(
      'SELECT req_status, req_id_composto, req_observacao, req_previsao_chegada FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [requisitionId, version]
    );
    
    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Requisição não encontrada' 
      });
    }
    
    const requisition = checkResult.rows[0];
    
    // Só pode gerar ordem se estiver aprovada (A)
    if (requisition.req_status !== 'A') {
      client.release();
      return res.status(400).json({ 
        success: false, 
        message: `Não é possível gerar ordem para requisição com status ${requisition.req_status}. Deve estar aprovada.` 
      });
    }
    
    // Verificar se já existe ordem para esta requisição
    const existingOrder = await client.query(
      'SELECT orc_id FROM db_manaus.cmp_ordem_compra WHERE orc_req_id = $1 AND orc_req_versao = $2',
      [requisitionId, version]
    );

    if (existingOrder.rows.length > 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: `Já existe ordem de compra para esta requisição (Ordem: ${existingOrder.rows[0].orc_id})`
      });
    }

    // Buscar local de entrega da requisição para gerar ID correto
    const reqEntregaQuery = await client.query(
      'SELECT req_unm_id_entrega FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [requisitionId, version]
    );
    const localEntrega = reqEntregaQuery.rows[0]?.req_unm_id_entrega;

    // Gerar novo ID para a ordem no padrão [filial][ano][mês][sequencial]
    const nextId = await gerarProximoIdOrdem(client, localEntrega);
    
    // Calcular valor total se não foi fornecido
    let calculatedValorTotal = valorTotal;
    if (!calculatedValorTotal) {
      const valorResult = await client.query(
        `SELECT COALESCE(SUM(itr_quantidade * itr_pr_unitario), 0) as total_itens
         FROM db_manaus.cmp_it_requisicao
         WHERE itr_req_id = $1 AND itr_req_versao = $2`,
        [requisitionId, version]
      );
      calculatedValorTotal = valorResult.rows[0]?.total_itens || 0;
    }

    // Criar ordem de compra usando a observação e previsão originais da requisição
    // Status inicial = 'A' (Aberta) - conforme sistema legado Oracle
    const insertResult = await client.query(
      `INSERT INTO db_manaus.cmp_ordem_compra (
        orc_id, orc_req_id, orc_req_versao, orc_data, orc_status,
        orc_valor_total, orc_observacao, orc_previsao_chegada
      ) VALUES ($1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, 'A', $4, $5, $6)
      RETURNING orc_id, orc_data, orc_status`,
      [
        nextId,
        requisitionId,
        version,
        calculatedValorTotal,
        requisition.req_observacao || '', // Usar observação original da requisição
        requisition.req_previsao_chegada || null // Herdar previsão de chegada da requisição
      ]
    );

    const newOrder = insertResult.rows[0];

    // Registrar histórico de criação
    await registrarCriacaoOrdem(
      client,
      newOrder.orc_id,
      userIdFinal,
      userNameFinal,
      {
        req_id_composto: requisition.req_id_composto,
        fornecedor: fornecedor || 'N/A',
        valor_total: calculatedValorTotal
      }
    );

    client.release();
    
    res.status(200).json({
      success: true,
      message: 'Ordem de compra gerada com sucesso',
      data: {
        ordemId: newOrder.orc_id,
        ordemNumero: String(newOrder.orc_id).padStart(11, '0'),
        data: newOrder.orc_data,
        status: newOrder.orc_status,
        requisicaoId: requisitionId,
        requisicaoVersao: version
      }
    });
  } catch (err) {
    console.error('Erro ao gerar ordem de compra:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor ao gerar ordem de compra',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}