/**
 * Tab "Contratos de Câmbio" da Declaração de Importação
 * Contratos vêm do XML ou do Contas a Pagar Internacional
 */

import React, { useState } from 'react';
import { Trash2, DollarSign, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContratoCambio } from '../types/importacao';
import { useContratosTotais } from '../hooks/useContratoModal';
import { fmtUSD, fmtBRL, fmtTaxa, fmtDate } from '../utils/formatters';
import { BuscarContaPagarModal, type TituloSelecionado } from './BuscarContaPagarModal';

interface ContratosTabProps {
  contratos: ContratoCambio[];
  onAdd: (contrato: ContratoCambio) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
  taxaDolarMedio?: number;
}

export const ContratosTab: React.FC<ContratosTabProps> = ({
  contratos,
  onAdd,
  onRemove,
  readOnly = false,
  taxaDolarMedio,
}) => {
  const totais = useContratosTotais(contratos, taxaDolarMedio);
  const [modalAberto, setModalAberto] = useState(false);

  // IDs de títulos já vinculados (para filtrar no modal)
  const titulosVinculados = contratos
    .filter((c) => c.id_titulo_pagar)
    .map((c) => String(c.id_titulo_pagar));

  const handleTitulosSelecionados = (titulos: TituloSelecionado[]) => {
    for (const t of titulos) {
      onAdd({
        id_importacao: 0,
        contrato: t.contrato,
        data: t.data,
        taxa_dolar: t.taxa_dolar,
        vl_merc_dolar: t.vl_merc_dolar,
        vl_reais: t.vl_reais,
        moeda: t.moeda,
        id_titulo_pagar: parseInt(t.id_titulo_pagar) || undefined,
      });
    }
    setModalAberto(false);
  };

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-4">
        <IndicadorCard
          titulo="Total Contratos (USD)"
          valor={fmtUSD(totais.totalUSD)}
        />
        <IndicadorCard
          titulo="Total Contratos (BRL)"
          valor={fmtBRL(totais.totalBRL)}
        />
        <IndicadorCard
          titulo="Dólar Médio Ponderado"
          valor={totais.dolarMedio > 0 ? fmtTaxa(totais.dolarMedio) : '-'}
        />
      </div>

      {/* Header + ações */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Contratos de Câmbio ({contratos.length})
        </h3>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1"
          >
            <Search size={14} />
            Buscar no Contas a Pagar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="border border-gray-300 dark:border-zinc-600 rounded-lg overflow-hidden">
        {/* Header da tabela */}
        <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
          <div className="flex gap-2 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <div className="w-40">Nº Contrato</div>
            <div className="w-24">Data</div>
            <div className="w-20 text-center">Moeda</div>
            <div className="w-32 text-right">Valor (Moeda)</div>
            <div className="w-28 text-right">Taxa Câmbio</div>
            <div className="flex-1 text-right">Valor (BRL)</div>
            {!readOnly && <div className="w-16 text-center">Ações</div>}
          </div>
        </div>

        {/* Corpo */}
        <div className="min-h-[120px]">
          {contratos.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <DollarSign className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhum contrato de câmbio adicionado
                </p>
                {!readOnly && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Use "Buscar no Contas a Pagar" para vincular titulos
                  </p>
                )}
              </div>
            </div>
          ) : (
            contratos.map((c, idx) => (
              <div
                key={idx}
                className="flex gap-2 px-4 py-3 text-sm border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors items-center"
              >
                <div className="w-40 font-medium text-gray-900 dark:text-gray-100">
                  {c.contrato}
                  {c.id_titulo_pagar && (
                    <span className="ml-1 text-[10px] text-gray-400">#{c.id_titulo_pagar}</span>
                  )}
                </div>
                <div className="w-24 text-gray-600 dark:text-gray-300">
                  {fmtDate(c.data)}
                </div>
                <div className="w-20 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300">
                    {c.moeda || 'USD'}
                  </span>
                </div>
                <div className="w-32 text-right text-gray-900 dark:text-gray-100">
                  {c.vl_merc_dolar?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="w-28 text-right text-gray-600 dark:text-gray-300">
                  {fmtTaxa(c.taxa_dolar)}
                </div>
                <div className="flex-1 text-right font-medium text-gray-900 dark:text-gray-100">
                  {fmtBRL(c.vl_reais || (c.vl_merc_dolar || 0) * (c.taxa_dolar || 0))}
                </div>
                {!readOnly && (
                  <div className="w-16 flex items-center justify-center">
                    <button
                      onClick={() => onRemove(idx)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de busca */}
      <BuscarContaPagarModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onConfirmar={handleTitulosSelecionados}
        contratosExistentes={titulosVinculados}
      />
    </div>
  );
};

/** Card indicador simples */
const IndicadorCard: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
    <div className="text-xs text-gray-500 dark:text-gray-400">{titulo}</div>
    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{valor}</div>
  </div>
);
