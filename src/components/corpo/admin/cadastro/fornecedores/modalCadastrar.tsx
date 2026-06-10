import React, { useEffect, useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFinanceiros from './_forms/DadosFinanceiros';
import RegrasFaturamento from './_forms/RegrasFaturamento';
import { z } from 'zod';
import InfoModal from '@/components/common/infoModal';
import ModalFormulario from '@/components/common/modalform';
import { useDebouncedCallback } from 'use-debounce';
import { getPaises, Paises } from '@/data/paises/paises';
import { getBairroByDescricao } from '@/data/bairros/bairros';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { CircleCheck } from 'lucide-react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { campoParaAba } from './_forms/campoParaAba';
import { cadastroFornecedorSchema } from '@/data/fornecedores/schemas'; // Importa o novo schema
import {
  ClassesFornecedor,
  Fornecedor,
  getClassesFornecedor,
  insertFornecedor,
} from '@/data/fornecedores/fornecedores';

const tabs = [
  { name: 'Dados Cadastrais', key: 'dadosCadastrais' },
  { name: 'Dados Financeiros', key: 'dadosFinanceiros' },
  { name: 'Regras Faturamento', key: 'regraFaturamento' },
];

export type CadFornecedorSearchOptions = 'classeFornecedor' | 'pais';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CustomModal({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [fornecedor, setFornecedor] = useState({} as Fornecedor);
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);

  const [disableFields, setDisableFields] = useState({
    disableIm: false,
    disableIe: false,
    disableSuf: false,
    regraDiferenciada: false,
  });

  const [options, setOptions] = useState({
    classesFornecedor: {} as ClassesFornecedor,
    paises: {} as Paises,
  });

  const [searchOptions, setSearchOptions] = useState({
    classeFornecedor: '',
    pais: '',
  });

  const { toast } = useToast();

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);

  const camposObrigatoriosPorAba: Record<string, string[]> = {
    dadosCadastrais: ['nome', 'nome_fant', 'cpf_cgc', 'codcf', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'uf', 'codpais', 'tipoemp', 'tipofornecedor', 'tipo'],
    dadosFinanceiros: ['regime_tributacao'],
    regrasFaturamento: [],
  };

  const handleActiveTab = (tab: string) => {
    const camposAba = camposObrigatoriosPorAba[activeTab] || [];
    const camposPendentes = camposAba.filter((campo) => {
      // tipofornecedor só é obrigatório quando tipo !== 'X'
      if (campo === 'tipofornecedor' && fornecedor.tipo === 'X') return false;
      const valor = (fornecedor as any)[campo];
      return valor === undefined || valor === null || valor === '';
    });

    if (camposPendentes.length > 0) {
      setAbaPendente(tab);
      setModalConfirmAba(true);
      return;
    }

    setActiveTab(tab);
  };

  const handleFornecedorChange = useCallback(
    (field: keyof Fornecedor, value: any) => {
      setFornecedor((prev) => ({ ...prev, [field]: value }));

      setErrors((prev) => {
        const updatedErrors = { ...prev };
        delete updatedErrors[field as string];
        return updatedErrors;
      });
    },
    [],
  );

  const handleSearchOptionsChange = useDebouncedCallback(
    (option: CadFornecedorSearchOptions, value: string) => {
      setSearchOptions((prev) => ({ ...prev, [option]: value }));
    },
    300,
  );

  const handleClassesFornecedor = useCallback(async () => {
    const classesFornecedor = await getClassesFornecedor({
      page: 1,
      perPage: 999,
      search: searchOptions.classeFornecedor,
    });
    setOptions((prev) => ({ ...prev, classesFornecedor }));
    setLoading(false);
  }, [searchOptions.classeFornecedor]);

  const handlePaises = useCallback(async () => {
    const paises = await getPaises({
      page: 1,
      perPage: 999,
      search: searchOptions.pais,
    });
    setOptions((prev) => ({ ...prev, paises }));
    setLoading(false);
  }, [searchOptions.pais]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const classesFornecedor = await getClassesFornecedor({
          page: 1,
          perPage: 999,
          search: '',
        });
        const paises = await getPaises({
          page: 1,
          perPage: 999,
          search: '',
        });
        setOptions({ classesFornecedor, paises });
      } catch (error) {
        console.error('Erro ao buscar dados iniciais:', error);
      } finally {
        setLoading(false);
      }
    };

    if (searchOptions.classeFornecedor) handleClassesFornecedor();
    else if (searchOptions.pais) handlePaises();
    else fetchInitialData();
  }, [searchOptions, handlePaises, handleClassesFornecedor]);

  const handleClear = () => setFornecedor({} as Fornecedor);

  const handleBairroAndUpdateFornecedor = async () => {
    const bairro = await getBairroByDescricao(fornecedor.bairro);
    if (bairro) {
      setFornecedor((prev) => ({
        ...prev,
        codbairro: bairro.codbairro,
        codmunicipio: bairro.municipio?.codmunicipio ?? '',
      }));
    }
  };

  const setDisable = (
    field: 'disableIm' | 'disableIe' | 'disableSuf' | 'regraDiferenciada',
    value: boolean,
  ) => {
    setDisableFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      console.log(
        '🚀 Iniciando processo de cadastro do fornecedor...',
        fornecedor,
      );

      const isentoIm = disableFields.disableIm;
      const isentoIe = disableFields.disableIe;
      const isentoSuf = disableFields.disableSuf;

      if (isentoIm) fornecedor.imun = 'ISENTO';
      if (isentoIe) fornecedor.iest = 'ISENTO';
      if (isentoSuf) fornecedor.isuframa = 'ISENTO';

      // ✅ CORREÇÃO: Tratando campos que podem ser null antes da validação
      console.log('🔧 Tratando campos opcionais que podem ser null...');

      // Criar uma cópia do fornecedor para tratamento
      const fornecedorParaValidacao = { ...fornecedor };

      // Converter valores null para string vazia nos campos obrigatórios
      if (
        fornecedorParaValidacao.tipofornecedor === null ||
        fornecedorParaValidacao.tipofornecedor === undefined
      ) {
        console.log(
          '⚠️ Campo tipofornecedor era null, definindo como string vazia',
        );
        fornecedorParaValidacao.tipofornecedor = '';
      }

      if (
        fornecedorParaValidacao.codcf === null ||
        fornecedorParaValidacao.codcf === undefined
      ) {
        console.log('⚠️ Campo codcf era null, definindo como string vazia');
        fornecedorParaValidacao.codcf = '';
      }

      // Outros campos que podem ser problemáticos
      const camposParaTratarComoString = [
        'nome',
        'nome_fant',
        'endereco',
        'cidade',
        'uf',
        'bairro',
        'cep',
        'numero',
        'complemento',
        'referencia',
        'contatos',
        'tipo',
        'tipoemp',
        'cpf_cgc',
      ];

      camposParaTratarComoString.forEach((campo) => {
        if (
          fornecedorParaValidacao[campo as keyof Fornecedor] === null ||
          fornecedorParaValidacao[campo as keyof Fornecedor] === undefined
        ) {
          console.log(
            `⚠️ Campo ${campo} era null, definindo como string vazia`,
          );
          (fornecedorParaValidacao as any)[campo] = '';
        }
      });

      console.log('🔍 Dados tratados para validação:', {
        tipofornecedor: fornecedorParaValidacao.tipofornecedor,
        codcf: fornecedorParaValidacao.codcf,
        nome: fornecedorParaValidacao.nome,
        tipo: fornecedorParaValidacao.tipo,
        cpf_cgc: fornecedorParaValidacao.cpf_cgc,
      });

      // Validação: Exterior exige Conta Contábil
      if (fornecedorParaValidacao.tipo === 'X' && !fornecedorParaValidacao.codccontabil) {
        toast({ description: 'Conta Contábil é obrigatória para fornecedor Exterior.', variant: 'destructive' });
        setActiveTab('dadosCadastrais');
        return;
      }

      // Validação: PIS/COFINS quando regra diferenciada ativa
      if (disableFields.regraDiferenciada) {
        const piscofinsVazios = [
          fornecedorParaValidacao.piscofins_365,
          fornecedorParaValidacao.piscofins_925,
          fornecedorParaValidacao.piscofins_1150,
          fornecedorParaValidacao.piscofins_1310,
        ].some((v) => v === undefined || v === null || v === '');

        if (piscofinsVazios) {
          toast({ description: 'Todos os campos PIS/COFINS são obrigatórios quando a regra diferenciada está ativa.', variant: 'destructive' });
          setActiveTab('regrasFaturamento');
          return;
        }
      }

      // Validar dados antes de enviar
      console.log('🔍 Validando dados do fornecedor...');
      try {
        cadastroFornecedorSchema.parse({
          ...fornecedorParaValidacao,
          imun: { isentoIm, imun: fornecedorParaValidacao.imun },
          iest: { isentoIe, iest: fornecedorParaValidacao.iest },
          isuframa: { isentoSuf, isuframa: fornecedorParaValidacao.isuframa },
        });
        console.log('✅ Validação de dados bem-sucedida');
      } catch (validationError) {
        console.error('❌ Erro de validação:', validationError);
        throw validationError; // Re-throw para ser capturado pelo catch principal
      }

      // Verificar duplicidade de CPF/CNPJ antes de salvar (conforme Delphi)
      if (fornecedorParaValidacao.cpf_cgc && fornecedorParaValidacao.cpf_cgc !== 'EXTERIOR') {
        try {
          const dupResp = await fetch(`/api/fornecedores/verificar-duplicidade?cpf_cgc=${encodeURIComponent(fornecedorParaValidacao.cpf_cgc)}`);
          const dupData = await dupResp.json();
          if (dupData.existe) {
            toast({
              description: `CPF/CNPJ já cadastrado para o fornecedor "${dupData.fornecedor.nome}" (código: ${dupData.fornecedor.cod_credor}).`,
              variant: 'destructive',
            });
            setActiveTab('dadosCadastrais');
            return;
          }
        } catch (dupError) {
          console.error('Erro ao verificar duplicidade:', dupError);
        }
      }

      console.log('🏠 Processando dados do bairro...');
      await handleBairroAndUpdateFornecedor();

      console.log('💾 Enviando dados para a API...');
      // Usar os dados tratados para envio
      const resultadoInsercao = await insertFornecedor(fornecedorParaValidacao);
      console.log('✅ Fornecedor cadastrado com sucesso:', resultadoInsercao);

      setErrors({});
      setMensagemInfo('Fornecedor cadastrado com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      // ✅ CORREÇÃO: Tratamento de erros melhorado com logs detalhados
      console.error('❌ Erro detalhado ao cadastrar fornecedor:', {
        error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        fornecedor: fornecedor,
      });

      if (error instanceof z.ZodError) {
        console.error('❌ Erro de validação Zod:', error.errors);

        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as string;
            fieldErrors[fieldName] = err.message;
            console.error(`❌ Campo com erro: ${fieldName} - ${err.message}`);
          }
        });

        // Ordenar erros pela sequência das abas
        const tabOrder = ['dadosCadastrais', 'dadosFinanceiros', 'regrasFaturamento'];
        const sortedErrors = [...error.errors].sort((a, b) => {
          const tabA = tabOrder.indexOf(campoParaAba[String(a.path[0])] || '');
          const tabB = tabOrder.indexOf(campoParaAba[String(b.path[0])] || '');
          return tabA - tabB;
        });
        const firstError = sortedErrors[0];
        const fieldWithError = firstError.path[0];
        const abaDoErro = campoParaAba[fieldWithError as string];

        if (abaDoErro) {
          console.log(
            `🔄 Mudando para aba: ${abaDoErro} devido ao erro no campo: ${fieldWithError}`,
          );
          setActiveTab(abaDoErro);
          setTimeout(() => {
            const el = document.getElementById(fieldWithError);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLInputElement).focus();
            }
          }, 100);
        }

        setErrors(fieldErrors);

        // Mostrar toast com o primeiro erro encontrado
        toast({
          description: `Erro de validação: ${firstError.message}`,
          variant: 'destructive',
        });
      } else {
        // ✅ CORREÇÃO: Tratamento melhorado para erros da API
        let errorMessage = 'Erro desconhecido ao cadastrar fornecedor.';

        if (error instanceof Error) {
          errorMessage = error.message;
          console.error('❌ Erro da API ou sistema:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        } else if (typeof error === 'string') {
          errorMessage = error;
          console.error('❌ Erro como string:', error);
        } else {
          console.error('❌ Erro de tipo desconhecido:', error);
        }

        toast({
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  const handleCloseInfoModal = () => {
    setOpenInfo(false);
    onClose();
    onSuccess?.(); // <-- chama onSuccess após o fechamento do modal de sucesso
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dadosCadastrais':
        return (
          <DadosCadastrais
            fornecedor={fornecedor}
            handleFornecedorChange={handleFornecedorChange}
            error={errors}
            setDisable={setDisable}
            disableFields={disableFields}
            options={options}
            handleSearchOptionsChange={handleSearchOptionsChange}
          />
        );
      case 'dadosFinanceiros':
        return (
          <DadosFinanceiros
            fornecedor={fornecedor}
            handleFornecedorChange={handleFornecedorChange}
            error={errors}
          />
        );
      case 'regraFaturamento':
        return (
          <RegrasFaturamento
            fornecedor={fornecedor}
            handleFornecedorChange={handleFornecedorChange}
            error={errors}
            setDisable={setDisable}
            disableFields={disableFields}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div>
      <ModalFormulario
        titulo="Cadastro de Fornecedor"
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={handleActiveTab}
        renderTabContent={renderTabContent}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        onClose={onClose}
        loading={loading}
      />
      <InfoModal
        isOpen={openInfo}
        onClose={handleCloseInfoModal}
        title="INFORMAÇÃO IMPORTANTE"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <Toaster />

      {/* Modal de confirmação ao trocar aba com campos pendentes */}
      <ConfirmationModal
        isOpen={modalConfirmAba}
        onClose={() => {
          setModalConfirmAba(false);
          setAbaPendente(null);
        }}
        onConfirm={() => {
          setModalConfirmAba(false);
          if (abaPendente) {
            setActiveTab(abaPendente);
            setAbaPendente(null);
          }
        }}
        title="Campos obrigatórios pendentes"
        message={`Existem campos obrigatórios não preenchidos na aba "${tabs.find((t) => t.key === activeTab)?.name || activeTab}". Deseja prosseguir mesmo assim?`}
        type="warning"
        confirmText="Prosseguir"
        cancelText="Voltar e corrigir"
      />
    </div>
  );
}
