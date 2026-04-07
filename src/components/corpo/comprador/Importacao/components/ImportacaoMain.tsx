/**
 * Componente principal de Importação
 * Lista sempre visível, detalhe e criação abrem como modais
 */

import React from 'react';
import { ImportacaoList } from './ImportacaoList';
import { ImportacaoDetalhe } from './ImportacaoDetalhe';
import { NovaImportacaoModal } from './NovaImportacaoModal';

export const ImportacaoMain: React.FC = () => {
  const [importacaoId, setImportacaoId] = React.useState<number | undefined>();
  const [modalNovaAberto, setModalNovaAberto] = React.useState(false);
  const [modalDetalheAberto, setModalDetalheAberto] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleNovaImportacao = () => {
    setModalNovaAberto(true);
  };

  const handleModalSuccess = (id: number) => {
    setModalNovaAberto(false);
    setRefreshKey((k) => k + 1);
    // Abre o detalhe da importação recém-criada
    setImportacaoId(id);
    setModalDetalheAberto(true);
  };

  const handleVerDetalhe = (id: number) => {
    setImportacaoId(id);
    setModalDetalheAberto(true);
  };

  const handleFecharDetalhe = () => {
    setModalDetalheAberto(false);
    setImportacaoId(undefined);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ImportacaoList
        onNovaImportacao={handleNovaImportacao}
        onVerDetalhe={handleVerDetalhe}
        refreshKey={refreshKey}
      />
      <NovaImportacaoModal
        isOpen={modalNovaAberto}
        onClose={() => setModalNovaAberto(false)}
        onSuccess={handleModalSuccess}
      />
      <ImportacaoDetalhe
        isOpen={modalDetalheAberto}
        importacaoId={importacaoId}
        onClose={handleFecharDetalhe}
      />
    </div>
  );
};
