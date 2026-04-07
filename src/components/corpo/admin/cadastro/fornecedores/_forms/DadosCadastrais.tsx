import React, { useEffect, useState } from 'react';
import SelectInput from '@/components/common/SelectInput';
import {
  ClassesFornecedor,
  Fornecedor,
} from '@/data/fornecedores/fornecedores';
import FormInput from '@/components/common/FormInput';
import CheckInput from '@/components/common/CheckInput';
import { buscaCep, ViaCepResponse } from '@/data/cep';
import { useDebouncedCallback } from 'use-debounce';
import SearchSelectInput from '@/components/common/SearchSelectInput';
//import { Bancos } from '@/data/bancos/bancos';
import { CadFornecedorSearchOptions } from '../modalCadastrar';
import { Paises } from '@/data/paises/paises';
import { isValidCpfCnpj } from '@/utils/validacoes';

const tipoPessoaOptions = [
  { value: 'J', label: 'Jurídica' },
  { value: 'F', label: 'Física' },
  { value: 'X', label: 'X-Exterior' },
];

const tipoEmpresaOptions = [
  { value: 'NL', label: 'NL' },
  { value: 'EI', label: 'EI' },
  { value: 'NE', label: 'NE' },
  { value: 'LT', label: 'LTDA' },
  { value: 'EF', label: 'EF' },
  { value: 'ME', label: 'ME' },
  { value: 'SA', label: 'SA' },
  { value: 'EP', label: 'EPP' },
];

const tipoFornecedorOptions = [
  { value: 'TF', label: 'TF' },
  { value: 'OS', label: 'OS' },
  { value: 'PF', label: 'PF' },
  { value: 'CI', label: 'CI' },
];

interface DadosCadastraisProps {
  fornecedor: Fornecedor;
  handleFornecedorChange: (field: keyof Fornecedor, value: any) => void;
  error?: { [p: string]: string };
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
  isEdit?: boolean;
  options: { classesFornecedor: ClassesFornecedor; paises: Paises };
  handleSearchOptionsChange: (
    option: CadFornecedorSearchOptions,
    value: string,
  ) => void;
}

const DadosCadastrais: React.FC<DadosCadastraisProps> = ({
  fornecedor,
  handleFornecedorChange,
  error,
  setDisable,
  disableFields,
  options,
  handleSearchOptionsChange,
}) => {
  const [resultCep, setResultCep] = useState<ViaCepResponse>(
    {} as ViaCepResponse,
  );
  const [cnpjCpfError, setCnpjCpfError] = useState<string>('');

  const handleCepSearch = useDebouncedCallback(() => {
    getResultCep();
  }, 1000);

  const validarCnpjCpf = (value: string) => {
    if (!value) {
      setCnpjCpfError('CNPJ/CPF obrigatório');
      return false;
    }
    if (!isValidCpfCnpj(value)) {
      setCnpjCpfError('CNPJ/CPF inválido');
      return false;
    }
    setCnpjCpfError('');
    return true;
  };

  const getResultCep = async () => {
    if (fornecedor.cep && fornecedor.cep.length >= 8) {
      setResultCep(await buscaCep(fornecedor.cep));
    }
  };

  const classesFornecedorOptions = options.classesFornecedor.data.map(
    (classeFornecedor) => ({
      value: classeFornecedor.codcf,
      label: classeFornecedor.descr,
    }),
  );

  const paisesOptions = options.paises?.data?.map((pais) => ({
    value: pais.codpais,
    label: pais.descricao,
  }));

  useEffect(() => {
    if (resultCep.logradouro)
      handleFornecedorChange('endereco', resultCep.logradouro);
    if (resultCep.bairro) handleFornecedorChange('bairro', resultCep.bairro);
    if (resultCep.localidade)
      handleFornecedorChange('cidade', resultCep.localidade);
    if (resultCep.uf) handleFornecedorChange('uf', resultCep.uf);
  }, [resultCep, handleFornecedorChange]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-4 gap-4">
          <SelectInput
            name="tipo"
            label="Tipo"
            options={tipoPessoaOptions}
            defaultValue={fornecedor.tipo || ''}
            onValueChange={(value) => handleFornecedorChange('tipo', value)}
            error={error?.tipo}
          />
          <FormInput
            name="cpf_cgc"
            type="text"
            label={fornecedor.tipo === 'F' ? 'CPF' : 'CNPJ'}
            defaultValue={fornecedor.cpf_cgc || ''}
            onChange={(e) => handleFornecedorChange('cpf_cgc', e.target.value)}
            onBlur={(e) => validarCnpjCpf(e.target.value)}
            error={cnpjCpfError || error?.cpf_cgc}
            required
          />
          <SelectInput
            name="tipoemp"
            label="Tipo Empresa"
            options={tipoEmpresaOptions}
            defaultValue={fornecedor.tipoemp || ''}
            onValueChange={(value) => handleFornecedorChange('tipoemp', value)}
            error={error?.tipoemp}
            required
          />
          <SearchSelectInput
            name="classefornecedor"
            label="Classe de Fornecedor"
            options={classesFornecedorOptions}
            defaultValue={fornecedor.codcf || ''}
            onValueChange={(value) => handleFornecedorChange('codcf', value)}
            onInputChange={(value) =>
              handleSearchOptionsChange('classeFornecedor', value)
            }
            required
          />
        </div>
        <FormInput
          name="nome"
          type="text"
          label="Nome"
          defaultValue={fornecedor.nome || ''}
          onChange={(e) => handleFornecedorChange('nome', e.target.value)}
          error={error?.nome}
          required
        />
        <FormInput
          name="nome_fant"
          type="text"
          label="Nome Fantasia"
          defaultValue={fornecedor.nome_fant || ''}
          onChange={(e) => handleFornecedorChange('nome_fant', e.target.value)}
          error={error?.nome_fant}
        />
        <div className="flex gap-4 justify-between">
          <p className="text-gray-700 font-bold">
            ENDEREÇO PARA CORRESPONDÊNCIA
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormInput
            name="cep"
            type="text"
            label="CEP"
            defaultValue={fornecedor.cep || ''}
            onChange={(e) => {
              handleFornecedorChange('cep', e.target.value);
              handleCepSearch();
            }}
            error={error?.cep}
            maxLength={8}
            required
          />
          <FormInput
            name="endereco"
            type="text"
            label="Logradouro"
            defaultValue={fornecedor.endereco || ''}
            onChange={(e) => handleFornecedorChange('endereco', e.target.value)}
            error={error?.ender}
            required
          />
          <FormInput
            name="numero"
            type="text"
            label="Número"
            defaultValue={fornecedor.numero || ''}
            onChange={(e) => handleFornecedorChange('numero', e.target.value)}
            error={error?.numero}
          />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <FormInput
            name="bairro"
            type="text"
            label="Bairro"
            defaultValue={fornecedor.bairro || ''}
            onChange={(e) => handleFornecedorChange('bairro', e.target.value)}
            error={error?.bairro}
            required
          />
          <FormInput
            name="cidade"
            type="text"
            label="Cidade"
            defaultValue={fornecedor.cidade || ''}
            onChange={(e) => handleFornecedorChange('cidade', e.target.value)}
            error={error?.cidade}
            required
          />
          <FormInput
            name="uf"
            type="text"
            label="UF"
            defaultValue={fornecedor.uf || ''}
            onChange={(e) => handleFornecedorChange('uf', e.target.value)}
            error={error?.uf}
            required
          />
          <SearchSelectInput
            name="codpais"
            label="País"
            options={paisesOptions}
            defaultValue={Number(fornecedor.codpais) || ''}
            onValueChange={(value) => handleFornecedorChange('codpais', value)}
            onInputChange={(value) => handleSearchOptionsChange('pais', value)}
            error={error?.codpais}
            required
          />
        </div>
        <FormInput
          name="complemento"
          type="text"
          label="Complemento"
          defaultValue={fornecedor.complemento || ''}
          onChange={(e) =>
            handleFornecedorChange('complemento', e.target.value)
          }
          error={error?.complemento}
        />
        <FormInput
          name="referencia"
          type="text"
          label="Referência"
          defaultValue={fornecedor.referencia || ''}
          onChange={(e) => handleFornecedorChange('referencia', e.target.value)}
          error={error?.referencia}
        />
        <FormInput
          name="contatos"
          type="text"
          label="Contatos"
          defaultValue={fornecedor.contatos || ''}
          onChange={(e) => handleFornecedorChange('contatos', e.target.value)}
          error={error?.contatos}
        />
        <div className="grid grid-cols-3 gap-4">
          <CheckInput
            name="isentoim"
            label="Isento IM"
            onChange={(e) => setDisable('disableIm', e.target.checked)}
            checked={disableFields.disableIm}
          />
          <CheckInput
            name="isentoie"
            label="Isento IE"
            onChange={(e) => setDisable('disableIe', e.target.checked)}
            checked={disableFields.disableIe}
          />
          <CheckInput
            name="isentosuf"
            label="Isento Suframa"
            onChange={(e) => setDisable('disableSuf', e.target.checked)}
            checked={disableFields.disableSuf}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormInput
            name="imun"
            type="text"
            label="Inscrição Municipal"
            defaultValue={fornecedor.imun || ''}
            onChange={(e) => {
              handleFornecedorChange(
                'imun',
                disableFields.disableIm ? 'ISENTO' : e.target.value,
              );
            }}
            error={error?.imun}
            disabled={disableFields.disableIm}
          />
          <FormInput
            name="iest"
            type="text"
            label="Inscrição Estadual"
            defaultValue={fornecedor.iest || ''}
            onChange={(e) => {
              handleFornecedorChange(
                'iest',
                disableFields.disableIe ? 'ISENTO' : e.target.value,
              );
            }}
            error={error?.iest}
            disabled={disableFields.disableIe}
          />
          <FormInput
            name="isuframa"
            type="text"
            label="Inscrição Suframa"
            defaultValue={fornecedor.isuframa || ''}
            onChange={(e) => {
              handleFornecedorChange(
                'isuframa',
                disableFields.disableSuf ? 'ISENTO' : e.target.value,
              );
            }}
            error={error?.isuframa}
            disabled={disableFields.disableSuf}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectInput
            name="tipofornecedor"
            label="Tipo Fornecedor"
            options={tipoFornecedorOptions}
            defaultValue={fornecedor.tipofornecedor || ''}
            onValueChange={(value) =>
              handleFornecedorChange('tipofornecedor', value)
            }
            error={error?.tipofornecedor}
            required
          />
          <SearchSelectInput
            name="contacontabil"
            label="Conta Contábil"
            options={[]}
          />
        </div>
      </div>
    </>
  );
};

export default DadosCadastrais;
