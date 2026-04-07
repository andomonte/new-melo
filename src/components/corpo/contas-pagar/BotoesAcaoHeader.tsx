import React from 'react';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { Plus, Filter, CalculatorIcon } from 'lucide-react';

interface BotoesAcaoHeaderProps {
  onNovoClick: () => void;
  onFiltrosClick: () => void;
  totalSelecionados?: number;
  onPagamentoLoteClick?: () => void;
}

const BotoesAcaoHeader: React.FC<BotoesAcaoHeaderProps> = ({
  onNovoClick,
  onFiltrosClick,
  totalSelecionados = 0,
  onPagamentoLoteClick,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {totalSelecionados > 0 && onPagamentoLoteClick && (
        <DefaultButton
          variant="primary"
          onClick={onPagamentoLoteClick}
          text={`Pagar ${totalSelecionados} ${totalSelecionados === 1 ? 'Título' : 'Títulos'}`}
        />
      )}
      <AuxButton
        variant="secondary"
        onClick={onFiltrosClick}
        icon={<Filter className="w-4 h-4" />}
        text="Filtros"
      />
      <DefaultButton
        variant="primary"
        onClick={onNovoClick}
        icon={<Plus className="w-4 h-4" />}
        text="Novo"
      />
    </div>
  );
};

export default BotoesAcaoHeader;
