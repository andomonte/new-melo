// API otimizada para operações em lote
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { getUserOrDefault } from '@/lib/authHelper';
import { gerarProximoIdOrdem } from '@/lib/compras/ordemCompraHelper';

interface BatchRequest {
  action: 'submit' | 'approve' | 'reject' | 'cancel';
  userId?: string;
  userName?: string;
  requisitions: Array<{
    requisitionId: string;
    version: number;
    comments?: string;
  }>;
}

interface BatchResult {
  requisitionId: string;
  version: number;
  success: boolean;
  message: string;
  ordemId?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { action, requisitions, userId, userName } = req.body as BatchRequest;

  if (!action || !requisitions || !Array.isArray(requisitions)) {
    return res.status(400).json({
      success: false,
      message: 'Ação e lista de requisições são obrigatórias'
    });
  }

  const pool = getPgPool('manaus');
  // Prioriza body, depois helper
  const helperUser = getUserOrDefault(req);
  const finalUserId = userId || helperUser.login_user_login;
  const finalUserName = userName || helperUser.login_user_name;
  const results: BatchResult[] = [];

  // Processar cada requisição (mantém sequencial para evitar race conditions)
  for (const req of requisitions) {
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      // Verificar se requisição existe e pegar status atual
      // Busca por req_id (formato completo ex: 12002010068) que é o que o frontend envia
      const checkResult = await client.query(
        'SELECT req_id, req_status FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
        [req.requisitionId.toString(), req.version]
      );

      if (checkResult.rows.length === 0) {
        results.push({
          requisitionId: req.requisitionId,
          version: req.version,
          success: false,
          message: 'Requisição não encontrada'
        });
        continue;
      }

      const currentStatus = checkResult.rows[0].req_status;
      const reqId = checkResult.rows[0].req_id;

      // Validar transição de estado
      const validTransitions: Record<string, string[]> = {
        submit: ['P'],
        approve: ['S'],
        reject: ['S'],
        cancel: ['P', 'S']
      };

      if (!validTransitions[action].includes(currentStatus)) {
        results.push({
          requisitionId: req.requisitionId,
          version: req.version,
          success: false,
          message: `Status atual (${currentStatus}) não permite ${action}`
        });
        continue;
      }

      // Iniciar transação
      await client.query('BEGIN');

      // Mapear ação para novo status
      const statusMap: Record<string, string> = {
        submit: 'S',
        approve: 'A',
        reject: 'R',
        cancel: 'C'
      };

      const newStatus = statusMap[action];

      // Atualizar status
      await client.query(
        `UPDATE db_manaus.cmp_requisicao
         SET req_status = $1
         WHERE req_id = $2 AND req_versao = $3`,
        [newStatus, req.requisitionId.toString(), req.version]
      );

      // Registrar histórico
      await client.query(
        `INSERT INTO db_manaus.cmp_requisicao_historico
         (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          reqId,
          req.version,
          currentStatus,
          newStatus,
          finalUserId,
          finalUserName,
          `${action} em lote`,
          req.comments || `${action} via batch operation`
        ]
      );

      let ordemId: number | undefined;

      // Se for aprovação, gerar ordem de compra
      if (action === 'approve') {
        try {
          // Buscar dados da requisição
          const requisitionData = await client.query(
            `SELECT r.* FROM db_manaus.cmp_requisicao r
             WHERE r.req_id = $1 AND r.req_versao = $2`,
            [req.requisitionId.toString(), req.version]
          );

          if (requisitionData.rows.length > 0) {
            const requisition = requisitionData.rows[0];

            // Calcular valor total
            const valorTotalResult = await client.query(
              `SELECT COALESCE(SUM(itr_quantidade * itr_pr_unitario), 0) as total_itens
               FROM db_manaus.cmp_it_requisicao
               WHERE itr_req_id = $1 AND itr_req_versao = $2`,
              [reqId, req.version]
            );

            const valorTotal = valorTotalResult.rows[0]?.total_itens || 0;

            // Gerar ID no padrão [filial][ano][mês][sequencial]
            const novoIdOrdem = await gerarProximoIdOrdem(client, requisition.req_unm_id_entrega);

            // Gerar ordem
            const ordemResult = await client.query(
              `INSERT INTO db_manaus.cmp_ordem_compra (
                orc_id, orc_req_id, orc_req_versao, orc_data, orc_status,
                orc_valor_total, orc_previsao_chegada, orc_unm_id_entrega, orc_unm_id_destino, orc_observacao
              ) VALUES (
                $1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, 'A', $4, $5, $6, $7, $8
              ) RETURNING orc_id`,
              [
                novoIdOrdem,
                reqId,
                req.version,
                valorTotal,
                requisition.req_previsao_chegada,
                requisition.req_unm_id_entrega,
                requisition.req_unm_id_destino,
                requisition.req_observacao
              ]
            );

            ordemId = ordemResult.rows[0]?.orc_id;
          }
        } catch (ordemError) {
          console.error('Erro ao gerar ordem:', ordemError);
          // Continua mesmo se ordem falhar (requisição já foi aprovada)
        }
      }

      // Commit da transação
      await client.query('COMMIT');

      results.push({
        requisitionId: req.requisitionId,
        version: req.version,
        success: true,
        message: ordemId
          ? `${action} executado com sucesso. Ordem #${ordemId} gerada.`
          : `${action} executado com sucesso`,
        ordemId
      });

    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error(`Erro ao processar requisição ${req.requisitionId}:`, err);
      results.push({
        requisitionId: req.requisitionId,
        version: req.version,
        success: false,
        message: err instanceof Error ? err.message : 'Erro desconhecido'
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Retornar resultado agregado
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  res.status(200).json({
    success: failCount === 0,
    message: `${successCount} sucesso, ${failCount} falhas`,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failCount
    }
  });
}
