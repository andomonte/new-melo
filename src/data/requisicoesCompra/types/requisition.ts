// DEPRECATED: Este arquivo foi substituído pelos tipos unificados
// Importe de: @/types/compras/requisition

import { 
  RequisitionDTO as UnifiedRequisitionDTO,
  RequisitionStatus,
  OrderStatus 
} from '@/types/compras/requisition';

// Re-exportar o tipo unificado para compatibilidade
export type RequisitionDTO = UnifiedRequisitionDTO;

// Re-exportar enums para compatibilidade
export { RequisitionStatus, OrderStatus };
