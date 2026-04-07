import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import InfoModalError from '@/components/common/infoModal';
import { insertFuncao } from '@/data/funcoes/funcoes';
import { cadastroFuncaoSchema } from '@/data/funcoes/funcoesSchema';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import ModalFormCadastrarFuncao from './_forms/modalFormCadastrar';
import { CircleCheck, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalCadastrarFuncao({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [openInfoError, setOpenInfoError] = useState(false);
  const [mensagemInfoError, setMensagemInfoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (dadosDoFilho: {
    descricao: string;
    sigla: string;
    usadoEm: string;
  }) => {
    setIsSaving(true);

    try {
      cadastroFuncaoSchema.parse(dadosDoFilho);
      await insertFuncao(dadosDoFilho);
      setMensagemInfo('Funcao cadastrada com sucesso!');
      setOpenInfo(true);
    } catch (e) {
      toast({
        description: 'Falha ao cadastrar funcao.',
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
          'Erro inesperado ao cadastrar funcao. Tente novamente mais tarde.',
        );
        setOpenInfoError(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <ModalFormCadastrarFuncao
        titulo="Cadastrar Funcao"
        handleSubmitPai={handleSubmit}
        onClose={handleClose}
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
