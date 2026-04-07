/**
 * Card de uma entrada para alocacao
 */

import React, { useState } from 'react';
import { EntradaParaAlocar, Armazem } from '@/data/alocacao/alocacaoService';
import { DefaultButton } from '@/components/common/Buttons';
import {
  Package,
  Truck,
  DollarSign,
  Clock,
  FileText,
  Play,
  Warehouse,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';

interface CardEntradaAlocacaoProps {
  entrada: EntradaParaAlocar;
  isAtiva: boolean;
  onIniciar?: (armId: number) => void;
  onAlocar?: () => void;
  formatCurrency: (value: number) => string;
  disabled?: boolean;
  armazens: Armazem[];
}

const CardEntradaAlocacao: React.FC<CardEntradaAlocacaoProps> = ({
  entrada,
  isAtiva,
  onIniciar,
  onAlocar,
  formatCurrency,
  disabled,
  armazens,
}) => {
  const [selectedArmazem, setSelectedArmazem] = useState<number | null>(null);
  const [showArmazemSelect, setShowArmazemSelect] = useState(false);

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
        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
          Em Alocacao
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200 border-green-300 flex items-center gap-1">
        Recebido
        {entrada.tem_divergencia && (
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
        )}
      </span>
    );
  };

  const handleIniciarClick = () => {
    if (armazens.length === 0) {
      alert('Nenhum armazem disponivel');
      return;
    }

    // Se tem romaneio com apenas 1 armazém, usa ele automaticamente
    if (entrada.tem_romaneio && entrada.romaneio_resumo?.length === 1) {
      const armIdRomaneio = entrada.romaneio_resumo[0].arm_id;
      onIniciar?.(armIdRomaneio);
      return;
    }

    // Se tem romaneio com múltiplos armazéns, pré-seleciona o primeiro do romaneio
    if (entrada.tem_romaneio && entrada.romaneio_resumo && entrada.romaneio_resumo.length > 1) {
      setSelectedArmazem(entrada.romaneio_resumo[0].arm_id);
      setShowArmazemSelect(true);
      return;
    }

    // Sem romaneio: comportamento original
    if (armazens.length === 1) {
      onIniciar?.(armazens[0].arm_id);
    } else {
      setShowArmazemSelect(true);
    }
  };

  const handleConfirmArmazem = () => {
    if (selectedArmazem) {
      onIniciar?.(selectedArmazem);
      setShowArmazemSelect(false);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-800 rounded-lg shadow-sm border ${
        isAtiva
          ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-100 dark:ring-amber-900/50'
          : 'border-gray-200 dark:border-zinc-700'
      } p-4`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Entrada de Estoque
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {entrada.numero_entrada}
            </h3>
            {getStatusBadge()}
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

      {/* Romaneio Planejado */}
      {entrada.tem_romaneio && entrada.romaneio_resumo && entrada.romaneio_resumo.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Romaneio Planejado
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {entrada.romaneio_resumo.map((r) => (
              <span
                key={r.arm_id}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full"
              >
                {r.arm_descricao}: {r.qtd_total} un.
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de divergencia */}
      {entrada.tem_divergencia && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              Esta entrada possui divergencias no recebimento
            </span>
          </div>
        </div>
      )}

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
              {isAtiva ? 'Iniciado' : 'Recebido'}
            </span>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">
            {formatDate(isAtiva && entrada.inicio_alocacao ? entrada.inicio_alocacao : entrada.data_recebimento)}
          </p>
        </div>
      </div>

      {/* Selecao de armazem */}
      {showArmazemSelect && !isAtiva && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-3">
          <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
            <Warehouse className="w-4 h-4 inline mr-1" />
            {entrada.tem_romaneio && entrada.romaneio_resumo && entrada.romaneio_resumo.length > 1
              ? 'Romaneio com múltiplos armazéns - Confirme para iniciar'
              : 'Selecione o Armazem de Destino'
            }
          </label>
          {entrada.tem_romaneio && entrada.romaneio_resumo && entrada.romaneio_resumo.length > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
              Os itens serão alocados conforme o romaneio planejado em cada armazém.
            </p>
          )}
          <div className="flex gap-2">
            <select
              value={selectedArmazem || ''}
              onChange={e => setSelectedArmazem(parseInt(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Selecione...</option>
              {/* Se tem romaneio, mostrar armazéns do romaneio primeiro */}
              {entrada.tem_romaneio && entrada.romaneio_resumo?.map(r => (
                <option key={`rom-${r.arm_id}`} value={r.arm_id}>
                  {r.arm_descricao} (Romaneio: {r.qtd_total} un.)
                </option>
              ))}
              {/* Separador se tem romaneio */}
              {entrada.tem_romaneio && entrada.romaneio_resumo && entrada.romaneio_resumo.length > 0 && (
                <option disabled>──────────</option>
              )}
              {/* Outros armazéns */}
              {armazens
                .filter(arm => !entrada.romaneio_resumo?.some(r => r.arm_id === arm.arm_id))
                .map(arm => (
                  <option key={arm.arm_id} value={arm.arm_id}>
                    {arm.arm_descricao}
                  </option>
                ))}
            </select>
            <DefaultButton
              text="Confirmar"
              size="sm"
              variant="primary"
              onClick={handleConfirmArmazem}
              disabled={!selectedArmazem}
              className="bg-amber-600 hover:bg-amber-700"
            />
            <DefaultButton
              text="Cancelar"
              size="sm"
              variant="secondary"
              onClick={() => setShowArmazemSelect(false)}
            />
          </div>
        </div>
      )}

      {/* Acoes */}
      <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
        {isAtiva ? (
          <DefaultButton
            text="Alocar Itens"
            size="sm"
            variant="primary"
            onClick={onAlocar}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
            icon={<Warehouse className="w-4 h-4" />}
          />
        ) : (
          <DefaultButton
            text="Iniciar Alocacao"
            size="sm"
            variant="primary"
            onClick={handleIniciarClick}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
            icon={<Play className="w-4 h-4" />}
            disabled={disabled || showArmazemSelect}
            title={disabled ? 'Finalize a alocacao atual primeiro' : 'Iniciar alocacao desta entrada'}
          />
        )}
      </div>
    </div>
  );
};

export default CardEntradaAlocacao;
