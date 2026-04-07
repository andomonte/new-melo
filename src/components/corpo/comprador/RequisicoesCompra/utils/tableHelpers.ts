import React from 'react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';

export const formatTableData = (data: RequisitionDTO[], headers: string[]) => {
  return data.map((item) => {
    const row: Record<string, any> = {};

    headers.forEach((col) => {
      if (col === 'selecionar' || col === 'editar') return;

      let v = item[col as keyof RequisitionDTO];
      
      // Tratamento especial para condições de pagamento
      if (col === 'condicoesPagamento' && !v) {
        v = item.condPagto || '';
      }

      // Tratar campos vazios de ordem de compra
      if (col === 'ordemCompra' && (!v || v === 0 || v === '0')) {
        v = '-';
      }

      // Tratar data de ordem vazia ANTES de formatar data
      if (col === 'dataOrdem' && (!v || v === '0' || v === 0)) {
        v = '-';
      } else if (
        // Format dates (se não for '-')
        typeof v === 'string' &&
        v !== '-' &&
        (col.toLowerCase().includes('data') ||
          col.toLowerCase().includes('date'))
      ) {
        try {
          const date = new Date(v);
          if (!isNaN(date.getTime())) {
            v = date.toLocaleDateString('pt-BR');
          }
        } catch {
          // Ignore date parsing errors
        }
      }

      // Format status with simple text
      if (col.toLowerCase().includes('status')) {
        // Se for statusOrdem e não tiver ordem, mostrar '-'
        if (col.toLowerCase().includes('ordem') && (!item.ordemCompra || item.ordemCompra === 0)) {
          v = '-';
        } else {
          // Determinar se é status de requisição ou ordem
          const isOrdemStatus = col.toLowerCase().includes('ordem');
          v = formatStatusText(v as string, isOrdemStatus);
        }
      }

      // Format tipo with full name
      if (col === 'tipo') {
        v = formatTipoText(v as string);
      }

      // Truncate long text fields
      if (typeof v === 'string' && (col === 'observacao' || col === 'fornecedorNome' || col === 'fornecedorCompleto' || col === 'compradorCompleto')) {
        if (v.length > 30) {
          v = v.substring(0, 30) + '...';
        }
      }

      // Tratar observação vazia
      if (col === 'observacao' && (!v || v === '')) {
        v = '-';
      }

      row[col] = v ?? '-';
    });

    return row;
  });
};

const formatStatusText = (status: string, isOrdemStatus: boolean = false) => {
  if (!status) return '';

  // Mapeamento para STATUS DE REQUISIÇÃO com cores
  const statusRequisicaoMap: Record<string, { label: string; color: string }> = {
    'P': { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50' },
    'A': { label: 'Aprovada', color: 'text-green-600 bg-green-50' },
    'R': { label: 'Reprovada', color: 'text-red-600 bg-red-50' },
    'C': { label: 'Cancelada', color: 'text-gray-600 bg-gray-50' },
    'S': { label: 'Submetida', color: 'text-blue-600 bg-blue-50' },
    'E': { label: 'Em Análise', color: 'text-purple-600 bg-purple-50' },
    'F': { label: 'Finalizada', color: 'text-blue-600 bg-blue-50' },
  };

  // Mapeamento para STATUS DE ORDEM DE COMPRA com cores
  const statusOrdemMap: Record<string, { label: string; color: string }> = {
    'P': { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50' },
    'A': { label: 'Aberta', color: 'text-green-600 bg-green-50' },
    'F': { label: 'Finalizada', color: 'text-blue-600 bg-blue-50' },
    'C': { label: 'Cancelada', color: 'text-gray-600 bg-gray-50' },
  };

  const map = isOrdemStatus ? statusOrdemMap : statusRequisicaoMap;
  const statusKey = status.toUpperCase();
  const statusInfo = map[statusKey];

  if (statusInfo) {
    return React.createElement('span', {
      className: `px-2 py-1 text-xs rounded-full ${statusInfo.color}`
    }, statusInfo.label);
  }

  return status;
};

const formatTipoText = (tipo: string) => {
  if (!tipo) return '';

  const tipoMap: Record<string, string> = {
    'CD': 'COMPRA DIRETA',
    'RP': 'REQUISIÇÃO DE PREÇO',
    'VC': 'VENDA COMBINADA',
    'BF': 'BONIFICAÇÃO',
  };

  return tipoMap[tipo.toUpperCase()] || tipo;
};


export const createEditButton = (
  item: RequisitionDTO, 
  onEdit: (item: RequisitionDTO) => void,
  EditIcon: React.ComponentType<{ size: number }>
) => {
  return React.createElement('div', {
    className: "relative group flex justify-center"
  }, React.createElement('button', {
    onClick: () => onEdit(item),
    className: "text-gray-700 dark:text-gray-100 group-hover:text-blue-600 transition-colors duration-200 p-0",
    title: "Editar"
  }, React.createElement(EditIcon, { size: 16 })));
};

export const createActionsMenu = (
  item: RequisitionDTO,
  ActionsMenuComponent: React.ComponentType<any>,
  onSubmit: (item: RequisitionDTO) => void,
  onApprove: (item: RequisitionDTO) => Promise<void>,
  onReject: (item: RequisitionDTO) => Promise<void>,
  onManageItems?: (item: RequisitionDTO) => void,
  onEdit?: (item: RequisitionDTO) => void,
  onCancel?: (item: RequisitionDTO) => void,
  onView?: (item: RequisitionDTO) => void,
  onDelete?: (item: RequisitionDTO) => void
) => {
  return React.createElement(ActionsMenuComponent, {
    requisition: item,
    onSubmit: () => onSubmit(item),
    onApprove: () => onApprove(item),
    onReject: () => onReject(item),
    onManageItems: onManageItems ? () => onManageItems(item) : undefined,
    onEdit: onEdit ? () => onEdit(item) : undefined,
    onCancel: onCancel ? () => onCancel(item) : undefined,
    onView: onView ? () => onView(item) : undefined,
    onDelete: onDelete ? () => onDelete(item) : undefined
  });
};