// src/components/corpo/comprador/RequisicoesCompra/List/ActionsMenu.tsx

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Package, Send, CheckCircle, XCircle, Eye, Edit3, Trash2, Ban } from 'lucide-react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useRequisitionPermissions } from '@/hooks/usePermissions';

export interface ActionsMenuProps {
  requisition: RequisitionDTO;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onManageItems?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onView?: () => void;
  onDelete?: () => void;
}

export default function ActionsMenu({ 
  requisition, 
  onSubmit, 
  onApprove, 
  onReject,
  onManageItems,
  onEdit,
  onCancel,
  onView,
  onDelete
}: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const permissions = useRequisitionPermissions(requisition);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    console.log('ActionsMenu: Executando ação');
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="
          flex items-center justify-center
          w-8 h-8
          rounded-md
          text-gray-600 dark:text-gray-400
          hover:bg-gray-100 dark:hover:bg-gray-700
          hover:text-gray-900 dark:hover:text-gray-100
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
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
          {permissions.canManageItems && onManageItems && (
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
          
          {permissions.canView && onView && (
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
          
          {permissions.canEditThisRequisition && onEdit && (
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

          {/* Separador para ações de workflow */}
          {(permissions.canSubmitThisRequisition || permissions.canApproveThisRequisition || permissions.canReject) && (
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
          )}
          
          {/* Ações de workflow */}
          {permissions.canSubmitThisRequisition && (
            <button
              onClick={() => handleAction(onSubmit)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-blue-700 dark:text-blue-400
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                transition-colors
              "
            >
              <Send size={14} />
              Submeter
            </button>
          )}
          
          {permissions.canApproveThisRequisition && (
            <button
              onClick={() => handleAction(onApprove)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-green-700 dark:text-green-400
                hover:bg-green-50 dark:hover:bg-green-900/20
                transition-colors
              "
            >
              <CheckCircle size={14} />
              Aprovar
            </button>
          )}

          {permissions.canReject && requisition.statusRequisicao === 'S' && (
            <button
              onClick={() => handleAction(onReject)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-red-700 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20
                transition-colors
              "
            >
              <Ban size={14} />
              Reprovar
            </button>
          )}

          {permissions.canCancel && onCancel && (
            <button
              onClick={() => handleAction(onCancel)}
              className="
                flex items-center gap-2 w-full px-3 py-2
                text-sm text-orange-700 dark:text-orange-400
                hover:bg-orange-50 dark:hover:bg-orange-900/20
                transition-colors
              "
            >
              <XCircle size={14} />
              Cancelar
            </button>
          )}

          {/* Separador para ações destrutivas */}
          {permissions.canDeleteThisRequisition && onDelete && (
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
                Excluir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
