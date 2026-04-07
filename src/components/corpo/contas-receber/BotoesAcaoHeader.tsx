import React from 'react';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { Plus, Filter, Download, Upload, CalculatorIcon } from 'lucide-react';

interface BotoesAcaoHeaderProps {
  onNovoClick: () => void;
  onFiltrosClick?: () => void;
  onExportarClick?: () => void;
  onImportarClick?: () => void;
  onCalcularTotaisClick?: () => void;
  titulosSelecionados?: number;
  onReceberLoteClick?: () => void;
}

export default function BotoesAcaoHeader({
  onNovoClick,
  onFiltrosClick,
  onExportarClick,
  onImportarClick,
  onCalcularTotaisClick,
  titulosSelecionados = 0,
  onReceberLoteClick,
}: BotoesAcaoHeaderProps) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {/* Botão Receber em Lote (só aparece quando há títulos selecionados) */}
      {titulosSelecionados > 0 && onReceberLoteClick && (
        <DefaultButton
          variant="secondary"
          size="default"
          onClick={onReceberLoteClick}
          icon={<CalculatorIcon className="w-4 h-4" />}
          text={`Receber (${titulosSelecionados})`}
          className="relative animate-pulse bg-blue-600 hover:bg-blue-700"
        />
      )}

      {/* Botão Novo */}
      <DefaultButton
        variant="primary"
        size="default"
        onClick={onNovoClick}
        icon={<Plus className="w-4 h-4" />}
        text="Novo"
      />

      {/* Botão Filtros */}
      {onFiltrosClick && (
        <AuxButton
          variant="secondary"
          size="default"
          onClick={onFiltrosClick}
          icon={<Filter className="w-4 h-4" />}
          text="Filtros"
        />
      )}

      {/* Botão Exportar */}
      {onExportarClick && (
        <AuxButton
          variant="secondary"
          size="default"
          onClick={onExportarClick}
          icon={<Download className="w-4 h-4" />}
          text="Exportar"
        />
      )}

      {/* Botão Importar */}
      {onImportarClick && (
        <AuxButton
          variant="secondary"
          size="default"
          onClick={onImportarClick}
          icon={<Upload className="w-4 h-4" />}
          text="Importar"
        />
      )}

      {/* Botão Calcular Totais */}
      {onCalcularTotaisClick && (
        <AuxButton
          variant="secondary"
          size="default"
          onClick={onCalcularTotaisClick}
          icon={<CalculatorIcon className="w-4 h-4" />}
          text="Totais"
        />
      )}
    </div>
  );
}