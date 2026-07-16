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
import {
  X,
  Ban,
  RotateCcw,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
  onSuccess?: (busca?: string) => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  produtoId: string;
  /** Lista ordenada de codprods do filtro atual — habilita navegar prev/próximo
   *  entre os produtos do filtro (como o navegador de registros do Delphi). */
  listaCodprods?: string[];
}

//dados para achar as abas com erro e poder chavear
const campoParaAba: Record<string, string> = {
  // Dados Cadastrais
  ref: 'dadosCadastrais',
  aplic_extendida: 'dadosCadastrais',
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
  ipi: 'dadosFiscais',
  percsubst: 'dadosFiscais',
  agregado: 'dadosFiscais',
  ii: 'dadosFiscais',
  descontopiscofins: 'dadosFiscais',

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
  listaCodprods,
}: ModalProps) {
  const [produto, setProduto] = useState<Produto>({} as Produto);
  const [dadosOriginais, setDadosOriginais] = useState<Produto>({} as Produto);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [emPromocao, setEmPromocao] = useState<string | null>(null);

  // Navegador de registros (prev/próximo conforme o filtro). O produto exibido
  // é sempre `codprodNav` (começa no produtoId e muda ao navegar).
  const [codprodNav, setCodprodNav] = useState<string>(produtoId);
  // Marca se houve algum salvamento durante a navegação (para recarregar a
  // listagem ao fechar, já que no modo navegação o salvar não fecha o modal).
  const [houveSalvamentoNav, setHouveSalvamentoNav] = useState(false);
  useEffect(() => {
    setCodprodNav(produtoId);
    setHouveSalvamentoNav(false);
  }, [produtoId]);
  const navLista = listaCodprods || [];
  const navIndex = navLista.indexOf(codprodNav);
  const navTotal = navLista.length;
  const temNav = navTotal > 1 && navIndex >= 0;

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

  // Há alterações não salvas em relação ao produto carregado?
  const temAlteracoesPendentes = () =>
    JSON.stringify(produto) !== JSON.stringify(dadosOriginais);

  // Navega para outro produto do filtro. Se houver alterações não salvas,
  // confirma antes de descartá-las (usa o modal estilizado padrão).
  const navegarPara = (i: number) => {
    if (i < 0 || i >= navTotal || navLista[i] === codprodNav) return;
    const trocar = () => setCodprodNav(navLista[i]);
    if (temAlteracoesPendentes()) {
      pedirConfirmacao(trocar, {
        title: 'Alterações não salvas',
        message:
          'Existem alterações não salvas neste produto.\n.:: Deseja descartá-las e ir para outro registro?',
        type: 'warning',
        confirmText: 'Descartar e continuar',
        cancelText: 'Ficar neste',
      });
      return;
    }
    trocar();
  };

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);
  const [modalExcluir, setModalExcluir] = useState(false);

  // Referência + Marca duplicada: o par não pode se repetir entre produtos.
  // (Só a referência repete legitimamente entre marcas — por isso a checagem é
  // do par, não da ref sozinha.)
  const [produtoDuplicado, setProdutoDuplicado] = useState<{
    codprod: string;
    ref: string;
    descr: string;
  } | null>(null);

  useEffect(() => {
    const ref = (produto.ref || '').trim();
    const codmarca = (produto.codmarca || '').trim();

    // Só acusa duplicidade que ESTE edit está criando. A base tem ~44 mil
    // produtos herdados do Oracle já duplicados em ref+marca (ex.: 1.117 com
    // ref "DESATIVADO"); avisar sem o usuário ter mexido em ref/marca encheria
    // a tela de alarme falso — e travar o save deixaria esses 44 mil
    // impossíveis de editar.
    const refMudou =
      ref.toUpperCase() !== (dadosOriginais.ref || '').trim().toUpperCase();
    const marcaMudou = codmarca !== (dadosOriginais.codmarca || '').trim();
    const alterouChave = refMudou || marcaMudou;

    if (!isOpen || !alterouChave || ref.length < 2 || !codmarca) {
      setProdutoDuplicado(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(
        `/api/produtos/verificar-ref-marca?ref=${encodeURIComponent(ref)}` +
          `&codmarca=${encodeURIComponent(codmarca)}` +
          // ignorarCodprod: senão o próprio produto em edição se acusaria
          `&ignorarCodprod=${encodeURIComponent(codprodNav)}`,
      )
        .then((r) => (r.ok ? r.json() : { existe: false }))
        .then((d) => setProdutoDuplicado(d.existe && d.produto ? d.produto : null))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [
    produto.ref,
    produto.codmarca,
    dadosOriginais.ref,
    dadosOriginais.codmarca,
    codprodNav,
    isOpen,
  ]);
  const [excluindo, setExcluindo] = useState(false);

  // Produto não é excluído, é desativado (inf='D'); ativar volta inf='-'.
  // Ver memória produto-status-ativo-inativo.
  const produtoInativo = String(produto.inf ?? '').trim() === 'D';

  const handleAlterarStatus = async () => {
    if (!produto.codprod) return;
    const acao = produtoInativo ? 'ativar' : 'desativar';
    setExcluindo(true);
    try {
      const response = await fetch('/api/produtos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprods: [produto.codprod], acao }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || 'Falha na operação');
      toast({
        description: `Produto ${produto.codprod} ${
          acao === 'ativar' ? 'ativado' : 'desativado'
        } com sucesso!`,
      });
      setModalExcluir(false);
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        description: error.message || 'Erro ao alterar status do produto',
        variant: 'destructive',
      });
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
    // Se salvou durante a navegação, recarrega a listagem ao fechar (mantendo
    // o filtro atual) para refletir as alterações feitas nos vários produtos.
    if (houveSalvamentoNav) {
      onSuccess?.();
    }
    // Limpa estado ao fechar modal
    setProduto({} as Produto);
    setErrors({});
    setActiveTab('dadosCadastrais');
    setLoading(true);
    setHouveSalvamentoNav(false);
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

      // Obs.: a validação de "Compra Direta = SIM exige Ref. de Fábrica" é
      // feita no backend (checa os vínculos no banco, sem depender de abrir a
      // aba); a mensagem retornada é exibida no catch abaixo.


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
          pedirConfirmacao(() => setActiveTab('dadosFiscais'), {
            title: 'CEST inválido',
            message: cestResult.message,
            type: 'warning',
            confirmText: 'OK',
            somenteOk: true,
          });
          return;
        }
      }

      // Validação Informativo: na edição, 'E' e 'S' são sempre inválidos;
      // 'D' exige checagem de estoque > 0 (conforme Delphi)
      const infVal = (produtoFinal.inf || '').toUpperCase();
      if (infVal === 'E' || infVal === 'S') {
        pedirConfirmacao(() => setActiveTab('dadosCadastrais'), {
          title: 'Informativo inválido',
          message: `Informativo "${infVal}" não é permitido para edição de produto.`,
          type: 'warning',
          confirmText: 'OK',
          somenteOk: true,
        });
        return;
      }

      // Verificar estoque antes de permitir desativar produto (inf='D')
      if (infVal === 'D' && produtoFinal.codprod) {
        try {
          const estoqueResp = await fetch(`/api/produtos/verificar-estoque?codprod=${encodeURIComponent(produtoFinal.codprod)}`);
          const estoqueData = await estoqueResp.json();
          if (estoqueData.temEstoque) {
            pedirConfirmacao(() => setActiveTab('dadosCadastrais'), {
              title: 'Produto com estoque',
              message: `Não é possível desativar produto com estoque (quantidade: ${estoqueData.quantidade}).`,
              type: 'warning',
              confirmText: 'OK',
              somenteOk: true,
            });
            return;
          }
        } catch (estoqueError) {
          console.error('Erro ao verificar estoque:', estoqueError);
        }
      }

      // Comissões Diferenciadas: se habilitadas (qualquer das 3 definida), exige
      // valor > 0 nas três comissões (Externa, Externa/Interna e Interna).
      const comissoes = [
        produtoFinal.comdifeext,
        produtoFinal.comdifeext_int,
        produtoFinal.comdifint,
      ];
      const comissaoAtiva = comissoes.some((v) => v !== undefined && v !== null);
      if (comissaoAtiva && comissoes.some((v) => !(Number(v) > 0))) {
        pedirConfirmacao(() => setActiveTab('dadosCadastrais'), {
          title: 'Comissões Diferenciadas',
          message:
            'Informe valor maior que 0 nas três comissões (Externa, Externa/Interna e Interna).',
          type: 'warning',
          confirmText: 'OK',
          somenteOk: true,
        });
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
          pedirConfirmacao(() => setActiveTab('referenciaFabrica'), {
            title: 'Marca divergente',
            message: `A Marca da referência de fábrica "${divergente.referencia}" difere da Marca informada na aba Dados Cadastrais.`,
            type: 'warning',
            confirmText: 'OK',
            somenteOk: true,
          });
          return;
        }
      }

      cadastroProdutoSchema.parse(produtoFinal);

      setLoading(true);
      await updateProduto(produtoFinal);

      setErrors({});

      toast({ description: 'Produto atualizado com sucesso!' });

      // Modo navegação (editar vários em sequência conforme o filtro): NÃO fecha
      // — mantém o produto na tela para continuar navegando. Atualiza o
      // "original" para voltar ao estado de "sem alterações".
      if (temNav) {
        setLoading(false);
        setDadosOriginais(produtoFinal);
        setHouveSalvamentoNav(true);
        return;
      }

      // Fecha o modal após sucesso sem reload. Sem argumento de propósito:
      // mantém o filtro que o usuário montou e só recarrega a lista com os
      // valores alterados. (Trocar o filtro pelo código do produto salvo
      // fazia o usuário perder a busca a cada edição.)
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 1500);
    } catch (error) {
      setLoading(false);
      // Mensagem específica do backend (ex.: Compra Direta exige Ref. Fábrica)
      const msgBackend = (error as any)?.response?.data?.error;

      // "Compra Direta = SIM exige Referência de Fábrica": modal estilizado
      // com OK que leva à aba Referência de Fábrica.
      if (msgBackend && /refer[êe]ncia de f[áa]brica/i.test(msgBackend)) {
        pedirConfirmacao(() => setActiveTab('referenciaFabrica'), {
          title: 'Referência de Fábrica obrigatória',
          message: msgBackend,
          type: 'warning',
          confirmText: 'OK',
          somenteOk: true,
        });
        return;
      }

      toast({
        description: msgBackend || 'Falha ao atualizar produto.',
        variant: 'destructive',
      });
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        // Ordenar erros pela sequência das abas. Campos não mapeados vão pro
        // FIM (999), para que o primeiro erro seja sempre de uma aba conhecida
        // (e a navegação funcione).
        const tabOrder = ['dadosCadastrais', 'dadosFiscais', 'dadosCustos', 'referenciaFabrica'];
        const idxAba = (field: unknown) => {
          const i = tabOrder.indexOf(campoParaAba[String(field)] || '');
          return i < 0 ? 999 : i;
        };
        const sortedErrors = [...error.errors].sort(
          (a, b) => idxAba(a.path[0]) - idxAba(b.path[0]),
        );
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

    if (codprodNav && isOpen) {
      const fetchUsuario = async () => {
        try {
          setLoading(true);
          // Limpa o estado anterior antes de carregar novo produto
          setProduto({} as Produto);
          setErrors({});
          setActiveTab('dadosCadastrais');

          const produtoData = await getProduto(
            codprodNav as string,
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
          fetch(`/api/produtos/verificar-promocao?codprod=${codprodNav}`)
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
  }, [codprodNav, isOpen, toast]);

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
          <header className="mb-0 w-[60%] flex items-center gap-4">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-300 whitespace-nowrap">
              Editar Produto
            </h4>
            {/* Navegador de registros (igual ao Delphi): percorre os produtos do
                filtro atual, salvando e mantendo na tela. */}
            {temNav && (
              <div className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => navegarPara(0)}
                  disabled={navIndex <= 0}
                  title="Primeiro"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                >
                  <ChevronFirst size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navegarPara(navIndex - 1)}
                  disabled={navIndex <= 0}
                  title="Anterior"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                  {navIndex + 1} / {navTotal}
                </span>
                <button
                  type="button"
                  onClick={() => navegarPara(navIndex + 1)}
                  disabled={navIndex >= navTotal - 1}
                  title="Próximo"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navegarPara(navTotal - 1)}
                  disabled={navIndex >= navTotal - 1}
                  title="Último"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                >
                  <ChevronLast size={16} />
                </button>
              </div>
            )}
          </header>
          <div className="w-[35%] h-full flex justify-end gap-2 items-center">
            <button
              type="button"
              onClick={() => setModalExcluir(true)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded transition-colors ${
                produtoInativo
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={produtoInativo ? 'Ativar produto' : 'Desativar produto'}
            >
              {produtoInativo ? <RotateCcw size={14} /> : <Ban size={14} />}
              {produtoInativo ? 'Ativar' : 'Desativar'}
            </button>
            {footer || (
              <FormFooter
                onSubmit={() => {
                  // Confirmação padrão de salvar (usa as opções do hook)
                  const confirmarSalvar = () => pedirConfirmacao(handleSubmit);

                  // Ref+Marca que ESTE edit passou a duplicar. Avisa e deixa
                  // decidir — igual ao cadastro, que também não impede.
                  if (produtoDuplicado) {
                    pedirConfirmacao(confirmarSalvar, {
                      title: 'Referência já cadastrada nessa marca',
                      message: `A referência "${produtoDuplicado.ref}" já é do produto ${produtoDuplicado.codprod} - ${produtoDuplicado.descr} nessa marca.\n.:: Deseja salvar assim mesmo?`,
                      type: 'warning',
                      confirmText: 'Sim, salvar assim',
                      cancelText: 'Não',
                      onCancel: () => setActiveTab('dadosCadastrais'),
                    });
                    return;
                  }

                  // Aviso do Delphi (mesmo modal estilizado): Tributado = SIM
                  // e % Agregado = 0.
                  if (
                    produto.trib === 'S' &&
                    (Number(produto.percsubst) || 0) === 0
                  ) {
                    pedirConfirmacao(confirmarSalvar, {
                      title: 'Substituição Tributária',
                      message:
                        'Informe o percentual agregado para cálculo da Substituição Tributária.\n.:: Deseja salvar sem essa informação?',
                      type: 'warning',
                      confirmText: 'Sim, salvar assim',
                      cancelText: 'Não',
                      onCancel: () => setActiveTab('dadosFiscais'),
                    });
                    return;
                  }
                  confirmarSalvar();
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

        {/* Referência + Marca já usada por outro produto. Faixa em vez de modal
            para não interromper quem está digitando — o save é bloqueado. */}
        {produtoDuplicado && (
          <div className="flex-shrink-0 px-4 py-2 bg-red-100 dark:bg-red-900/30 border-b border-red-300 dark:border-red-700 text-center">
            <span className="text-sm font-bold text-red-800 dark:text-red-200">
              ⚠ REFERÊNCIA &quot;{produtoDuplicado.ref}&quot; JÁ É DO PRODUTO{' '}
              {produtoDuplicado.codprod} - {produtoDuplicado.descr} NESSA MARCA
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
                  {/* preventDefault: evita que Enter/submit implícito recarregue
                      a página (fechava o modal e zerava a listagem). O salvar é
                      feito pelos botões, não pelo submit do form. */}
                  <form onSubmit={(e) => e.preventDefault()}>
                    {renderTabContent()}
                  </form>
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

        {/* Confirmação de desativar / ativar */}
        <ConfirmationModal
          isOpen={modalExcluir}
          onClose={() => setModalExcluir(false)}
          onConfirm={handleAlterarStatus}
          title={produtoInativo ? 'Ativar Produto' : 'Desativar Produto'}
          message={
            produtoInativo
              ? `Deseja ativar o produto ${produto.codprod} - ${produto.descr}?`
              : `Deseja desativar o produto ${produto.codprod} - ${produto.descr}? Ele deixa de aparecer nos ativos, mas pode ser ativado depois.`
          }
          type={produtoInativo ? 'info' : 'warning'}
          confirmText={produtoInativo ? 'Ativar' : 'Desativar'}
          cancelText="Cancelar"
          loading={excluindo}
        />

        {/* Confirmação antes de salvar */}
        {ConfirmacaoSalvarModal}
      </div>
    </div>
  );
}
