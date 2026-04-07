// src/components/gruposDeProdutos/modalCadastrarGrupoProduto.tsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  GrupoProduto,
  insertGrupoProduto,
} from '@/data/gruposDeProdutos/gruposDeProdutos';
import {
  createGrupoProdutoSchema,
  CreateGrupoProdutoFormInput,
} from '@/data/gruposDeProdutos/gruposProdutoSchema';
import ModalFormCadastrarGrupoProduto from './_forms/modalFormCadatrarGrupoProduto';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
}

export default function CadastrarGrupoProdutoModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Cadastrar Novo Grupo de Produto',
}: ModalProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateGrupoProdutoFormInput>({
    resolver: zodResolver(createGrupoProdutoSchema),
    mode: 'onBlur',
    defaultValues: {
      codgpp: '',
      descr: '',
    },
  });

  // Limpa o formulário quando o modal é fechado
  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CreateGrupoProdutoFormInput) => {
    try {
      // Converte os dados do formulário para o formato esperado pela API
      const grupoProdutoNovo: GrupoProduto = {
        codgpp: data.codgpp || '',
        descr: data.descr || '',
        codvend: data.codvend || undefined,
        descbalcao: data.descbalcao ?? undefined,
        dscrev30: data.dscrev30 ?? undefined,
        dscrev45: data.dscrev45 ?? undefined,
        dscrev60: data.dscrev60 ?? undefined,
        dscrv30: data.dscrv30 ?? undefined,
        dscrv45: data.dscrv45 ?? undefined,
        dscrv60: data.dscrv60 ?? undefined,
        dscbv30: data.dscbv30 ?? undefined,
        dscbv45: data.dscbv45 ?? undefined,
        dscbv60: data.dscbv60 ?? undefined,
        dscpv30: data.dscpv30 ?? undefined,
        dscpv45: data.dscpv45 ?? undefined,
        dscpv60: data.dscpv60 ?? undefined,
        comgpp: data.comgpp ?? undefined,
        comgpptmk: data.comgpptmk ?? undefined,
        comgppextmk: data.comgppextmk ?? undefined,
        codseg: data.codseg || undefined,
        diasreposicao: data.diasreposicao ?? undefined,
        codcomprador: data.codcomprador || undefined,
        ramonegocio: data.ramonegocio || undefined,
        gpp_id: data.gpp_id ?? undefined,
        p_comercial: data.p_comercial ?? undefined,
        v_marketing: data.v_marketing ?? undefined,
        codgpc: data.codgpc || undefined,
        margem_min_venda: data.margem_min_venda ?? undefined,
        margem_med_venda: data.margem_med_venda ?? undefined,
        margem_ide_venda: data.margem_ide_venda ?? undefined,
        bloquear_preco: data.bloquear_preco || undefined,
        codgrupai: data.codgrupai ?? undefined,
        codgrupoprod: data.codgrupoprod ?? undefined,
        DSCBALCAO: data.DSCBALCAO ?? undefined,
      };

      // Remove codgpp do objeto pois insertGrupoProduto espera Omit<GrupoProduto, 'codgpp'>
      // Mas precisamos passar codgpp, então vamos criar um objeto sem omitir
      await insertGrupoProduto(grupoProdutoNovo as any);

      toast({
        title: '✅ Sucesso!',
        description: `Grupo de produto "${data.descr}" cadastrado com sucesso!`,
        variant: 'default',
      });

      reset(); // Limpa o formulário após sucesso

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao cadastrar grupo de produto:', error);

      // Extrai mensagem de erro detalhada
      let errorMessage = 'Falha ao cadastrar grupo de produto.';
      let errorTitle = '❌ Erro';

      if (error.message) {
        errorMessage = error.message;

        // Personaliza título baseado no tipo de erro
        if (error.statusCode === 409) {
          errorTitle = '⚠️ Duplicata Detectada';
        } else if (error.statusCode === 400) {
          errorTitle = '⚠️ Dados Inválidos';
        }

        // Se houver campo específico do erro, adiciona ao log
        if (error.field) {
          console.error(`Campo com erro: ${error.field}`);
        }

        // Se houver registro existente, adiciona informação
        if (error.existingRecord) {
          console.log('Registro existente:', error.existingRecord);
          errorMessage += `\n\nRegistro existente: ${error.existingRecord.codgpp} - ${error.existingRecord.descr}`;
        }
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <ModalFormCadastrarGrupoProduto
        titulo={title}
        handleSubmit={handleSubmit(onSubmit)}
        handleClear={() => reset()}
        onClose={onClose}
        loading={isSubmitting}
        register={register}
        errors={errors}
        isDirty={isDirty}
      />
      <Toaster />
    </div>
  );
}
