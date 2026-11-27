/**
 * Componente principal de Devolução
 * Lista sempre visível, detalhe abre como modal; "Nova devolução" (manual, como no Delphi)
 * abre o ModalNovaDevolucao e, ao salvar, o detalhe da devolução criada.
 */

import React, { useContext, useState } from 'react';
import { DevolucaoList } from './DevolucaoList';
import { DevolucaoDetalhe } from './DevolucaoDetalhe';
import { ModalNovaDevolucao } from './ModalNovaDevolucao';
import { AuthContext } from '@/contexts/authContexts';

export const DevolucaoMain: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [devolucaoId, setDevolucaoId] = useState<string | undefined>();
  const [modalDetalheAberto, setModalDetalheAberto] = useState(false);
  const [abrirEmissao, setAbrirEmissao] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const usuarioLogado = (): string => {
    if (user?.usuario) return String(user.usuario);
    try {
      const perfil = JSON.parse(localStorage.getItem('perfilUserMelo') || 'null');
      if (perfil?.usuario) return String(perfil.usuario);
    } catch { /* ignora */ }
    return 'Sistema';
  };

  const handleVerDetalhe = (id: string) => {
    setDevolucaoId(id);
    setAbrirEmissao(false);
    setModalDetalheAberto(true);
  };

  const handleFecharDetalhe = () => {
    setModalDetalheAberto(false);
    setAbrirEmissao(false);
    setDevolucaoId(undefined);
    setRefreshKey((k) => k + 1);
  };

  const handleSalva = (devId: string, emitir: boolean) => {
    setNovaAberta(false);
    setRefreshKey((k) => k + 1);
    setDevolucaoId(devId);
    setAbrirEmissao(emitir);
    setModalDetalheAberto(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DevolucaoList
        onVerDetalhe={handleVerDetalhe}
        onNova={() => setNovaAberta(true)}
        refreshKey={refreshKey}
      />
      <DevolucaoDetalhe
        isOpen={modalDetalheAberto}
        devolucaoId={devolucaoId}
        abrirEmissao={abrirEmissao}
        onClose={handleFecharDetalhe}
      />
      {novaAberta && (
        <ModalNovaDevolucao
          usuario={usuarioLogado()}
          onClose={() => setNovaAberta(false)}
          onSalva={handleSalva}
        />
      )}
    </div>
  );
};
