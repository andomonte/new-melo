import React from 'react';
import FormInput from '@/components/common/FormInput'; // Certifique-se que o caminho está correto
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { LegislacaoSignatario } from '@/data/legislacao_signatario/legislacaoSignatario';

export const LegislacaoSignatarioForm: React.FC<
  FormComponentProps<LegislacaoSignatario>
> = ({ formData, onFormChange, errors }) => {
  // Função genérica para notificar a mudança de qualquer campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Tratar campos específicos
    if (name === 'LES_MVA_ST_ORIGINAL') {
      // Limitar entrada para números e pontos decimais
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        const numericValue = value === '' ? '' : value;
        onFormChange(name as keyof LegislacaoSignatario, numericValue);
      }
    } else if (name === 'LES_UF') {
      // Permitir apenas letras e converter para maiúsculo
      if (value === '' || /^[A-Za-z]*$/.test(value)) {
        onFormChange(name as keyof LegislacaoSignatario, value.toUpperCase());
      }
    } else {
      onFormChange(name as keyof LegislacaoSignatario, value);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormInput
        name="LES_LEI_ID"
        label="ID da Legislação"
        type="number"
        value={formData.LES_LEI_ID || ''}
        onChange={handleInputChange}
        error={errors.LES_LEI_ID}
        required
        min="1"
        placeholder="Digite o ID da legislação"
      />
      <FormInput
        name="LES_UF"
        label="UF"
        value={formData.LES_UF || ''}
        onChange={handleInputChange}
        error={errors.LES_UF}
        required
        maxLength={2}
        minLength={2}
        type="text"
        placeholder="Ex: SP, RJ, MG"
        pattern="[A-Z]{2}"
        title="UF deve ter exatamente 2 letras maiúsculas"
        style={{ textTransform: 'uppercase' }}
      />
      <FormInput
        name="LES_MVA_ST_ORIGINAL"
        label="MVA ST Original (%)"
        value={formData.LES_MVA_ST_ORIGINAL || ''}
        onChange={handleInputChange}
        error={errors.LES_MVA_ST_ORIGINAL}
        required
        type="number"
        step="0.01"
        min="0"
        max="100"
        placeholder="0.00 - 100.00"
        title="MVA deve estar entre 0% e 100%"
      />
    </div>
  );
};
