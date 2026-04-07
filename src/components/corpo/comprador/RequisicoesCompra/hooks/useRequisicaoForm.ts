import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRequisicaoStore } from '../stores/useRequisicaoStore';
import { validateRequisicaoForm, getFirstValidationError } from '../utils/validation';
import api from '@/components/services/api';
import type { FormDataRequisicao } from '../types';

export const useRequisicaoForm = () => {
  const { toast } = useToast();
  const {
    formData,
    loading,
    updateFormData,
    resetFormData,
    setLoading,
  } = useRequisicaoStore();

  const handleFieldChange = useCallback((field: keyof FormDataRequisicao, value: any) => {
    updateFormData({ [field]: value });
  }, [updateFormData]);

  const resetForm = useCallback(() => {
    resetFormData();
  }, [resetFormData]);

  const submitForm = useCallback(async () => {
    // Validar formulário
    const validationError = getFirstValidationError(formData);
    if (validationError) {
      toast({
        title: 'Erro de Validação',
        description: validationError,
        variant: 'destructive'
      });
      return { success: false };
    }

    setLoading(true);
    try {
      const response = await api.post('/api/compras/requisicoes/criar', {
        tipo: formData.tipo,
        cod_fornecedor: formData.cod_fornecedor,
        cod_comprador: formData.cod_comprador,
        entrega_em: parseInt(formData.entrega_em),
        destinado_para: parseInt(formData.destinado_para),
        condicoes_pagto: formData.condicoes_pagto,
        observacao: formData.observacao,
        previsao_chegada: formData.previsao_chegada || null
      });

      toast({
        title: 'Sucesso!',
        description: `Requisição ${response.data.req_id_composto} criada com sucesso`
      });

      return { 
        success: true, 
        data: response.data 
      };
    } catch (error: any) {
      console.error('Erro ao criar requisição:', error);
      toast({
        title: 'Erro',
        description: error.response?.data?.error || 'Erro ao criar requisição',
        variant: 'destructive'
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [formData, setLoading, toast]);

  const getValidationErrors = useCallback(() => {
    return validateRequisicaoForm(formData);
  }, [formData]);

  return {
    formData,
    loading,
    handleFieldChange,
    resetForm,
    submitForm,
    getValidationErrors,
  };
};