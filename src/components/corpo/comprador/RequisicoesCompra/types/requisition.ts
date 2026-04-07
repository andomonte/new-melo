// DEPRECATED: Este arquivo foi substituído pelos tipos unificados
// Importe de: @/types/compras/requisition

import { 
  RequisitionDTO as UnifiedRequisitionDTO,
  RequisitionStatus as UnifiedRequisitionStatus,
  OrderStatus as UnifiedOrderStatus 
} from '@/types/compras/requisition';

// Re-exportar os tipos unificados para compatibilidade
export type RequisitionDTO = UnifiedRequisitionDTO;
export type RequisitionStatus = UnifiedRequisitionStatus;
export type OrderStatus = UnifiedOrderStatus;
