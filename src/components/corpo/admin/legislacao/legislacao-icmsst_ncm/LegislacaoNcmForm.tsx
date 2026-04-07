import FormInput from '@/components/common/FormInput'; // Certifique-se que o caminho está correto
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { LegislacaoNcm } from '@/data/legislacao_icmsst_ncm/legislacao_icmsst_ncm';
import React from 'react';

export const LegislacaoNcmForm: React.FC<FormComponentProps<LegislacaoNcm>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  // Função genérica para notificar a mudança de qualquer campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Tratar campos específicos
    if (name === 'LIN_MVA_ST_ORIGINAL') {
      // Limitar entrada para números e pontos decimais
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        const numericValue = value === '' ? '' : value;
        onFormChange(name as keyof LegislacaoNcm, numericValue);
      }
    } else if (name === 'LIN_NCM' || name === 'LIN_CEST') {
      // Permitir apenas números
      if (value === '' || /^\d*$/.test(value)) {
        onFormChange(name as keyof LegislacaoNcm, value);
      }
    } else {
      onFormChange(name as keyof LegislacaoNcm, value);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormInput
        name="LIN_LEI_ID"
        label="ID da Legislação"
        type="number"
        value={formData.LIN_LEI_ID || ''}
        onChange={handleInputChange}
        error={errors.LIN_LEI_ID}
        required
        min="1"
        placeholder="Digite o ID da legislação"
      />
      <FormInput
        name="LIN_NCM"
        label="NCM"
        value={formData.LIN_NCM || ''}
        onChange={handleInputChange}
        error={errors.LIN_NCM}
        required
        maxLength={9}
        minLength={8}
        type="text"
        placeholder="Digite o NCM (8-9 dígitos)"
        pattern="[0-9]*"
        title="NCM deve conter apenas números"
      />
      <FormInput
        name="LIN_STATUS"
        label="Status"
        value={formData.LIN_STATUS || ''}
        onChange={handleInputChange}
        error={errors.LIN_STATUS}
        required
        maxLength={10}
        type="text"
        placeholder="Ex: ATIVO, INATIVO"
      />
      <FormInput
        name="LIN_MVA_ST_ORIGINAL"
        label="MVA ST Original (%)"
        value={formData.LIN_MVA_ST_ORIGINAL || ''}
        onChange={handleInputChange}
        error={errors.LIN_MVA_ST_ORIGINAL}
        required
        type="number"
        step="0.001"
        min="0"
        max="100"
        placeholder="0.000 - 100.000"
        title="MVA deve estar entre 0% e 100%"
      />
      <FormInput
        name="LIN_CEST"
        label="CEST (Opcional)"
        value={formData.LIN_CEST || ''}
        onChange={handleInputChange}
        error={errors.LIN_CEST}
        maxLength={8}
        minLength={7}
        type="text"
        placeholder="Digite o CEST (7-8 dígitos)"
        pattern="[0-9]*"
        title="CEST deve conter apenas números"
      />
    </div>
  );
};
