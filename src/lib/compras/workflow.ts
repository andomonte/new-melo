// Sistema de workflow para requisições de compra
import { RequisitionStatus } from '@/types/compras';

/**
 * Máquina de estados para requisições de compra
 */
export interface WorkflowState {
  current: RequisitionStatus;
  allowedTransitions: RequisitionStatus[];
  requiredPermissions: string[];
  description: string;
}

/**
 * Definição dos estados e transições válidas
 */
export const WORKFLOW_STATES: Record<RequisitionStatus, WorkflowState> = {
  [RequisitionStatus.DRAFT]: {
    current: RequisitionStatus.DRAFT,
    allowedTransitions: [RequisitionStatus.SUBMITTED, RequisitionStatus.CANCELLED],
    requiredPermissions: ['compra.criar', 'compra.editar'],
    description: 'Requisição em rascunho, pode ser editada'
  },
  
  [RequisitionStatus.SUBMITTED]: {
    current: RequisitionStatus.SUBMITTED,
    allowedTransitions: [RequisitionStatus.APPROVED, RequisitionStatus.REJECTED, RequisitionStatus.CANCELLED],
    requiredPermissions: ['compra.aprovar', 'compra.gerenciar'],
    description: 'Requisição submetida, aguardando aprovação'
  },
  
  [RequisitionStatus.APPROVED]: {
    current: RequisitionStatus.APPROVED,
    allowedTransitions: [RequisitionStatus.CANCELLED],
    requiredPermissions: ['compra.gerenciar'],
    description: 'Requisição aprovada, pode gerar ordem de compra'
  },
  
  [RequisitionStatus.REJECTED]: {
    current: RequisitionStatus.REJECTED,
    allowedTransitions: [RequisitionStatus.DRAFT],
    requiredPermissions: ['compra.editar'],
    description: 'Requisição rejeitada, pode ser corrigida'
  },
  
  [RequisitionStatus.CANCELLED]: {
    current: RequisitionStatus.CANCELLED,
    allowedTransitions: [],
    requiredPermissions: [],
    description: 'Requisição cancelada, estado final'
  }
};

/**
 * Interface para histórico de mudanças de status
 */
export interface StatusChangeHistory {
  id: string;
  requisitionId: number;
  requisitionVersion: number;
  previousStatus: RequisitionStatus;
  newStatus: RequisitionStatus;
  userId: string;
  userName: string;
  timestamp: Date;
  reason?: string;
  comments?: string;
}

/**
 * Interface para dados de aprovação
 */
export interface ApprovalData {
  userId: string;
  userName: string;
  reason?: string;
  comments?: string;
  timestamp?: Date;
}

/**
 * Classe para gerenciar o workflow de requisições
 */
export class RequisitionWorkflow {
  /**
   * Verifica se uma transição é válida
   */
  static isValidTransition(
    currentStatus: RequisitionStatus,
    targetStatus: RequisitionStatus
  ): boolean {
    const currentState = WORKFLOW_STATES[currentStatus];
    if (!currentState) {
      return false;
    }
    
    return currentState.allowedTransitions.includes(targetStatus);
  }

  /**
   * Obtém as transições válidas para um status atual
   */
  static getValidTransitions(currentStatus: RequisitionStatus): RequisitionStatus[] {
    const currentState = WORKFLOW_STATES[currentStatus];
    return currentState?.allowedTransitions || [];
  }

  /**
   * Verifica se o usuário tem permissão para uma transição
   */
  static hasPermission(
    currentStatus: RequisitionStatus,
    targetStatus: RequisitionStatus,
    userPermissions: string[]
  ): boolean {
    const targetState = WORKFLOW_STATES[targetStatus];
    if (!targetState) {
      return false;
    }

    // Verificar se o usuário tem pelo menos uma das permissões necessárias
    return targetState.requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );
  }

  /**
   * Valida uma mudança de status completa
   */
  static validateStatusChange(
    currentStatus: RequisitionStatus,
    targetStatus: RequisitionStatus,
    userPermissions: string[]
  ): { valid: boolean; reason?: string } {
    // Verificar se a transição é válida
    if (!this.isValidTransition(currentStatus, targetStatus)) {
      return {
        valid: false,
        reason: `Transição inválida de ${currentStatus} para ${targetStatus}`
      };
    }

    // Verificar permissões
    if (!this.hasPermission(currentStatus, targetStatus, userPermissions)) {
      return {
        valid: false,
        reason: 'Usuário não tem permissão para esta ação'
      };
    }

    return { valid: true };
  }

  /**
   * Obtém as ações disponíveis para um status atual
   */
  static getAvailableActions(
    currentStatus: RequisitionStatus,
    userPermissions: string[]
  ): Array<{
    action: string;
    targetStatus: RequisitionStatus;
    label: string;
    description: string;
    icon: string;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
  }> {
    const validTransitions = this.getValidTransitions(currentStatus);
    const actions: Array<{
      action: string;
      targetStatus: RequisitionStatus;
      label: string;
      description: string;
      icon: string;
      variant: 'default' | 'destructive' | 'outline' | 'secondary';
    }> = [];

    for (const transition of validTransitions) {
      if (this.hasPermission(currentStatus, transition, userPermissions)) {
        switch (transition) {
          case RequisitionStatus.SUBMITTED:
            actions.push({
              action: 'submit',
              targetStatus: transition,
              label: 'Submeter',
              description: 'Enviar requisição para aprovação',
              icon: 'Send',
              variant: 'default'
            });
            break;
            
          case RequisitionStatus.APPROVED:
            actions.push({
              action: 'approve',
              targetStatus: transition,
              label: 'Aprovar',
              description: 'Aprovar requisição',
              icon: 'Check',
              variant: 'default'
            });
            break;
            
          case RequisitionStatus.REJECTED:
            actions.push({
              action: 'reject',
              targetStatus: transition,
              label: 'Rejeitar',
              description: 'Rejeitar requisição',
              icon: 'X',
              variant: 'destructive'
            });
            break;
            
          case RequisitionStatus.CANCELLED:
            actions.push({
              action: 'cancel',
              targetStatus: transition,
              label: 'Cancelar',
              description: 'Cancelar requisição',
              icon: 'Ban',
              variant: 'outline'
            });
            break;
            
          case RequisitionStatus.DRAFT:
            actions.push({
              action: 'reopen',
              targetStatus: transition,
              label: 'Reabrir',
              description: 'Reabrir para edição',
              icon: 'Edit',
              variant: 'secondary'
            });
            break;
        }
      }
    }

    return actions;
  }

  /**
   * Cria um registro de mudança de status
   */
  static createStatusChangeRecord(
    requisitionId: number,
    requisitionVersion: number,
    previousStatus: RequisitionStatus,
    newStatus: RequisitionStatus,
    approvalData: ApprovalData
  ): StatusChangeHistory {
    return {
      id: `${requisitionId}-${requisitionVersion}-${Date.now()}`,
      requisitionId,
      requisitionVersion,
      previousStatus,
      newStatus,
      userId: approvalData.userId,
      userName: approvalData.userName,
      timestamp: approvalData.timestamp || new Date(),
      reason: approvalData.reason,
      comments: approvalData.comments
    };
  }

  /**
   * Obtém mensagem de erro amigável para transições inválidas
   */
  static getTransitionErrorMessage(
    currentStatus: RequisitionStatus,
    targetStatus: RequisitionStatus
  ): string {
    const currentState = WORKFLOW_STATES[currentStatus];
    const targetState = WORKFLOW_STATES[targetStatus];

    if (!currentState || !targetState) {
      return 'Status inválido';
    }

    if (!this.isValidTransition(currentStatus, targetStatus)) {
      return `Não é possível ${targetState.description.toLowerCase()} uma requisição ${currentState.description.toLowerCase()}`;
    }

    return 'Transição inválida';
  }

  /**
   * Verifica se uma requisição pode ser editada
   */
  static canEdit(status: RequisitionStatus): boolean {
    return status === RequisitionStatus.DRAFT || status === RequisitionStatus.REJECTED;
  }

  /**
   * Verifica se uma requisição pode ter itens gerenciados
   */
  static canManageItems(status: RequisitionStatus): boolean {
    return status === RequisitionStatus.DRAFT || status === RequisitionStatus.REJECTED;
  }

  /**
   * Verifica se uma requisição pode gerar ordem de compra
   */
  static canGenerateOrder(status: RequisitionStatus): boolean {
    return status === RequisitionStatus.APPROVED;
  }

  /**
   * Obtém o próximo status sugerido baseado no contexto
   */
  static getNextSuggestedStatus(
    currentStatus: RequisitionStatus,
    hasItems: boolean = false
  ): RequisitionStatus | null {
    switch (currentStatus) {
      case RequisitionStatus.DRAFT:
        return hasItems ? RequisitionStatus.SUBMITTED : null;
      case RequisitionStatus.SUBMITTED:
        return RequisitionStatus.APPROVED;
      case RequisitionStatus.REJECTED:
        return RequisitionStatus.DRAFT;
      default:
        return null;
    }
  }
}

/**
 * Utilitários para UI
 */
export const WorkflowUtils = {
  /**
   * Obtém a cor do status para UI
   */
  getStatusColor(status: RequisitionStatus): string {
    switch (status) {
      case RequisitionStatus.DRAFT:
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case RequisitionStatus.SUBMITTED:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case RequisitionStatus.APPROVED:
        return 'bg-green-100 text-green-800 border-green-300';
      case RequisitionStatus.REJECTED:
        return 'bg-red-100 text-red-800 border-red-300';
      case RequisitionStatus.CANCELLED:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  },

  /**
   * Obtém o ícone do status
   */
  getStatusIcon(status: RequisitionStatus): string {
    switch (status) {
      case RequisitionStatus.DRAFT:
        return 'FileText';
      case RequisitionStatus.SUBMITTED:
        return 'Send';
      case RequisitionStatus.APPROVED:
        return 'CheckCircle';
      case RequisitionStatus.REJECTED:
        return 'XCircle';
      case RequisitionStatus.CANCELLED:
        return 'Ban';
      default:
        return 'FileText';
    }
  },

  /**
   * Obtém o label do status
   */
  getStatusLabel(status: RequisitionStatus): string {
    switch (status) {
      case RequisitionStatus.DRAFT:
        return 'Rascunho';
      case RequisitionStatus.SUBMITTED:
        return 'Submetida';
      case RequisitionStatus.APPROVED:
        return 'Aprovada';
      case RequisitionStatus.REJECTED:
        return 'Rejeitada';
      case RequisitionStatus.CANCELLED:
        return 'Cancelada';
      default:
        return 'Desconhecido';
    }
  }
};