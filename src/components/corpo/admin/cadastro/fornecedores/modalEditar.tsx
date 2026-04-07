import React, { useEffect, useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFinanceiros from './_forms/DadosFinanceiros';
import { campoParaAba } from './_forms/campoParaAba';
import RegrasFaturamento from './_forms/RegrasFaturamento';
import { z } from 'zod';
import {
  ClassesFornecedor,
  Fornecedor,
  getClassesFornecedor,
  getFornecedor,
  updateFornecedor,
} from '@/data/fornecedores/fornecedores';
import { edicaoFornecedorSchema } from '@/data/fornecedores/schemas';
import Carregamento from '@/utils/carregamento';
import { getBairroByDescricao } from '@/data/bairros/bairros';
import { useDebouncedCallback } from 'use-debounce';
import { CadFornecedorSearchOptions } from './modalCadastrar';
import { getPaises, Paises } from '@/data/paises/paises';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import ModalForm from '@/components/common/modalform';
import InfoModal from '@/components/common/infoModal';
import { CircleCheck } from 'lucide-react';

const tabs = [
  { name: 'Dados Cadastrais', key: 'dadosCadastrais' },
  { name: 'Dados Financeiros', key: 'dadosFinanceiros' },
  { name: 'Regras Faturamento', key: 'regraFaturamento' },
];

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  fornecedorId: string;
}

export default function CustomModal({
  isOpen,
  fornecedorId,
  onClose,
  onSuccess,
}: ModalProps) {
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
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
  const [_searchOptions, setSearchOptions] = useState({
    classeFornecedor: '',
    pais: '',
  });

  const { toast } = useToast();

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleFornecedorChange = useCallback(
    (field: keyof Fornecedor, value: any) => {
      console.log(`🔄 Atualizando campo ${String(field)} com valor:`, value);
      setFornecedor((prev) => {
        if (!prev) {
          console.log('⚠️ Fornecedor anterior é null, não pode atualizar');
          return null;
        }
        const updated = { ...prev, [field]: value };
        console.log(
          `✅ Campo ${String(field)} atualizado. Novo valor:`,
          updated[field],
        );
        return updated;
      });
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field as string];
        return updated;
      });
    },
    [],
  );

  const handleBairroAndUpdateFornecedor = async () => {
    if (!fornecedor?.bairro) return;
    const bairro = await getBairroByDescricao(fornecedor.bairro);
    if (bairro) {
      handleFornecedorChange('codbairro', bairro.codbairro);
      handleFornecedorChange('codpais', bairro.codpais);
      handleFornecedorChange(
        'codmunicipio',
        bairro.municipio?.codmunicipio ?? '',
      );
    }
  };

  const handleClear = () => {
    setFornecedor(null);
    if (fornecedorId) {
      setLoading(true);
      getFornecedor(fornecedorId)
        .then(setFornecedor)
        .finally(() => setLoading(false));
    }
  };

  const setDisable = (
    field: 'disableIm' | 'disableIe' | 'disableSuf' | 'regraDiferenciada',
    value: boolean,
  ) => {
    setDisableFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearchOptionsChange = useDebouncedCallback(
    (option: CadFornecedorSearchOptions, value: string) => {
      setSearchOptions((prev) => ({ ...prev, [option]: value }));
    },
    300,
  );

  useEffect(() => {
    if (isOpen && fornecedorId) {
      setLoading(true);
      const fetchAllData = async () => {
        try {
          const [fornecedorData, classesFornecedor, paises] = await Promise.all(
            [
              getFornecedor(fornecedorId),
              getClassesFornecedor({ page: 1, perPage: 999, search: '' }),
              getPaises({ page: 1, perPage: 999, search: '' }),
            ],
          );

          setFornecedor(fornecedorData);
          setOptions({ classesFornecedor, paises });

          if (fornecedorData.imun === 'ISENTO') setDisable('disableIm', true);
          if (fornecedorData.iest === 'ISENTO') setDisable('disableIe', true);
          if (fornecedorData.isuframa === 'ISENTO')
            setDisable('disableSuf', true);

          const hasRegra = Object.keys(fornecedorData).some(
            (key) =>
              (key.startsWith('desc_') ||
                key.startsWith('acres_') ||
                key.startsWith('piscofins_') ||
                key.startsWith('base')) &&
              fornecedorData[key as keyof Fornecedor] != null,
          );
          if (hasRegra) {
            setDisable('regraDiferenciada', true);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do fornecedor:', error);
          toast({
            title: 'Erro ao carregar fornecedor',
            description: 'Não foi possível obter os dados do servidor.',
            variant: 'destructive',
          });
          onClose(); // onClose é chamada aqui, mas não precisa ser dependência
        } finally {
          setLoading(false);
        }
      };
      fetchAllData();
    }
    // ✅ CORREÇÃO: Removido 'onClose' e 'toast' da lista de dependências para evitar o loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fornecedorId]);

  const handleSubmit = async () => {
    if (!fornecedor) {
      console.error('❌ Tentativa de salvar sem dados do fornecedor');
      toast({
        description: 'Erro: Dados do fornecedor não encontrados.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log(
        '🚀 Iniciando processo de edição do fornecedor...',
        fornecedor,
      );
      console.log('🔍 Estado atual do fornecedor antes do processamento:', {
        tipofornecedor: fornecedor.tipofornecedor,
        codcf: fornecedor.codcf,
        nome: fornecedor.nome,
        tipo: fornecedor.tipo,
        tipoemp: fornecedor.tipoemp,
      });

      const { disableIm, disableIe, disableSuf } = disableFields;
      const fornecedorAtualizado = { ...fornecedor };

      if (disableIm) fornecedorAtualizado.imun = 'ISENTO';
      if (disableIe) fornecedorAtualizado.iest = 'ISENTO';
      if (disableSuf) fornecedorAtualizado.isuframa = 'ISENTO';

      // ✅ CORREÇÃO: Tratando campos que podem ser null antes da validação
      console.log('🔧 Tratando campos opcionais que podem ser null...');

      // Converter valores null para string vazia ou valor padrão nos campos obrigatórios
      if (
        fornecedorAtualizado.tipofornecedor === null ||
        fornecedorAtualizado.tipofornecedor === undefined
      ) {
        console.log(
          '⚠️ Campo tipofornecedor era null, definindo como string vazia',
        );
        fornecedorAtualizado.tipofornecedor = '';
      }

      if (
        fornecedorAtualizado.codcf === null ||
        fornecedorAtualizado.codcf === undefined
      ) {
        console.log('⚠️ Campo codcf era null, definindo como string vazia');
        fornecedorAtualizado.codcf = '';
      }

      // Outros campos que podem ser problemáticos
      const camposParaTratarComoString = [
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
      ];

      camposParaTratarComoString.forEach((campo) => {
        if (
          fornecedorAtualizado[campo as keyof Fornecedor] === null ||
          fornecedorAtualizado[campo as keyof Fornecedor] === undefined
        ) {
          console.log(
            `⚠️ Campo ${campo} era null, definindo como string vazia`,
          );
          (fornecedorAtualizado as any)[campo] = '';
        }
      });

      console.log('🔍 Dados tratados para validação:', {
        tipofornecedor: fornecedorAtualizado.tipofornecedor,
        codcf: fornecedorAtualizado.codcf,
        nome: fornecedorAtualizado.nome,
        tipo: fornecedorAtualizado.tipo,
      });

      // ✅ CORREÇÃO MELHORADA: Permitir salvamento com campos opcionais vazios durante edição
      console.log('🔍 Validando dados do fornecedor...');
      try {
        // Preparar dados para validação incluindo campos vazios como válidos
        const dadosParaValidacao = {
          ...fornecedorAtualizado,
          // Garantir que campos opcionais tenham valores válidos para validação
          tipofornecedor: fornecedorAtualizado.tipofornecedor || '',
          codcf: fornecedorAtualizado.codcf || '',
          imun: { isentoIm: disableIm, imun: fornecedorAtualizado.imun },
          iest: { isentoIe: disableIe, iest: fornecedorAtualizado.iest },
          isuframa: {
            isentoSuf: disableSuf,
            isuframa: fornecedorAtualizado.isuframa,
          },
        };

        console.log('🔍 Dados sendo validados:', dadosParaValidacao);
        console.log(
          '🔎 Verificação específica - tipofornecedor:',
          dadosParaValidacao.tipofornecedor,
        );
        console.log(
          '🔎 Verificação específica - codcf:',
          dadosParaValidacao.codcf,
        );

        edicaoFornecedorSchema.parse(dadosParaValidacao);
        console.log('✅ Validação de dados bem-sucedida');
      } catch (validationError) {
        console.error('❌ Erro de validação:', validationError);
        throw validationError; // Re-throw para ser capturado pelo catch principal
      }

      console.log('🏠 Processando dados do bairro...');
      await handleBairroAndUpdateFornecedor();

      console.log('💾 Atualizando dados na API...');
      const resultadoAtualizacao = await updateFornecedor(fornecedorAtualizado);
      console.log(
        '✅ Fornecedor atualizado com sucesso:',
        resultadoAtualizacao,
      );

      setErrors({});
      setMensagemInfo('Fornecedor atualizado com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      // ✅ CORREÇÃO: Tratamento de erros melhorado com logs detalhados
      console.error('❌ Erro detalhado ao atualizar fornecedor:', {
        error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        fornecedor: fornecedor,
      });

      // Toast inicial para informar sobre o erro
      toast({
        description: 'Falha ao atualizar fornecedor. Verifique os campos.',
        variant: 'destructive',
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

        const firstError = error.errors[0];
        const fieldWithError = firstError.path[0];
        const abaDoErro = campoParaAba[fieldWithError];

        if (abaDoErro) {
          console.log(
            `🔄 Mudando para aba: ${abaDoErro} devido ao erro no campo: ${fieldWithError}`,
          );
          setActiveTab(abaDoErro);
          setTimeout(() => {
            const el = document.getElementById(fieldWithError as string);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLInputElement).focus();
            }
          }, 100);
        }
        setErrors(fieldErrors);

        // Toast específico com detalhes do erro de validação
        toast({
          description: `Erro de validação: ${firstError.message}`,
          variant: 'destructive',
        });
      } else {
        // ✅ CORREÇÃO: Tratamento melhorado para erros da API
        let errorMessage = 'Erro desconhecido ao atualizar fornecedor.';

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

        // Toast específico para erros da API
        toast({
          description: `Erro da API: ${errorMessage}`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleCloseInfoModal = () => {
    setOpenInfo(false);
    onClose();
    onSuccess?.();
  };

  const renderTabContent = () => {
    if (!fornecedor) return <Carregamento />;

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
      {loading ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center">
          <Carregamento />
        </div>
      ) : (
        <ModalForm
          titulo="Editar Fornecedor"
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={handleActiveTab}
          renderTabContent={renderTabContent}
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          onClose={onClose}
        />
      )}
      <InfoModal
        isOpen={openInfo}
        onClose={handleCloseInfoModal}
        title="SUCESSO"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <Toaster />
    </div>
  );
}
