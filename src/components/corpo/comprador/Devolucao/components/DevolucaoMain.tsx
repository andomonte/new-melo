/**
 * Componente principal de Devolução
 * Lista sempre visível, detalhe abre como modal
 */

import React, { useState } from 'react';
import { DevolucaoList } from './DevolucaoList';
import { DevolucaoDetalhe } from './DevolucaoDetalhe';

export const DevolucaoMain: React.FC = () => {
  const [devolucaoId, setDevolucaoId] = useState<number | undefined>();
  const [modalDetalheAberto, setModalDetalheAberto] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleVerDetalhe = (id: number) => {
    setDevolucaoId(id);
    setModalDetalheAberto(true);
  };

  const handleFecharDetalhe = () => {
    setModalDetalheAberto(false);
    setDevolucaoId(undefined);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DevolucaoList
        onVerDetalhe={handleVerDetalhe}
        refreshKey={refreshKey}
      />
      <DevolucaoDetalhe
        isOpen={modalDetalheAberto}
        devolucaoId={devolucaoId}
        onClose={handleFecharDetalhe}
      />
    </div>
  );
};
