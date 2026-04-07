// Tabela de requisições seguindo o padrão do sistema
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical, Package, Eye, Edit, FileText } from 'lucide-react';
import { RequisitionDTO, RequisitionStatus } from '@/types/compras';
import WorkflowActionsMenu from './WorkflowActionsMenu';
import { WorkflowUtils } from '@/lib/compras/workflow';

interface Meta {
  total: number;
  lastPage: number;
  currentPage: number;
  perPage: number;
}

interface RequisitionsTableProps {
  data: RequisitionDTO[];
  meta: Meta;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onEdit?: (item: RequisitionDTO) => void;
  onView?: (item: RequisitionDTO) => void;
  onManageItems?: (item: RequisitionDTO) => void;
  onStatusChange?: (item: RequisitionDTO, newStatus: RequisitionStatus) => void;
}

const RequisitionsTable: React.FC<RequisitionsTableProps> = ({
  data,
  meta,
  loading,
  onPageChange,
  onPerPageChange,
  onEdit,
  onView,
  onManageItems,
  onStatusChange,
}) => {
  const perPageOptions = [10, 25, 50, 100];

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-600 rounded-lg overflow-hidden">
      {/* Header da Tabela */}
      <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 uppercase">
          <div className="col-span-1 text-center">Ações</div>
          <div className="col-span-2">Requisição</div>
          <div className="col-span-1">Data</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-3">Fornecedor</div>
          <div className="col-span-2">Comprador</div>
          <div className="col-span-1">Destino</div>
          <div className="col-span-1">Valor</div>
        </div>
      </div>

      {/* Corpo da Tabela */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Carregando dados...</p>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Nenhuma requisição encontrada</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Crie uma nova requisição para começar</p>
            </div>
          </div>
        ) : (
          <div className="min-h-full">
            {data.map((item, index) => {
              const status = item.statusRequisicao as RequisitionStatus || RequisitionStatus.DRAFT;
              
              return (
                <div
                  key={item.id || index}
                  className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {/* Ações */}
                  <div className="col-span-1 flex items-center justify-center">
                    <WorkflowActionsMenu
                      requisition={item}
                      onStatusChange={onStatusChange}
                      onManageItems={() => onManageItems?.(item)}
                      onEdit={() => onEdit?.(item)}
                      onView={() => onView?.(item)}
                    />
                  </div>

                  {/* Requisição */}
                  <div className="col-span-2 flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {item.requisicao || `${item.id}/${item.versao}`}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      v{item.versao}
                    </span>
                  </div>

                  {/* Data */}
                  <div className="col-span-1 flex items-center text-gray-600 dark:text-gray-300">
                    {formatDate(item.dataRequisicao)}
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex items-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${WorkflowUtils.getStatusColor(status)}`}>
                      {WorkflowUtils.getStatusLabel(status)}
                    </span>
                  </div>

                  {/* Fornecedor */}
                  <div className="col-span-3 flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate" title={item.fornecedorNome}>
                      {item.fornecedorNome || '-'}
                    </span>
                    {item.fornecedorCpfCnpj && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.fornecedorCpfCnpj}
                      </span>
                    )}
                  </div>

                  {/* Comprador */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-gray-600 dark:text-gray-300 truncate" title={item.compradorNome}>
                      {item.compradorNome || '-'}
                    </span>
                  </div>

                  {/* Destino */}
                  <div className="col-span-1 flex items-center">
                    <span className="text-gray-600 dark:text-gray-300 truncate text-xs" title={item.destino}>
                      {item.destino || '-'}
                    </span>
                  </div>

                  {/* Valor */}
                  <div className="col-span-1 flex items-center">
                    <span className="text-green-600 dark:text-green-400 font-medium text-xs">
                      {formatCurrency(item.valorTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé com Paginação */}
      <div className="bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-600 px-4 py-3 flex items-center justify-between">
        {/* Seletor de itens por página */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Mostrar</span>
          <select
            value={meta.perPage}
            onChange={(e) => onPerPageChange?.(Number(e.target.value))}
            className="border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            {perPageOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>itens por página</span>
        </div>

        {/* Informações e navegação */}
        <div className="flex items-center space-x-4">
          {/* Informações de paginação */}
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Mostrando {Math.min((meta.currentPage - 1) * meta.perPage + 1, meta.total)} a{' '}
            {Math.min(meta.currentPage * meta.perPage, meta.total)} de {meta.total} registros
          </div>

          {/* Controles de navegação */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(meta.currentPage - 1)}
              disabled={meta.currentPage <= 1}
              className="p-2 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Números das páginas (simplified) */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, meta.lastPage) }, (_, i) => {
                let pageNumber;
                
                if (meta.lastPage <= 5) {
                  pageNumber = i + 1;
                } else {
                  const start = Math.max(1, meta.currentPage - 2);
                  const end = Math.min(meta.lastPage, start + 4);
                  pageNumber = start + i;
                  
                  if (pageNumber > end) return null;
                }
                
                return (
                  <button
                    key={pageNumber}
                    onClick={() => onPageChange(pageNumber)}
                    className={`w-8 h-8 text-sm rounded border transition-colors ${
                      pageNumber === meta.currentPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-600'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(meta.currentPage + 1)}
              disabled={meta.currentPage >= meta.lastPage}
              className="p-2 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequisitionsTable;