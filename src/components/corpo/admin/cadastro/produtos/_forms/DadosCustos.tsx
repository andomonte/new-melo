import React from 'react';
import { Produto } from '@/data/produtos/produtos';
import CampoDecimal from './CampoDecimal';

interface DadosCustosProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

// Casas do Delphi: preços/custos = 99999.99 (5 int, 2 dec);
// taxas de dólar = 99.999999 (2 int, 6 dec).
const DadosCustos: React.FC<DadosCustosProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const moeda = produto.dolar === 'S' ? 'US$' : 'R$';

  const campo = (
    nome: string,
    label: string,
    opts: { int?: number; dec?: number; required?: boolean } = {},
  ) => (
    <CampoDecimal
      name={nome}
      label={label}
      intDigits={opts.int ?? 5}
      decDigits={opts.dec ?? 2}
      required={opts.required}
      value={(produto as any)[nome]}
      onChangeValue={(v) =>
        handleProdutoChange({ ...produto, [nome]: v } as Produto)
      }
      error={error?.[nome]}
    />
  );

  const dolar = { int: 2, dec: 6 };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Custo Referente a Lista de Fábrica
          </div>
          {campo('prfabr', `Preço Fábrica (${moeda})`)}
          {campo('prcustoatual', `Preço Líquido (${moeda})`)}
          {campo('preconf', `Preço NF (${moeda})`)}
          {campo('precosnf', `Preço sem NF (${moeda})`)}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Custo Referente a Compra e Transferência
          </div>
          {campo('prcompra', `Custo Compra (${moeda})`, { required: true })}
          {campo('prcomprasemst', `Custo Transf. Líquido (${moeda})`)}
          {campo('pratualdesp', `Custo Transf. Bruto (${moeda})`)}
          {campo('txdolarcompra', 'Taxa Dólar', dolar)}
          {campo('prcusto', 'Custo Contábil')}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">Lista de Preço</div>
          {campo('prvenda', `Preço Venda (${moeda})`)}
          {campo('primp', 'Preço Importação')}
          {campo('impfat', 'Preço Importação Fatura')}
          {campo('impfab', 'Preço Importação Fábrica')}
          {campo('concor', `Preço Concorrência (${moeda})`)}
          {campo('txdolarvenda', 'Taxa Dólar', dolar)}
        </div>

        {/* Seção de Taxas de Câmbio Adicionais */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-[#347AB6]/25 dark:border-blue-900/25 rounded-lg p-4 content-start">
          <div className="col-span-2 block text-gray-700 dark:text-gray-200 font-bold">
            Taxas de Câmbio Adicionais
          </div>
          {campo('txdolarfabrica', 'Taxa Dólar Fábrica', dolar)}
          {campo('txdolarcompramedio', 'Taxa Dólar Compra Médio', dolar)}
        </div>
      </div>
    </>
  );
};

export default DadosCustos;
