/**
 * Helper para registrar histórico de alterações em Entradas de NFe
 *
 * Cenários que geram histórico:
 * - Upload de XML (UPLOAD)
 * - Início de processamento/associação (INICIO_PROCESSAMENTO)
 * - Associação de itens (ASSOCIACAO_ITEM)
 * - Conclusão de associação (ASSOCIACAO_CONCLUIDA)
 * - Configuração de pagamento (CONFIG_PAGAMENTO)
 * - Pagamento antecipado (PAGAMENTO_ANTECIPADO)
 * - Geração de entrada (ENTRADA_GERADA)
 * - Cadastro de CT-e (CTE_CADASTRADO)
 * - Processamento completo (PROCESSADA)
 * - Cancelamento/Exclusão (CANCELAMENTO)
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { PoolClient, Pool } from 'pg';

// Mapeamento de status para descrição legível
export const STATUS_NFE_LABELS: Record<string, string> = {
  '': 'Nova',
  'R': 'Recebida',
  'A': 'Em Andamento',
  'C': 'Associação Concluída',
  'S': 'Processada',
  'N': 'Erro'
};

// Tipos de acao para historico
export type TipoAcaoNfe =
  | 'UPLOAD'
  | 'INICIO_PROCESSAMENTO'
  | 'ASSOCIACAO_ITEM'
  | 'ASSOCIACAO_CONCLUIDA'
  | 'CONFIG_PAGAMENTO'
  | 'PAGAMENTO_ANTECIPADO'
  | 'ENTRADA_GERADA'
  | 'CTE_CADASTRADO'
  | 'PROCESSADA'
  | 'CANCELAMENTO'
  | 'ALTERACAO_STATUS'
  | 'CONTINUAR_PROCESSAMENTO'
  | 'CONFIRMACAO_DADOS'
  | 'ASSUMIU_PROCESSAMENTO'
  | 'LIBEROU_PROCESSAMENTO';

// Mapeamento de tipo de acao para descricao legivel
export const TIPO_ACAO_LABELS: Record<TipoAcaoNfe, string> = {
  'UPLOAD': 'Upload de XML',
  'INICIO_PROCESSAMENTO': 'Inicio de Processamento',
  'ASSOCIACAO_ITEM': 'Associacao de Item',
  'ASSOCIACAO_CONCLUIDA': 'Associacao Concluida',
  'CONFIG_PAGAMENTO': 'Configuracao de Pagamento',
  'PAGAMENTO_ANTECIPADO': 'Pagamento Antecipado',
  'ENTRADA_GERADA': 'Entrada Gerada',
  'CTE_CADASTRADO': 'CT-e Cadastrado',
  'PROCESSADA': 'NFe Processada',
  'CANCELAMENTO': 'Cancelamento',
  'ALTERACAO_STATUS': 'Alteracao de Status',
  'CONTINUAR_PROCESSAMENTO': 'Continuacao de Processamento',
  'CONFIRMACAO_DADOS': 'Confirmacao de Dados',
  'ASSUMIU_PROCESSAMENTO': 'Assumiu Processamento',
  'LIBEROU_PROCESSAMENTO': 'Liberou Processamento'
};

export interface HistoricoNfeParams {
  codNfeEnt: number;
  tipoAcao: TipoAcaoNfe;
  previousStatus?: string;
  newStatus?: string;
  userId: string;
  userName: string;
  comments?: string | object;
}

export interface HistoricoNfeItem {
  id: number;
  codnfe_ent: number;
  tipo_acao: string;
  previous_status: string | null;
  new_status: string | null;
  user_id: string;
  user_name: string;
  comments: string | null;
  created_at: string;
  status_label_anterior: string;
  status_label_novo: string;
  tipo_acao_label: string;
}

/**
 * Registra uma entrada no histórico da NFe
 */
export async function registrarHistoricoNfe(
  client: PoolClient | Pool,
  params: HistoricoNfeParams
): Promise<number> {
  const {
    codNfeEnt,
    tipoAcao,
    previousStatus,
    newStatus,
    userId,
    userName,
    comments
  } = params;

  // Serializar comments se for objeto
  const commentsStr = comments
    ? (typeof comments === 'object' ? JSON.stringify(comments) : comments)
    : null;

  console.log(`[Historico NFe] Registrando: ${codNfeEnt} | ${tipoAcao} | ${previousStatus || 'NOVO'} -> ${newStatus || 'N/A'} | Usuario: ${userName}`);

  const query = `
    INSERT INTO dbnfe_ent_historico (
      codnfe_ent,
      tipo_acao,
      previous_status,
      new_status,
      user_id,
      user_name,
      comments,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING id
  `;

  const result = await client.query(query, [
    codNfeEnt,
    tipoAcao,
    previousStatus || null,
    newStatus || null,
    userId,
    userName,
    commentsStr
  ]);

  const historicoId = result.rows[0].id;
  console.log(`[Historico NFe] Registrado com ID: ${historicoId}`);

  return historicoId;
}

/**
 * Registra histórico de upload de XML
 */
export async function registrarUploadNfe(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes?: { numeroNf?: string; chave?: string; emitente?: string; valorTotal?: number }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'UPLOAD',
    previousStatus: '',
    newStatus: 'R',
    userId,
    userName,
    comments: {
      tipo: 'UPLOAD',
      descricao: `XML da NFe importado`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de início de processamento
 */
export async function registrarInicioProcessamento(
  client: PoolClient | Pool,
  codNfeEnt: number,
  previousStatus: string,
  userId: string,
  userName: string
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'INICIO_PROCESSAMENTO',
    previousStatus,
    newStatus: 'A',
    userId,
    userName,
    comments: {
      tipo: 'INICIO_PROCESSAMENTO',
      descricao: 'Processamento iniciado'
    }
  });
}

/**
 * Registra histórico de continuação de processamento
 */
export async function registrarContinuarProcessamento(
  client: PoolClient | Pool,
  codNfeEnt: number,
  previousStatus: string,
  userId: string,
  userName: string
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'CONTINUAR_PROCESSAMENTO',
    previousStatus,
    newStatus: 'A',
    userId,
    userName,
    comments: {
      tipo: 'CONTINUAR_PROCESSAMENTO',
      descricao: 'Processamento retomado'
    }
  });
}

/**
 * Registra histórico de associação de item
 */
export async function registrarAssociacaoItem(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes: {
    itemNfe?: string;
    produtoAssociado?: string;
    ordemCompra?: string;
    quantidade?: number;
  }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'ASSOCIACAO_ITEM',
    userId,
    userName,
    comments: {
      tipo: 'ASSOCIACAO_ITEM',
      descricao: `Item associado: ${detalhes.itemNfe} -> ${detalhes.produtoAssociado}`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de conclusão de associação
 */
export async function registrarAssociacaoConcluida(
  client: PoolClient | Pool,
  codNfeEnt: number,
  previousStatus: string,
  userId: string,
  userName: string,
  detalhes?: { totalItens?: number; itensAssociados?: number }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'ASSOCIACAO_CONCLUIDA',
    previousStatus,
    newStatus: 'C',
    userId,
    userName,
    comments: {
      tipo: 'ASSOCIACAO_CONCLUIDA',
      descricao: `Associacao concluida: ${detalhes?.itensAssociados || 0}/${detalhes?.totalItens || 0} itens`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de configuração de pagamento
 */
export async function registrarConfigPagamentoNfe(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes: {
    formaPagamento?: string;
    banco?: string;
    parcelas?: number;
    valorTotal?: number;
  }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'CONFIG_PAGAMENTO',
    userId,
    userName,
    comments: {
      tipo: 'CONFIG_PAGAMENTO',
      descricao: `Pagamento configurado: ${detalhes.parcelas || 1} parcela(s)`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de pagamento antecipado
 */
export async function registrarPagamentoAntecipadoNfe(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes: {
    valor?: number;
    banco?: string;
    dataVencimento?: string;
  }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'PAGAMENTO_ANTECIPADO',
    userId,
    userName,
    comments: {
      tipo: 'PAGAMENTO_ANTECIPADO',
      descricao: `Pagamento antecipado registrado: R$ ${detalhes.valor?.toFixed(2) || '0.00'}`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de geração de entrada
 */
export async function registrarEntradaGerada(
  client: PoolClient | Pool,
  codNfeEnt: number,
  previousStatus: string,
  userId: string,
  userName: string,
  detalhes?: { codEntrada?: number; tipoEntrada?: string }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'ENTRADA_GERADA',
    previousStatus,
    newStatus: 'S',
    userId,
    userName,
    comments: {
      tipo: 'ENTRADA_GERADA',
      descricao: `Entrada gerada com sucesso`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de cadastro de CT-e
 */
export async function registrarCteCadastrado(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes: {
    numeroCte?: string;
    transportadora?: string;
    valorFrete?: number;
    tipoFrete?: string;
  }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'CTE_CADASTRADO',
    userId,
    userName,
    comments: {
      tipo: 'CTE_CADASTRADO',
      descricao: `CT-e cadastrado: ${detalhes.numeroCte || 'N/A'} - ${detalhes.transportadora || 'N/A'}`,
      ...detalhes
    }
  });
}

/**
 * Registra histórico de confirmação de dados
 */
export async function registrarConfirmacaoDados(
  client: PoolClient | Pool,
  codNfeEnt: number,
  userId: string,
  userName: string,
  detalhes?: { camposConfirmados?: string[] }
): Promise<number> {
  return registrarHistoricoNfe(client, {
    codNfeEnt,
    tipoAcao: 'CONFIRMACAO_DADOS',
    userId,
    userName,
    comments: {
      tipo: 'CONFIRMACAO_DADOS',
      descricao: 'Dados da NFe confirmados',
      ...detalhes
    }
  });
}

/**
 * Busca histórico completo de uma NFe
 */
export async function buscarHistoricoNfe(
  client: PoolClient | Pool,
  codNfeEnt: number
): Promise<HistoricoNfeItem[]> {
  const query = `
    SELECT
      h.id,
      h.codnfe_ent,
      h.tipo_acao,
      h.previous_status,
      h.new_status,
      h.user_id,
      h.user_name,
      h.comments,
      h.created_at
    FROM dbnfe_ent_historico h
    WHERE h.codnfe_ent = $1
    ORDER BY h.created_at ASC, h.id ASC
  `;

  const result = await client.query(query, [codNfeEnt]);

  return result.rows.map(row => ({
    ...row,
    status_label_anterior: row.previous_status ? STATUS_NFE_LABELS[row.previous_status] || row.previous_status : '',
    status_label_novo: row.new_status ? STATUS_NFE_LABELS[row.new_status] || row.new_status : '',
    tipo_acao_label: TIPO_ACAO_LABELS[row.tipo_acao as TipoAcaoNfe] || row.tipo_acao
  }));
}

/**
 * Parse de comentário estruturado do histórico
 */
export interface ParsedHistoricoNfe {
  tipo: TipoAcaoNfe;
  descricao: string;
  dados?: Record<string, any>;
}

export function parseComentarioHistoricoNfe(comments: string | null): ParsedHistoricoNfe | null {
  if (!comments) return null;

  try {
    const parsed = JSON.parse(comments);
    return {
      tipo: parsed.tipo,
      descricao: parsed.descricao || '',
      dados: parsed
    };
  } catch {
    // Se não for JSON, retorna como texto simples
    return {
      tipo: 'ALTERACAO_STATUS',
      descricao: comments,
      dados: undefined
    };
  }
}

/**
 * Busca o usuário que iniciou o processamento de uma NFe
 */
export async function buscarUsuarioIniciador(
  client: PoolClient | Pool,
  codNfeEnt: number
): Promise<{ userId: string; userName: string } | null> {
  const query = `
    SELECT user_id, user_name
    FROM dbnfe_ent_historico
    WHERE codnfe_ent = $1
      AND tipo_acao IN ('UPLOAD', 'INICIO_PROCESSAMENTO')
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const result = await client.query(query, [codNfeEnt]);

  if (result.rows.length === 0) return null;

  return {
    userId: result.rows[0].user_id,
    userName: result.rows[0].user_name
  };
}
