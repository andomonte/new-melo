// src/pages/api/requisicoesCompra/actions/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { getUserOrDefault } from '@/lib/authHelper';
import { gerarProximoIdOrdem } from '@/lib/compras/ordemCompraHelper';

interface ApproveRequest {
  requisitionId: string;
  version: number;
  userId?: string;
  userName?: string;
  comments?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { requisitionId, version, userId, userName, comments } = req.body as ApproveRequest;

  console.log('DEBUG - Approve request:', { requisitionId, version, body: req.body });

  if (!requisitionId || !version) {
    return res.status(400).json({
      success: false,
      message: 'ID da requisição e versão são obrigatórios'
    });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;
  let clientReleased = false;

  // Obter dados do usuário autenticado (prioriza body, depois helper)
  const helperUser = getUserOrDefault(req);
  const finalUserId = userId || helperUser.login_user_login;
  const finalUserName = userName || helperUser.login_user_name;
  console.log('🔍 Usuário capturado para histórico (approve):', { finalUserId, finalUserName });

  // Declare variables outside try block to be accessible in response
  let ordemNumero = null;
  let updateResult: any = null;

  try {
    client = await pool.connect();
    
    // Verificar se a requisição existe e está em status que permite aprovação
    // Busca por req_id (formato completo ex: 12002010068) que é o que o frontend envia
    const checkResult = await client.query(
      'SELECT req_id, req_status FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [requisitionId.toString(), version]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Requisição não encontrada' 
      });
    }
    
    const currentStatus = checkResult.rows[0].req_status;
    
    // Só pode aprovar se estiver submetida (S)
    if (currentStatus !== 'S') {
      return res.status(400).json({ 
        success: false, 
        message: `Não é possível aprovar requisição com status ${currentStatus}. Deve estar submetida.` 
      });
    }
    
    // Iniciar transação
    await client.query('BEGIN');

    // Atualizar status para Aprovada (A)
    updateResult = await client.query(
      `UPDATE db_manaus.cmp_requisicao
       SET req_status = 'A'
       WHERE req_id = $1 AND req_versao = $2
       RETURNING req_id, req_versao, req_status`,
      [requisitionId.toString(), version]
    );

    // Registrar histórico da mudança
    try {
      await client.query(
        `INSERT INTO db_manaus.cmp_requisicao_historico 
         (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          checkResult.rows[0].req_id,
          version,
          currentStatus,
          'A',
          finalUserId,
          finalUserName,
          `Requisição aprovada`,
          comments || `Aprovada via interface por ${finalUserName}`
        ]
      );
    } catch (historyError) {
      console.warn('Erro ao registrar histórico:', historyError);
      // Não falha a transação principal
    }

    // Buscar dados da requisição para gerar ordem
    const requisitionData = await client.query(
      `SELECT r.*, f.nome as fornecedor_nome
       FROM db_manaus.cmp_requisicao r
       LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
       WHERE r.req_id = $1 AND r.req_versao = $2`,
      [requisitionId.toString(), version]
    );
    
    console.log('DEBUG - Dados da requisição encontrados:', requisitionData.rows.length);

    if (requisitionData.rows.length > 0) {
      const req = requisitionData.rows[0];
      
      // Calcular valor total dos itens da requisição
      const valorTotalResult = await client.query(
        `SELECT COALESCE(SUM(itr_quantidade * itr_pr_unitario), 0) as total_itens
         FROM db_manaus.cmp_it_requisicao
         WHERE itr_req_id = $1 AND itr_req_versao = $2`,
        [checkResult.rows[0].req_id, version]
      );
      
      const valorTotal = valorTotalResult.rows[0]?.total_itens || 0;
      
      // Gerar ordem de compra automaticamente
      try {
        // Status da ordem: A = Ativa (campo aceita apenas 1 caractere)
        const statusOrdem = 'A';

        // Gerar ID no padrão: [filial][ano][mês][sequencial]
        const novoIdOrdem = await gerarProximoIdOrdem(client, req.req_unm_id_entrega);

        console.log('DEBUG - Criando ordem de compra:', {
          novoIdOrdem,
          valorTotal,
          statusOrdem,
          previsaoChegada: req.req_previsao_chegada,
          localEntrega: req.req_unm_id_entrega,
          localDestino: req.req_unm_id_destino,
          observacao: req.req_observacao
        });

        const ordemResult = await client.query(
          `INSERT INTO db_manaus.cmp_ordem_compra (
            orc_id, orc_req_id, orc_req_versao, orc_data, orc_status,
            orc_valor_total, orc_previsao_chegada, orc_unm_id_entrega, orc_unm_id_destino, orc_observacao
          ) VALUES (
            $1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, $4, $5, $6, $7, $8, $9
          ) RETURNING orc_id`,
          [
            novoIdOrdem,
            checkResult.rows[0].req_id,
            version,
            statusOrdem,
            valorTotal,
            req.req_previsao_chegada,
            req.req_unm_id_entrega,
            req.req_unm_id_destino,
            req.req_observacao
          ]
        );

        console.log('DEBUG - Ordem criada:', {
          ordemId: ordemResult.rows[0]?.orc_id,
          valorTotal,
          statusOrdem
        });

        ordemNumero = ordemResult.rows[0]?.orc_id;
        console.log('DEBUG - Ordem de compra gerada automaticamente:', ordemNumero);
      } catch (ordemError) {
        console.error('DEBUG - Erro ao gerar ordem automaticamente:', ordemError);
        // Fallback para gerar ordem simples se der erro nos campos novos
        try {
          const fallbackIdOrdem = await gerarProximoIdOrdem(client, req.req_unm_id_entrega);
          const ordemSimples = await client.query(
            `INSERT INTO db_manaus.cmp_ordem_compra (
              orc_id, orc_req_id, orc_req_versao, orc_data, orc_status,
              orc_valor_total, orc_previsao_chegada, orc_unm_id_entrega, orc_unm_id_destino
            ) VALUES (
              $1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, 'A', $4, $5, $6, $7
            ) RETURNING orc_id`,
            [
              fallbackIdOrdem,
              checkResult.rows[0].req_id,
              version,
              valorTotal,
              req.req_previsao_chegada,
              req.req_unm_id_entrega,
              req.req_unm_id_destino
            ]
          );
          ordemNumero = ordemSimples.rows[0]?.orc_id;
          console.log('DEBUG - Ordem simples gerada como fallback:', ordemNumero);
        } catch (fallbackError) {
          console.error('DEBUG - Erro no fallback também:', fallbackError);
        }
      }
    }
    
    // Commit da transação
    await client.query('COMMIT');
    
  } catch (err) {
    if (client && !clientReleased) {
      await client.query('ROLLBACK');
      client.release();
      clientReleased = true;
    }
    console.error('Erro ao aprovar requisição:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor ao aprovar requisição',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client && !clientReleased) {
      client.release();
      clientReleased = true;
    }
  }
    
  res.status(200).json({
    success: true,
    message: ordemNumero
      ? `Requisição aprovada e ordem #${String(ordemNumero).padStart(11, '0')} gerada com sucesso`
      : 'Requisição aprovada com sucesso',
    data: updateResult.rows[0],
    ordemGerada: ordemNumero
  });
}