// Novo ActionsMenu com suporte ao sistema de workflow
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  MoreVertical, Package, Send, CheckCircle, XCircle, Eye, Edit3,
  Trash2, Ban, FileText, RotateCcw
} from 'lucide-react';
import { RequisitionWorkflow, WorkflowUtils } from '@/lib/compras/workflow';
import { RequisitionDTO, RequisitionStatus, UpdateStatusPayload } from '@/types/compras';
import api from '@/components/services/api';
import { AuthContext } from '@/contexts/authContexts';

export interface WorkflowActionsMenuProps {
  requisition: RequisitionDTO;
  userPermissions?: string[];
  onStatusChange?: (requisition: RequisitionDTO, newStatus: RequisitionStatus) => void;
  onManageItems?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  onDelete?: () => void;
}

// Mapeamento de ícones para ações
const ACTION_ICONS = {
  Send: Send,
  Check: CheckCircle,
  X: XCircle,
  Ban: Ban,
  Edit: Edit3,
  FileText: FileText,
  RotateCcw: RotateCcw
};

export default function WorkflowActionsMenu({
  requisition,
  userPermissions = ['compra.criar', 'compra.editar', 'compra.aprovar'], // Permissões padrão
  onStatusChange,
  onManageItems,
  onEdit,
  onView,
  onDelete
}: WorkflowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useContext(AuthContext);

  const currentStatus = requisition.statusRequisicao as RequisitionStatus || RequisitionStatus.DRAFT;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = async (targetStatus: RequisitionStatus, reason?: string) => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      setIsOpen(false);

      const payload: UpdateStatusPayload = {
        id: requisition.id,
        versao: requisition.versao,
        status: targetStatus,
        observacao: reason,
        userId: user?.codusr,
        userName: user?.usuario,
      };

      const response = await api.put('/api/requisicoesCompra/status/update', payload);

      if (response.data?.success) {
        // Notificar componente pai sobre a mudança
        if (onStatusChange) {
          onStatusChange({
            ...requisition,
            statusRequisicao: targetStatus
          }, targetStatus);
        }
        
        // Mostrar mensagem de sucesso
        // TODO: Implementar sistema de notificações
        console.log('Status atualizado:', response.data.message);
      } else {
        throw new Error(response.data?.message || 'Falha ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // TODO: Mostrar erro para o usuário
      alert('Erro ao atualizar status da requisição');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  // Obter ações disponíveis baseadas no workflow
  const availableActions = RequisitionWorkflow.getAvailableActions(currentStatus, userPermissions);

  // Verificar permissões para ações básicas
  const canEdit = RequisitionWorkflow.canEdit(currentStatus);
  const canManageItems = RequisitionWorkflow.canManageItems(currentStatus);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className="
          flex items-center justify-center
          w-8 h-8
          rounded-md
          text-gray-600 dark:text-gray-400
          hover:bg-gray-100 dark:hover:bg-gray-700
          hover:text-gray-900 dark:hover:text-gray-100
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="Ações"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="
          absolute right-0 top-full mt-1 z-50
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-md shadow-lg
          min-w-48
          py-1
        ">
          {/* Ações básicas */}
          {onView && (
            <button
              onClick={() => handleAction(onView)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-gray-100
                transition-colors
              "
            >
              <Eye size={14} />
              Visualizar
            </button>
          )}

          {onManageItems && canManageItems && (
            <button
              onClick={() => handleAction(onManageItems)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-gray-100
                transition-colors
              "
            >
              <Package size={14} />
              Gerenciar Itens
            </button>
          )}
          
          {onEdit && canEdit && (
            <button
              onClick={() => handleAction(onEdit)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-gray-100
                transition-colors
              "
            >
              <Edit3 size={14} />
              Editar
            </button>
          )}

          {/* Separador se houver ações básicas e de workflow */}
          {(availableActions.length > 0 && (onView || (onManageItems && canManageItems) || (onEdit && canEdit))) && (
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
          )}

          {/* Ações do workflow */}
          {availableActions.map((action) => {
            const IconComponent = ACTION_ICONS[action.icon as keyof typeof ACTION_ICONS] || FileText;
            
            const getButtonStyle = () => {
              switch (action.variant) {
                case 'default':
                  return 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20';
                case 'destructive':
                  return 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20';
                case 'outline':
                  return 'text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
                case 'secondary':
                  return 'text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20';
                default:
                  return 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
              }
            };

            return (
              <button
                key={action.action}
                onClick={() => handleStatusChange(action.targetStatus)}
                disabled={isUpdating}
                className={`
                  flex items-center gap-2 w-full px-3 py-2
                  text-sm transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${getButtonStyle()}
                `}
                title={action.description}
              >
                <IconComponent size={14} />
                {action.label}
              </button>
            );
          })}

          {/* Ação de deletar se disponível */}
          {onDelete && currentStatus === RequisitionStatus.DRAFT && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                onClick={() => handleAction(onDelete)}
                className="
                  flex items-center gap-2 w-full px-3 py-2
                  text-sm text-red-700 dark:text-red-400
                  hover:bg-red-50 dark:hover:bg-red-900/20
                  transition-colors
                "
              >
                <Trash2 size={14} />
                Deletar
              </button>
            </>
          )}

          {/* Indicador de loading */}
          {isUpdating && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Atualizando...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook para usar o WorkflowActionsMenu de forma simplificada
 */
export function useWorkflowActions(
  requisition: RequisitionDTO,
  callbacks: {
    onStatusChange?: (requisition: RequisitionDTO, newStatus: RequisitionStatus) => void;
    onManageItems?: () => void;
    onEdit?: () => void;
    onView?: () => void;
    onDelete?: () => void;
  }
) {
  const currentStatus = requisition.statusRequisicao as RequisitionStatus || RequisitionStatus.DRAFT;
  
  return {
    currentStatus,
    canEdit: RequisitionWorkflow.canEdit(currentStatus),
    canManageItems: RequisitionWorkflow.canManageItems(currentStatus),
    canGenerateOrder: RequisitionWorkflow.canGenerateOrder(currentStatus),
    statusLabel: WorkflowUtils.getStatusLabel(currentStatus),
    statusColor: WorkflowUtils.getStatusColor(currentStatus),
    statusIcon: WorkflowUtils.getStatusIcon(currentStatus),
    availableActions: RequisitionWorkflow.getAvailableActions(
      currentStatus, 
      ['compra.criar', 'compra.editar', 'compra.aprovar'] // TODO: Obter do contexto
    ),
    nextSuggestedStatus: RequisitionWorkflow.getNextSuggestedStatus(currentStatus, true), // Assumindo que tem itens
    ...callbacks
  };
}