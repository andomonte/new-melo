// src/pages/cadastro/armazens/_forms/modalFormCadastrarArmazem.tsx

import React, { useEffect, useState } from 'react';
import { Armazem } from '@/data/armazem/armazens';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import CheckInput from '@/components/common/CheckInput';
import SelectInput from '@/components/common/SelectInput';
import {
  getTodasFiliais,
  Filial,
  TodasFiliaisResponse,
} from '@/data/filiais/filiais';

import { getAllInscricoesEstaduais } from '@/data/inscricoesEstaduais/inscricoesEstaduais';
import { parseISO, format } from 'date-fns';

interface FormArmazemContainerProps {
  titulo: string;
  onClose: () => void;
  armazem: Partial<Armazem>; // Partial para cadastro, pois id_armazem pode não existir inicialmente
  isSaving?: boolean;
  error?: { [P in keyof Armazem]?: string };
  handleArmazemChange: (armazem: Armazem) => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
}

const ModalFormCadastrarArmazem: React.FC<FormArmazemContainerProps> = ({
  titulo,
  isSaving,
  handleSubmit,
  handleClear,
  onClose,
  armazem,
  error,
  handleArmazemChange,
  loading = false,
}) => {
  const [filiaisOptions, setFiliaisOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [inscricaoEstadualOptions, setInscricaoEstadualOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingFiliais, setLoadingFiliais] = useState(true);
  const [loadingInscricaoEstadual, setLoadingInscricaoEstadual] =
    useState(true);
  const [errorLoadingFiliais, setErrorLoadingFiliais] = useState<string | null>(
    null,
  );
  const [errorLoadingInscricaoEstadual, setErrorLoadingInscricaoEstadual] =
    useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);

  // Efeito para carregar as filiais
  useEffect(() => {
    const fetchFiliais = async () => {
      setLoadingFiliais(true);
      setErrorLoadingFiliais(null);
      try {
        const response: TodasFiliaisResponse = await getTodasFiliais();
        const data: Filial[] = response.data;
        const options = data.map((filial) => ({
          value: String(filial.codigo_filial),
          label: filial.nome_filial,
        }));
        setFiliaisOptions(options);
      } catch (err) {
        console.error('Falha ao carregar filiais:', err);
        setErrorLoadingFiliais('Não foi possível carregar as filiais.');
      } finally {
        setLoadingFiliais(false);
      }
    };
    fetchFiliais();
  }, []);

  // Efeito para carregar as inscrições estaduais de db_ie
  useEffect(() => {
    const fetchInscricoesEstaduais = async () => {
      setLoadingInscricaoEstadual(true);
      setErrorLoadingInscricaoEstadual(null);
      try {
        console.log('🔍 Buscando inscrições estaduais de db_ie...');
        // ✅ Busca TODAS as inscrições estaduais de db_ie (CGC + IE)
        const inscricoes = await getAllInscricoesEstaduais();

        console.log('📦 Inscrições recebidas:', inscricoes);

        const options = inscricoes
          .filter(
            (ie) =>
              ie.inscricaoestadual !== null &&
              ie.inscricaoestadual !== undefined &&
              ie.inscricaoestadual !== '',
          )
          .map((ie) => ({
            value: ie.inscricaoestadual,
            label: `${ie.inscricaoestadual} - ${ie.nomecontribuinte || ''}`,
          }));

        console.log('✅ Opções de IE montadas:', options);
        setInscricaoEstadualOptions(options);
      } catch (err) {
        console.error('❌ Falha ao carregar inscrições estaduais:', err);
        setErrorLoadingInscricaoEstadual(
          'Não foi possível carregar as inscrições estaduais.',
        );
      } finally {
        setLoadingInscricaoEstadual(false);
      }
    };
    fetchInscricoesEstaduais();
  }, []);

  // Função para buscar CEP
  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      if (!response.ok) {
        throw new Error('Falha ao buscar CEP');
      }
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }

      handleArmazemChange({
        ...(armazem as Armazem),
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        municipio: data.localidade || '',
        uf: data.uf || '',
        cep: cleanCep,
      });
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      handleArmazemChange({
        ...(armazem as Armazem),
        logradouro: '',
        bairro: '',
        municipio: '',
        uf: '',
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let updatedArmazem = { ...(armazem as Armazem), [name]: value };

    if (name === 'nome') {
      updatedArmazem = {
        ...updatedArmazem,
        // Mantém a lógica de ID do armazém baseada no nome
        id_armazem: Number(
          value.substring(0, 10).toUpperCase().replace(/\s+/g, ''),
        ),
      };
    }

    handleArmazemChange(updatedArmazem);

    if (name === 'cep') {
      if (value.replace(/\D/g, '').length === 8) {
        fetchAddressByCep(value);
      }
    }
  };

  const handleFilialChange = (selectedValue: string) => {
    // Encontrar o label (nome da filial) correspondente ao value (código) selecionado
    const selectedFilialOption = filiaisOptions.find(
      (option) => option.value === selectedValue,
    );

    // Se encontrou, atualiza o armazém com o label (nome da filial)
    if (selectedFilialOption) {
      const updatedArmazem = {
        ...(armazem as Armazem),
        filial: selectedFilialOption.label, // SALVA O LABEL (NOME)
      };
      handleArmazemChange(updatedArmazem);
    } else {
      // Se por algum motivo não encontrou, pode ser que o valor tenha sido limpo ou seja inválido
      const updatedArmazem = {
        ...(armazem as Armazem),
        filial: null,
      };
      handleArmazemChange(updatedArmazem);
    }
  };

  // Função para lidar com a mudança da Inscrição Estadual
  const handleInscricaoEstadualChange = (value: string) => {
    const updatedArmazem = {
      ...(armazem as Armazem),
      inscricaoestadual: value,
    };
    handleArmazemChange(updatedArmazem);
  };

  const handleCheckInputChange = (e: {
    target: { name: string; checked: boolean };
  }) => {
    const { name, checked } = e.target;
    const updatedArmazem = { ...(armazem as Armazem), [name]: checked };
    handleArmazemChange(updatedArmazem);
  };

  // Determina o valor da inscrição estadual atual para o SelectInput
  const currentInscricaoEstadualValue =
    (inscricaoEstadualOptions || []).find(
      (option) => option.value === armazem.inscricaoestadual,
    )?.value || '';

  // O defaultValue do SelectInput de filial para o cadastro:
  // Como `armazem.filial` agora conterá o NOME, precisamos encontrar o CÓDIGO (value)
  // correspondente para que o SelectInput exiba a opção correta.
  const currentFilialValue =
    (filiaisOptions || []).find((option) => option.label === armazem.filial)
      ?.value || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[96vw] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter
              onSubmit={handleSubmit}
              onClear={handleClear}
              isSaving={isSaving}
              hasChanges={
                Object.keys(armazem).length > 0 &&
                (armazem.nome || armazem.id_armazem)
                  ? true
                  : false
              }
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          {/* Lógica de carregamento e erro atualizada para incluir Inscrição Estadual */}
          {loading ||
          loadingFiliais ||
          loadingCep ||
          loadingInscricaoEstadual ? (
            <Carregamento />
          ) : errorLoadingFiliais ? (
            <p className="text-red-500 text-center">{errorLoadingFiliais}</p>
          ) : errorLoadingInscricaoEstadual ? (
            <p className="text-red-500 text-center">
              {errorLoadingInscricaoEstadual}
            </p>
          ) : (
            <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 mx-auto">
              {/* --- CAMPOS GERAIS --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="nome"
                  type="text"
                  label="Nome Armazém"
                  defaultValue={armazem.nome || ''}
                  onChange={handleChange}
                  error={error?.nome}
                  required
                />
                <SelectInput
                  label="Filial"
                  name="filial"
                  options={filiaisOptions}
                  onValueChange={handleFilialChange} // Usa a nova função
                  defaultValue={currentFilialValue} // Usa o valor derivado do nome da filial
                  error={error?.filial}
                  required
                  disabled={
                    loadingFiliais || (filiaisOptions || []).length === 0
                  }
                />
                <SelectInput
                  label="Inscrição Estadual"
                  name="inscricaoestadual"
                  options={inscricaoEstadualOptions}
                  onValueChange={handleInscricaoEstadualChange}
                  defaultValue={currentInscricaoEstadualValue}
                  error={error?.inscricaoestadual}
                  disabled={loadingInscricaoEstadual}
                />
                <CheckInput
                  label="Ativo"
                  name="ativo"
                  checked={armazem.ativo ?? true} // Geralmente ativo por padrão no cadastro
                  onChange={handleCheckInputChange}
                  error={error?.ativo}
                />
              </div>

              <hr className="my-8 border-gray-300 dark:border-gray-600" />

              {/* --- CAMPOS DE ENDEREÇO --- */}
              <h5 className="text-lg font-semibold text-[#347AB6] dark:text-gray-200 mb-4">
                Dados de Endereço
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="cep"
                  type="text"
                  label="CEP"
                  defaultValue={armazem.cep || ''}
                  onChange={handleChange}
                  error={error?.cep}
                  maxLength={9}
                />
                <FormInput
                  autoComplete="off"
                  name="logradouro"
                  type="text"
                  label="Logradouro"
                  defaultValue={armazem.logradouro || ''}
                  onChange={handleChange}
                  error={error?.logradouro}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="numero"
                  type="text"
                  label="Número"
                  defaultValue={armazem.numero || ''}
                  onChange={handleChange}
                  error={error?.numero}
                />
                <FormInput
                  autoComplete="off"
                  name="complemento"
                  type="text"
                  label="Complemento"
                  defaultValue={armazem.complemento || ''}
                  onChange={handleChange}
                  error={error?.complemento}
                />
                <FormInput
                  autoComplete="off"
                  name="bairro"
                  type="text"
                  label="Bairro"
                  defaultValue={armazem.bairro || ''}
                  onChange={handleChange}
                  error={error?.bairro}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="municipio"
                  type="text"
                  label="Município"
                  defaultValue={armazem.municipio || ''}
                  onChange={handleChange}
                  error={error?.municipio}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="uf"
                  type="text"
                  label="UF"
                  defaultValue={armazem.uf || ''}
                  onChange={handleChange}
                  error={error?.uf}
                  maxLength={2}
                  disabled={loadingCep}
                />
              </div>

              {/* Campo Data de Cadastro geralmente não é visível no cadastro, mas mantido se for o caso */}
              {armazem.data_cadastro && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                  <FormInput
                    autoComplete="off"
                    label="Data de Cadastro"
                    name="data_cadastro"
                    type="text"
                    defaultValue={
                      armazem.data_cadastro
                        ? format(
                            parseISO(armazem.data_cadastro),
                            'dd/MM/yyyy HH:mm:ss',
                          )
                        : ''
                    }
                    disabled
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalFormCadastrarArmazem;
