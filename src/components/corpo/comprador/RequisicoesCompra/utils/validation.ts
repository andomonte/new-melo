import type { FormDataRequisicao } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export const validateRequisicaoForm = (formData: FormDataRequisicao): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Campos obrigatórios
  if (!formData.tipo) {
    errors.push({ field: 'tipo', message: 'Tipo é obrigatório' });
  }

  if (!formData.cod_fornecedor) {
    errors.push({ field: 'cod_fornecedor', message: 'Fornecedor é obrigatório' });
  }

  if (!formData.cod_comprador) {
    errors.push({ field: 'cod_comprador', message: 'Comprador é obrigatório' });
  }

  if (!formData.entrega_em) {
    errors.push({ field: 'entrega_em', message: 'Local de entrega é obrigatório' });
  }

  if (!formData.destinado_para) {
    errors.push({ field: 'destinado_para', message: 'Destino é obrigatório' });
  }

  // Validação de data
  if (formData.previsao_chegada) {
    const dataPrevisao = new Date(formData.previsao_chegada);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (dataPrevisao < hoje) {
      errors.push({ 
        field: 'previsao_chegada', 
        message: 'Data de previsão não pode ser anterior a hoje' 
      });
    }
  }

  return errors;
};

export const getFirstValidationError = (formData: FormDataRequisicao): string | null => {
  const errors = validateRequisicaoForm(formData);
  return errors.length > 0 ? errors[0].message : null;
};