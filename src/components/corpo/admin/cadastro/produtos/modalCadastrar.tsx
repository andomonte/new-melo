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
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';

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
  pis: 'dadosFiscais',
  cofins: 'dadosFiscais',
  percsubst: 'dadosFiscais',
  ii: 'dadosFiscais',
  ipi: 'dadosFiscais',

  // Dados de Custos
  prcompra: 'dadosCustos',
  prvenda: 'dadosCustos',
  prfabr: 'dadosCustos',
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
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar cadastro',
    message: 'Deseja realmente salvar este produto?',
  });

  const handleProdutoChange = (produtoAtualizado: Produto) => {
    handleProdutoByCodbar(produtoAtualizado.codbar);
    setProduto(produtoAtualizado);

    // Limpa o erro de qualquer campo que agora tenha valor preenchido. Antes
    // os erros só eram recalculados no submit, então o campo continuava
    // vermelho ("obrigatório"/"Required") mesmo após digitar/selecionar.
    setErrors((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      const novos = { ...prev };
      let mudou = false;
      Object.keys(novos).forEach((campo) => {
        const valor = (produtoAtualizado as any)[campo];
        if (valor !== undefined && valor !== null && valor !== '') {
          delete novos[campo];
          mudou = true;
        }
      });
      return mudou ? novos : prev;
    });
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

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);

  // Campos obrigatórios por aba para validação ao trocar
  const camposObrigatoriosPorAba: Record<string, string[]> = {
    dadosCadastrais: ['ref', 'descr', 'unimed', 'codmarca', 'codgpf', 'codgpp', 'multiplo', 'multiplocompra'],
    dadosFiscais: ['trib', 'strib', 'isentopiscofins', 'isentoipi', 'clasfiscal', 'inf'],
    dadosCustos: [],
    referenciaFabrica: [],
  };

  const handleActiveTab = (tab: string) => {
    // Verifica campos obrigatórios da aba atual
    const camposAba = camposObrigatoriosPorAba[activeTab] || [];
    const camposPendentes = camposAba.filter((campo) => {
      const valor = (produto as any)[campo];
      return valor === undefined || valor === null || valor === '';
    });

    if (camposPendentes.length > 0) {
      setAbaPendente(tab);
      setModalConfirmAba(true);
      return;
    }

    setActiveTab(tab);
  };

  // Converte campos de texto para uppercase antes de salvar
  const produtoUpperCase = (prod: Produto): Produto => {
    const upper = { ...prod };
    const camposTexto = ['ref', 'reforiginal', 'descr', 'aplic_extendida', 'obs', 'descr_importacao', 'codbar'] as const;
    camposTexto.forEach((campo) => {
      if (upper[campo] && typeof upper[campo] === 'string') {
        (upper as any)[campo] = (upper[campo] as string).toUpperCase();
      }
    });
    return upper;
  };

  const handleSubmit = async () => {
    try {
      const produtoFinal = produtoUpperCase(produto);

      // Validação: Compra Direta SIM exige pelo menos 1 Ref. Fábrica
      if (produtoFinal.compradireta === 'S' && (!produtoFinal.referenciasFabrica || produtoFinal.referenciasFabrica.length === 0)) {
        toast({ description: 'Compra Direta = SIM exige pelo menos 1 Referência de Fábrica cadastrada.', variant: 'destructive' });
        setActiveTab('referenciaFabrica');
        return;
      }

      // Validação CEST/NCM — bloqueia save se inválido
      if (produtoFinal.cest && produtoFinal.cest.length > 0) {
        const ncm = produtoFinal.clasfiscal || '';
        if (!ncm || ncm.length < 8) {
          toast({ description: 'NCM é obrigatório quando CEST está preenchido.', variant: 'destructive' });
          setActiveTab('dadosFiscais');
          return;
        }
        const cestResp = await fetch('/api/produtos/validar-cest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ncm, cest: produtoFinal.cest }),
        });
        const cestResult = await cestResp.json();
        if (cestResult.resultado === 'NOK1' || cestResult.resultado === 'NOK2') {
          toast({ description: cestResult.message, variant: 'destructive' });
          setActiveTab('dadosFiscais');
          return;
        }
      }

      // Validação Informativo: no cadastro, 'D', 'E' e 'S' são inválidos (conforme Delphi)
      const infVal = (produtoFinal.inf || '').toUpperCase();
      if (infVal === 'D' || infVal === 'E' || infVal === 'S') {
        toast({ description: 'Informativo inválido para cadastro. Valores "D", "E" e "S" não são permitidos ao criar um produto.', variant: 'destructive' });
        setActiveTab('dadosFiscais');
        return;
      }

      // Validação (Delphi): a Marca das referências de fábrica deve ser igual
      // à Marca informada nos Dados Cadastrais.
      if (
        produtoFinal.referenciasFabrica &&
        produtoFinal.referenciasFabrica.length > 0 &&
        produtoFinal.codmarca
      ) {
        const marcaProd = String(produtoFinal.codmarca).trim();
        const divergente = produtoFinal.referenciasFabrica.find(
          (r: any) => r.codmarca && String(r.codmarca).trim() !== marcaProd,
        );
        if (divergente) {
          toast({
            description: `A Marca da referência de fábrica "${divergente.referencia}" difere da Marca informada na aba Dados Cadastrais.`,
            variant: 'destructive',
          });
          setActiveTab('referenciaFabrica');
          return;
        }
      }

      cadastroProdutoSchema.parse(produtoFinal);

      await insertProduto(produtoFinal);

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
        // Ordenar erros pela sequência das abas
        const tabOrder = ['dadosCadastrais', 'dadosFiscais', 'dadosCustos', 'referenciaFabrica'];
        const sortedErrors = [...error.errors].sort((a, b) => {
          const tabA = tabOrder.indexOf(campoParaAba[String(a.path[0])] || '');
          const tabB = tabOrder.indexOf(campoParaAba[String(b.path[0])] || '');
          return tabA - tabB;
        });
        const firstError = sortedErrors[0];
        const fieldWithError = firstError.path[0];
        const abaDoErro = campoParaAba[fieldWithError as string];

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
    setErrors({});
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
              <FormFooter
                onSubmit={() => {
                  // Aviso do Delphi: Tributado = SIM e % Agregado = 0
                  if (
                    produto.trib === 'S' &&
                    (Number(produto.percsubst) || 0) === 0
                  ) {
                    const ok = window.confirm(
                      'Informe o percentual agregado para cálculo da Substituição Tributária.\n.:: Deseja salvar sem essa informação?',
                    );
                    if (!ok) {
                      setActiveTab('dadosFiscais');
                      return;
                    }
                  }
                  pedirConfirmacao(handleSubmit);
                }}
                onClear={handleClear}
              />
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
          <div className="p-4">
            <div className="shadow-md rounded-lg w-full p-6 bg-white dark:bg-zinc-800">
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

        {/* Confirmação antes de salvar */}
        {ConfirmacaoSalvarModal}
      </div>
    </div>
  );
}
