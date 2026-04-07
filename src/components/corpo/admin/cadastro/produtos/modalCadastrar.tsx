import React, { useState } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFiscais from './_forms/DadosFiscais';
import DadosCustos from './_forms/DadosCustos';
import ReferenciaFabrica from './_forms/ReferenciaFabrica';
import {
  getProdutoByCodBar,
  insertProduto,
  Produto,
} from '@/data/produtos/produtos';
import TabNavigation from '@/components/common/TabNavigation';
import FormFooter from '@/components/common/FormFooter';
import { z } from 'zod';
import { cadastroProdutoSchema } from '@/data/produtos/produtosSchema';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { X } from 'lucide-react';

const tabs = [
  { name: 'Dados Cadastrais', key: 'dadosCadastrais' },
  { name: 'Dados Fiscais', key: 'dadosFiscais' },
  { name: 'Dados de Custos', key: 'dadosCustos' },
  { name: 'Referência de Fábrica', key: 'referenciaFabrica' },
];

export type CadFornecedorSearchOptions = 'classeFornecedor' | 'pais';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
  onClose,
  onSuccess,
  footer,
}: ModalProps) {
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [produto, setProduto] = useState({} as Produto);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  const handleProdutoChange = (produto: Produto) => {
    handleProdutoByCodbar(produto.codbar);
    setProduto(produto);
  };

  const handleProdutoByCodbar = async (codbar: string | undefined) => {
    if (codbar) {
      try {
        const produtoByCodBar = await getProdutoByCodBar(codbar);

        if (produtoByCodBar) {
          // Ao invés de redirecionar, mostra um toast informando que produto já existe
          toast({
            description: `Produto com código de barras ${codbar} já existe: ${produtoByCodBar.descr}`,
            variant: 'destructive',
          });
          // Opcional: limpar o campo código de barras
          setProduto({ ...produto, codbar: '' });
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleSubmit = async () => {
    try {
      cadastroProdutoSchema.parse(produto);

      await insertProduto(produto);

      setErrors({});

      toast({ description: 'Produto cadastrado com sucesso!' });

      // Fecha o modal e limpa os dados ao invés de recarregar
      setTimeout(() => {
        handleClear();
        onClose();
        // Chama o callback para atualizar a lista
        onSuccess?.();
      }, 1500);
    } catch (error) {
      toast({
        description: 'Falha ao cadastrar produto.',
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

  const handleClear = () => {
    setProduto({} as Produto);
  };

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
              Cadastro Produto
            </h4>
          </header>
          <div className="w-[35%] h-full flex justify-end">
            {footer || (
              <FormFooter onSubmit={handleSubmit} onClear={handleClear} />
            )}
          </div>
          <div className="w-[5%] flex justify-end h-full">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
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

          <Toaster />
        </div>
      </div>
    </div>
  );
}
