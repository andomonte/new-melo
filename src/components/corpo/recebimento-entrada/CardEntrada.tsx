/**
 * Card de uma entrada para recebimento
 */

import React from 'react';
import { EntradaParaReceber } from '@/data/recebimento-entrada/recebimentoEntradaService';
import { DefaultButton } from '@/components/common/Buttons';
import {
  Package,
  Truck,
  DollarSign,
  Clock,
  FileText,
  Play,
  ClipboardCheck,
} from 'lucide-react';

interface CardEntradaProps {
  entrada: EntradaParaReceber;
  isAtiva: boolean;
  onIniciar?: () => void;
  onConferir?: () => void;
  formatCurrency: (value: number) => string;
  disabled?: boolean;
}

const CardEntrada: React.FC<CardEntradaProps> = ({
  entrada,
  isAtiva,
  onIniciar,
  onConferir,
  formatCurrency,
  disabled,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = () => {
    if (isAtiva) {
      return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
          Em Recebimento
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-300">
        Aguardando
      </span>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-800 rounded-lg shadow-sm border ${
        isAtiva
          ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-900/50'
          : 'border-gray-200 dark:border-zinc-700'
      } p-4`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Entrada de Estoque
          </span>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {entrada.numero_entrada}
            </h3>
            {getStatusBadge()}
            {/* Indicador de preco confirmado */}
            {entrada.preco_confirmado && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Preco confirmado
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fornecedor */}
      <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Fornecedor
          </span>
        </div>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {entrada.fornecedor}
        </p>
      </div>

      {/* Grid de informacoes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              NFe
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {entrada.nfe_numero} / {entrada.nfe_serie}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Valor
            </span>
          </div>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
            {formatCurrency(entrada.valor_total)}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              Itens
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {entrada.qtd_itens} {entrada.qtd_itens === 1 ? 'item' : 'itens'}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              {isAtiva ? 'Iniciado' : 'Entrada'}
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {formatDate(isAtiva && entrada.inicio_recebimento ? entrada.inicio_recebimento : entrada.data_entrada)}
          </p>
        </div>
      </div>

      {/* Acoes */}
      <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
        {isAtiva ? (
          <DefaultButton
            text="Conferir Itens"
            size="sm"
            variant="primary"
            onClick={onConferir}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            icon={<ClipboardCheck className="w-4 h-4" />}
          />
        ) : (
          <DefaultButton
            text="Iniciar Recebimento"
            size="sm"
            variant="primary"
            onClick={onIniciar}
            className="w-full sm:w-auto"
            icon={<Play className="w-4 h-4" />}
            disabled={disabled}
            title={disabled ? 'Finalize o recebimento atual primeiro' : 'Iniciar recebimento desta entrada'}
          />
        )}
      </div>
    </div>
  );
};

export default CardEntrada;
