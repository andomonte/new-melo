// src/components/gruposDeProdutos/editarGrupoProdutoModal.tsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Carregamento from '@/utils/carregamento';
import {
  GrupoProduto,
  updateGrupoProduto,
} from '@/data/gruposDeProdutos/gruposDeProdutos';
import {
  updateGrupoProdutoSchema,
  UpdateGrupoProdutoFormInput,
} from '@/data/gruposDeProdutos/gruposProdutoSchema';
import ModalFormEditarGrupoProduto from './_forms/modalFormEditarGrupoProduto';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  grupoProduto: GrupoProduto | null;
  onSuccess?: () => void;
}

export default function EditarGrupoProdutoModal({
  isOpen,
  grupoProduto: grupoProdutoProp,
  onSuccess,
  onClose,
  title = 'Editar Grupo de Produto',
}: ModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateGrupoProdutoFormInput>({
    resolver: zodResolver(updateGrupoProdutoSchema),
    mode: 'onBlur', // Valida ao sair do campo
  });

  // Carrega os dados do grupo de produto no formulário
  useEffect(() => {
    if (grupoProdutoProp && isOpen) {
      // Preprocessa valores numéricos para garantir compatibilidade
      const formData: UpdateGrupoProdutoFormInput = {
        codgpp: grupoProdutoProp.codgpp || '',
        descr: grupoProdutoProp.descr || '',
        codvend: grupoProdutoProp.codvend || undefined,
        descbalcao: grupoProdutoProp.descbalcao ?? undefined,
        dscrev30: grupoProdutoProp.dscrev30 ?? undefined,
        dscrev45: grupoProdutoProp.dscrev45 ?? undefined,
        dscrev60: grupoProdutoProp.dscrev60 ?? undefined,
        dscrv30: grupoProdutoProp.dscrv30 ?? undefined,
        dscrv45: grupoProdutoProp.dscrv45 ?? undefined,
        dscrv60: grupoProdutoProp.dscrv60 ?? undefined,
        dscbv30: grupoProdutoProp.dscbv30 ?? undefined,
        dscbv45: grupoProdutoProp.dscbv45 ?? undefined,
        dscbv60: grupoProdutoProp.dscbv60 ?? undefined,
        dscpv30: grupoProdutoProp.dscpv30 ?? undefined,
        dscpv45: grupoProdutoProp.dscpv45 ?? undefined,
        dscpv60: grupoProdutoProp.dscpv60 ?? undefined,
        comgpp: grupoProdutoProp.comgpp ?? undefined,
        comgpptmk: grupoProdutoProp.comgpptmk ?? undefined,
        comgppextmk: grupoProdutoProp.comgppextmk ?? undefined,
        codseg: grupoProdutoProp.codseg || undefined,
        diasreposicao: grupoProdutoProp.diasreposicao ?? undefined,
        codcomprador: grupoProdutoProp.codcomprador || undefined,
        ramonegocio: grupoProdutoProp.ramonegocio || undefined,
        gpp_id: grupoProdutoProp.gpp_id ?? undefined,
        p_comercial: grupoProdutoProp.p_comercial ?? undefined,
        v_marketing: grupoProdutoProp.v_marketing ?? undefined,
        codgpc: grupoProdutoProp.codgpc || undefined,
        margem_min_venda: grupoProdutoProp.margem_min_venda ?? undefined,
        margem_med_venda: grupoProdutoProp.margem_med_venda ?? undefined,
        margem_ide_venda: grupoProdutoProp.margem_ide_venda ?? undefined,
        bloquear_preco: grupoProdutoProp.bloquear_preco || undefined,
        codgrupai: grupoProdutoProp.codgrupai ?? undefined,
        codgrupoprod: grupoProdutoProp.codgrupoprod ?? undefined,
        DSCBALCAO: grupoProdutoProp.DSCBALCAO ?? undefined,
      };

      reset(formData);
    }
  }, [isOpen, grupoProdutoProp, reset]);

  const onSubmit = async (data: UpdateGrupoProdutoFormInput) => {
    setLoading(true);

    try {
      // Converte os dados do formulário para o formato esperado pela API
      const grupoProdutoAtualizado: GrupoProduto = {
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

      await updateGrupoProduto(grupoProdutoAtualizado);

      toast({
        title: '✅ Sucesso!',
        description: `Grupo de produto "${data.descr}" atualizado com sucesso!`,
        variant: 'default',
      });

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao atualizar grupo de produto:', error);

      // Extrai mensagem de erro detalhada
      let errorMessage = 'Falha ao atualizar grupo de produto.';
      let errorTitle = '❌ Erro';

      if (error.message) {
        errorMessage = error.message;

        // Personaliza título baseado no tipo de erro
        if (error.statusCode === 409) {
          errorTitle = '⚠️ Duplicata Detectada';
        } else if (error.statusCode === 400) {
          errorTitle = '⚠️ Dados Inválidos';
        } else if (error.statusCode === 404) {
          errorTitle = '⚠️ Não Encontrado';
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
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {grupoProdutoProp ? (
        <ModalFormEditarGrupoProduto
          titulo={title}
          handleSubmit={handleSubmit(onSubmit)}
          handleClear={() => reset()}
          onClose={onClose}
          loading={isSubmitting || loading}
          register={register}
          errors={errors}
          isDirty={isDirty}
        />
      ) : (
        <Carregamento />
      )}
      <Toaster />
    </div>
  );
}
