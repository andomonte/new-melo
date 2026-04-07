import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import InfoModalError from '@/components/common/infoModal';
import { Tela, insertTela } from '@/data/telas/telas';
import { cadastroTelaSchema } from '@/data/telas/telasSchema';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import ModalFormCadastrarTela from './_forms/modalFormCadastrar';
import { CircleCheck, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalCadastrarTela({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [tela, setTela] = useState<Tela>({} as Tela);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [openInfoError, setOpenInfoError] = useState(false);
  const [mensagemInfoError, setMensagemInfoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleClear = () => {
    setTela({} as Tela);
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    try {
      cadastroTelaSchema.parse(tela);
      await insertTela(tela);
      setMensagemInfo('Tela cadastrada com sucesso!');
      setOpenInfo(true);
    } catch (e) {
      toast({
        description: 'Falha ao cadastrar tela.',
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
      } else {
        setMensagemInfoError(
          'Erro inesperado ao cadastrar tela. Tente novamente mais tarde.',
        );
        setOpenInfoError(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTelaChange = (telaAtualizada: Tela) => {
    setTela(telaAtualizada);
  };
  const handleClose = () => {
    handleClear();
    onClose();
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <ModalFormCadastrarTela
        titulo="Cadastrar Tela"
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        handleTelaChange={handleTelaChange}
        onClose={handleClose}
        tela={tela}
        error={errors}
        isSaving={isSaving}
      />

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

      <InfoModalError
        isOpen={openInfoError}
        onClose={() => {
          setOpenInfoError(false);
          onClose();
        }}
        title="ALGO DEU ERRADO"
        icon={<AlertTriangle className="text-red-500 w-6 h-6" />}
        content={mensagemInfoError}
      />

      <Toaster />
    </div>
  );
}
