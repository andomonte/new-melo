import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import ModalFormCadastrar from './_forms/modalFormCadastrar';
import { Filial, insertFilial } from '@/data/filiais/filiais';
import { z } from 'zod';
import { CircleCheck } from 'lucide-react';
import { cadastroFilialSchema } from '@/data/filiais/filiaisSchema';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function CustomModal({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [filial, setFilial] = useState<Filial>({} as Filial);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleFilialChange = (filial: Filial) => {
    setFilial(filial);
  };

  const handleClear = () => {
    setFilial({} as Filial);
  };
  const handleFechar = () => {
    setFilial({} as Filial);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      cadastroFilialSchema.parse(filial);
      await insertFilial(filial); // aguarda salvar no back
      setMensagemInfo('Filial cadastrada com sucesso!');
      setFilial({
        codigo_filial: 0, // ou null se quiser
        nome_filial: '',
      });

      setOpenInfo(true);
    } catch (e) {
      toast({
        description: 'Falha ao cadastrar filial.',
        variant: 'destructive',
      });
      if (e instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        e.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSaving(false); // Define isSaving como false quando o salvamento termina
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-xl p-4">
        <ModalFormCadastrar
          titulo="Editar Filial"
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          handleFilialChange={handleFilialChange}
          onClose={handleFechar}
          filial={filial}
          error={errors}
          isSaving={isSaving}
        />
      </div>

      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          onSuccess?.(); // ✅ chama a função de sucesso do pai (index)
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
