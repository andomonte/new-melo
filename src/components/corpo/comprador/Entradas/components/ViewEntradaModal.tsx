import React from 'react';
import { X, Package, FileText, Calendar, DollarSign, Building2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntradaDTO {
  id: string;
  numeroNF: string;
  numeroEntrada?: string;
  serie: string;
  fornecedor?: string;
  fornecedorNome: string;
  dataEmissao: string;
  dataEntrada: string;
  valorTotal: number;
  valorProdutos?: number;
  status: string;
  chaveNFe?: string;
  tipoEntrada: string;
  observacoes?: string;
  totalItens?: number;
  temRomaneio?: boolean;
}

interface ViewEntradaModalProps {
  isOpen: boolean;
  entrada: EntradaDTO;
  onClose: () => void;
}

export const ViewEntradaModal: React.FC<ViewEntradaModalProps> = ({
  isOpen,
  entrada,
  onClose,
}) => {
  if (!isOpen) return null;

  const statusConfig: Record<string, { label: string; color: string }> = {
    PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    CRIADA: { label: 'Criada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
    PROCESSANDO: { label: 'Processando', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    PRECO_CONFIRMADO: { label: 'Preco Confirmado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    AGUARDANDO_RECEBIMENTO: { label: 'Aguardando Recebimento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    EM_RECEBIMENTO: { label: 'Em Recebimento', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    RECEBIDO: { label: 'Recebido', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
    EM_ALOCACAO: { label: 'Em Alocacao', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    ALOCADO: { label: 'Alocado', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
    DISPONIVEL_VENDA: { label: 'Disponivel p/ Venda', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    P: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    F: { label: 'Finalizada', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    C: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
  };

  // Fallback para status desconhecidos
  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return dateString ? new Date(dateString).toLocaleDateString('pt-BR') : '-';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-[#347AB6]" size={24} />
            Detalhes da Entrada - NF {entrada.numeroNF}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusConfig(entrada.status).color}`}>
              {getStatusConfig(entrada.status).label}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo:</span>
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              entrada.tipoEntrada === 'XML' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {entrada.tipoEntrada}
            </span>
          </div>

          {/* Dados da Nota Fiscal */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText size={20} />
              Dados da Nota Fiscal
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Número da NF
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {entrada.numeroNF}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Série
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {entrada.serie}
                </p>
              </div>

              {entrada.chaveNFe && (
                <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded md:col-span-3">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Chave da NFe
                  </label>
                  <p className="text-base font-mono text-gray-900 dark:text-white break-all">
                    {entrada.chaveNFe}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fornecedor */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 size={20} />
              Fornecedor
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Código
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {entrada.fornecedor}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Nome/Razão Social
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {entrada.fornecedorNome}
                </p>
              </div>
            </div>
          </div>

          {/* Datas */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Datas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Data de Emissão
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(entrada.dataEmissao)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Data de Entrada
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(entrada.dataEntrada)}
                </p>
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Valores
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entrada.valorProdutos !== undefined && entrada.valorProdutos !== null && (
                <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Valor dos Produtos
                  </label>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(entrada.valorProdutos)}
                  </p>
                </div>
              )}

              <div className={`bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800 ${!entrada.valorProdutos ? 'md:col-span-2' : ''}`}>
                <label className="text-sm font-medium text-green-600 dark:text-green-400">
                  Valor Total da NF
                </label>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(entrada.valorTotal || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Itens e Romaneio */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package size={20} />
              Itens e Romaneio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total de Itens
                </label>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {entrada.totalItens ?? '-'} {entrada.totalItens === 1 ? 'item' : 'itens'}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Romaneio
                </label>
                <p className={`text-base font-semibold ${entrada.temRomaneio ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {entrada.temRomaneio ? 'Configurado' : 'Nao configurado'}
                </p>
              </div>
            </div>
          </div>

          {/* Observações */}
          {entrada.observacoes && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Info size={20} />
                Observações
              </h3>

              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {entrada.observacoes}
                </p>
              </div>
            </div>
          )}

          {/* Informações Adicionais */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              Informações do Sistema
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p className="text-blue-700 dark:text-blue-200">
                <span className="font-medium">ID da Entrada:</span> {entrada.id}
              </p>
              <p className="text-blue-700 dark:text-blue-200">
                <span className="font-medium">Tipo de Entrada:</span> {entrada.tipoEntrada}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onClose}
            className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};