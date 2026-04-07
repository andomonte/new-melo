import React, { useState } from 'react';
import SelectInput from '@/components/common/SelectInput';
import FormInput from '@/components/common/FormInput';
import SearchSelectInput from '@/components/common/SearchSelectInput';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { useTiposDeCompra } from '../hooks/useTiposDeCompra';
import { useFiliais } from '../hooks/useFiliais';
import { useCompradores } from '../hooks/useCompradores';
import { useFornecedores } from '../hooks/useFornecedores';
import { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';

interface RequisitionHeaderProps {
  onSave: (data: Partial<RequisitionDTO>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function RequisitionHeader({
  onSave,
  onCancel,
  isLoading,
}: RequisitionHeaderProps) {
  const [formData, setFormData] = useState<Partial<RequisitionDTO>>({});

  const { tipos } = useTiposDeCompra();
  const { filiais } = useFiliais();
  const { compradores } = useCompradores();
  const { fornecedores } = useFornecedores();

  const handleChange = (field: keyof RequisitionDTO, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const tipoCompraOptions = tipos.map((t) => ({
    value: t.codigo,
    label: t.descricao || t.codigo,
  }));
  const filiaisOptions = filiais.map((f) => ({
    value: f.codigo_filial.toString(),
    label: f.nome_filial,
  }));
  const compradoresOptions = compradores.map((c) => ({
    value: c.codcomprador.toString(),
    label: c.nome,
  }));
  const fornecedoresOptions = fornecedores.map((f) => ({
    value: f.cod_credor!,
    label: `${f.cod_credor} - ${f.nome_fant || f.nome}`,
  }));

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Lado Esquerdo */}
        <div className="space-y-4 flex flex-col">
          <SelectInput
            name="tipo"
            label="Tipo:"
            options={tipoCompraOptions}
            onValueChange={(v) => handleChange('tipo', v)}
            required
          />
          <SelectInput
            name="comprador"
            label="Comprador:"
            options={compradoresOptions}
            onValueChange={(v) => handleChange('compradorCodigo', v)}
            required
          />
          <FormInput
            name="condicoesPgto"
            label="Condições de Pgto.:"
            type="text" // CORREÇÃO: Adicionado o tipo
            onChange={(e) => handleChange('condPagto', e.target.value)}
          />
          <FormInput
            name="observacao"
            label="Observação:"
            type="text" // CORREÇÃO: Adicionado o tipo
            onChange={(e) => handleChange('observacao', e.target.value)}
          />
        </div>

        {/* Lado Direito */}
        <div className="space-y-4 flex flex-col">
          <SelectInput
            name="entregaEm"
            label="Entrega em:"
            options={filiaisOptions}
            onValueChange={(v) => handleChange('entregaId', parseInt(v))}
            required
          />
          <SelectInput
            name="destinadoPara"
            label="Destinado para:"
            options={filiaisOptions}
            onValueChange={(v) => handleChange('destinoId', parseInt(v))}
            required
          />
          <SearchSelectInput
            name="fornecedor"
            label="Fornecedor:"
            options={fornecedoresOptions}
            onValueChange={(v) => handleChange('fornecedorCodigo', v)}
            required
          />
          <FormInput
            name="previsaoChegada"
            type="date"
            label="Previsão Chegada:"
            onChange={(e) => handleChange('previsaoChegada', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <AuxButton text="Voltar" onClick={onCancel} />
        <DefaultButton
          text="Avançar"
          onClick={() => onSave(formData)}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
