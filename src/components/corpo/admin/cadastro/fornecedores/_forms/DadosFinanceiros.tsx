import React from 'react';
import FormInput from '@/components/common/FormInput';
import { Fornecedor } from '@/data/fornecedores/fornecedores';
import SelectInput from '@/components/common/SelectInput';

const regimeTributarioOptions = [
  { value: '1', label: 'Simples Nacional' },
  { value: '2', label: 'Lucro Presumido' },
  { value: '3', label: 'Lucro Real' },
  { value: '4', label: 'Isento' },
];

interface DadosFinanceirosProps {
  fornecedor: Fornecedor;
  handleFornecedorChange: (field: keyof Fornecedor, value: any) => void;
  error?: { [p: string]: string };
  isEdit?: boolean;
}

const DadosFinanceiros: React.FC<DadosFinanceirosProps> = ({
  fornecedor,
  handleFornecedorChange,
  error,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="cc"
            type="text"
            label="C/C"
            defaultValue={fornecedor.cc || ''}
            onChange={(e) => handleFornecedorChange('cc', e.target.value)}
            error={error?.cc}
          />
          <FormInput
            name="banco"
            type="text"
            label="Banco"
            defaultValue={fornecedor.banco || ''}
            onChange={(e) => handleFornecedorChange('banco', e.target.value)}
            error={error?.banco}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="n_agencia"
            type="text"
            label="Agência"
            defaultValue={fornecedor.n_agencia || ''}
            onChange={(e) =>
              handleFornecedorChange('n_agencia', e.target.value)
            }
            error={error?.n_agencia}
          />
          <FormInput
            name="cod_ident"
            type="text"
            label="Código Identificação"
            defaultValue={fornecedor.cod_ident || ''}
            onChange={(e) =>
              handleFornecedorChange('cod_ident', e.target.value)
            }
            error={error?.cod_ident}
            maxLength={5}
          />
        </div>
        <SelectInput
          name="regime_tributacao"
          label="Regime Tributário"
          options={regimeTributarioOptions}
          defaultValue={fornecedor.regime_tributacao || ''}
          onValueChange={(value) =>
            handleFornecedorChange('regime_tributacao', value)
          }
          error={error?.regime_tributacao}
        />
      </div>
    </>
  );
};

export default DadosFinanceiros;
