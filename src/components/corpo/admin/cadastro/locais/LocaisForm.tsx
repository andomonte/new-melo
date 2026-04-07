import FormInput from '@/components/common/FormInput';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { Local } from '@/data/locais/locais';
import React from 'react';

export const LocaisForm: React.FC<FormComponentProps<Local>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  // Função genérica para notificar a mudança de qualquer campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof Local, e.target.value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormInput
        name="id_local"
        label="ID do Local"
        value={formData.id_local || ''}
        onChange={handleInputChange}
        error={errors.id_local}
        required
        maxLength={15}
        // Dica: Desabilita o campo na edição para proteger a chave primária
        disabled={!!formData.id_local}
        type={''}
      />
      <FormInput
        name="id_armazem"
        label="ID do Armazém"
        type="number"
        value={String(formData.id_armazem || '')}
        onChange={handleInputChange}
        error={errors.id_armazem}
        required
      />
      <FormInput
        name="descricao"
        label="Descrição"
        value={formData.descricao || ''}
        onChange={handleInputChange}
        error={errors.descricao}
        maxLength={50}
        type={''}
      />
      <FormInput
        name="tipo_local"
        label="Tipo do Local"
        value={formData.tipo_local || ''}
        onChange={handleInputChange}
        error={errors.tipo_local}
        maxLength={20}
        type={''}
      />
      <FormInput
        name="capacidade"
        label="Capacidade"
        type="number"
        value={String(formData.capacidade || '')}
        onChange={handleInputChange}
        error={errors.capacidade}
      />
      <FormInput
        name="unidade"
        label="Unidade"
        value={formData.unidade || ''}
        onChange={handleInputChange}
        error={errors.unidade}
        maxLength={5}
        type={''}
      />
    </div>
  );
};
