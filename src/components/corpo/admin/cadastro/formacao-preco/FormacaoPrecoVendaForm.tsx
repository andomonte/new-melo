import React from 'react';
// Supondo que você tenha um componente de input reutilizável
import FormInput from '@/components/common/FormInput';
import ProdutoSearchInput from '@/components/common/ProdutoSearchInput';
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { FormacaoPrecoVenda } from '@/data/formacaoPreco/formacaoPreco';

export const FormacaoPrecoVendaForm: React.FC<
  FormComponentProps<FormacaoPrecoVenda>
> = ({ formData, onFormChange, errors }) => {
  // Verificar se estamos no modo de edição
  const isEditMode = Boolean(formData.CODPROD && formData.CODPROD !== '');

  // Função para notificar o componente pai sobre a mudança em um campo
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof FormacaoPrecoVenda, e.target.value);
  };

  // Função para lidar com a mudança do produto
  const handleProdutoChange = (codigo: string, _produto?: any) => {
    onFormChange('CODPROD', codigo);
  };

  return (
    // Um grid para organizar os campos do formulário
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProdutoSearchInput
        name="CODPROD"
        label="Cód. Produto"
        value={formData.CODPROD || ''}
        onChange={handleProdutoChange}
        error={errors.CODPROD}
        required
        // Desabilitar apenas no modo de edição para proteger a chave primária
        disabled={isEditMode}
        placeholder="Digite o código ou nome do produto..."
      />
      <FormInput
        name="PRECOVENDA"
        label="Preço Venda (R$)"
        type="number"
        value={formData.PRECOVENDA || ''}
        onChange={handleInputChange}
        error={errors.PRECOVENDA}
        required
      />
      <FormInput
        name="MARGEMLIQUIDA"
        label="Margem Líquida (%)"
        type="number"
        value={formData.MARGEMLIQUIDA || ''}
        onChange={handleInputChange}
        error={errors.MARGEMLIQUIDA}
        required
      />
      <FormInput
        name="TIPOPRECO"
        label="Tipo Preço"
        type="number"
        value={formData.TIPOPRECO || ''}
        onChange={handleInputChange}
        error={errors.TIPOPRECO}
        required
      />
      <FormInput
        name="ICMS"
        label="ICMS (%)"
        type="number"
        value={formData.ICMS || ''}
        onChange={handleInputChange}
        error={errors.ICMS}
        required
      />
      <FormInput
        name="IPI"
        label="IPI (%)"
        type="number"
        value={formData.IPI || ''}
        onChange={handleInputChange}
        error={errors.IPI}
        required
      />
      <FormInput
        name="PIS"
        label="PIS (%)"
        type="number"
        value={formData.PIS || ''}
        onChange={handleInputChange}
        error={errors.PIS}
        required
      />
      <FormInput
        name="COFINS"
        label="COFINS (%)"
        type="number"
        value={formData.COFINS || ''}
        onChange={handleInputChange}
        error={errors.COFINS}
        required
      />
      <FormInput
        name="ICMSDEVOL"
        label="ICMS Devolução (%)"
        type="number"
        value={formData.ICMSDEVOL || ''}
        onChange={handleInputChange}
        error={errors.ICMSDEVOL}
        required
      />
      <FormInput
        name="DCI"
        label="DCI (%)"
        type="number"
        value={formData.DCI || ''}
        onChange={handleInputChange}
        error={errors.DCI}
        required
      />
      <FormInput
        name="COMISSAO"
        label="Comissão (%)"
        type="number"
        value={formData.COMISSAO || ''}
        onChange={handleInputChange}
        error={errors.COMISSAO}
        required
      />
      <FormInput
        name="FATORDESPESAS"
        label="Fator Despesas"
        type="number"
        value={formData.FATORDESPESAS || ''}
        onChange={handleInputChange}
        error={errors.FATORDESPESAS}
        required
      />
      <FormInput
        name="TAXACARTAO"
        label="Taxa Cartão (%)"
        type="number"
        value={formData.TAXACARTAO || ''}
        onChange={handleInputChange}
        error={errors.TAXACARTAO}
      />
    </div>
  );
};
