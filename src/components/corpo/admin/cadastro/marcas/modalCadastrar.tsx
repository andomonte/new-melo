import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createMarca } from '@/data/marcas/marcas';
import { useToast } from '@/hooks/use-toast';
import FormInput from '@/components/common/FormInput';
import ModalFormulario from '@/components/common/modalform';

// No Delphi o cadastro de marca tem apenas a Descrição. O código é gerado
// automaticamente e o bloqueio de preço entra como 'S' por padrão.
const marcaSchema = z.object({
  descr: z.string().min(1, 'Descrição é obrigatória'),
});

type MarcaForm = z.infer<typeof marcaSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSuccess?: () => void;
}

export default function Cadastrar({
  isOpen,
  onClose,
  title,
  onSuccess,
}: Props) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MarcaForm>({
    resolver: zodResolver(marcaSchema),
  });

  const onSubmit = async (data: MarcaForm) => {
    try {
      // Bloqueio de preço entra como 'S' por padrão (comportamento do Delphi)
      await createMarca({ descr: data.descr, bloquear_preco: 'S' } as any);

      toast({
        title: 'Sucesso!',
        description: 'Marca cadastrada com sucesso!',
        variant: 'default',
      });

      reset();

      // Fecha o modal imediatamente após o sucesso
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 500);
    } catch (error) {
      console.log('err', error);

      toast({
        description: 'Erro ao cadastrar marca.',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    reset();
  };

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 bg-black/50 flex justify-center items-center px-4">
      <ModalFormulario
        tabs={[{ name: 'Formulário', key: 'form' }]}
        activeTab="form"
        setActiveTab={() => {}}
        titulo={title}
        renderTabContent={() => (
          <div className="space-y-4">
            <FormInput
              label="Descrição"
              type="text"
              autoFocus
              {...register('descr')}
              error={errors.descr?.message}
            />
          </div>
        )}
        handleSubmit={handleSubmit(onSubmit)}
        handleClear={handleClear}
        onClose={onClose}
        loading={isSubmitting}
      />
    </div>
  );
}
