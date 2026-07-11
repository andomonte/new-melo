import React from 'react';
import FormInput from '@/components/common/FormInput';
import { Produto } from '@/data/produtos/produtos';

interface DadosCustosProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

// Máscara decimal no padrão do Delphi: os dígitos entram pela direita e as
// últimas `casas` viram os decimais (ex.: digitar 1080 -> 10.80). Guarda o
// número real, não o texto.
const mascaraDecimalChange = (value: string, casas = 2): number => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / Math.pow(10, casas);
};

// Exibe com `casas` decimais fixas (ex.: 10.8 -> "10.80").
const exibeDecimal = (value: number | null | undefined, casas = 2): string => {
  const n = Number(value ?? 0);
  return (isNaN(n) ? 0 : n).toFixed(casas);
};

// Casas de cada campo (Delphi): preços/custos = 2; taxas de dólar = 6.
const DEC_PRECO = 2;
const DEC_DOLAR = 6;

const DadosCustos: React.FC<DadosCustosProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const moeda = produto.dolar === 'S' ? 'US$' : 'R$';

  // Gera value/onChange padronizados para um campo decimal com máscara.
  const campoDecimal = (campo: string, casas: number = DEC_PRECO) => ({
    type: 'text' as const,
    inputMode: 'numeric' as const,
    value: exibeDecimal(
      (produto as any)[campo] as number | null | undefined,
      casas,
    ),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      handleProdutoChange({
        ...produto,
        [campo]: mascaraDecimalChange(e.target.value, casas),
      } as Produto),
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Custo Referente a Lista de Fábrica
          </div>
          <FormInput
            name="prfabr"
            label={`Preço Fábrica (${moeda})`}
            {...campoDecimal('prfabr')}
            error={error?.prfabr}
          />
          <FormInput
            name="prcustoatual"
            label={`Preço Líquido (${moeda})`}
            {...campoDecimal('prcustoatual')}
            error={error?.prcustoatual}
          />
          <FormInput
            name="preconf"
            label={`Preço NF (${moeda})`}
            {...campoDecimal('preconf')}
            error={error?.preconf}
          />
          <FormInput
            name="precosnf"
            label={`Preço sem NF (${moeda})`}
            {...campoDecimal('precosnf')}
            error={error?.precosnf}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Custo Referente a Compra e Transferência
          </div>
          <FormInput
            name="prcompra"
            label={`Custo Compra (${moeda})`}
            {...campoDecimal('prcompra')}
            error={error?.prcompra}
            required
          />
          <FormInput
            name="prcomprasemst"
            label={`Custo Transf. Líquido (${moeda})`}
            {...campoDecimal('prcomprasemst')}
            error={error?.prcomprasemst}
          />
          <FormInput
            name="pratualdesp"
            label={`Custo Transf. Bruto (${moeda})`}
            {...campoDecimal('pratualdesp')}
            error={error?.pratualdesp}
          />
          <FormInput
            name="txdolarcompra"
            label="Taxa Dólar"
            {...campoDecimal('txdolarcompra', DEC_DOLAR)}
            error={error?.txdolarcompra}
          />
          <FormInput
            name="prcusto"
            label="Custo Contábil"
            {...campoDecimal('prcusto')}
            error={error?.prcusto}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">Lista de Preço</div>
          <FormInput
            name="prvenda"
            label={`Preço Venda (${moeda})`}
            {...campoDecimal('prvenda')}
            error={error?.prvenda}
          />
          <FormInput
            name="primp"
            label="Preço Importação"
            {...campoDecimal('primp')}
            error={error?.primp}
          />
          <FormInput
            name="impfat"
            label="Preço Importação Fatura"
            {...campoDecimal('impfat')}
            error={error?.impfat}
          />
          <FormInput
            name="impfab"
            label="Preço Importação Fábrica"
            {...campoDecimal('impfab')}
            error={error?.impfab}
          />
          <FormInput
            name="concor"
            label={`Preço Concorrência (${moeda})`}
            {...campoDecimal('concor')}
            error={error?.concor}
          />
          <FormInput
            name="txdolarvenda"
            label="Taxa Dólar"
            {...campoDecimal('txdolarvenda', DEC_DOLAR)}
            error={error?.txdolarvenda}
          />
        </div>

        {/* Seção de Taxas de Câmbio Adicionais */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Taxas de Câmbio Adicionais
          </div>
          <FormInput
            name="txdolarfabrica"
            label="Taxa Dólar Fábrica"
            {...campoDecimal('txdolarfabrica', DEC_DOLAR)}
            error={error?.txdolarfabrica}
          />
          <FormInput
            name="txdolarcompramedio"
            label="Taxa Dólar Compra Médio"
            {...campoDecimal('txdolarcompramedio', DEC_DOLAR)}
            error={error?.txdolarcompramedio}
          />
        </div>
      </div>
    </>
  );
};

export default DadosCustos;
