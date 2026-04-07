// src/lib/vendas/dashboardUtils.ts

import { PoolClient } from 'pg';

// ============================================================================
// TIPAGEM DOS DADOS DE SAÍDA
// ============================================================================
export type KpiData = {
  totalSales: number;
  newClients: number;
};

export type TopSellingProduct = {
  codprod: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
};

export type RecentSale = {
  codvenda: string;
  clientName: string;
  date: string;
  total: number;
  status: 'Faturada' | 'Finalizada' | 'Cancelada';
};

export type SalesOverviewDataPoint = {
  label: string;
  revenue: number;
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
  // <<< MUDANÇA NO TIPO DE RETORNO
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
      // Usar datas extremas garante a captura de todos os registros
      return { startDate: '1970-01-01', endDate: '2099-12-31' };
    default:
      startDateObj.setDate(startDateObj.getDate() - 30);
      startDateObj.setHours(0, 0, 0, 0);
      break;
  }

  // Retorna as datas já formatadas como string
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
    const salesSpanResult = await client.query(
      `SELECT MIN(data) as "firstSale", MAX(data) as "lastSale" FROM dbvenda WHERE data IS NOT NULL`,
    );
    const salesSpan = salesSpanResult.rows[0];

    if (salesSpan && salesSpan.firstSale && salesSpan.lastSale) {
      const diffTime = Math.abs(
        new Date(salesSpan.lastSale).getTime() -
          new Date(salesSpan.firstSale).getTime(),
      );
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 90) return 'day';
      if (diffDays <= 730) return 'month';
      return 'year';
    }
  }

  // Padrão para qualquer caso não previsto ou se a tabela estiver vazia
  return 'day';
};
