/**
 * Helper para registrar histórico de alterações em Ordens de Compra
 *
 * Cenários que geram histórico:
 * - Criação da ordem (A → Aberta)
 * - Aprovação (P → A)
 * - Cancelamento (A → C)
 * - Finalização/Fechamento (A → F)
 * - Bloqueio (A → B)
 * - Desbloqueio (B → A)
 * - Configuração de pagamento
 * - Pagamento antecipado
 * - Alteração de previsão de chegada
 * - Confirmação de pagamento
 * - Rejeição de pagamento
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { PoolClient } from 'pg';

// Mapeamento de status para descrição legível
export const STATUS_ORDEM_LABELS: Record<string, string> = {
  '': 'Criação',
  'P': 'Pendente',
  'A': 'Aberta',
  'B': 'Bloqueada',
  'C': 'Cancelada',
  'F': 'Fechada'
};

// Tipos de ação para histórico
export type TipoAcaoOrdem =
  | 'CRIACAO'
  | 'APROVACAO'
  | 'CANCELAMENTO'
  | 'FINALIZACAO'
  | 'BLOQUEIO'
  | 'DESBLOQUEIO'
  | 'CONFIG_PAGAMENTO'
  | 'PAGAMENTO_ANTECIPADO'
  | 'ALTERACAO_PREVISAO'
  | 'CONFIRMACAO_PAGAMENTO'
  | 'REJEICAO_PAGAMENTO'
  | 'ALTERACAO_STATUS'
  | 'EDICAO'
  | 'SUBSTITUIR_ITEM'
  | 'FECHAR_ITEM'
  | 'BAIXAR_PENDENCIA';

export interface HistoricoOrdemParams {
  orcId: number;
  previousStatus: string;
  newStatus: string;
  userId: string;
  userName: string;
  reason?: string;
  comments?: string | object;
}

export interface HistoricoOrdemItem {
  id: number;
  orc_id: number;
  previous_status: string;
  new_status: string;
  user_id: string;
  user_name: string;
  reason: string | null;
  comments: string | null;
  created_at: string;
  status_label_anterior: string;
  status_label_novo: string;
}

/**
 * Registra uma entrada no histórico da ordem de compra
 */
export async function registrarHistoricoOrdem(
  client: PoolClient,
  params: HistoricoOrdemParams
): Promise<number> {
  const {
    orcId,
    previousStatus,
    newStatus,
    userId,
    userName,
    reason,
    comments
  } = params;

  // Serializar comments se for objeto
  const commentsStr = comments
    ? (typeof comments === 'object' ? JSON.stringify(comments) : comments)
    : null;

  console.log(`📝 [Histórico Ordem] Registrando: ${orcId} | ${previousStatus || 'NOVO'} → ${newStatus} | Usuário: ${userName}`);

  const query = `
    INSERT INTO db_manaus.cmp_ordem_historico (
      orc_id,
      previous_status,
      new_status,
      user_id,
      user_name,
      reason,
      comments,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING id
  `;

  const result = await client.query(query, [
    orcId,
    previousStatus || '',
    newStatus,
    userId,
    userName,
    reason || null,
    commentsStr
  ]);

  const historicoId = result.rows[0].id;
  console.log(`✅ [Histórico Ordem] Registrado com ID: ${historicoId}`);

  return historicoId;
}

/**
 * Registra histórico de criação da ordem
 */
export async function registrarCriacaoOrdem(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  detalhes?: object
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: '',
    newStatus: 'A',
    userId,
    userName,
    reason: 'Ordem de compra criada',
    comments: detalhes ? {
      tipo: 'CRIACAO',
      ...detalhes
    } : { tipo: 'CRIACAO' }
  });
}

/**
 * Registra histórico de aprovação da ordem
 */
export async function registrarAprovacaoOrdem(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  motivo?: string
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'P',
    newStatus: 'A',
    userId,
    userName,
    reason: motivo || 'Ordem aprovada',
    comments: { tipo: 'APROVACAO' }
  });
}

/**
 * Registra histórico de cancelamento da ordem
 */
export async function registrarCancelamentoOrdem(
  client: PoolClient,
  orcId: number,
  previousStatus: string,
  userId: string,
  userName: string,
  motivo?: string
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus,
    newStatus: 'C',
    userId,
    userName,
    reason: motivo || 'Ordem cancelada',
    comments: { tipo: 'CANCELAMENTO' }
  });
}

/**
 * Registra histórico de finalização da ordem
 */
export async function registrarFinalizacaoOrdem(
  client: PoolClient,
  orcId: number,
  previousStatus: string,
  userId: string,
  userName: string,
  motivo?: string
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus,
    newStatus: 'F',
    userId,
    userName,
    reason: motivo || 'Ordem finalizada',
    comments: { tipo: 'FINALIZACAO' }
  });
}

/**
 * Registra histórico de configuração de pagamento
 */
export async function registrarConfiguracaoPagamento(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  detalhes: {
    condicao_pagamento?: string;
    data_pagamento?: string;
    parcelas?: number;
    valor_total?: number;
  }
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'A',
    newStatus: 'A',
    userId,
    userName,
    reason: 'Pagamento configurado',
    comments: {
      tipo: 'CONFIG_PAGAMENTO',
      ...detalhes
    }
  });
}

/**
 * Registra histórico de pagamento antecipado
 */
export async function registrarPagamentoAntecipado(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  detalhes: {
    valor_antecipado?: number;
    data_pagamento?: string;
    percentual?: number;
  }
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'A',
    newStatus: 'A',
    userId,
    userName,
    reason: 'Pagamento antecipado registrado',
    comments: {
      tipo: 'PAGAMENTO_ANTECIPADO',
      ...detalhes
    }
  });
}

/**
 * Registra histórico de alteração de previsão de chegada
 */
export async function registrarAlteracaoPrevisao(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  detalhes: {
    data_anterior?: string;
    data_nova?: string;
  }
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'A',
    newStatus: 'A',
    userId,
    userName,
    reason: 'Previsão de chegada alterada',
    comments: {
      tipo: 'ALTERACAO_PREVISAO',
      ...detalhes
    }
  });
}

/**
 * Registra histórico de confirmação de pagamento
 */
export async function registrarConfirmacaoPagamento(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  detalhes?: {
    valor_confirmado?: number;
    data_confirmacao?: string;
  }
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'A',
    newStatus: 'A',
    userId,
    userName,
    reason: 'Pagamento confirmado',
    comments: {
      tipo: 'CONFIRMACAO_PAGAMENTO',
      ...detalhes
    }
  });
}

/**
 * Registra histórico de rejeição de pagamento
 */
export async function registrarRejeicaoPagamento(
  client: PoolClient,
  orcId: number,
  userId: string,
  userName: string,
  motivo?: string
): Promise<number> {
  return registrarHistoricoOrdem(client, {
    orcId,
    previousStatus: 'A',
    newStatus: 'A',
    userId,
    userName,
    reason: motivo || 'Pagamento rejeitado',
    comments: { tipo: 'REJEICAO_PAGAMENTO' }
  });
}

/**
 * Busca histórico completo de uma ordem
 */
export async function buscarHistoricoOrdem(
  client: PoolClient,
  orcId: number
): Promise<HistoricoOrdemItem[]> {
  const query = `
    SELECT
      h.id,
      h.orc_id,
      h.previous_status,
      h.new_status,
      h.user_id,
      h.user_name,
      h.reason,
      h.comments,
      h.created_at,
      CASE
        WHEN h.previous_status = '' THEN 'Criação'
        WHEN h.previous_status = 'P' THEN 'Pendente'
        WHEN h.previous_status = 'A' THEN 'Aberta'
        WHEN h.previous_status = 'B' THEN 'Bloqueada'
        WHEN h.previous_status = 'C' THEN 'Cancelada'
        WHEN h.previous_status = 'F' THEN 'Fechada'
        ELSE h.previous_status
      END as status_label_anterior,
      CASE h.new_status
        WHEN 'P' THEN 'Pendente'
        WHEN 'A' THEN 'Aberta'
        WHEN 'B' THEN 'Bloqueada'
        WHEN 'C' THEN 'Cancelada'
        WHEN 'F' THEN 'Fechada'
        ELSE h.new_status
      END as status_label_novo
    FROM db_manaus.cmp_ordem_historico h
    WHERE h.orc_id = $1
    ORDER BY h.created_at DESC, h.id DESC
  `;

  const result = await client.query(query, [orcId]);

  return result.rows.map(row => ({
    id: row.id,
    orc_id: row.orc_id,
    previous_status: row.previous_status,
    new_status: row.new_status,
    user_id: row.user_id,
    user_name: row.user_name,
    reason: row.reason,
    comments: row.comments,
    created_at: row.created_at,
    status_label_anterior: row.status_label_anterior,
    status_label_novo: row.status_label_novo
  }));
}

/**
 * Parseia comentário JSON do histórico para exibição legível
 */
export function parseComentarioHistoricoOrdem(comments: string | null): {
  tipo: TipoAcaoOrdem;
  descricao_legivel: string;
  dados?: Record<string, any>;
} | null {
  if (!comments) return null;

  try {
    const parsed = JSON.parse(comments);
    const tipo = parsed.tipo as TipoAcaoOrdem;
    let descricao = '';

    switch (tipo) {
      case 'CRIACAO':
        descricao = '**Ordem criada**';
        if (parsed.req_id_composto) {
          descricao += `\n- Requisição: ${parsed.req_id_composto}`;
        }
        if (parsed.fornecedor) {
          descricao += `\n- Fornecedor: ${parsed.fornecedor}`;
        }
        if (parsed.valor_total) {
          descricao += `\n- Valor: R$ ${Number(parsed.valor_total).toFixed(2)}`;
        }
        break;

      case 'APROVACAO':
        descricao = '**Ordem aprovada**';
        break;

      case 'CANCELAMENTO':
        descricao = '**Ordem cancelada**';
        break;

      case 'FINALIZACAO':
        descricao = '**Ordem finalizada**';
        break;

      case 'CONFIG_PAGAMENTO':
        descricao = '**Pagamento configurado**';
        if (parsed.condicao_pagamento) {
          descricao += `\n- Condição: ${parsed.condicao_pagamento}`;
        }
        if (parsed.parcelas) {
          descricao += `\n- Parcelas: ${parsed.parcelas}`;
        }
        if (parsed.valor_total) {
          descricao += `\n- Valor: R$ ${Number(parsed.valor_total).toFixed(2)}`;
        }
        break;

      case 'PAGAMENTO_ANTECIPADO':
        descricao = '**Pagamento antecipado registrado**';
        if (parsed.valor_antecipado) {
          descricao += `\n- Valor: R$ ${Number(parsed.valor_antecipado).toFixed(2)}`;
        }
        if (parsed.percentual) {
          descricao += `\n- Percentual: ${parsed.percentual}%`;
        }
        if (parsed.data_pagamento) {
          descricao += `\n- Data: ${new Date(parsed.data_pagamento).toLocaleDateString('pt-BR')}`;
        }
        break;

      case 'ALTERACAO_PREVISAO':
        descricao = '**Previsão de chegada alterada**';
        if (parsed.data_anterior) {
          descricao += `\n- De: ${new Date(parsed.data_anterior).toLocaleDateString('pt-BR')}`;
        }
        if (parsed.data_nova) {
          descricao += `\n- Para: ${new Date(parsed.data_nova).toLocaleDateString('pt-BR')}`;
        }
        break;

      case 'CONFIRMACAO_PAGAMENTO':
        descricao = '**Pagamento confirmado**';
        if (parsed.valor_confirmado) {
          descricao += `\n- Valor: R$ ${Number(parsed.valor_confirmado).toFixed(2)}`;
        }
        break;

      case 'REJEICAO_PAGAMENTO':
        descricao = '**Pagamento rejeitado**';
        break;

      case 'SUBSTITUIR_ITEM':
        descricao = '**Item substituído**';
        if (parsed.codprod_original) {
          descricao += `\n- Item original: ${parsed.referencia_original || parsed.codprod_original}`;
        }
        if (parsed.codprod_novo) {
          descricao += `\n- Novo item: ${parsed.referencia_nova || parsed.codprod_novo}`;
        }
        if (parsed.quantidade) {
          descricao += `\n- Quantidade: ${parsed.quantidade}`;
        }
        break;

      case 'FECHAR_ITEM':
        descricao = '**Item fechado**';
        if (parsed.referencia || parsed.codprod) {
          descricao += `\n- Item: ${parsed.referencia || parsed.codprod}`;
        }
        if (parsed.descricao) {
          descricao += `\n- Descrição: ${parsed.descricao}`;
        }
        if (parsed.quantidade_fechada !== undefined) {
          descricao += `\n- Quantidade fechada: ${parsed.quantidade_fechada}`;
        }
        if (parsed.ordem_fechada) {
          descricao += `\n- ⚠️ Ordem finalizada (todos os itens fechados)`;
        }
        break;

      case 'BAIXAR_PENDENCIA':
        descricao = '**Pendência baixada**';
        if (parsed.referencia || parsed.codprod) {
          descricao += `\n- Item: ${parsed.referencia || parsed.codprod}`;
        }
        if (parsed.descricao) {
          descricao += `\n- Descrição: ${parsed.descricao}`;
        }
        if (parsed.quantidade_baixada !== undefined) {
          descricao += `\n- Quantidade baixada: ${parsed.quantidade_baixada}`;
        }
        if (parsed.pendencia_anterior !== undefined && parsed.pendencia_nova !== undefined) {
          descricao += `\n- Pendência: ${parsed.pendencia_anterior} → ${parsed.pendencia_nova}`;
        }
        break;

      default:
        descricao = '**Alteração registrada**';
    }

    return {
      tipo,
      descricao_legivel: descricao,
      dados: parsed
    };
  } catch {
    // Se não for JSON válido, retornar como texto simples
    return {
      tipo: 'EDICAO',
      descricao_legivel: comments
    };
  }
}
