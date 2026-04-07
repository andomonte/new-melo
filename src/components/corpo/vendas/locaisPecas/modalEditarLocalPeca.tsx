import React, { useMemo } from 'react';
import { LocalPeca } from '@/data/locaisPecas/locaisPecas';
import CadastrarLocalPecaModal from './modalCadastrarLocalPeca';

interface EditarLocalPecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  local: LocalPeca | null;
  onSuccess?: () => void;
}

const EditarLocalPecaModal: React.FC<EditarLocalPecaModalProps> = ({
  isOpen,
  onClose,
  local,
  onSuccess,
}) => {
  // Memoizar conversão de dados para evitar re-renders desnecessários
  const localParaEdicao = useMemo(() => {
    if (!local) return null;

    return {
      id_local: local.id_local,
      id_armazem: local.id_armazem,
      descricao: local.descricao || '',
      tipo_local: local.tipo_local || '',
      capacidade: local.capacidade,
      unidade: local.unidade || '',
    };
  }, [local]);

  if (!isOpen || !localParaEdicao) return null;

  return (
    <CadastrarLocalPecaModal
      isOpen={isOpen}
      onClose={onClose}
      localPecaToEdit={localParaEdicao}
      onSuccess={onSuccess}
    />
  );
};

export default EditarLocalPecaModal;
