import React, { useEffect, useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import ModalForm from '@/components/common/modalform';
import { z } from 'zod';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Carregamento from '@/utils/carregamento';
import {
  ClassesVendedor,
  // O tipo DetalhadoVendedor não é mais necessário importar aqui, pois não teremos um estado separado para ele.
  getClassesVendedor,
  getVendedor,
  updateVendedor,
  Vendedor,
  // O tipo VendedorPst também não é mais necessário para um estado separado.
} from '@/data/vendedores/vendedores';
import { Bairros, getBairros } from '@/data/bairros/bairros';
import {
  getGruposProduto,
  GruposProduto,
} from '@/data/gruposProduto/gruposProduto';
import { cadastroVendedorSchema } from '@/data/vendedores/schemas';

// A interface de props continua a mesma.
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  vendedorId: string;
}

const tabs = [{ name: 'Dados Cadastrais', key: 'dadosCadastrais' }];

export type CadVendedorSearchOptions =
  | 'classeVendedor'
  | 'bairro'
  | 'grupoProduto';

export default function CustomModal({
  isOpen,
  vendedorId,
  onClose,
}: ModalProps) {
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [vendedor, setVendedor] = useState<Vendedor>({} as Vendedor);

  // COMENTÁRIO: Os estados 'detalhadoVendedor' e 'pstVendedor' foram removidos.
  // A informação deles agora é gerida diretamente dentro do estado 'vendedor',
  // o que torna o código mais limpo e evita bugs.

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [options, setOptions] = useState({
    classesVendedor: {} as ClassesVendedor,
    bairros: {} as Bairros,
    gruposProduto: {} as GruposProduto,
  });
  const [searchOptions, setSearchOptions] = useState({
    classeVendedor: '',
    bairro: '',
    grupoProduto: '',
  });
  const { toast } = useToast();

  // COMENTÁRIO DE MUDANÇA: Esta é a função handleVendedorChange otimizada.
  // Ela foi copiada do modal de cadastro para substituir a versão anterior que era mais complexa.
  // Ela consegue atualizar qualquer campo do vendedor, incluindo os que estão "aninhados"
  // (como detalhado_vendedor.nome), de forma simples e direta.
  const handleVendedorChange = useCallback((field: string, value: any) => {
    // Debug: verificar valores sendo atualizados
    if (
      ['comnormal', 'comtele', 'valobj', 'limite', 'pst.codpst'].includes(field)
    ) {
      console.log(`📝 Campo "${field}" atualizado:`, {
        valorNovo: value,
        tipo: typeof value,
      });
    }

    setVendedor((prev) => {
      const newVendedor = { ...prev };
      let currentLevel: any = newVendedor;
      const fieldParts = field.split('.');

      for (let i = 0; i < fieldParts.length - 1; i++) {
        const part = fieldParts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }
      currentLevel[fieldParts[fieldParts.length - 1]] = value;
      return newVendedor;
    });

    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // COMENTÁRIO DE MUDANÇA: Este é o bloco de código que adiciona a funcionalidade de busca por CEP.
  // Ele foi copiado do modal de cadastro e inserido aqui.
  // Ele "escuta" por mudanças no campo CEP do vendedor.
  useEffect(() => {
    const cep = vendedor.detalhado_vendedor?.cep?.replace(/\D/g, '');
    if (cep && cep.length === 8) {
      const fetchCepData = async () => {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();
          if (!data.erro) {
            // Usa a nova função handleVendedorChange para preencher os campos.
            handleVendedorChange(
              'detalhado_vendedor.logradouro',
              data.logradouro,
            );
            handleVendedorChange('detalhado_vendedor.bairro', data.bairro);
            handleVendedorChange('detalhado_vendedor.cidade', data.localidade);
            handleVendedorChange('detalhado_vendedor.estado', data.uf);
          } else {
            toast({ title: 'CEP não encontrado.', variant: 'destructive' });
          }
        } catch (error) {
          console.error('Erro ao buscar CEP:', error);
          toast({ title: 'Erro ao buscar CEP.', variant: 'destructive' });
        }
      };
      fetchCepData();
    }
  }, [vendedor.detalhado_vendedor?.cep, handleVendedorChange, toast]);

  const handleRemoveGrupoProduto = (codgpp: string) => {
    setVendedor((prevVendedor) => ({
      ...prevVendedor,
      grupos_produto: prevVendedor.grupos_produto?.filter(
        (grupo) => grupo.codgpp !== codgpp,
      ),
    }));
  };

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleClear = () => {
    setVendedor({} as Vendedor);
  };

  const handleSearchOptionsChange = useDebouncedCallback(
    (option: CadVendedorSearchOptions, value: string) => {
      setSearchOptions((prevState) => ({
        ...prevState,
        [option]: value,
      }));
    },
    300,
  );

  const handleClassesVendedor = useCallback(async () => {
    try {
      const classesVendedor = await getClassesVendedor({
        page: 1,
        perPage: 999,
        search: searchOptions.classeVendedor,
      });
      setOptions((prevState) => ({
        ...prevState,
        classesVendedor,
      }));
    } catch (error) {
      console.error('Erro ao buscar classes de vendedor:', error);
    } finally {
      setLoading(false);
    }
  }, [searchOptions.classeVendedor]);

  const handleBairros = useCallback(async () => {
    try {
      const bairros = await getBairros({
        page: 1,
        perPage: 999,
        search: searchOptions.bairro,
      });
      setOptions((prevState) => ({
        ...prevState,
        bairros,
      }));
    } catch (error) {
      console.error('Erro ao buscar bairros:', error);
    } finally {
      setLoading(false);
    }
  }, [searchOptions.bairro]);

  const handleGruposProduto = useCallback(async () => {
    try {
      const gruposProduto = await getGruposProduto({
        page: 1,
        perPage: 999,
        search: searchOptions.grupoProduto,
      });
      setOptions((prevState) => ({
        ...prevState,
        gruposProduto,
      }));
    } catch (error) {
      console.error('Erro ao buscar grupos de produto:', error);
    } finally {
      setLoading(false);
    }
  }, [searchOptions.grupoProduto]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const classesVendedor = await getClassesVendedor({
          page: 1,
          perPage: 999,
          search: searchOptions.classeVendedor,
        });
        const bairros = await getBairros({
          page: 1,
          perPage: 999,
          search: searchOptions.bairro,
        });
        const gruposProduto = await getGruposProduto({
          page: 1,
          perPage: 999,
          search: searchOptions.grupoProduto,
        });
        setOptions((prevState) => ({
          ...prevState,
          classesVendedor,
          bairros,
          gruposProduto,
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (searchOptions.classeVendedor) {
      handleClassesVendedor();
    } else if (searchOptions.bairro) {
      handleBairros();
    } else if (searchOptions.grupoProduto) {
      handleGruposProduto();
    } else {
      fetchInitialData();
    }
  }, [
    searchOptions,
    handleClassesVendedor,
    handleBairros,
    handleGruposProduto,
  ]);

  useEffect(() => {
    if (vendedorId) {
      const fetchVendedor = async () => {
        const vendedorData = await getVendedor(vendedorId as string);

        // Debug: verificar os valores numéricos que vêm do backend
        console.log('📊 Dados do vendedor carregados:', {
          codvend: vendedorData.codvend,
          nome: vendedorData.nome,
          comnormal: vendedorData.comnormal,
          comtele: vendedorData.comtele,
          valobj: vendedorData.valobj,
          limite: vendedorData.limite,
          pst: vendedorData.pst,
        });

        setVendedor(vendedorData);

        const classesVendedor = await getClassesVendedor({
          page: 1,
          perPage: 999,
          search: searchOptions.classeVendedor,
        });
        const bairros = await getBairros({
          page: 1,
          perPage: 999,
          search: searchOptions.bairro,
        });
        const gruposProduto = await getGruposProduto({
          page: 1,
          perPage: 999,
          search: searchOptions.grupoProduto,
        });
        setOptions((prevState) => ({
          ...prevState,
          classesVendedor,
          bairros,
          gruposProduto,
        }));

        setLoading(false);
      };
      fetchVendedor();
    }
  }, [
    vendedorId,
    searchOptions.classeVendedor,
    searchOptions.bairro,
    searchOptions.grupoProduto,
  ]);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Debug: verificar os valores antes da validação
      console.log('📤 Dados antes da validação:', {
        codvend: vendedor.codvend,
        nome: vendedor.nome,
        comnormal: vendedor.comnormal,
        comtele: vendedor.comtele,
        valobj: vendedor.valobj,
        limite: vendedor.limite,
        pst: vendedor.pst,
        tipos: {
          comnormal: typeof vendedor.comnormal,
          comtele: typeof vendedor.comtele,
          valobj: typeof vendedor.valobj,
          limite: typeof vendedor.limite,
          'pst.codpst': typeof vendedor.pst?.codpst,
        },
      });

      cadastroVendedorSchema.parse(vendedor);

      const response = await updateVendedor(vendedor);

      if (response) {
        setErrors({});
        toast({
          description: '✅ Vendedor atualizado com sucesso!',
          variant: 'default',
        });

        setTimeout(() => {
          handleClear(); // Limpa o estado do vendedor
          onClose();
        }, 500);
      } else {
        throw new Error('Falha ao atualizar vendedor');
      }
    } catch (error: any) {
      console.log('error', error);

      if (error instanceof z.ZodError) {
        // Erro de validação Zod (frontend)
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path.join('.')] = error.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          description: '❌ Erro de validação. Verifique os campos destacados.',
          variant: 'destructive',
        });
      } else if (error?.response?.data) {
        // Erro da API com mensagem estruturada
        const apiError = error.response.data;

        // Exibe mensagem principal
        toast({
          title: apiError.error || '❌ Erro ao atualizar vendedor',
          description:
            apiError.details?.sugestao ||
            'Verifique os dados e tente novamente.',
          variant: 'destructive',
          duration: 6000, // 6 segundos para dar tempo de ler
        });

        // Se houver campo específico, destaca no formulário
        if (apiError.details?.campo) {
          const campoMapeamento: { [key: string]: string } = {
            'Classe de Vendedor': 'codcv',
            Nome: 'nome',
            'Código do Vendedor': 'codvend',
          };

          const campoFormulario =
            campoMapeamento[apiError.details.campo] ||
            apiError.details.campo.toLowerCase();
          setErrors({
            [campoFormulario]: apiError.details.sugestao || apiError.error,
          });
        }

        // Log técnico para debug
        if (apiError.details?.technical) {
          console.error('Detalhes técnicos:', apiError.details.technical);
        }
      } else {
        // Erro genérico
        const errorMessage =
          error?.message || 'Falha ao atualizar vendedor. Tente novamente.';
        toast({
          title: '❌ Erro ao atualizar vendedor',
          description: errorMessage,
          variant: 'destructive',
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dadosCadastrais':
        return (
          <DadosCadastrais
            vendedor={vendedor}
            handleVendedorChange={handleVendedorChange}
            handleRemoveGrupoProduto={handleRemoveGrupoProduto}
            options={options}
            handleSearchOptionsChange={handleSearchOptionsChange}
            error={errors}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed  inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {vendedor?.codvend === vendedorId ? (
        <ModalForm
          titulo="Editar Vendedor"
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={handleActiveTab}
          renderTabContent={() => <>{renderTabContent()}</>}
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          onClose={onClose}
          loading={loading}
        />
      ) : (
        <Carregamento />
      )}
      <Toaster />
    </div>
  );
}
