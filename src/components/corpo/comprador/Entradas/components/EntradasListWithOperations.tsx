import React, { useState } from 'react';
import { FileText, Building2, Calendar, DollarSign, Warehouse, AlertCircle } from 'lucide-react';
import { EntradaOperacoesMenu } from './EntradaOperacoesMenu';
import { EntradaItensModal } from './EntradaItensModal';
import { EntradaDTO, EntradasMeta } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import Pagination from '@/components/common/pagination';

interface EntradasListWithOperationsProps {
  data: EntradaDTO[];
  meta: EntradasMeta;
  loading: boolean;
  onView: (item: EntradaDTO) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onRefresh: () => void;
}

export const EntradasListWithOperations: React.FC<EntradasListWithOperationsProps> = ({
  data,
  meta,
  loading,
  onView,
  onPageChange,
  onPerPageChange,
  onRefresh,
}) => {
  const [showItensModal, setShowItensModal] = useState(false);
  const [selectedEntrada, setSelectedEntrada] = useState<EntradaDTO | null>(null);

  const handleViewItems = (entrada: EntradaDTO) => {
    setSelectedEntrada(entrada);
    setShowItensModal(true);
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando entradas...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Nenhuma entrada encontrada</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Não há entradas que correspondam aos critérios de busca.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Entradas de Mercadorias ({meta.total} total)
        </h3>
      </div>

      {/* Lista de Entradas */}
      <div className="space-y-3">
        {data.map((entrada) => (
          <div
            key={entrada.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              {/* Informações da Entrada */}
              <div className="flex-1 space-y-3">
                {/* Linha 1: NF e Fornecedor */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      NF {entrada.numeroNF}/{entrada.serie}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{entrada.fornecedorNome}</span>
                  </div>
                </div>

                {/* Linha 2: Datas e Valor */}
                <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Emissão: {formatDate(entrada.dataEmissao)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Entrada: {formatDate(entrada.dataEntrada)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">{formatCurrency(entrada.valorTotal)}</span>
                  </div>
                </div>

                {/* Linha 3: Tipo, Romaneio e Comprador */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                    {entrada.tipoEntrada}
                  </span>
                  {/* Indicador de Romaneio */}
                  {entrada.temRomaneio ? (
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                      <Warehouse className="h-3 w-3" />
                      Romaneio OK
                    </span>
                  ) : (
                    entrada.status !== 'DISPONIVEL_VENDA' && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Sem Romaneio
                      </span>
                    )
                  )}
                  {entrada.comprador && (
                    <span className="text-gray-600 dark:text-gray-400">Comprador: {entrada.comprador}</span>
                  )}
                </div>
              </div>

              {/* Menu de Operações */}
              <div className="ml-4">
                <EntradaOperacoesMenu
                  entrada={{
                    id: entrada.id,
                    numeroNF: entrada.numeroNF,
                    numeroEntrada: entrada.numeroEntrada || entrada.numeroNF,
                    status: entrada.status,
                    temRomaneio: entrada.temRomaneio,
                  }}
                  onView={() => onView(entrada)}
                  onViewItems={() => handleViewItems(entrada)}
                  onRefresh={onRefresh}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {meta.total > meta.perPage && (
        <div className="mt-6">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            perPage={meta.perPage}
            total={meta.total}
            onPageChange={onPageChange}
            onPerPageChange={onPerPageChange}
          />
        </div>
      )}

      {/* Modal de Itens */}
      {selectedEntrada && (
        <EntradaItensModal
          isOpen={showItensModal}
          entradaId={selectedEntrada.id}
          numeroEntrada={selectedEntrada.numeroNF}
          onClose={() => {
            setShowItensModal(false);
            setSelectedEntrada(null);
          }}
        />
      )}
    </div>
  );
};