import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getMarca, updateMarca } from '@/data/marcas/marcas';
import FormInput from '@/components/common/FormInput';
import { useToast } from '@/hooks/use-toast';
import ModalForm from '@/components/common/modalform';

interface EditarModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  marcaId: string;
  onSuccess?: () => void;
}

const marcaSchema = z.object({
  codmarca: z.string().min(1, 'Código é obrigatório'),
  descr: z.string().min(1, 'Descrição é obrigatória'),
  bloquear_preco: z.string().optional(),
});

type MarcaForm = z.infer<typeof marcaSchema>;

export default function Editar({
  isOpen,
  onClose,
  title,
  marcaId,
  onSuccess,
}: EditarModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MarcaForm>({
    resolver: zodResolver(marcaSchema),
  });

  useEffect(() => {
    const fetchMarca = async () => {
      if (!marcaId || !isOpen) return;
      setLoading(true);

      try {
        const marca = await getMarca(marcaId);

        reset({
          codmarca: marca.codmarca,
          descr: marca.descr,
          bloquear_preco: marca.bloquear_preco ?? '',
        });
      } catch (err) {
        console.log('err', err);
        toast({
          description: 'Erro ao carregar dados da marca.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMarca();
  }, [isOpen, marcaId, reset, toast]);

  const onSubmit = async (data: MarcaForm) => {
    try {
      await updateMarca(data);

      toast({
        title: 'Sucesso!',
        description: 'Marca atualizada com sucesso!',
        variant: 'default',
      });

      // Fecha o modal imediatamente após o sucesso
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 500);
    } catch (err) {
      console.log('err', err);
      toast({
        description: 'Erro ao atualizar marca.',
        variant: 'destructive',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <ModalForm
        titulo={title}
        handleSubmit={handleSubmit(onSubmit)}
        onClose={onClose}
        loading={isSubmitting || loading}
        tabs={['Informações']}
        activeTab={'0'}
        setActiveTab={() => {}}
        handleClear={() => reset()}
        renderTabContent={() => (
          <div className="space-y-4">
            <FormInput
              label="Código da Marca"
              type="text"
              id="codmarca"
              {...register('codmarca')}
              error={errors.codmarca?.message}
              readOnly
            />

            <FormInput
              label="Descrição"
              type="text"
              id="descr"
              {...register('descr')}
              error={errors.descr?.message}
            />

            <FormInput
              label="Bloquear Preço (S/N)"
              type="text"
              id="bloquear_preco"
              {...register('bloquear_preco')}
              error={errors.bloquear_preco?.message}
            />
          </div>
        )}
      />
    </div>
  );
}
