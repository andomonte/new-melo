import React from 'react';
import { Promocao } from '@/data/promocoes/promocoes';
import CadastrarPromocaoModal from './modalCadastrarPromocao';

interface EditarPromocaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  promocao: Promocao | null;
  onSuccess?: () => void;
  title?: string;
}

const EditarPromocaoModal: React.FC<EditarPromocaoModalProps> = ({
  isOpen,
  onClose,
  promocao,
  onSuccess,
}) => {
  if (!isOpen || !promocao) return null;

  return (
    <CadastrarPromocaoModal
      isOpen={isOpen}
      onClose={onClose}
      promocaoToEdit={promocao}
      onSuccess={onSuccess}
    />
  );
};

export default EditarPromocaoModal;
