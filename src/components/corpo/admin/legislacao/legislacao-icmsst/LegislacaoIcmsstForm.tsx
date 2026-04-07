import React from 'react';
import FormInput from '@/components/common/FormInput'; // Certifique-se que o caminho está correto
import { LegislacaoIcmsst } from '@/data/legislacao/legislacao'; // Importa a interface que criamos
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';

// Função auxiliar para formatar datas para o input type="date"
const formatDateForInput = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  return dateString.split('T')[0]; // Pega apenas a parte 'AAAA-MM-DD'
};

export const LegislacaoIcmsstForm: React.FC<
  FormComponentProps<LegislacaoIcmsst>
> = ({ formData, onFormChange, errors }) => {
  // Handler genérico para facilitar a passagem para os inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof LegislacaoIcmsst, e.target.value);
  };

  return (
    // Usamos um grid para organizar os campos do formulário
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormInput
        name="LEI_ID"
        type="number"
        label="ID da Lei"
        value={String(formData.LEI_ID || '')}
        onChange={handleInputChange}
        error={errors.LEI_ID}
        required
        disabled={!!formData.LEI_ID} // Desabilita o campo ID na edição
      />
      <FormInput
        name="LEI_PROTOCOLO"
        type="number"
        label="Protocolo"
        value={String(formData.LEI_PROTOCOLO || '')}
        onChange={handleInputChange}
        error={errors.LEI_PROTOCOLO}
        required
      />
      <FormInput
        name="LEI_STATUS"
        label="Status"
        value={formData.LEI_STATUS || ''}
        onChange={handleInputChange}
        error={errors.LEI_STATUS}
        required
        type={''}
      />
      <FormInput
        name="LEI_DATA_VIGENCIA"
        type="date"
        label="Data de Vigência"
        value={formatDateForInput(formData.LEI_DATA_VIGENCIA)}
        onChange={handleInputChange}
        error={errors.LEI_DATA_VIGENCIA}
        required
      />
      <FormInput
        name="LEI_DATA_PUBLICACAO"
        type="date"
        label="Data de Publicação"
        value={formatDateForInput(formData.LEI_DATA_PUBLICACAO)}
        onChange={handleInputChange}
        error={errors.LEI_DATA_PUBLICACAO}
        required
      />
      <FormInput
        name="LEI_MVA_AJUSTADA"
        label="MVA Ajustada"
        value={formData.LEI_MVA_AJUSTADA || ''}
        onChange={handleInputChange}
        error={errors.LEI_MVA_AJUSTADA}
        required
        type={''}
      />
      <FormInput
        name="LEI_TIPO"
        label="Tipo"
        value={formData.LEI_TIPO || ''}
        onChange={handleInputChange}
        error={errors.LEI_TIPO}
        type={''}
      />
    </div>
  );
};
