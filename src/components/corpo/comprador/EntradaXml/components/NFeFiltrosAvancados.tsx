import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Filter,
  X,
  Search,
  Calendar,
  DollarSign,
  Hash,
  Building2,
  FileText,
  Tag,
  CheckCircle2
} from 'lucide-react';

interface NFeFiltrosAvancadosProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: NFeFilters) => void;
  initialFilters?: NFeFilters;
}

export interface NFeFilters {
  search?: string;
  status?: string[];
  fornecedor?: string;
  numeroNfe?: string;
  serieNfe?: string;
  chaveNfe?: string;
  dataInicio?: string;
  dataFim?: string;
  valorMinimo?: string;
  valorMaximo?: string;
  temAssociacao?: string;
}

const statusOptions = [
  { value: 'PROCESSADA', label: 'Processada', color: 'text-green-600' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'text-yellow-600' },
  { value: 'ASSOCIACAO_CONCLUIDA', label: 'Associação Concluída', color: 'text-purple-600' },
  { value: 'RECEBIDA', label: 'Recebida', color: 'text-blue-600' },
  { value: 'ERRO', label: 'Erro', color: 'text-red-600' }
];

const associacaoOptions = [
  { value: '', label: 'Todas' },
  { value: 'true', label: 'Com Associação' },
  { value: 'false', label: 'Sem Associação' }
];

export const NFeFiltrosAvancados: React.FC<NFeFiltrosAvancadosProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<NFeFilters>(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters, isOpen]);

  const handleInputChange = (field: keyof NFeFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStatusChange = (statusValue: string, checked: boolean) => {
    setFilters(prev => {
      const currentStatus = prev.status || [];
      if (checked) {
        return {
          ...prev,
          status: [...currentStatus, statusValue]
        };
      } else {
        return {
          ...prev,
          status: currentStatus.filter(s => s !== statusValue)
        };
      }
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: NFeFilters = {};
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
    onClose();
  };

  const hasFilters = () => {
    return Object.values(filters).some(value =>
      Array.isArray(value) ? value.length > 0 : Boolean(value)
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Filtros Avançados - NFe
            </h3>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Busca Geral */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Search size={16} />
                Busca Geral
              </label>
              <Input
                placeholder="Número NFe, chave, fornecedor..."
                value={filters.search || ''}
                onChange={(e) => handleInputChange('search', e.target.value)}
              />
            </div>

            {/* Fornecedor */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Building2 size={16} />
                Fornecedor
              </label>
              <Input
                placeholder="Nome ou CNPJ do fornecedor"
                value={filters.fornecedor || ''}
                onChange={(e) => handleInputChange('fornecedor', e.target.value)}
              />
            </div>

            {/* Número NFe */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Hash size={16} />
                Número NFe
              </label>
              <Input
                type="number"
                placeholder="Ex: 999001"
                value={filters.numeroNfe || ''}
                onChange={(e) => handleInputChange('numeroNfe', e.target.value)}
              />
            </div>

            {/* Série NFe */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Tag size={16} />
                Série NFe
              </label>
              <Input
                type="number"
                placeholder="Ex: 1, 2, 3..."
                value={filters.serieNfe || ''}
                onChange={(e) => handleInputChange('serieNfe', e.target.value)}
              />
            </div>

            {/* Chave NFe */}
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <FileText size={16} />
                Chave NFe
              </label>
              <Input
                placeholder="Chave de acesso completa ou parcial"
                value={filters.chaveNfe || ''}
                onChange={(e) => handleInputChange('chaveNfe', e.target.value)}
              />
            </div>

            {/* Data Início */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar size={16} />
                Data Início
              </label>
              <Input
                type="date"
                value={filters.dataInicio || ''}
                onChange={(e) => handleInputChange('dataInicio', e.target.value)}
              />
            </div>

            {/* Data Fim */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar size={16} />
                Data Fim
              </label>
              <Input
                type="date"
                value={filters.dataFim || ''}
                onChange={(e) => handleInputChange('dataFim', e.target.value)}
              />
            </div>

            {/* Tem Associação */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <CheckCircle2 size={16} />
                Associação
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                value={filters.temAssociacao || ''}
                onChange={(e) => handleInputChange('temAssociacao', e.target.value)}
              >
                {associacaoOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor Mínimo */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <DollarSign size={16} />
                Valor Mínimo
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.valorMinimo || ''}
                onChange={(e) => handleInputChange('valorMinimo', e.target.value)}
              />
            </div>

            {/* Valor Máximo */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <DollarSign size={16} />
                Valor Máximo
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="999999.99"
                value={filters.valorMaximo || ''}
                onChange={(e) => handleInputChange('valorMaximo', e.target.value)}
              />
            </div>
          </div>

          {/* Status Section */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Status da NFe
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statusOptions.map(status => (
                <label
                  key={status.value}
                  className="flex items-center space-x-2 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={(filters.status || []).includes(status.value)}
                    onChange={(e) => handleStatusChange(status.value, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${status.color}`}>
                    {status.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Resumo dos Filtros */}
          {hasFilters() && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Filtros Ativos:
              </h4>
              <div className="flex flex-wrap gap-2">
                {filters.search && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Busca: {filters.search}
                  </span>
                )}
                {(filters.status || []).length > 0 && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Status: {(filters.status || []).length} selecionados
                  </span>
                )}
                {filters.fornecedor && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Fornecedor: {filters.fornecedor}
                  </span>
                )}
                {filters.temAssociacao && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Associação: {associacaoOptions.find(o => o.value === filters.temAssociacao)?.label}
                  </span>
                )}
                {filters.numeroNfe && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Número NFe: {filters.numeroNfe}
                  </span>
                )}
                {filters.serieNfe && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Série: {filters.serieNfe}
                  </span>
                )}
                {filters.chaveNfe && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Chave: {filters.chaveNfe.length > 20 ? filters.chaveNfe.substring(0, 20) + '...' : filters.chaveNfe}
                  </span>
                )}
                {filters.dataInicio && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Data Início: {filters.dataInicio}
                  </span>
                )}
                {filters.dataFim && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Data Fim: {filters.dataFim}
                  </span>
                )}
                {filters.valorMinimo && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Valor Mín: R$ {parseFloat(filters.valorMinimo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {filters.valorMaximo && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded">
                    Valor Máx: R$ {parseFloat(filters.valorMaximo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-zinc-700">
          <Button variant="outline" onClick={handleReset}>
            <X size={16} className="mr-2" />
            Limpar Filtros
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Filter size={16} className="mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};