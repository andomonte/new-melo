import React from 'react';
import FormInput from '@/components/common/FormInput';
import { Produto } from '@/data/produtos/produtos';

interface DadosCustosProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

// Helper function para lidar com valores numéricos opcionais
const handleOptionalNumberChange = (value: string): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

// Helper function para lidar com valores numéricos obrigatórios
const handleRequiredNumberChange = (
  value: string,
  defaultValue: number = 0,
): number => {
  if (value === '' || value === null || value === undefined)
    return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Helper function para exibir valores numéricos
const displayNumberValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value.toString();
};

const DadosCustos: React.FC<DadosCustosProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="block text-gray-700 font-bold">
            Custo Referente a Lista de Fábrica
          </div>
          <FormInput
            name="prfabr"
            type="number"
            label="Preço Fábrica"
            value={displayNumberValue(produto.prfabr)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                prfabr: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.prfabr}
          />
          <FormInput
            name="prcustoatual"
            type="number"
            label="Preço Líquido"
            value={displayNumberValue(produto.prcustoatual)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                prcustoatual: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.prcustoatual}
          />
          <FormInput
            name="preconf"
            type="number"
            label="Preço NF"
            value={displayNumberValue(produto.preconf)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                preconf: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.preconf}
          />
          <FormInput
            name="precosnf"
            type="number"
            label="Preço sem NF"
            value={displayNumberValue(produto.precosnf)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                precosnf: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.precosnf}
          />
        </div>
        <div className="flex flex-col gap-4 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="block text-gray-700 font-bold">
            Custo Referente a Compra e Transferência
          </div>
          <FormInput
            name="prcompra"
            type="number"
            label="Custo Compra"
            value={displayNumberValue(produto.prcompra)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                prcompra: handleRequiredNumberChange(e.target.value),
              })
            }
            error={error?.prcompra}
            required
          />
          <FormInput
            name="prcomprasemst"
            type="number"
            label="Custo Transf. Líquido"
            value={displayNumberValue(produto.prcomprasemst)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                prcomprasemst: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.prcomprasemst}
          />
          <FormInput
            name="pratualdesp"
            type="number"
            label="Custo Transf. Bruto"
            value={displayNumberValue(produto.pratualdesp)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                pratualdesp: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.pratualdesp}
          />
          <FormInput
            name="txdolarcompra"
            type="number"
            label="Taxa Dólar"
            value={displayNumberValue(produto.txdolarcompra)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                txdolarcompra: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.txdolarcompra}
          />
          {/*<FormInput*/}
          {/*  name="prcusto"*/}
          {/*  type="number"*/}
          {/*  label="Custo Contábil"*/}
          {/*  value={displayNumberValue(produto.prcusto)}
          {/*  onChange={(e) => handleProdutoChange({ ...produto, prcusto: handleOptionalNumberChange(e.target.value) })}*/}
          {/*  error={error?.prcusto}*/}
          {/*/>*/}
        </div>
        <div className="flex flex-col gap-4 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="block text-gray-700 font-bold">Lista de Preço</div>
          <FormInput
            name="prvenda"
            type="number"
            label="Preço Venda"
            value={displayNumberValue(produto.prvenda)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                prvenda: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.prvenda}
          />
          <FormInput
            name="primp"
            type="number"
            label="Preço Importação"
            value={displayNumberValue(produto.primp)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                primp: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.primp}
          />
          <FormInput
            name="impfat"
            type="number"
            label="Preço Importação Fatura"
            value={displayNumberValue(produto.impfat)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                impfat: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.impfat}
          />
          <FormInput
            name="impfab"
            type="number"
            label="Preço Importação Fábrica"
            value={displayNumberValue(produto.impfab)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                impfab: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.impfab}
          />
          <FormInput
            name="concor"
            type="number"
            label="Preço Concorrência"
            value={displayNumberValue(produto.concor)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                concor: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.concor}
          />
          <FormInput
            name="txdolarvenda"
            type="number"
            label="Taxa Dólar"
            value={displayNumberValue(produto.txdolarvenda)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                txdolarvenda: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.txdolarvenda}
          />
        </div>

        {/* Seção de Comissões */}
        <div className="flex flex-col gap-4 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="block text-gray-700 font-bold">
            Comissões Diferenciadas
          </div>
          <FormInput
            name="comdifeext"
            type="number"
            label="Comissão Externa (%)"
            value={displayNumberValue(produto.comdifeext)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                comdifeext: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.comdifeext}
          />
          <FormInput
            name="comdifeext_int"
            type="number"
            label="Comissão Externa Internacional (%)"
            value={displayNumberValue(produto.comdifeext_int)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                comdifeext_int: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.comdifeext_int}
          />
          <FormInput
            name="comdifint"
            type="number"
            label="Comissão Interna (%)"
            value={displayNumberValue(produto.comdifint)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                comdifint: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.comdifint}
          />
        </div>

        {/* Seção de Taxas de Câmbio Adicionais */}
        <div className="flex flex-col gap-4 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4">
          <div className="block text-gray-700 font-bold">
            Taxas de Câmbio Adicionais
          </div>
          <FormInput
            name="txdolarfabrica"
            type="number"
            label="Taxa Dólar Fábrica"
            value={displayNumberValue(produto.txdolarfabrica)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                txdolarfabrica: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.txdolarfabrica}
          />
          <FormInput
            name="txdolarcompramedio"
            type="number"
            label="Taxa Dólar Compra Médio"
            value={displayNumberValue(produto.txdolarcompramedio)}
            onChange={(e) =>
              handleProdutoChange({
                ...produto,
                txdolarcompramedio: handleOptionalNumberChange(e.target.value),
              })
            }
            error={error?.txdolarcompramedio}
          />
        </div>
      </div>
    </>
  );
};

export default DadosCustos;
