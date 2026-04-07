// src/pages/cadastro/armazens/modalEditarArmazem.tsx

import React, { useEffect, useState } from 'react';
import InfoModal from '@/components/common/infoModal';
// InfoModalError é o mesmo componente InfoModal, mas com outro nome para clareza
import InfoModalError from '@/components/common/infoModal';
// Importações de dados e schema para Armazém
import { Armazem, updateArmazem } from '@/data/armazem/armazens';
import { edicaoArmazemSchema } from '@/data/armazem/armazensSchema';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
// Caminho para o componente de formulário de edição dentro de _forms
import ModalFormEditarArmazem from './_forms/modalFormEditarArmazem';
import { CircleCheck, AlertTriangle } from 'lucide-react';
import Carregamento from '@/utils/carregamento';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  armazem: Armazem | null;
  onSuccess?: () => void;
}

export default function EditarArmazemModal({
  isOpen,
  armazem: armazemProp,
  onSuccess,
  onClose,
}: ModalProps) {
  const [armazem, setArmazem] = useState<Partial<Armazem>>(armazemProp || {});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [openInfoError, setOpenInfoError] = useState(false);
  const [mensagemInfoError, setMensagemInfoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleClear = () => {
    // Reseta para o estado inicial do armazém recebido pela prop
    // Adicionando explicitamente 'inscricaoestadual: null' ao reset, se não estiver presente.
    setArmazem(
      armazemProp
        ? {
            ...armazemProp,
            inscricaoestadual: armazemProp.inscricaoestadual || null,
          }
        : { inscricaoestadual: null },
    ); // <-- APENAS ESTA LINHA FOI ATUALIZADA
    setErrors({});
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrors({}); // Limpa erros anteriores

    try {
      edicaoArmazemSchema.parse(armazem);

      if (armazem.id_armazem) {
        // Mantendo o cast original, conforme seu pedido de não alterar o que já estava lá.
        await updateArmazem(armazem as Armazem);
        setMensagemInfo('Armazém atualizado com sucesso!');
        setOpenInfo(true);
      } else {
        toast({
          description: 'ID do armazém inválido para edição.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        e.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          description: 'Verifique os campos do formulário.',
          variant: 'destructive',
        });
      } else {
        console.error('Erro ao atualizar o armazém:', e);
        setMensagemInfoError(
          'Ocorreu um erro ao tentar atualizar o armazém. Por favor, tente novamente ou entre em contato com o suporte técnico.',
        );
        setOpenInfoError(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Efeito para atualizar o estado 'armazem' quando 'armazemProp' muda
  useEffect(() => {
    if (armazemProp) {
      // Certifica-se de que inscricaoestadual esteja presente, mesmo que seja null,
      // para evitar undefined se a prop não o contiver.
      setArmazem({
        ...armazemProp,
        inscricaoestadual: armazemProp.inscricaoestadual || null,
      }); // <-- APENAS ESTA LINHA FOI ATUALIZADA
      setErrors({});
    } else {
      setArmazem({ inscricaoestadual: null }); // Reseta se armazemProp for nulo, garantindo a nova propriedade
    }
  }, [armazemProp]);

  if (!isOpen) return null;

  const handleArmazemChange = (updatedArmazem: Armazem) => {
    setArmazem(updatedArmazem);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {armazemProp && armazem.id_armazem ? (
        <ModalFormEditarArmazem
          titulo="Editar Armazém"
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          handleArmazemChange={handleArmazemChange}
          onClose={onClose}
          loading={false}
          armazem={armazem as Armazem}
          error={errors}
          isSaving={isSaving}
        />
      ) : (
        <Carregamento />
      )}
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
