import React from 'react';
import { Fornecedor } from '@/data/fornecedores/fornecedores';
import CheckInput from '@/components/common/CheckInput';
import SelectInput from '@/components/common/SelectInput';

const pisCofinsOptions = [
  { value: '0', label: 'Não Aplicar' },
  { value: '1', label: 'Aplicar' },
];

const pisCofins1150Options = [
  { value: '0', label: 'Não Aplicar' },
  { value: '1', label: 'Cobrar 11.50%' },
  { value: '2', label: 'Descontar 11.50%' },
  { value: '3', label: 'Descontar 11.50% e Depois Cobrar 11.50%' },
];

const pisCofins1310Options = [
  { value: '0', label: 'Não Aplicar' },
  { value: '1', label: 'Cobrar 13.10%' },
  { value: '2', label: 'Descontar 13.10%' },
  { value: '3', label: 'Descontar 13.10% e Depois Cobrar 13.10%' },
  { value: '4', label: 'Aplicar Desconto 9.25%' },
];

const modalidadeFreteOptions = [
  { value: '0', label: 'CIF' },
  { value: '1', label: 'FOB' },
];

interface RegraFaturamentoProps {
  fornecedor: Fornecedor;
  handleFornecedorChange: (field: keyof Fornecedor, value: any) => void;
  error?: { [p: string]: string };
  isEdit?: boolean;
  setDisable: (
    field: 'disableIm' | 'disableIe' | 'disableSuf' | 'regraDiferenciada',
    value: boolean,
  ) => void;
  disableFields: {
    disableIm: boolean;
    disableIe: boolean;
    disableSuf: boolean;
    regraDiferenciada: boolean;
  };
}

const RegraFaturamentoTab: React.FC<RegraFaturamentoProps> = ({
  fornecedor,
  handleFornecedorChange,
  setDisable,
  disableFields,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 text-gray-700">
      <CheckInput
        name="regraDiferenciada"
        label="Aplicar Regra Diferenciada"
        onChange={(e) => setDisable('regraDiferenciada', e.target.checked)}
        checked={disableFields.regraDiferenciada}
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold">ICMS</p>
          <CheckInput
            name="desc_icms_sufra"
            label="Desconto ICMS Suframa (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_icms_sufra',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_icms_sufra === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="desc_icms_sufra_importado"
            label="Desconto ICMS Suframa Importado (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_icms_sufra_importado',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_icms_sufra_importado === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="basereduzida_icms"
            label="Base Reduzida (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'basereduzida_icms',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.basereduzida_icms === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="desc_icms_sufra_base"
            label="Desconto ICMS Suframa na Base (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_icms_sufra_base',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_icms_sufra_base === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="desc_icms_sufra_importado_base"
            label="Desconto ICMS Suframa Importado na Base (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_icms_sufra_importado_base',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_icms_sufra_importado_base === 1}
            disabled={!disableFields.regraDiferenciada}
          />
        </div>
        <div>
          <p className="font-bold">ICMS ST</p>
          <CheckInput
            name="desc_icms_sufra_st"
            label="Aplicar Desconto ICMS (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_icms_sufra_st',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_icms_sufra_st === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="desc_piscofins_st"
            label="Aplicar Desconto PIS/COFINS (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'desc_piscofins_st',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.desc_piscofins_st === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="acres_piscofins_st"
            label="Aplicar Acréscimo PIS/COFINS (+)"
            onChange={(e) =>
              handleFornecedorChange(
                'acres_piscofins_st',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.acres_piscofins_st === 1}
            disabled={!disableFields.regraDiferenciada}
          />
          <CheckInput
            name="basereduzida_st"
            label="Base Reduzida (-)"
            onChange={(e) =>
              handleFornecedorChange(
                'basereduzida_st',
                e.target.checked ? 1 : 0,
              )
            }
            checked={fornecedor.basereduzida_st === 1}
            disabled={!disableFields.regraDiferenciada}
          />
        </div>
      </div>
      <div>
        <p className="font-bold">Comportamento PIS/COFINS</p>
        <CheckInput
          name="desc_icms_sufra_piscofins"
          label="Aplicar Desconto ICMS na Base (-)"
          onChange={(e) =>
            handleFornecedorChange(
              'desc_icms_sufra_piscofins',
              e.target.checked ? 1 : 0,
            )
          }
          checked={fornecedor.desc_icms_sufra_piscofins === 1}
          disabled={!disableFields.regraDiferenciada}
        />
        <div className="grid grid-cols-2 gap-4">
          <SelectInput
            name="piscofins_365"
            label="3.65%"
            options={pisCofinsOptions}
            defaultValue={String(fornecedor.piscofins_365 ?? '')}
            onValueChange={(value) =>
              handleFornecedorChange('piscofins_365', Number(value))
            }
            disabled={!disableFields.regraDiferenciada}
          />
          <SelectInput
            name="piscofins_925"
            label="9.25%"
            options={pisCofinsOptions}
            defaultValue={String(fornecedor.piscofins_925 ?? '')}
            onValueChange={(value) =>
              handleFornecedorChange('piscofins_925', Number(value))
            }
            disabled={!disableFields.regraDiferenciada}
          />
          <SelectInput
            name="piscofins_1150"
            label="11.50%"
            options={pisCofins1150Options}
            defaultValue={String(fornecedor.piscofins_1150 ?? '')}
            onValueChange={(value) =>
              handleFornecedorChange('piscofins_1150', Number(value))
            }
            disabled={!disableFields.regraDiferenciada}
          />
          <SelectInput
            name="piscofins_1310"
            label="13.10%"
            options={pisCofins1310Options}
            defaultValue={String(fornecedor.piscofins_1310 ?? '')}
            onValueChange={(value) =>
              handleFornecedorChange('piscofins_1310', Number(value))
            }
            disabled={!disableFields.regraDiferenciada}
          />
        </div>
      </div>
      <div>
        <p className="font-bold">IPI</p>
        <CheckInput
          name="cobrar_ipi_importado"
          label="Não Cobrar de Importado (-)"
          onChange={(e) =>
            handleFornecedorChange(
              'cobrar_ipi_importado',
              e.target.checked ? 1 : 0,
            )
          }
          checked={fornecedor.cobrar_ipi_importado === 1}
          disabled={!disableFields.regraDiferenciada}
        />
      </div>
      <SelectInput
        name="frete"
        label="Modalidade do Frete"
        options={modalidadeFreteOptions}
        defaultValue={String(fornecedor.frete ?? '')}
        onValueChange={(value) => handleFornecedorChange('frete', value)}
        disabled={!disableFields.regraDiferenciada}
      />
    </div>
  );
};

export default RegraFaturamentoTab;
