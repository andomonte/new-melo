// src/pages/api/compras/dashboard/dashboardUtils.ts

import { PoolClient } from 'pg';

// ============================================================================
// TIPAGEM DOS DADOS DE SAÍDA
// ============================================================================
export type ComprasPorPeriodo = {
  comprasDiarias: number;
  comprasSemanais: number;
  comprasMensais: number;
  comprasAnuais: number;
};

export type TopFornecedor = {
  codCredor: string;
  nomeFornecedor: string;
  totalCompras: number;
  totalOrdens: number;
};

export type TopProdutoComprado = {
  codprod: string;
  nomeProduto: string;
  quantidadeComprada: number;
  valorTotal: number;
};

export type StatusRequisicao = {
  status: string;
  statusLabel: string;
  quantidade: number;
  percentual: number;
};

export type ComprasMensais = {
  label: string;
  totalCompras: number;
  totalComprasAnterior?: number;
};

// Mapeamento de status para labels legíveis
export const STATUS_LABELS: Record<string, string> = {
  P: 'Rascunho',
  S: 'Submetida',
  A: 'Aprovada',
  R: 'Rejeitada',
  C: 'Cancelada',
  L: 'Liberada',
  F: 'Finalizada',
};

// Cores para o gráfico de status
export const STATUS_COLORS: Record<string, string> = {
  P: '#94a3b8', // slate-400 (Rascunho)
  S: '#3b82f6', // blue-500 (Submetida)
  A: '#22c55e', // green-500 (Aprovada)
  R: '#ef4444', // red-500 (Rejeitada)
  C: '#6b7280', // gray-500 (Cancelada)
  L: '#8b5cf6', // violet-500 (Liberada)
  F: '#14b8a6', // teal-500 (Finalizada)
};

// Função auxiliar para formatar a data para o padrão do PostgreSQL 'YYYY-MM-DD'
const formatDateForPG = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// FUNÇÃO AUXILIAR PARA CALCULAR PERÍODOS
// ============================================================================
export const getDateRange = (
  range: string,
): { startDate: string; endDate: string } => {
  const endDateObj = new Date();
  const startDateObj = new Date();

  switch (range) {
    case 'hoje':
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(23, 59, 59, 999);
      break;
    case 'ultima_semana':
      startDateObj.setDate(startDateObj.getDate() - 7);
      startDateObj.setHours(0, 0, 0, 0);
      break;
    case 'ultimos_30_dias':
      startDateObj.setDate(startDateObj.getDate() - 30);
      startDateObj.setHours(0, 0, 0, 0);
      break;
    case 'ultimo_trimestre':
      startDateObj.setMonth(startDateObj.getMonth() - 3);
      startDateObj.setHours(0, 0, 0, 0);
      break;
    case 'ultimo_ano':
      startDateObj.setFullYear(startDateObj.getFullYear() - 1);
      startDateObj.setHours(0, 0, 0, 0);
      break;
    case 'todo_periodo':
      return { startDate: '1970-01-01', endDate: '2099-12-31' };
    default:
      startDateObj.setDate(startDateObj.getDate() - 30);
      startDateObj.setHours(0, 0, 0, 0);
      break;
  }

  return {
    startDate: formatDateForPG(startDateObj),
    endDate: formatDateForPG(endDateObj),
  };
};

// ============================================================================
// FUNÇÃO AUXILIAR PARA AGRUPAMENTO DINÂMICO DO GRÁFICO
// ============================================================================
export const getDynamicTrunc = async (
  client: PoolClient,
  range: string,
): Promise<'day' | 'month' | 'year'> => {
  // Para períodos fixos, o 'trunc' é previsível
  if (range === 'ultimo_trimestre' || range === 'ultimo_ano') return 'month';
  if (
    range === 'hoje' ||
    range === 'ultima_semana' ||
    range === 'ultimos_30_dias'
  )
    return 'day';

  // A lógica dinâmica só se aplica a 'todo_periodo'
  if (range === 'todo_periodo') {
    const comprasSpanResult = await client.query(
      `SELECT MIN(orc_data) as "firstCompra", MAX(orc_data) as "lastCompra"
       FROM db_manaus.cmp_ordem_compra
       WHERE orc_data IS NOT NULL AND orc_status IN ('A', 'F')`,
    );
    const comprasSpan = comprasSpanResult.rows[0];

    if (comprasSpan && comprasSpan.firstCompra && comprasSpan.lastCompra) {
      const diffTime = Math.abs(
        new Date(comprasSpan.lastCompra).getTime() -
          new Date(comprasSpan.firstCompra).getTime(),
      );
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 90) return 'day';
      if (diffDays <= 730) return 'month';
      return 'year';
    }
  }

  // Padrão para qualquer caso não previsto
  return 'day';
};
