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
import { X, Trash2 } from 'lucide-react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';

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
  const [dadosOriginais, setDadosOriginais] = useState<Produto>({} as Produto);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [emPromocao, setEmPromocao] = useState<string | null>(null);

  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar alteração',
    message: 'Deseja realmente salvar as alterações deste produto?',
  });

  const handleProdutoChange = (produtoAtualizado: Produto) => {
    setProduto(produtoAtualizado);

    // Limpa o erro de qualquer campo que agora tenha valor preenchido, para a
    // mensagem de obrigatório sumir assim que o usuário digita/seleciona
    // (antes só era revalidado no submit).
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

  const handleClear = () => {
    setProduto({ ...dadosOriginais });
    setErrors({});
  };

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleExcluir = async () => {
    if (!produto.codprod) return;
    setExcluindo(true);
    try {
      const response = await fetch('/api/produtos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprod: produto.codprod }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || 'Erro ao excluir');
      toast({ description: `Produto ${produto.codprod} excluído com sucesso!` });
      setModalExcluir(false);
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({ description: error.message || 'Erro ao excluir produto', variant: 'destructive' });
    } finally {
      setExcluindo(false);
    }
  };

  const camposObrigatoriosPorAba: Record<string, string[]> = {
    dadosCadastrais: ['ref', 'descr', 'unimed'],
    dadosFiscais: ['trib', 'strib', 'isentopiscofins', 'isentoipi'],
    dadosCustos: [],
    referenciaFabrica: [],
  };

  const handleActiveTab = (tab: string) => {
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

  const handleClose = () => {
    // Limpa estado ao fechar modal
    setProduto({} as Produto);
    setErrors({});
    setActiveTab('dadosCadastrais');
    setLoading(true);
    onClose();
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

      // Validação Informativo: na edição, 'E' e 'S' são sempre inválidos;
      // 'D' exige checagem de estoque > 0 (conforme Delphi)
      const infVal = (produtoFinal.inf || '').toUpperCase();
      if (infVal === 'E' || infVal === 'S') {
        toast({ description: `Informativo "${infVal}" não é permitido para edição de produto.`, variant: 'destructive' });
        setActiveTab('dadosCadastrais');
        return;
      }

      // Verificar estoque antes de permitir desativar produto (inf='D')
      if (infVal === 'D' && produtoFinal.codprod) {
        try {
          const estoqueResp = await fetch(`/api/produtos/verificar-estoque?codprod=${encodeURIComponent(produtoFinal.codprod)}`);
          const estoqueData = await estoqueResp.json();
          if (estoqueData.temEstoque) {
            toast({
              description: `Não é possível desativar produto com estoque (quantidade: ${estoqueData.quantidade}).`,
              variant: 'destructive',
            });
            setActiveTab('dadosCadastrais');
            return;
          }
        } catch (estoqueError) {
          console.error('Erro ao verificar estoque:', estoqueError);
        }
      }

      cadastroProdutoSchema.parse(produtoFinal);

      setLoading(true);
      await updateProduto(produtoFinal);

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
          setDadosOriginais(produtoNormalizado);
          setLoading(false);

          // Verifica se produto está em promoção ativa
          fetch(`/api/produtos/verificar-promocao?codprod=${produtoId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.emPromocao) {
                setEmPromocao(data.nomePromocao || 'Promoção ativa');
              } else {
                setEmPromocao(null);
              }
            })
            .catch(() => setEmPromocao(null));
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
          <div className="w-[35%] h-full flex justify-end gap-2 items-center">
            <button
              type="button"
              onClick={() => setModalExcluir(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              title="Excluir produto"
            >
              <Trash2 size={14} />
              Excluir
            </button>
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
              onClick={handleClose}
              className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Banner de promoção */}
        {emPromocao && (
          <div className="flex-shrink-0 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-300 dark:border-yellow-700 text-center">
            <span className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
              ⚠ PRODUTO EM PROMOÇÃO: {emPromocao}
            </span>
          </div>
        )}

        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
          {loading ? (
            <div className="w-full h-full">
              <Carregamento />
            </div>
          ) : (
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
          )}
        </div>

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

        {/* Modal de confirmação de exclusão */}
        <ConfirmationModal
          isOpen={modalExcluir}
          onClose={() => setModalExcluir(false)}
          onConfirm={handleExcluir}
          title="Excluir Produto"
          message={`Tem certeza que deseja excluir o produto ${produto.codprod} - ${produto.descr}? Esta ação pode ser desfeita.`}
          type="danger"
          confirmText="Excluir"
          cancelText="Cancelar"
          loading={excluindo}
        />

        {/* Confirmação antes de salvar */}
        {ConfirmacaoSalvarModal}
      </div>
    </div>
  );
}
