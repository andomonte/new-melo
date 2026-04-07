/**
 * Resumo de Custos da Declaração de Importação
 * Padrão visual do sistema (raw tailwind)
 */

import React from 'react';
import { Calculator } from 'lucide-react';
import type { ResumoCustos } from '../types/importacao';
import { fmtUSD, fmtBRL, fmtTaxa } from '../utils/formatters';

interface CustosResumoProps {
  resumo: ResumoCustos | null;
}

export const CustosResumo: React.FC<CustosResumoProps> = ({ resumo }) => {
  if (!resumo) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Calculator className="h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Custos ainda não calculados
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Preencha os dados gerais, contratos e itens para calcular os custos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Indicadores principais */}
      <div className="grid grid-cols-4 gap-4">
        <IndicadorCard
          titulo="Total Mercadoria (FOB)"
          valor={fmtUSD(resumo.total_mercadoria_usd)}
        />
        <IndicadorCard
          titulo="Total CIF"
          valor={fmtUSD(resumo.total_cif_usd)}
          subtitulo={fmtBRL(resumo.total_cif_brl)}
        />
        <IndicadorCard
          titulo="Dólar Médio"
          valor={fmtTaxa(resumo.taxa_dolar_medio)}
          subtitulo={`DI: ${fmtTaxa(resumo.taxa_dolar_di)}`}
        />
        <IndicadorCard
          titulo="Custo Total"
          valor={fmtBRL(resumo.total_geral_brl)}
          subtitulo={`${resumo.qtd_itens} itens`}
          destaque
        />
      </div>

      {/* Composição do custo */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
        <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 rounded-t-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Composição do Custo
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <LinhaResumo label="Mercadoria (FOB)" valor={fmtUSD(resumo.total_mercadoria_usd)} />
          <LinhaResumo label="CIF (FOB + Frete + Seguro)" valor={fmtBRL(resumo.total_cif_brl)} />

          <div className="border-t border-gray-200 dark:border-zinc-700" />

          <LinhaResumo
            label="Impostos (PIS + COFINS + II + IPI + ICMS-ST)"
            valor={fmtBRL(resumo.total_impostos_brl)}
          />
          <LinhaResumo
            label="Despesas (Desp. + Frete + EADI + Taxas)"
            valor={fmtBRL(resumo.total_despesas_brl)}
          />

          <div className="border-t border-gray-200 dark:border-zinc-700" />

          <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100">
            <span>Total Geral</span>
            <span>{fmtBRL(resumo.total_geral_brl)}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {resumo.qtd_contratos} contratos de câmbio vinculados
      </div>
    </div>
  );
};

const IndicadorCard: React.FC<{
  titulo: string;
  valor: string;
  subtitulo?: string;
  destaque?: boolean;
}> = ({ titulo, valor, subtitulo, destaque }) => (
  <div className={`border rounded-lg p-4 ${
    destaque
      ? 'border-[#347AB6] bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800'
      : 'border-gray-200 dark:border-zinc-700'
  }`}>
    <div className="text-xs text-gray-500 dark:text-gray-400">{titulo}</div>
    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{valor}</div>
    {subtitulo && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitulo}</div>
    )}
  </div>
);

const LinhaResumo: React.FC<{ label: string; valor: string }> = ({ label, valor }) => (
  <div className="flex justify-between text-sm">
    <span className="text-gray-600 dark:text-gray-400">{label}</span>
    <span className="text-gray-900 dark:text-gray-100">{valor}</span>
  </div>
);
