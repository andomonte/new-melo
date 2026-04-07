import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import { CircleCheck } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import FormPerfilContainer from './_forms/modalFormCadastrar';

interface ModalCadastrarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalCadastrarPerfil({
  isOpen,
  onClose,
  onSuccess,
}: ModalCadastrarProps) {
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');

  const handleSuccess = () => {
    setMensagemInfo('Perfil cadastrado com sucesso!');
    setOpenInfo(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-5xl p-4">
        <FormPerfilContainer
          titulo="Cadastrar Perfil"
          onSuccess={handleSuccess}
          onClose={onClose}
        />
      </div>

      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          onSuccess?.();
          onClose();
        }}
        title="INFORMAÇÃO IMPORTANTE"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <Toaster />
    </div>
  );
}
