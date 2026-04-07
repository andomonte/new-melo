import React, { useEffect, useState } from 'react';
import { getProduto, Produto, updateProduto } from '@/data/produtos/produtos';
import { z } from 'zod';
import { cadastroProdutoSchema } from '@/data/produtos/produtosSchema';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFiscais from './_forms/DadosFiscais';
import DadosCustos from './_forms/DadosCustos';
import ReferenciaFabrica from './_forms/ReferenciaFabrica';
import TabNavigation from '@/components/common/TabNavigation';
import FormFooter from '@/components/common/FormFooter';
import Carregamento from '@/utils/carregamento';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { X } from 'lucide-react';

const tabs = [
  { name: 'Dados Cadastrais', key: 'dadosCadastrais' },
  { name: 'Dados Fiscais', key: 'dadosFiscais' },
  { name: 'Dados de Custos', key: 'dadosCustos' },
  { name: 'Referência de Fábrica', key: 'referenciaFabrica' },
];
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  produtoId: string;
}

//dados para achar as abas com erro e poder chavear
const campoParaAba: Record<string, string> = {
  // Dados Cadastrais
  ref: 'dadosCadastrais',
  descr: 'dadosCadastrais',
  codmarca: 'dadosCadastrais',
  codgpf: 'dadosCadastrais',
  codgpp: 'dadosCadastrais',
  curva: 'dadosCadastrais',
  inf: 'dadosCadastrais',
  unimed: 'dadosCadastrais',
  multiplo: 'dadosCadastrais',
  coddesc: 'dadosCadastrais',
  compradireta: 'dadosCadastrais',
  multiplocompra: 'dadosCadastrais',
  tipo: 'dadosCadastrais',
  codbar: 'dadosCadastrais',
  consumo_interno: 'dadosCadastrais',

  // Dados Fiscais
  trib: 'dadosFiscais',
  clasfiscal: 'dadosFiscais',
  strib: 'dadosFiscais',
  isentopiscofins: 'dadosFiscais',
  isentoipi: 'dadosFiscais',
  cest: 'dadosFiscais',

  // Dados de Consumo
  // Nenhum campo obrigatório aparente (exemplo de referência é uma lista com adicionar/remover, sem `*`)
  // Então, nada mapeado aqui por enquanto

  // Referência de Fábrica
  // Nenhum campo obrigatório marcado com `*`
};

export default function CustomModal({
  isOpen,
  produtoId,
  onClose,
  onSuccess,
  footer,
}: ModalProps) {
  const [produto, setProduto] = useState<Produto>({} as Produto);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState('dadosCadastrais');

  const { toast } = useToast();

  const handleProdutoChange = (produto: Produto) => {
    setProduto(produto);
  };

  const handleClear = () => {
    setProduto({} as Produto);
  };

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleClose = () => {
    // Limpa estado ao fechar modal
    setProduto({} as Produto);
    setErrors({});
    setActiveTab('dadosCadastrais');
    setLoading(true);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      cadastroProdutoSchema.parse(produto);

      setLoading(true);
      await updateProduto(produto);

      setErrors({});

      toast({ description: 'Produto atualizado com sucesso!' });

      // Fecha o modal após sucesso sem reload
      setTimeout(() => {
        handleClose();
        // Chama o callback para atualizar a lista
        onSuccess?.();
      }, 1500);
    } catch (error) {
      setLoading(false);
      toast({
        description: 'Falha ao atualizar produto.',
        variant: 'destructive',
      });
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        const firstError = error.errors[0];
        const fieldWithError = firstError.path[0]; // pega o campo raiz, ex: "cepcobr"
        const abaDoErro = campoParaAba[fieldWithError];

        if (abaDoErro) {
          setActiveTab(abaDoErro);
          setTimeout(() => {
            // Foca no input usando `document.getElementById`, assumindo que o campo tem id
            const el = document.getElementById(fieldWithError as string);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLInputElement).focus();
            }
          }, 100); // dá tempo de trocar a aba antes de focar
        }

        setErrors(fieldErrors);
      }
    }
  };

  useEffect(() => {
    // Flag para evitar atualização de estado em componente desmontado
    let isMounted = true;
    // Controlador para cancelar requisições pendentes
    const controller = new AbortController();

    if (produtoId && isOpen) {
      const fetchUsuario = async () => {
        try {
          setLoading(true);
          // Limpa o estado anterior antes de carregar novo produto
          setProduto({} as Produto);
          setErrors({});
          setActiveTab('dadosCadastrais');

          const produtoData = await getProduto(
            produtoId as string,
            controller.signal,
          );

          // Só atualiza o estado se o componente ainda estiver montado
          if (!isMounted) return;

          // Aplica valores padrão para campos obrigatórios que podem estar vazios
          const produtoNormalizado: Produto = {
            ...produtoData,
            codmarca: produtoData.codmarca || '00000',
            codgpf: produtoData.codgpf || '00000',
            codgpp: produtoData.codgpp || '00000',
            curva: produtoData.curva || 'D',
            multiplo: produtoData.multiplo || 1,
            compradireta: produtoData.compradireta || 'N',
            tipo: produtoData.tipo || 'ME',
            trib: produtoData.trib || 'N',
            strib: produtoData.strib || '000',
            isentopiscofins: produtoData.isentopiscofins || 'N',
            isentoipi: produtoData.isentoipi || 'S',
          };

          setProduto(produtoNormalizado);
          setLoading(false);
        } catch (error: any) {
          // Ignora erros de abort (quando requisição é cancelada)
          if (error.name === 'AbortError' || error.name === 'CanceledError') {
            console.log(
              'Requisição cancelada (normal ao trocar de produto rapidamente)',
            );
            return;
          }

          if (!isMounted) return;
          console.error('Erro ao carregar produto:', error);
          setLoading(false);
          toast({
            description: 'Erro ao carregar dados do produto.',
            variant: 'destructive',
          });
        }
      };
      fetchUsuario();
    } else if (!isOpen) {
      // Limpa estado quando modal fecha
      setProduto({} as Produto);
      setErrors({});
      setActiveTab('dadosCadastrais');
      setLoading(true);
    }

    // Cleanup: cancela requisições pendentes e marca componente como desmontado
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [produtoId, isOpen, toast]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dadosCadastrais':
        return (
          <DadosCadastrais
            produto={produto}
            handleProdutoChange={handleProdutoChange}
            error={errors}
          />
        );
      case 'dadosFiscais':
        return (
          <DadosFiscais
            produto={produto}
            handleProdutoChange={handleProdutoChange}
            error={errors}
          />
        );
      case 'dadosCustos':
        return (
          <DadosCustos
            produto={produto}
            handleProdutoChange={handleProdutoChange}
            error={errors}
          />
        );
      case 'referenciaFabrica':
        return (
          <ReferenciaFabrica
            produto={produto}
            handleProdutoChange={handleProdutoChange}
            error={errors}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300">
              Editar Produto
            </h4>
          </header>
          <div className="w-[35%] h-full flex justify-end">
            {footer || (
              <FormFooter onSubmit={handleSubmit} onClear={handleClear} />
            )}
          </div>
          <div className="w-[5%] flex justify-end h-full">
            <button
              onClick={handleClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
          {loading ? (
            <div className="w-full h-full">
              <Carregamento />
            </div>
          ) : (
            <div className="min-h-screen p-6">
              <div className="shadow-md rounded-lg max-w-6xl mx-auto p-6 bg-white dark:bg-zinc-800">
                <TabNavigation
                  tabs={tabs}
                  activeTab={activeTab}
                  setActiveTab={handleActiveTab}
                />
                <div>
                  <form>{renderTabContent()}</form>
                </div>
              </div>
            </div>
          )}
        </div>

        <Toaster />
      </div>
    </div>
  );
}
