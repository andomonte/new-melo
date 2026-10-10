/**
 * Tela "Gerar Entrada (Importação)" — opção de menu separada.
 * Lista DIs (com nota emitida) e abre uma para: Calcular Custos → Gerar Entrada
 * no estoque → Confirmar Preço (reusa o ConfirmarPrecoModal das Entradas).
 */

import React from 'react';
import { GerarEntradaList } from './GerarEntradaList';
import { GerarEntradaDetalhe } from './GerarEntradaDetalhe';

export const GerarEntradaImportacaoMain: React.FC = () => {
  const [importacaoId, setImportacaoId] = React.useState<number | undefined>();
  const [detalheAberto, setDetalheAberto] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleAbrir = (id: number) => {
    setImportacaoId(id);
    setDetalheAberto(true);
  };

  const handleFechar = () => {
    setDetalheAberto(false);
    setImportacaoId(undefined);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <GerarEntradaList onAbrir={handleAbrir} refreshKey={refreshKey} />
      <GerarEntradaDetalhe
        isOpen={detalheAberto}
        importacaoId={importacaoId}
        onClose={handleFechar}
      />
    </div>
  );
};

export default GerarEntradaImportacaoMain;
