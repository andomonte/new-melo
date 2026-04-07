import React, { useEffect, useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import FormPerfilContainer from './_forms/modalFormEditar';
import { PerfilCompleto } from '@/data/perfis/perfis'; // Importe a interface do seu perfil completo
import { CircleCheckBig } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

interface ModalEditarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  perfilData?: PerfilCompleto | null; // Prop para receber os dados do pai (agora com o nome correto)
}

export default function ModalEditarPerfil({
  isOpen,
  onClose,
  onSuccess,
  perfilData, // Usando o nome da prop que o pai está enviando
}: ModalEditarProps) {
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [perfilLocalData, setPerfilLocalData] = useState<PerfilCompleto | null>(
    null,
  );
  const [hasChanges, setHasChanges] = useState(false); // Estado para rastrear mudanças
  const [isSaving, setIsSaving] = useState(false); // Estado para rastrear o salvamento
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setPerfilLocalData(null);
      setHasChanges(false);
      setIsSaving(false);
      return;
    }

    // Se os dados do perfil foram passados pelo pai, use-os diretamente
    if (perfilData) {
      setPerfilLocalData(perfilData);
    }
    // Você pode remover a lógica de buscar os dados, pois o pai já está fornecendo
    // Caso ainda precise buscar em outros cenários, descomente e ajuste.
    // else if (login_perfil_name) {
    //   const fetchData = async () => {
    //     try {
    //       const perfil = await getPerfil(login_perfil_name);
    //       setPerfilLocalData(perfil);
    //     } catch (error) {
    //       console.error(error);
    //       toast({
    //         title: 'Erro ao carregar perfil',
    //         description: 'Verifique sua conexão com o banco de dados.',
    //         variant: 'destructive',
    //       });
    //     }
    //   };
    //   fetchData();
    // }
  }, [isOpen, perfilData, toast]);

  const handleDataChange = (changed: boolean) => {
    setHasChanges(changed);
  };

  const handleSaveInitiated = () => {
    setIsSaving(true);
  };

  const handleSuccessSave = () => {
    setIsSaving(false);
    setMensagemInfo('Perfil atualizado com sucesso!');
    setOpenInfo(true);
    setHasChanges(false);
  };

  const handleErrorSave = () => {
    setIsSaving(false);
    toast({
      title: 'Erro ao atualizar perfil',
      description: 'Ocorreu um erro ao salvar as alterações.',
      variant: 'destructive',
    });
  };

  if (!isOpen || !perfilLocalData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[90vw] h-[90vh] p-4">
        <FormPerfilContainer
          titulo="Editar Perfil"
          onClose={onClose}
          onSuccess={handleSuccessSave}
          onError={handleErrorSave}
          login_perfil_name={perfilLocalData.login_perfil_name} // Passando os dados do perfil para o formulário
          onDataChange={handleDataChange}
          onSaveInitiated={handleSaveInitiated}
          isSaving={isSaving}
          hasChanges={hasChanges}
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
