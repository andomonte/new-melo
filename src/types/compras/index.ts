// Exportação centralizada dos tipos do módulo de compras
export * from './requisition';

// Re-exportações para compatibilidade com código existente
export type {
  RequisitionDTO,
  RequisitionItem,
  OrderStatus,
  Fornecedor,
  Comprador,
  Filial,
  CartItem,
  NovaRequisicaoForm,
  CreateRequisitionResponse,
  ListRequisitionsResponse,
  RequisitionFilters,
  UpdateStatusPayload
} from './requisition';

// Export enums as values
export { RequisitionStatus } from './requisition';