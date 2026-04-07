import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createMarca } from '@/data/marcas/marcas';
import { useToast } from '@/hooks/use-toast';
import FormInput from '@/components/common/FormInput';
import ModalFormulario from '@/components/common/modalform';

const marcaSchema = z.object({
  codmarca: z.string().min(1, 'Código é obrigatório'),
  descr: z.string().min(1, 'Descrição é obrigatória'),
  bloquear_preco: z.string().optional(),
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
      await createMarca(data);

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
              label="Código da Marca"
              type="text"
              {...register('codmarca')}
              error={errors.codmarca?.message}
            />

            <FormInput
              label="Descrição"
              type="text"
              {...register('descr')}
              error={errors.descr?.message}
            />

            <FormInput
              label="Bloquear Preço (S/N)"
              type="text"
              {...register('bloquear_preco')}
              error={errors.bloquear_preco?.message}
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
