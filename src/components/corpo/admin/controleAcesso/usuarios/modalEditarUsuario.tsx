import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import FormUserContainer from './_forms/modalFormEditar';
import { CircleCheckBig } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { UsuarioEdit } from '@/data/usuarios/usuarios';
import { Vendedor } from '@/data/vendedores/vendedores';

interface ModalEditarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  usuario: UsuarioEdit;
  vendedores: Vendedor[]; // ✅ novo
  isLoadingVendedores: boolean; // ✅ novo
  errorVendedores: string | null; // ✅ novo
}

export default function ModalEditarUsuario({
  isOpen,
  onClose,
  onSuccess,
  usuario,
  vendedores,
  isLoadingVendedores,
  errorVendedores,
}: ModalEditarProps) {
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSaveInitiated = () => {
    setIsSaving(true);
  };

  const handleSuccessSave = () => {
    setIsSaving(false);

    setMensagemInfo('Usuário atualizado com sucesso!');
    setOpenInfo(true);
  };

  const handleErrorSave = () => {
    setIsSaving(false);
    toast({
      title: 'Erro ao atualizar usuário',
      description: 'Ocorreu um erro ao salvar as alterações.',
      variant: 'destructive',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[90vw] h-[90vh] p-4">
        <FormUserContainer
          titulo="Editar Usuário"
          onClose={onClose}
          onSuccess={handleSuccessSave}
          onError={handleErrorSave}
          usuario={usuario}
          onSaveInitiated={handleSaveInitiated}
          isSaving={isSaving}
          vendedores={vendedores} // ✅ novo
          isLoadingVendedores={isLoadingVendedores} // ✅ novo
          errorVendedores={errorVendedores}
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
        icon={<CircleCheckBig className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />

      <Toaster />
    </div>
  );
}
