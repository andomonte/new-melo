import React, { useState, useRef, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { buscaCep, ViaCepResponse } from '@/data/cep';
import { useToast } from '@/hooks/use-toast';
import { isValidCpfCnpj } from '@/utils/validacoes';
import { formatarDocumento } from '@/utils/mascaraDocumento';
import { CountryCombobox } from '@/components/common/CountryCombobox';

// Mapeamento UF -> código IBGE (primeiros 2 dígitos do código de município)
const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
  MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
  RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};

interface DadosCadastraisProps {
  transportadora: any;
  handleTransportadoraChange: (field: string, value: any) => void;
  error: { [key: string]: string };
  /** Chamado ao sair do campo CNPJ/CPF — busca duplicidade e auto-preenche */
  onDocumentoBlur?: () => void;
}

export default function DadosCadastrais({
  transportadora,
  handleTransportadoraChange,
  error,
  onDocumentoBlur,
}: DadosCadastraisProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [resultCep, setResultCep] = useState<ViaCepResponse>(
    {} as ViaCepResponse,
  );
  const [cpfCnpjError, setCpfCnpjError] = useState<string>('');
  const [municipioUfWarning, setMunicipioUfWarning] = useState<string>('');
  const [isentoIE, setIsentoIE] = useState(false);
  const [isentoSuframa, setIsentoSuframa] = useState(false);
  const [isentoMunicipal, setIsentoMunicipal] = useState(false);
  const { toast } = useToast();
  const cepRef = useRef<HTMLInputElement>(null);

  // Função para validar CPF/CNPJ
  const validarCpfCnpj = (value: string) => {
    if (!value) {
      setCpfCnpjError('');
      return true;
    }
    if (!isValidCpfCnpj(value)) {
      setCpfCnpjError('CPF ou CNPJ inválido');
      return false;
    }
    setCpfCnpjError('');
    return true;
  };

  // Função para aplicar máscara de CPF/CNPJ
  const formatarCpfCnpj = (value: string) => {
    const numeros = value.replace(/\D/g, '');
    if (numeros.length <= 11) {
      // CPF
      return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      // CNPJ
      return numeros.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5',
      );
    }
  };

  // Função para buscar CEP
  const handleCepSearch = useDebouncedCallback(() => {
    getResultCep();
  }, 1000);

  const getResultCep = async () => {
    if (transportadora.cep && transportadora.cep.length >= 8) {
      try {
        const resultado = await buscaCep(transportadora.cep);
        setResultCep(resultado);

        // Preencher automaticamente os campos
        if (resultado.logradouro) {
          handleTransportadoraChange('ender', resultado.logradouro);
        }
        if (resultado.bairro) {
          handleTransportadoraChange('bairro', resultado.bairro);
        }
        if (resultado.localidade) {
          handleTransportadoraChange('cidade', resultado.localidade);
        }
        if (resultado.uf) {
          handleTransportadoraChange('uf', resultado.uf);
        }
        // CEP válido = endereço no Brasil → preenche o País (igual cliente/fornecedor)
        if (resultado.uf || resultado.localidade) {
          handleTransportadoraChange('codpais', 1058);
        }
      } catch (error) {
        toast({
          description: `${(error as Error).message || 'Erro ao buscar CEP'}`,
          variant: 'destructive',
        });
        cepRef.current?.focus();
        cepRef.current?.select();
      }
    }
  };
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

  // Validar município x UF sempre que um deles mudar
  useEffect(() => {
    if (transportadora.codmunicipio && transportadora.uf) {
      validarMunicipioUf(String(transportadora.codmunicipio), transportadora.uf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportadora.codmunicipio, transportadora.uf]);

  return (
    <div className="space-y-6 overflow-y-auto">
      {/* Tipo Pessoa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="tipo"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Tipo Pessoa
          </label>
          <select
            id="tipo"
            value={transportadora.tipo || 'J'}
            onChange={(e) => handleTransportadoraChange('tipo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="J">JURÍDICA</option>
            <option value="F">FÍSICA</option>
            <option value="X">X-EXTERIOR</option>
          </select>
        </div>

        <div className={error.cpfcgc || cpfCnpjError ? 'field-error' : ''}>
          <label
            htmlFor="cpfcgc"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {transportadora.tipo === 'F'
              ? 'CPF'
              : transportadora.tipo === 'X'
              ? 'Documento'
              : 'CNPJ'}{' '}
            *
          </label>
          <div className="relative">
            <input
              type="text"
              id="cpfcgc"
              value={transportadora.cpfcgc || ''}
              onChange={(e) => {
                const valorFormatado = formatarDocumento(
                  e.target.value,
                  transportadora.tipo,
                );
                handleTransportadoraChange('cpfcgc', valorFormatado);
                if (transportadora.tipo !== 'X') validarCpfCnpj(valorFormatado);
              }}
              onBlur={(e) => {
                if (transportadora.tipo !== 'X') validarCpfCnpj(e.target.value);
                onDocumentoBlur?.();
              }}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                transportadora.tipo === 'J' ? 'pr-[68px]' : ''
              }`}
              maxLength={20}
              placeholder={
                transportadora.tipo === 'F'
                  ? '000.000.000-00'
                  : transportadora.tipo === 'X'
                  ? 'Documento'
                  : '00.000.000/0000-00'
              }
              required
            />
            {transportadora.tipo === 'J' && (
              <button
                type="button"
                onClick={() => onDocumentoBlur?.()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
                title="Buscar dados do CNPJ na Receita Federal e verificar duplicidade"
              >
                Buscar
              </button>
            )}
          </div>
          {(error.cpfcgc || cpfCnpjError) && (
            <p className="text-red-500 text-xs mt-1">
              {error.cpfcgc || cpfCnpjError}
            </p>
          )}
        </div>
      </div>

      {/* Nome (o Código é gerado automaticamente no banco, invisível ao usuário) */}
      <div className={error.nome ? 'field-error' : ''}>
        <label
          htmlFor="nome"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Nome *
        </label>
        <input
          type="text"
          id="nome"
          value={transportadora.nome || ''}
          onChange={(e) => handleTransportadoraChange('nome', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          maxLength={50}
          required
        />
        {error.nome && <p className="text-red-500 text-xs mt-1">{error.nome}</p>}
      </div>

      {/* Nome Fantasia */}
      <div className={error.nomefant ? 'field-error' : ''}>
        <label
          htmlFor="nomefant"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Nome Fantasia<span className="text-red-500"> *</span>
        </label>
        <input
          type="text"
          id="nomefant"
          value={transportadora.nomefant || ''}
          onChange={(e) =>
            handleTransportadoraChange('nomefant', e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          maxLength={40}
          required
        />
        {error.nomefant && (
          <p className="text-red-500 text-xs mt-1">{error.nomefant}</p>
        )}
      </div>

      {/* Endereço para Correspondência */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
          Endereço para Correspondência
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className={error.cep ? 'field-error' : ''}>
            <label
              htmlFor="cep"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              CEP<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              id="cep"
              ref={cepRef}
              value={transportadora.cep || ''}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '');
                const valorFormatado = valor.replace(/(\d{5})(\d{3})/, '$1-$2');
                handleTransportadoraChange('cep', valorFormatado);
                handleCepSearch();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={9}
              placeholder="00000-000"
              required
            />
            {error.cep && (
              <p className="text-red-500 text-xs mt-1">{error.cep}</p>
            )}
          </div>

          <div className={error.ender ? 'field-error' : ''}>
            <label
              htmlFor="ender"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Logradouro<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              id="ender"
              value={transportadora.ender || ''}
              onChange={(e) =>
                handleTransportadoraChange('ender', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={100}
              required
            />
            {error.ender && (
              <p className="text-red-500 text-xs mt-1">{error.ender}</p>
            )}
          </div>

          <div className={error.numero ? 'field-error' : ''}>
            <label
              htmlFor="numero"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Número<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              id="numero"
              value={transportadora.numero || ''}
              onChange={(e) =>
                handleTransportadoraChange('numero', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={60}
              required
            />
            {error.numero && (
              <p className="text-red-500 text-xs mt-1">{error.numero}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className={error.uf ? 'field-error' : ''}>
            <label
              htmlFor="uf"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              UF<span className="text-red-500"> *</span>
            </label>
            {/* TODO: quando UF='EX' (Exterior), pular validação de CNPJ/CPF e setar codmunicipio='9999999' (conforme Delphi) */}
            <input
              type="text"
              id="uf"
              value={transportadora.uf || ''}
              onChange={(e) => handleTransportadoraChange('uf', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={2}
              placeholder="Ex: SP, RJ, EX"
              required
            />
            {(error.uf || municipioUfWarning) && (
              <p className="text-red-500 text-xs mt-1">{error.uf || municipioUfWarning}</p>
            )}
          </div>

          <div className={error.bairro ? 'field-error' : ''}>
            <label
              htmlFor="bairro"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Bairro<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              id="bairro"
              value={transportadora.bairro || ''}
              onChange={(e) =>
                handleTransportadoraChange('bairro', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={100}
              required
            />
            {error.bairro && (
              <p className="text-red-500 text-xs mt-1">{error.bairro}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className={error.cidade ? 'field-error' : ''}>
            <label
              htmlFor="cidade"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Cidade<span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              id="cidade"
              value={transportadora.cidade || ''}
              onChange={(e) =>
                handleTransportadoraChange('cidade', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={100}
              required
            />
            {error.cidade && (
              <p className="text-red-500 text-xs mt-1">{error.cidade}</p>
            )}
          </div>

          <div className={error.codpais ? 'field-error' : ''}>
            <label
              htmlFor="codpais"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              País<span className="text-red-500"> *</span>
            </label>
            <CountryCombobox
              value={transportadora.codpais || undefined}
              onChange={(v) =>
                handleTransportadoraChange('codpais', Number(v))
              }
            />
            {error.codpais && (
              <p className="text-red-500 text-xs mt-1">{error.codpais}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="complemento"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Complemento
          </label>
          <input
            type="text"
            id="complemento"
            value={transportadora.complemento || ''}
            onChange={(e) =>
              handleTransportadoraChange('complemento', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={100}
          />
        </div>
      </div>

      {/* Referência */}
      <div>
        <label
          htmlFor="referencia"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Referência
        </label>
        <textarea
          id="referencia"
          value={transportadora.referencia || ''}
          onChange={(e) =>
            handleTransportadoraChange('referencia', e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          rows={3}
        />
      </div>

      {/* Tipo Empresa e Contatos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="tipoemp"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Tipo Empresa
          </label>
          <select
            id="tipoemp"
            value={transportadora.tipoemp || ''}
            onChange={(e) =>
              handleTransportadoraChange('tipoemp', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Selecione...</option>
            <option value="EPP">EPP - Empresa de Pequeno Porte</option>
            <option value="EP">EP - Empresa de Pequeno Porte</option>
            <option value="EF">EF - Empresa Filial</option>
            <option value="ME">ME - Microempresa</option>
            <option value="NL">NL - Normal</option>
            <option value="PF">PF - Pessoa Física</option>
            <option value="MEI">MEI - Microempreendedor Individual</option>
            <option value="EI">EI - Empresário Individual</option>
            <option value="LTDA">LTDA - Sociedade Limitada</option>
            <option value="SLU">SLU - Sociedade Limitada Unipessoal</option>
            <option value="S/S">S/S - Sociedade Simples</option>
            <option value="S/A">S/A - Sociedade Anônima</option>
            <option value="MGP">MGP - Empresa de Médio e Grande Porte</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="contatos"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Contatos
          </label>
          <input
            type="text"
            id="contatos"
            value={transportadora.contatos || ''}
            onChange={(e) =>
              handleTransportadoraChange('contatos', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={50}
          />
        </div>
      </div>

      {/* Inscrições */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="isento_ie"
              className="mr-2"
              checked={isentoIE}
              onChange={(e) => {
                setIsentoIE(e.target.checked);
                if (e.target.checked) {
                  handleTransportadoraChange('iest', '');
                }
              }}
            />
            <label
              htmlFor="isento_ie"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Isento?
            </label>
          </div>
          <label
            htmlFor="iest"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Inscrição Estadual {!isentoIE && '*'}
          </label>
          <input
            type="text"
            id="iest"
            value={transportadora.iest || ''}
            onChange={(e) => handleTransportadoraChange('iest', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
            disabled={isentoIE}
            required={!isentoIE}
          />
          {error.iest && (
            <p className="text-red-500 text-xs mt-1">{error.iest}</p>
          )}
        </div>

        <div>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="isento_suframa"
              className="mr-2"
              checked={isentoSuframa}
              onChange={(e) => {
                setIsentoSuframa(e.target.checked);
                if (e.target.checked) {
                  handleTransportadoraChange('isuframa', '');
                }
              }}
            />
            <label
              htmlFor="isento_suframa"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Isento?
            </label>
          </div>
          <label
            htmlFor="isuframa"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Inscrição Suframa {!isentoSuframa && '*'}
          </label>
          <input
            type="text"
            id="isuframa"
            value={transportadora.isuframa || ''}
            onChange={(e) =>
              handleTransportadoraChange('isuframa', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
            disabled={isentoSuframa}
            required={!isentoSuframa}
          />
          {error.isuframa && (
            <p className="text-red-500 text-xs mt-1">{error.isuframa}</p>
          )}
        </div>

        <div>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="isento_municipal"
              className="mr-2"
              checked={isentoMunicipal}
              onChange={(e) => {
                setIsentoMunicipal(e.target.checked);
                if (e.target.checked) {
                  handleTransportadoraChange('imun', '');
                }
              }}
            />
            <label
              htmlFor="isento_municipal"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Isento?
            </label>
          </div>
          <label
            htmlFor="imun"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Inscrição Municipal {!isentoMunicipal && '*'}
          </label>
          <input
            type="text"
            id="imun"
            value={transportadora.imun || ''}
            onChange={(e) => handleTransportadoraChange('imun', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
            disabled={isentoMunicipal}
            required={!isentoMunicipal}
          />
          {error.imun && (
            <p className="text-red-500 text-xs mt-1">{error.imun}</p>
          )}
        </div>
      </div>
    </div>
  );
}
