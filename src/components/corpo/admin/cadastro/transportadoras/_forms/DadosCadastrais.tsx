import React, { useState, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { buscaCep, ViaCepResponse } from '@/data/cep';
import { useToast } from '@/hooks/use-toast';
import { isValidCpfCnpj } from '@/utils/validacoes';

interface DadosCadastraisProps {
  transportadora: any;
  handleTransportadoraChange: (field: string, value: any) => void;
  error: { [key: string]: string };
}

export default function DadosCadastrais({
  transportadora,
  handleTransportadoraChange,
  error,
}: DadosCadastraisProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [resultCep, setResultCep] = useState<ViaCepResponse>(
    {} as ViaCepResponse,
  );
  const [cpfCnpjError, setCpfCnpjError] = useState<string>('');
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
            value={transportadora.tipo || 'JURIDICA'}
            onChange={(e) => handleTransportadoraChange('tipo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="JURIDICA">JURÍDICA</option>
            <option value="FISICA">FÍSICA</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="cpfcgc"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            CNPJ/CPF *
          </label>
          <input
            type="text"
            id="cpfcgc"
            value={transportadora.cpfcgc || ''}
            onChange={(e) => {
              const valor = e.target.value;
              const valorFormatado = formatarCpfCnpj(valor);
              handleTransportadoraChange('cpfcgc', valorFormatado);
              validarCpfCnpj(valor);
            }}
            onBlur={(e) => validarCpfCnpj(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            required
          />
          {(error.cpfcgc || cpfCnpjError) && (
            <p className="text-red-500 text-xs mt-1">
              {error.cpfcgc || cpfCnpjError}
            </p>
          )}
        </div>
      </div>

      {/* Código e Nome */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="codtransp"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Código *
          </label>
          <input
            type="text"
            id="codtransp"
            value={transportadora.codtransp || ''}
            onChange={(e) =>
              handleTransportadoraChange('codtransp', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={5}
            required
          />
          {error.codtransp && (
            <p className="text-red-500 text-xs mt-1">{error.codtransp}</p>
          )}
        </div>

        <div>
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
          {error.nome && (
            <p className="text-red-500 text-xs mt-1">{error.nome}</p>
          )}
        </div>
      </div>

      {/* Nome Fantasia */}
      <div>
        <label
          htmlFor="nomefant"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Nome Fantasia
        </label>
        <input
          type="text"
          id="nomefant"
          value={transportadora.nomefant || ''}
          onChange={(e) =>
            handleTransportadoraChange('nomefant', e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          maxLength={50}
        />
      </div>

      {/* Endereço para Correspondência */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
          Endereço para Correspondência
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label
              htmlFor="cep"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              CEP
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
            />
          </div>

          <div>
            <label
              htmlFor="ender"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Logradouro
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
            />
          </div>

          <div>
            <label
              htmlFor="numero"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Número
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
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="uf"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              UF
            </label>
            <input
              type="text"
              id="uf"
              value={transportadora.uf || ''}
              onChange={(e) => handleTransportadoraChange('uf', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              maxLength={2}
            />
          </div>

          <div>
            <label
              htmlFor="bairro"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Bairro
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
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="cidade"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Cidade
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
            />
          </div>

          <div>
            <label
              htmlFor="codpais"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              País
            </label>
            <input
              type="number"
              id="codpais"
              value={transportadora.codpais || ''}
              onChange={(e) =>
                handleTransportadoraChange('codpais', Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
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
            <option value="LTDA">LTDA</option>
            <option value="SA">S/A</option>
            <option value="EIRELI">EIRELI</option>
            <option value="MEI">MEI</option>
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
