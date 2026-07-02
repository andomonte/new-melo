import React, { useEffect, useState } from 'react';
import SelectInput from '@/components/common/SelectPadrao';
import {
  ClassesFornecedor,
  Fornecedor,
} from '@/data/fornecedores/fornecedores';
import FormInput from '@/components/common/FormInput';
import CheckInput from '@/components/common/CheckInput';
import { buscaCep, ViaCepResponse } from '@/data/cep';
import { useDebouncedCallback } from 'use-debounce';
//import { Bancos } from '@/data/bancos/bancos';
import { CadFornecedorSearchOptions } from '../modalCadastrar';
import { Paises } from '@/data/paises/paises';
import { isValidCpfCnpj } from '@/utils/validacoes';
import { formatarDocumento } from '@/utils/mascaraDocumento';
import { useToast } from '@/hooks/use-toast';

// Mapeamento UF -> código IBGE (primeiros 2 dígitos do código de município)
const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
  MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
  RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};

const tipoPessoaOptions = [
  { value: 'J', label: 'Jurídica' },
  { value: 'F', label: 'Física' },
  { value: 'X', label: 'X-Exterior' },
];

// Mesma lista do cadastro de Cliente
const tipoEmpresaOptions = [
  { value: 'EPP', label: 'EPP - Empresa de Pequeno Porte' },
  { value: 'EP', label: 'EP - Empresa de Pequeno Porte' },
  { value: 'EF', label: 'EF - Empresa Filial' },
  { value: 'ME', label: 'ME - Microempresa' },
  { value: 'NL', label: 'NL - Normal' },
  { value: 'PF', label: 'PF - Pessoa Física' },
  { value: 'MEI', label: 'MEI - Microempreendedor Individual' },
  { value: 'EI', label: 'EI - Empresário Individual' },
  { value: 'LTDA', label: 'LTDA - Sociedade Limitada' },
  { value: 'SLU', label: 'SLU - Sociedade Limitada Unipessoal' },
  { value: 'S/S', label: 'S/S - Sociedade Simples' },
  { value: 'S/A', label: 'S/A - Sociedade Anônima' },
  { value: 'MGP', label: 'MGP - Empresa de Médio e Grande Porte' },
];

const tipoFornecedorOptions = [
  { value: 'CI', label: 'CI - COMÉRCIO/INDÚSTRIA' },
  { value: 'PF', label: 'PF - PRESTAÇÃO SERVIÇO PF' },
  { value: 'OS', label: 'OS - PRESTAÇÃO SERVIÇO PJ' },
  { value: 'TF', label: 'TF - TRANSPORTES/FRETES' },
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
  /** Chamado ao sair do campo CNPJ/CPF — busca duplicidade e auto-preenche */
  onDocumentoBlur?: () => void;
}

const DadosCadastrais: React.FC<DadosCadastraisProps> = ({
  fornecedor,
  handleFornecedorChange,
  error,
  setDisable,
  disableFields,
  options,
  handleSearchOptionsChange,
  onDocumentoBlur,
}) => {
  const [resultCep, setResultCep] = useState<ViaCepResponse>(
    {} as ViaCepResponse,
  );
  const [cnpjCpfError, setCnpjCpfError] = useState<string>('');
  const [municipioUfWarning, setMunicipioUfWarning] = useState<string>('');
  const { toast } = useToast();

  // Validar município x UF usando mapeamento IBGE
  const validarMunicipioUf = (codmunicipio: string, uf: string) => {
    if (!codmunicipio || !uf || uf.toUpperCase() === 'EX') {
      setMunicipioUfWarning('');
      return;
    }
    const prefixoEsperado = UF_IBGE[uf.toUpperCase()];
    if (!prefixoEsperado) {
      setMunicipioUfWarning('');
      return;
    }
    const prefixoMunicipio = codmunicipio.substring(0, 2);
    if (prefixoMunicipio !== prefixoEsperado) {
      const msg = `Atenção: Código do município (${codmunicipio}) não corresponde à UF ${uf.toUpperCase()}.`;
      setMunicipioUfWarning(msg);
      toast({ description: msg, variant: 'destructive' });
    } else {
      setMunicipioUfWarning('');
    }
  };

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
    label: `${pais.codpais} - ${pais.descricao}`,
  }));

  useEffect(() => {
    if (resultCep.logradouro)
      handleFornecedorChange('endereco', resultCep.logradouro);
    if (resultCep.bairro) handleFornecedorChange('bairro', resultCep.bairro);
    if (resultCep.localidade)
      handleFornecedorChange('cidade', resultCep.localidade);
    if (resultCep.uf) handleFornecedorChange('uf', resultCep.uf);
    // CEP válido = endereço no Brasil → preenche o País (Brasil = 1058), igual ao cliente
    if (resultCep.uf || resultCep.localidade)
      handleFornecedorChange('codpais', 1058);
  }, [resultCep, handleFornecedorChange]);

  // Validar município x UF sempre que um deles mudar
  useEffect(() => {
    if (fornecedor.codmunicipio && fornecedor.uf) {
      validarMunicipioUf(String(fornecedor.codmunicipio), fornecedor.uf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedor.codmunicipio, fornecedor.uf]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-4 gap-4">
          <div className={error?.tipo ? 'field-error' : ''}>
            <SelectInput
              name="tipo"
              label="Tipo"
              options={tipoPessoaOptions}
              defaultValue={fornecedor.tipo || ''}
              required
              onValueChange={(value) => {
                handleFornecedorChange('tipo', value);
                // Exterior: seta CPF como "EXTERIOR" e limpa tipo fornecedor
                if (value === 'X') {
                  handleFornecedorChange('cpf_cgc', 'EXTERIOR');
                  handleFornecedorChange('tipofornecedor', '');
                } else if (fornecedor.cpf_cgc === 'EXTERIOR') {
                  handleFornecedorChange('cpf_cgc', '');
                }
              }}
              error={error?.tipo}
            />
          </div>
          <div className={error?.cpf_cgc || cnpjCpfError ? 'field-error' : ''}>
            <div className="relative">
              <FormInput
                name="cpf_cgc"
                type="text"
                label={fornecedor.tipo === 'F' ? 'CPF' : fornecedor.tipo === 'X' ? 'Documento' : 'CNPJ'}
                value={fornecedor.cpf_cgc || ''}
                placeholder={fornecedor.tipo === 'F' ? '000.000.000-00' : fornecedor.tipo === 'X' ? 'Documento' : '00.000.000/0000-00'}
                onChange={(e) =>
                  handleFornecedorChange(
                    'cpf_cgc',
                    formatarDocumento(e.target.value, fornecedor.tipo),
                  )
                }
                onBlur={(e) => {
                  if (fornecedor.tipo !== 'X') validarCnpjCpf(e.target.value);
                  onDocumentoBlur?.();
                }}
                required
                disabled={fornecedor.tipo === 'X'}
                className={fornecedor.tipo === 'J' ? 'pr-[68px]' : ''}
              />
              {fornecedor.tipo === 'J' && (
                <button
                  type="button"
                  onClick={() => onDocumentoBlur?.()}
                  className="absolute right-1.5 bottom-1.5 px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
                  title="Buscar dados do CNPJ na Receita Federal e verificar duplicidade"
                >
                  Buscar
                </button>
              )}
            </div>
            {(cnpjCpfError || error?.cpf_cgc) && (
              <p className="text-sm text-red-500 mt-1">
                {cnpjCpfError || error?.cpf_cgc}
              </p>
            )}
          </div>
          <div className={error?.tipoemp ? 'field-error' : ''}>
            <SelectInput
              name="tipoemp"
              label="Tipo Empresa"
              options={tipoEmpresaOptions}
              defaultValue={fornecedor.tipoemp || ''}
              onValueChange={(value) => handleFornecedorChange('tipoemp', value)}
              error={error?.tipoemp}
              required
            />
          </div>
          <div className={error?.codcf ? 'field-error' : ''}>
            <SelectInput searchable
              name="classefornecedor"
              label="Classe de Fornecedor"
              options={classesFornecedorOptions}
              defaultValue={fornecedor.codcf || ''}
              onValueChange={(value) => handleFornecedorChange('codcf', value)}
              onInputChange={(value) =>
                handleSearchOptionsChange('classeFornecedor', value)
              }
              error={error?.codcf}
              required
            />
          </div>
        </div>
        <div className={error?.nome ? 'field-error' : ''}>
          <FormInput
            name="nome"
            type="text"
            label="Nome"
            defaultValue={fornecedor.nome || ''}
            onChange={(e) => handleFornecedorChange('nome', e.target.value)}
            error={error?.nome}
            required
          />
        </div>
        <div className={error?.nome_fant ? 'field-error' : ''}>
          <FormInput
            name="nome_fant"
            type="text"
            label="Nome Fantasia"
            defaultValue={fornecedor.nome_fant || ''}
            onChange={(e) => handleFornecedorChange('nome_fant', e.target.value)}
            error={error?.nome_fant}
            required
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fornecedor.fabricante === 'S'}
              onChange={(e) => handleFornecedorChange('fabricante', e.target.checked ? 'S' : 'N')}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fabricante</span>
          </label>
        </div>
        <div className="flex gap-4 justify-between">
          <p className="text-gray-700 dark:text-gray-200 font-bold">
            ENDEREÇO PARA CORRESPONDÊNCIA
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className={error?.cep ? 'field-error' : ''}>
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
          </div>
          <div className={error?.ender ? 'field-error' : ''}>
            <FormInput
              name="endereco"
              type="text"
              label="Logradouro"
              defaultValue={fornecedor.endereco || ''}
              onChange={(e) => handleFornecedorChange('endereco', e.target.value)}
              error={error?.ender}
              required
            />
          </div>
          <div className={error?.numero ? 'field-error' : ''}>
            <FormInput
              name="numero"
              type="text"
              label="Número"
              defaultValue={fornecedor.numero || ''}
              onChange={(e) => handleFornecedorChange('numero', e.target.value)}
              error={error?.numero}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className={error?.bairro ? 'field-error' : ''}>
            <FormInput
              name="bairro"
              type="text"
              label="Bairro"
              defaultValue={fornecedor.bairro || ''}
              onChange={(e) => handleFornecedorChange('bairro', e.target.value)}
              error={error?.bairro}
              required
            />
          </div>
          <div className={error?.cidade ? 'field-error' : ''}>
            <FormInput
              name="cidade"
              type="text"
              label="Cidade"
              defaultValue={fornecedor.cidade || ''}
              onChange={(e) => handleFornecedorChange('cidade', e.target.value)}
              error={error?.cidade}
              required
            />
          </div>
          <div className={error?.uf ? 'field-error' : ''}>
            <FormInput
              name="uf"
              type="text"
              label="UF"
              defaultValue={fornecedor.uf || ''}
              onChange={(e) => handleFornecedorChange('uf', e.target.value)}
              error={error?.uf || municipioUfWarning}
              required
            />
          </div>
          <div className={error?.codpais ? 'field-error' : ''}>
            <SelectInput searchable
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
        <div>
          <p className="text-gray-700 dark:text-gray-200 font-bold mb-2">CONTATOS / TELEFONES</p>
          <FormInput
            name="contatos"
            type="text"
            label="Contato Principal"
            defaultValue={fornecedor.contatos || ''}
            onChange={(e) => handleFornecedorChange('contatos', e.target.value)}
            error={error?.contatos}
          />
          <div className="grid grid-cols-3 gap-4 mt-2">
            <FormInput
              name="fone1"
              type="text"
              label="Telefone 1"
              defaultValue={fornecedor.fone1 || ''}
              onChange={(e) => handleFornecedorChange('fone1', e.target.value)}
            />
            <FormInput
              name="fone2"
              type="text"
              label="Telefone 2"
              defaultValue={fornecedor.fone2 || ''}
              onChange={(e) => handleFornecedorChange('fone2', e.target.value)}
            />
            <FormInput
              name="email"
              type="email"
              label="E-mail"
              defaultValue={fornecedor.email || ''}
              onChange={(e) => handleFornecedorChange('email', e.target.value)}
            />
          </div>
        </div>
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
          <div className={error?.tipofornecedor ? 'field-error' : ''}>
            <SelectInput
              name="tipofornecedor"
              label="Tipo Fornecedor"
              options={tipoFornecedorOptions}
              defaultValue={fornecedor.tipofornecedor || ''}
              onValueChange={(value) =>
                handleFornecedorChange('tipofornecedor', value)
              }
              error={error?.tipofornecedor}
              required={fornecedor.tipo !== 'X'}
              disabled={fornecedor.tipo === 'X'}
            />
          </div>
          <FormInput
            name="codccontabil"
            type="text"
            label={`Conta Contábil${fornecedor.tipo === 'X' ? ' *' : ''}`}
            defaultValue={fornecedor.codccontabil || ''}
            onChange={(e) => handleFornecedorChange('codccontabil', e.target.value)}
            error={error?.codccontabil}
            required={fornecedor.tipo === 'X'}
          />
        </div>
      </div>
    </>
  );
};

export default DadosCadastrais;
