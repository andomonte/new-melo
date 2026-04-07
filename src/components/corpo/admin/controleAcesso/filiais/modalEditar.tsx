import React, { useEffect, useState } from 'react';
import InfoModal from '@/components/common/infoModal';
import InfoModalError from '@/components/common/infoModal';
import { Filial, updateFilial } from '@/data/filiais/filiais';
import { cadastroFilialSchema } from '@/data/filiais/filiaisSchema';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

import ModalForm from './_forms/modalFormEditar';
import { CircleCheck, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  filialId?: number | null;
  onSuccess?: () => void;
  filial?: Filial | null; // ✅ Adicionada a prop 'filial'
}

export default function CustomModal({
  isOpen,
  onSuccess,
  onClose,
  filial: filialProp, // ✅ Renomeada
}: ModalProps) {
  const [filial, setFilial] = useState<Filial>({} as Filial);
  const [loading, setLoading] = useState<boolean>(false); // Inicializado como false
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [openInfoError, setOpenInfoError] = useState(false);
  const [mensagemInfoError, setMensagemInfoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleClear = () => {
    setFilial({} as Filial);
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    try {
      cadastroFilialSchema.parse(filial);
      await updateFilial(filial);

      setMensagemInfo('Filial atualizada com sucesso!');
      setOpenInfo(true);
    } catch (e) {
      toast({
        description: 'Falha ao atualizar filial.',
        variant: 'destructive',
      });
      setMensagemInfoError(
        'Não foi possível acessar a filial agora. Tente mais tarde ou acione o setor técnico.',
      );
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
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen && filialProp) {
      // ✅ Se a prop 'filial' for fornecida, use-a diretamente
      setFilial(filialProp);
      setLoading(false);
      setErrors({});
    } else if (isOpen) {
      // ✅ Se o modal abrir sem a prop 'filial' (outros cenários?), inicializa o estado
      setLoading(false);
      setFilial({} as Filial);
      setErrors({});
    }
    // Removido filialId da dependência, pois não estamos mais buscando por ele nesse fluxo principal
  }, [isOpen, filialProp]);

  const handleFilialChange = (filial2: Filial) => {
    setFilial(filial2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed  inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <ModalForm
        titulo="Editar Filial"
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        handleFilialChange={handleFilialChange}
        onClose={onClose}
        loading={loading}
        filial={filial}
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
