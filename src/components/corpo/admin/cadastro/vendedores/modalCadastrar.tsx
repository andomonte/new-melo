import React, { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import ModalFormulario from '@/components/common/modalform';
import { useDebouncedCallback } from 'use-debounce';
import { Bairros, getBairros } from '@/data/bairros/bairros';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  ClassesVendedor,
  getClassesVendedor,
  insertVendedor,
  Vendedor,
} from '@/data/vendedores/vendedores';
import {
  getGruposProduto,
  GruposProduto,
} from '@/data/gruposProduto/gruposProduto';
import DadosCadastrais from '@/components/corpo/admin/cadastro/vendedores/_forms/DadosCadastrais';
import { cadastroVendedorSchema } from '@/data/vendedores/schemas';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  children?: React.ReactNode;
}

const tabs = [{ name: 'Dados Cadastrais', key: 'dadosCadastrais' }];

export type CadVendedorSearchOptions =
  | 'classeVendedor'
  | 'bairro'
  | 'grupoProduto';

// ✅ CORREÇÃO: Estado inicial completo para evitar erros de tipo com objetos aninhados.
const estadoInicialVendedor: Vendedor = {
  codvend: '',
  nome: '',
  valobj: 0,
  comnormal: 0,
  comtele: 0,
  debito: 0,
  credito: 0,
  limite: 0,
  status: '',
  codcv: '',
  comobj: 0,
  valobjf: 0,
  valobjm: 0,
  valobjsf: 0,
  ra_mat: '',
  detalhado_vendedor: { codvend: '', nome: '' }, // Garante que as propriedades obrigatórias existam
  grupos_produto: [],
  pst: { id: 0, codvend: '', codpst: '', local: '' }, // Garante que as propriedades obrigatórias existam
};

export default function CustomModal({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [vendedor, setVendedor] = useState<Vendedor>(estadoInicialVendedor);
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

  const handleVendedorChange = useCallback((field: string, value: any) => {
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

  useEffect(() => {
    const cep = vendedor.detalhado_vendedor?.cep?.replace(/\D/g, '');
    if (cep && cep.length === 8) {
      const fetchCepData = async () => {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();
          if (!data.erro) {
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
    setVendedor((prev) => ({
      ...prev,
      grupos_produto: prev.grupos_produto?.filter(
        (grupo) => grupo.codgpp !== codgpp,
      ),
    }));
  };

  const handleActiveTab = (tab: string) => setActiveTab(tab);
  const handleClear = () => setVendedor(estadoInicialVendedor);

  const handleSearchOptionsChange = useDebouncedCallback(
    (option: CadVendedorSearchOptions, value: string) => {
      setSearchOptions((prev) => ({ ...prev, [option]: value }));
    },
    300,
  );

  useEffect(() => {
    if (!isOpen) {
      handleClear();
      return;
    }
    setLoading(true);
    const fetchInitialData = async () => {
      try {
        const [classesVendedor, bairros, gruposProduto] = await Promise.all([
          getClassesVendedor({
            page: 1,
            perPage: 999,
            search: searchOptions.classeVendedor,
          }),
          getBairros({ page: 1, perPage: 999, search: searchOptions.bairro }),
          getGruposProduto({
            page: 1,
            perPage: 999,
            search: searchOptions.grupoProduto,
          }),
        ]);
        setOptions({ classesVendedor, bairros, gruposProduto });
      } catch (_error) {
        console.error('Error fetching data:', _error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [isOpen, searchOptions]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      cadastroVendedorSchema.parse(vendedor);
      const response = await insertVendedor(vendedor);

      if (response) {
        setErrors({});
        toast({
          description: '✅ Vendedor cadastrado com sucesso!',
          variant: 'default',
        });

        setTimeout(() => {
          handleClear(); // Limpa o formulário
          onSuccess?.();
          onClose();
        }, 500);
      } else {
        throw new Error('Falha ao cadastrar vendedor');
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        // Erro de validação Zod (frontend)
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((e) => {
          const path = e.path.join('.');
          fieldErrors[path] = e.message;
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
          title: apiError.error || '❌ Erro ao cadastrar vendedor',
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
        console.error('Erro ao cadastrar vendedor:', error);
        const errorMessage =
          error?.message || 'Falha ao cadastrar vendedor. Tente novamente.';
        toast({
          title: '❌ Erro ao cadastrar vendedor',
          description: errorMessage,
          variant: 'destructive',
          duration: 5000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div>
      <ModalFormulario
        titulo="Cadastro de Vendedor"
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={handleActiveTab}
        renderTabContent={() => (
          <DadosCadastrais
            vendedor={vendedor}
            handleVendedorChange={handleVendedorChange}
            handleRemoveGrupoProduto={handleRemoveGrupoProduto}
            options={options}
            handleSearchOptionsChange={handleSearchOptionsChange}
            error={errors}
          />
        )}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        onClose={onClose}
        loading={loading}
      />
      <Toaster />
    </div>
  );
}
