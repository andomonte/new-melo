import React, { useState, useEffect } from 'react';
import { X, Package2, Search, CheckCircle, AlertCircle, Settings, Plus, Minus, Lightbulb, Zap, FileText, Save, ChevronDown, ChevronUp, ChevronLeft, Loader2, Wand2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InputMoeda from '@/components/common/InputMoeda';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NFeDTO } from '../types';
import { formatCurrency } from '../utils/formatters';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import MessageModal from '@/components/common/MessageModal';
import DecisionModal from '@/components/common/DecisionModal';
import { SugestoesOCModal } from '../../Entradas/components/SugestoesOCModal';
import { useSugestoesOC, ItemNFe as ItemNFeAPI } from '../../Entradas/hooks/useSugestoesOC';
import { DivergenciasPrecoAlert } from './DivergenciasPrecoAlert';
import { SugestoesAutomaticas } from './SugestoesAutomaticas';
import { CentroCustoModal } from './CentroCustoModal';
import { SugestaoInteligenteAlert } from './SugestaoInteligenteAlert';
import { ListaSugestoesInteligentes } from './ListaSugestoesInteligentes';
import { useSugestaoInteligente } from '../hooks/useSugestaoInteligente';
import { useNavegacaoTecladoTabela, CLASSE_LINHA_ATIVA } from '@/hooks/useNavegacaoTecladoTabela';
import { toast } from 'sonner';

interface NFeItemsAssociationModalProps {
  isOpen: boolean;
  nfe: NFeDTO;
  onClose: () => void;
  onComplete: (associatedItems: AssociatedItem[]) => void;
  onRefetch?: () => void;
  /** Volta para a etapa anterior (Confirmação dos Dados da Nota). */
  onVoltar?: () => void;
  loading?: boolean;
  userId?: string;
  userName?: string;
}

interface NFeItem {
  id: string;
  referencia: string;
  descricao: string;
  codigoBarras?: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  status: 'pending' | 'associated' | 'error';
  produtoAssociado?: Produto;
  associacoes: ItemAssociation[];
}

interface Produto {
  id: string;
  referencia: string;
  ref?: string; // Referência de fábrica (dbprod.ref)
  descricao: string;
  codigoBarras?: string;
  marca: string;
  estoque: number;
  tipo: string;
  localizacao?: string;
  quantidadePedido?: number;       // Quantidade do pedido (para cálculo de divergência)
  valorUnitarioPedido?: number;    // Valor unitário do pedido (para cálculo de divergência)
  valorUnitarioNF?: number;        // ⭐ Valor unitário da NF (XML) - usado para validação Meia Nota
}

interface OrdemCompra {
  id: string;
  codigoRequisicao: string;
  filial: string;
  codCredor: string;
  fornecedor: string;
  quantidadeDisponivel: number;
  quantidadeAssociar: number;
  valorUnitario: number;
  dataPrevisao: string;
  multiplo: number;
  descricaoMarca: string;
  precoCompra: number;
  dolar: number;
}

interface ItemAssociation {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

interface AssociatedItem {
  nfeItemId: string;
  produtoId: string;
  associacoes: ItemAssociation[];
  meianota: boolean;
  precoReal?: number;
  rateio?: string;
  criterioRateio?: string;
  centroCusto?: string;
  // ⭐ CAMPO PARA MEIA NOTA (quantidade sempre = quantidade do pedido)
  precoUnitarioNF?: number;   // Preço unitário informado na Nota Fiscal
}

// Interface para item da OC
interface ItemOC {
  codprod: string;
  referencia?: string;  // Referência Melo do produto
  descricao: string;
  quantidade_oc: number;
  quantidade_atendida: number;
  quantidade_disponivel: number;
  valor_unitario: number;
}

// Interface para ordem encontrada automaticamente via xPed/infCpl
interface OrdemAutomatica {
  orc_id: number;
  req_id: number;
  req_versao: number;
  req_id_composto: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  data_ordem: string;
  status: string;
  valor_total: number;
  fonte: 'xped' | 'infcpl' | 'sugestao';
  score?: number;
  itens_match?: Array<{
    codprod: string;
    referencia?: string;     // Referência Melo do produto
    descricao: string;
    quantidade_oc: number;
    quantidade_nfe: number;
    quantidade_disponivel: number;
    // Dados do item da NFe correspondente
    nItem_nfe?: string;      // Número do item na NFe (1, 2, 3...)
    cProd_nfe?: string;      // Código do produto na NFe (referência fornecedor)
    descricao_nfe?: string;  // Descrição do item na NFe
  }>;
  itens_oc?: ItemOC[]; // Todos os itens da OC para associação
}

// Função para calcular similaridade entre duas descrições
// Retorna um score de 0 a 100 baseado em palavras em comum
const calcularSimilaridade = (descricao1: string, descricao2: string): number => {
  if (!descricao1 || !descricao2) return 0;

  // Normalizar: remover acentos, converter para maiúsculas, remover caracteres especiais
  const normalizar = (str: string) => {
    return str
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^A-Z0-9\s]/g, ' ') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  };

  const texto1 = normalizar(descricao1);
  const texto2 = normalizar(descricao2);

  // Extrair palavras significativas (mínimo 2 caracteres, ignorar números puros < 3 dígitos)
  const extrairPalavras = (texto: string) => {
    return texto.split(' ')
      .filter(p => p.length >= 2)
      .filter(p => !/^\d{1,2}$/.test(p)) // Ignora números de 1-2 dígitos
      .filter(p => !['DE', 'DA', 'DO', 'COM', 'SEM', 'PARA', 'POR', 'EM', 'NA', 'NO', 'AS', 'OS', 'UM', 'UMA'].includes(p));
  };

  const palavras1 = extrairPalavras(texto1);
  const palavras2 = extrairPalavras(texto2);

  if (palavras1.length === 0 || palavras2.length === 0) return 0;

  // Contar palavras em comum (match exato ou parcial)
  let matches = 0;
  let matchesParciais = 0;

  for (const p1 of palavras1) {
    for (const p2 of palavras2) {
      if (p1 === p2) {
        matches++;
        break;
      } else if (p1.includes(p2) || p2.includes(p1)) {
        matchesParciais += 0.5;
        break;
      }
    }
  }

  const totalMatches = matches + matchesParciais;
  const menorArray = Math.min(palavras1.length, palavras2.length);

  // Score baseado na proporção de matches
  const score = (totalMatches / menorArray) * 100;

  return Math.min(100, Math.round(score));
};

// Threshold mínimo para considerar um match válido
const THRESHOLD_SIMILARIDADE = 30;

export const NFeItemsAssociationModal: React.FC<NFeItemsAssociationModalProps> = ({
  isOpen,
  nfe,
  onClose,
  onComplete,
  onRefetch,
  onVoltar,
  loading = false,
  userId,
  userName
}) => {
  const [items, setItems] = useState<NFeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<NFeItem | null>(null);
  const [showAllItensOC, setShowAllItensOC] = useState(false); // Accordion para todos os itens da OC
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // Item aguardando confirmação de "Desassociar" (null = nenhum).
  const [itemParaDesassociar, setItemParaDesassociar] = useState<NFeItem | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [messageData, setMessageData] = useState({ title: '', message: '', type: 'info' as any });
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [associacoesSalvas, setAssociacoesSalvas] = useState(false); // Flag para evitar múltiplas associações
  const [salvandoAssociacoes, setSalvandoAssociacoes] = useState(false); // Loading do botão de concluir

  // ✅ NOVO: Modal de decisão após salvar associações
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [associatedItemsTemp, setAssociatedItemsTemp] = useState<AssociatedItem[]>([]);

  // ✅ NOVO: Dados de rateio e centro de custo temporários para cada item
  const [tempRateioData, setTempRateioData] = useState<Map<string, {
    rateio?: string;
    criterioRateio?: string;
    centroCusto?: string;
    meiaNota: boolean;
    precoUnitarioNF?: number;   // Só preço, quantidade sempre = quantidade do pedido
  }>>(new Map());

  // Hook de sugestões inteligentes (OCs)
  const [showSugestoesModal, setShowSugestoesModal] = useState(false);
  const [showSugestoesAutomaticas, setShowSugestoesAutomaticas] = useState(false);
  const [produtoSugestaoSelecionado, setProdutoSugestaoSelecionado] = useState<string>('');
  const {
    sugestoes,
    loading: loadingSugestoes,
    buscarSugestoes,
    criteriosUtilizados,
    totalOCsAnalisadas
  } = useSugestoesOC();

  // 🧠 Hook de Sugestão Inteligente (Produtos aprendidos)
  const { buscarSugestao, loading: loadingSugestaoInteligente } = useSugestaoInteligente();
  const [sugestaoUnica, setSugestaoUnica] = useState<any>(null);
  const [sugestoesMultiplas, setSugestoesMultiplas] = useState<any[]>([]);

  // Sugestão automática começa COLAPSADA (dá espaço à tabela); o usuário abre se quiser.
  const [mostrarSugestao, setMostrarSugestao] = useState<boolean>(false);
  // Tabela compacta de itens: linha expandida (detalhes) e filtro por status.
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);
  const [filtroStatusItem, setFiltroStatusItem] = useState<'todos' | 'pending' | 'associated'>('todos');
  // ⚡ BUSCA AUTOMÁTICA DE ORDEM (xPed / infCpl)
  const [ordemAutomatica, setOrdemAutomatica] = useState<OrdemAutomatica | null>(null);
  const [ordensAutomaticas, setOrdensAutomaticas] = useState<OrdemAutomatica[]>([]);
  const [metodoOrdemAutomatica, setMetodoOrdemAutomatica] = useState<string>('');
  const [loadingOrdemAutomatica, setLoadingOrdemAutomatica] = useState(false);
  const [dadosCompraXML, setDadosCompraXML] = useState<{ infCpl?: string; xPed?: string } | null>(null);
  const [showSugestaoUnica, setShowSugestaoUnica] = useState(false);
  const [showSugestoesMultiplas, setShowSugestoesMultiplas] = useState(false);

  // 🤖 Estado do modo automático
  const [loadingAutoAssociacao, setLoadingAutoAssociacao] = useState(false);

  // Carregar dados reais do XML via API
  useEffect(() => {
    if (isOpen && items.length === 0) {
      carregarDadosXML();
    }
    // Resetar flag quando abrir o modal
    if (isOpen) {
      setAssociacoesSalvas(false);
    }
  }, [isOpen]);

  const carregarDadosXML = async () => {
    try {
      // 1. Carregar dados do XML
      const xmlResponse = await fetch('/api/entrada-xml/extrair-dados-xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nfe_id: nfe.id
        })
      });

      const xmlResult = await xmlResponse.json();

      if (!xmlResult.success || !xmlResult.data) {
        throw new Error(xmlResult.message || 'Erro ao carregar dados do XML');
      }

      const xmlData = xmlResult.data;

      // 2. Carregar progresso salvo (se existir)
      let progressoSalvo: any = null;
      try {
        const progressoResponse = await fetch(`/api/entrada-xml/carregar-progresso?nfeId=${nfe.id}`);

        if (progressoResponse.ok) {
          const progressoResult = await progressoResponse.json();

          if (progressoResult.success && progressoResult.data) {
            progressoSalvo = progressoResult.data;
          }
        }
      } catch (progressoError) {
        // NFe nova - sem progresso salvo
      }

      // 3. Mesclar dados do XML com progresso salvo
      const progressoMap = new Map(
        progressoSalvo?.items.map((item: any) => [item.nfeItemId, item]) || []
      );

      const itensXML: NFeItem[] = xmlData.itens.map((item: any) => {
        const progressoItem = progressoMap.get(item.id);

        // Se tem progresso salvo, usar ele; senão, criar novo
        if (progressoItem) {
          return {
            id: item.id,
            referencia: item.codigo_produto,
            descricao: item.descricao,
            codigoBarras: item.codigo_barras,
            ncm: item.ncm,
            cfop: item.cfop,
            unidade: item.unidade,
            quantidade: item.quantidade,
            valorUnitario: item.valor_unitario,
            valorTotal: item.valor_total,
            status: progressoItem.status,
            produtoAssociado: {
              id: progressoItem.produtoId,
              referencia: progressoItem.produtoId,
              descricao: progressoItem.produtoDescricao || 'Produto associado',
              codigoBarras: item.codigo_barras,
              marca: 'TOYOTA',
              estoque: 0,
              tipo: 'P'
            },
            associacoes: progressoItem.associacoes
          };
        }

        // Item novo (sem progresso salvo)
        return {
          id: item.id,
          referencia: item.codigo_produto,
          descricao: item.descricao,
          codigoBarras: item.codigo_barras,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valorUnitario: item.valor_unitario,
          valorTotal: item.valor_total,
          status: item.produto_sugerido ? 'associated' : 'pending',
          produtoAssociado: item.produto_sugerido ? {
            id: item.produto_sugerido.id,
            referencia: item.produto_sugerido.referencia,
            descricao: item.produto_sugerido.descricao,
            codigoBarras: item.codigo_barras,
            marca: 'TOYOTA',
            estoque: 0,
            tipo: 'P'
          } : undefined,
          associacoes: []
        };
      });

      setItems(itensXML);

      // ⚡ 4. BUSCAR ORDEM AUTOMATICAMENTE (xPed / infCpl / sugestão)
      // Guardar dados de compra do XML para exibição
      if (xmlData.compra) {
        setDadosCompraXML(xmlData.compra);
      }

      // Tentar buscar ordem automaticamente
      await buscarOrdemAutomatica(xmlData.itens, xmlData.compra);

    } catch (error) {
      console.error('Erro ao carregar dados do XML:', error);
      // Fallback para dados mockados em caso de erro
      carregarDadosMock();
    }
  };

  // ⚡ Função para buscar ordem automaticamente via xPed/infCpl
  const buscarOrdemAutomatica = async (itensXML: any[], dadosCompra?: any) => {
    try {
      setLoadingOrdemAutomatica(true);

      // Preparar dados para a API
      const itensParaBusca = itensXML.map((item: any) => ({
        nItem: item.id || item.nitem,
        cProd: item.codigo_produto || item.cprod,
        xProd: item.descricao || item.xprod,
        qCom: item.quantidade || item.qcom,
        vUnCom: item.valor_unitario || item.vuncom,
        xPed: item.xPed || item.xped,
        nItemPed: item.nItemPed || item.nitemped
      }));

      const response = await fetch('/api/entrada-xml/buscar-ordem-automatica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: nfe.chave || nfe.id,
          numero: nfe.numero,
          serie: nfe.serie,
          cnpjEmitente: nfe.cnpjEmitente,
          nomeEmitente: nfe.fornecedor || nfe.razaoSocialEmitente,
          dataEmissao: nfe.dataEmissao,
          valorTotal: nfe.valorTotal,
          infCpl: dadosCompra?.infCpl,
          itens: itensParaBusca,
          limiteResultados: 5
        })
      });

      const result = await response.json();

      if (result.success && result.data && result.data.ordens.length > 0) {
        const { metodo_utilizado, ordens, detalhes } = result.data;

        // Filtrar apenas ordens com pelo menos 1 match e ordenar por mais matches
        const ordensComMatch = ordens
          .filter((o: any) => (o.itens_match?.length || 0) > 0)
          .sort((a: any, b: any) => (b.itens_match?.length || 0) - (a.itens_match?.length || 0));

        setOrdensAutomaticas(ordens); // Manter todas para referência

        if (ordensComMatch.length > 0) {
          setOrdemAutomatica(ordensComMatch[0]); // Selecionar a com mais matches
          setMetodoOrdemAutomatica(metodo_utilizado);

          // Toast de sucesso
          const fonteTexto = metodo_utilizado === 'xped' ? 'xPed do XML' :
                            metodo_utilizado === 'infcpl' ? 'Informações Complementares' : 'Sugestão Inteligente';
          toast.success(`Ordem ${ordensComMatch[0].req_id_composto} encontrada via ${fonteTexto}!`);
        } else {
          // Não há ordens com match - não mostrar o box verde
          setOrdemAutomatica(null);
          setMetodoOrdemAutomatica('');
        }
      } else {
        setOrdemAutomatica(null);
        setOrdensAutomaticas([]);
        setMetodoOrdemAutomatica('');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar ordem automaticamente:', error);
      setOrdemAutomatica(null);
      setOrdensAutomaticas([]);
    } finally {
      setLoadingOrdemAutomatica(false);
    }
  };

  // Fallback com dados mock para testes
  const carregarDadosMock = () => {
    const mockItems: NFeItem[] = [
      {
        id: '1',
        referencia: '',
        descricao: 'ALTO-FALANTE P4X 69 TOYOTA',
        codigoBarras: '85182100', // Código de barras real do produto
        ncm: '85182100', // NCM do produto
        cfop: '6949',
        unidade: 'P',
        quantidade: 2,
        valorUnitario: 84.90,
        valorTotal: 169.80,
        status: 'pending',
        associacoes: []
      }
    ];
    setItems(mockItems);
  };

  const getStatusColor = (status: NFeItem['status']) => {
    switch (status) {
      case 'associated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: NFeItem['status']) => {
    switch (status) {
      case 'associated':
        return <CheckCircle size={16} className="text-blue-600" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-600" />;
      default:
        return <Package2 size={16} className="text-gray-600" />;
    }
  };

  const handleAssociarProduto = async (item: NFeItem) => {
    setSelectedItem(item);

    // 🔄 MODO EDIÇÃO: Se já tem produto associado E tem associações (status 'associated')
    // Abrir diretamente o modal de pedidos com associações existentes para permitir edição
    if (item.status === 'associated' && item.produtoAssociado && item.associacoes && item.associacoes.length > 0) {
      setShowPedidosModal(true);
      return;
    }

    // Se já tem produto associado mas não tem associações completas, buscar sugestões automáticas de OCs
    if (item.produtoAssociado) {
      setProdutoSugestaoSelecionado(item.produtoAssociado.id);
      setShowSugestoesAutomaticas(true);
      return;
    }

    // 🎯 PRIORIDADE 0: Se o match automático encontrou uma OC para ESTE item,
    // associa o produto e abre DIRETO o modal de ordens (mesmo caminho do botão
    // "Associar" da tabela de correspondência) — sem mensagem guiada.
    if (ordemAutomatica && ordemAutomatica.itens_match && ordemAutomatica.itens_match.length > 0) {
      const match = ordemAutomatica.itens_match.find((m) => m.nItem_nfe === item.id);
      if (match) {
        const itemOC: ItemOC = {
          codprod: match.codprod,
          descricao: match.descricao,
          quantidade_oc: match.quantidade_oc,
          quantidade_atendida: match.quantidade_oc - match.quantidade_disponivel,
          quantidade_disponivel: match.quantidade_disponivel,
          valor_unitario: 0,
        };
        handleAssociarItemOC(itemOC, item);
        return;
      }
      // Sem match para este item específico → segue para as demais prioridades.
    }

    // 🧠 PRIORIDADE 1: Tentar SUGESTÃO INTELIGENTE (produtos aprendidos)
    const codCredorNFe = nfe.fornecedorCodigo || nfe.cnpjEmitente || '';
    if (item.referencia && codCredorNFe) {
      try {
        const sugestaoResult = await buscarSugestao(
          item.referencia,
          codCredorNFe,
          undefined // marca opcional
        );

        if (sugestaoResult && sugestaoResult.jaVisto && sugestaoResult.sugestoes) {
          const sugestoes = sugestaoResult.sugestoes;

          // DECISÃO INTELIGENTE:
          // 1. Se 1 sugestão de ALTA confiança → Auto-aceitar (mostra alert para confirmar)
          // 2. Se 1 sugestão de MÉDIA confiança → Mostra alert para confirmar
          // 3. Se múltiplas sugestões → Mostra lista para escolher

          if (sugestoes.length === 1) {
            const unica = sugestoes[0];
            setSugestaoUnica(unica);
            setShowSugestaoUnica(true);
            return;
          } else {
            setSugestoesMultiplas(sugestoes);
            setShowSugestoesMultiplas(true);
            return;
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar sugestão inteligente:', error);
        // Continuar fluxo normal
      }
    }

    // Primeiro tentar busca automática por código de barras
    if (item.codigoBarras) {
      try {
        const response = await fetch(`/api/entrada-xml/produtos/search?search=${encodeURIComponent(item.codigoBarras)}`);
        const apiData = await response.json();

        if (apiData.success && apiData.data && apiData.data.length > 0) {
          // Se encontrou produto automaticamente por código de barras
          const produtoEncontrado = apiData.data[0];

          const produtoMapeado: Produto = {
            id: produtoEncontrado.id,
            referencia: produtoEncontrado.referencia,
            descricao: produtoEncontrado.descricao,
            codigoBarras: produtoEncontrado.codigoBarras,
            marca: produtoEncontrado.marca,
            estoque: produtoEncontrado.estoque,
            tipo: produtoEncontrado.tipo
          };

          setSelectedProduct(produtoMapeado);
          setShowProductDetails(true);
          return; // Pula a busca manual
        }
      } catch (error) {
        // Erro na busca automática, continuar para busca manual
      }
    }

    // Se não encontrou automaticamente, abrir modal de busca manual
    setShowProductSearch(true);
  };

  const handleSelecionarProduto = (produto: Produto) => {
    setSelectedProduct(produto);
    setShowProductSearch(false);
    setShowProductDetails(true);
  };

  // 🧠 Handlers de Sugestão Inteligente
  const handleAceitarSugestaoUnica = () => {
    if (!sugestaoUnica || !selectedItem) return;

    const produtoSugerido: Produto = {
      id: sugestaoUnica.codprod,
      referencia: sugestaoUnica.referencia,
      descricao: sugestaoUnica.descricao,
      marca: sugestaoUnica.marca,
      estoque: sugestaoUnica.estoque,
      tipo: sugestaoUnica.tipo
    };

    setSelectedProduct(produtoSugerido);
    setShowSugestaoUnica(false);
    setSugestaoUnica(null);
    setShowProductDetails(true);
  };

  const handleRecusarSugestaoUnica = () => {
    setShowSugestaoUnica(false);
    setSugestaoUnica(null);
    setShowProductSearch(true);
  };

  const handleSelecionarDaLista = (produto: any) => {
    const produtoSelecionado: Produto = {
      id: produto.codprod,
      referencia: produto.referencia,
      descricao: produto.descricao,
      marca: produto.marca,
      estoque: produto.estoque,
      tipo: produto.tipo
    };

    setSelectedProduct(produtoSelecionado);
    setShowSugestoesMultiplas(false);
    setSugestoesMultiplas([]);
    setShowProductDetails(true);
  };

  const handleBuscarManualmenteDaLista = () => {
    setShowSugestoesMultiplas(false);
    setSugestoesMultiplas([]);
    setShowProductSearch(true);
  };

  const handleFecharListaSugestoes = () => {
    setShowSugestoesMultiplas(false);
    setSugestoesMultiplas([]);
  };

  const handleConfirmarProduto = (data: {
    rateio: string;
    criterioRateio?: string;
    centroCusto?: string;
    meiaNota: boolean;
    precoUnitarioNF?: number;
  }) => {
    if (selectedProduct && selectedItem) {
      // Armazenar dados de rateio/centro de custo para este item
      const newTempData = new Map(tempRateioData);
      newTempData.set(selectedItem.id, data);
      setTempRateioData(newTempData);

      const updatedItem = {
        ...selectedItem,
        produtoAssociado: selectedProduct,
        // Manter status como pending até associar com pedidos
        status: 'pending' as const
      };

      const updatedItems = items.map(item =>
        item.id === selectedItem.id ? updatedItem : item
      );
      setItems(updatedItems);
      // IMPORTANTE: Atualizar selectedItem TAMBÉM para que o modal de pedidos receba o produto associado
      setSelectedItem(updatedItem);
      setShowProductDetails(false);
      setSelectedProduct(null);
      // Após associar produto, buscar pedidos disponíveis
      setShowPedidosModal(true);
    }
  };

  // Função para associar item da OC diretamente ao item da NFe selecionado
  // itemNFeOverride permite passar o item da NFe diretamente (útil quando chamado da tabela de correspondência)
  const handleAssociarItemOC = async (itemOC: ItemOC, itemNFeOverride?: NFeItem) => {
    // Se foi passado um item diretamente, usar ele. Senão, usar o selecionado
    let itemParaAssociar = itemNFeOverride || selectedItem;

    if (!itemParaAssociar) {
      // Verificar itens pendentes
      const itensPendentes = items.filter(i => i.status === 'pending');

      if (itensPendentes.length === 0) {
        toast.error('Não há itens pendentes para associar');
        return;
      }

      if (itensPendentes.length === 1) {
        // Se só tem 1 item pendente, usar automaticamente
        itemParaAssociar = itensPendentes[0];
        setSelectedItem(itemParaAssociar);
        toast.info(`Associando ao item: ${itemParaAssociar.descricao?.substring(0, 40)}...`);
      } else {
        // Se tem múltiplos, pedir para selecionar
        toast.warning(`${itensPendentes.length} itens pendentes. Clique em "🔍 Associar" no item da NFe que deseja vincular primeiro.`, {
          duration: 5000
        });
        return;
      }
    }

    // Garantir que o item selecionado está atualizado no estado
    if (itemNFeOverride) {
      setSelectedItem(itemNFeOverride);
    }

    try {
      // 1. Buscar produto pelo codprod
      const response = await fetch(`/api/entrada-xml/produtos/search?search=${itemOC.codprod}`);
      const data = await response.json();

      if (!data.success || !data.data?.length) {
        toast.error('Produto não encontrado no sistema');
        return;
      }

      const produto = data.data[0];

      // 2. Criar objeto do produto associado
      const produtoAssociado: Produto = {
        id: produto.id,
        referencia: produto.referencia,
        descricao: produto.descricao,
        codigoBarras: produto.codigoBarras,
        marca: produto.marca,
        estoque: produto.estoque,
        tipo: produto.tipo,
        localizacao: produto.localizacao
      };

      // 3. Atualizar item com produto associado
      const updatedItem = {
        ...itemParaAssociar,
        produtoAssociado,
        status: 'pending' as const
      };

      const updatedItems = items.map(item =>
        item.id === itemParaAssociar.id ? updatedItem : item
      );

      setItems(updatedItems);
      setSelectedItem(updatedItem);

      // 4. Fechar modal de busca se estiver aberto
      setShowProductSearch(false);
      setShowProductDetails(false);

      // 5. Abrir modal de pedidos
      setShowPedidosModal(true);

      toast.success(`Produto ${itemOC.codprod} associado!`);
    } catch (error) {
      console.error('Erro ao associar item da OC:', error);
      toast.error('Erro ao associar produto');
    }
  };

  // Desassocia um item: remove produto + associações e volta para "pendente".
  // A remoção fica no estado; é persistida ao clicar em "Salvar Progresso"
  // ou "Concluir Associações".
  const handleDesassociarItem = (item: NFeItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, produtoAssociado: undefined, associacoes: [], status: 'pending' as const }
          : i,
      ),
    );
    setTempRateioData((prev) => {
      const m = new Map(prev);
      m.delete(item.id);
      return m;
    });
    if (itemExpandido === item.id) setItemExpandido(null);
    setItemParaDesassociar(null);
    toast.info('Item desassociado. Salve o progresso para confirmar.');
  };

  const handleConfirmarAssociacoes = async () => {
    // Verificar se já está salvando (evita cliques duplos)
    if (salvandoAssociacoes) {
      return;
    }

    // Verificar se já foram salvas (evita múltiplas associações)
    if (associacoesSalvas) {
      setMessageData({
        title: 'Associações já salvas',
        message: 'As associações já foram salvas. Feche este modal e prossiga para gerar a entrada.',
        type: 'info'
      });
      setShowMessage(true);
      return;
    }

    // Validação final: todos os itens devem estar associados
    const itensNaoAssociados = items.filter(item => item.status !== 'associated');

    if (itensNaoAssociados.length > 0) {
      setMessageData({
        title: 'Campos obrigatórios não preenchidos',
        message: `Há ${itensNaoAssociados.length} item(s) não associado(s) a pedidos de compra. Você deve associá-los integralmente antes de continuar.`,
        type: 'warning'
      });
      setShowMessage(true);
      return;
    }

    // Validação adicional: verificar se todas as quantidades batem
    const itensComQuantidadeIncorreta = items.filter(item => {
      const totalAssociado = item.associacoes?.reduce((sum, a) => sum + a.quantidade, 0) || 0;
      return totalAssociado !== item.quantidade;
    });

    if (itensComQuantidadeIncorreta.length > 0) {
      setMessageData({
        title: 'Quantidade deve ser associada integralmente',
        message: 'HÁ QUANTIDADE SOBRANDO DESTE ITEM. VOCÊ DEVE ASSOCIÁ-LA INTEGRALMENTE A PEDIDOS DE COMPRA.',
        type: 'warning'
      });
      setShowMessage(true);
      return;
    }

    // IMPORTANTE: Salvar associações no banco antes de gerar entrada
    setSalvandoAssociacoes(true);
    try {
      const associatedItems: AssociatedItem[] = items
        .filter(item => item.status === 'associated')
        .map(item => {
          // Pegar dados de rateio/centro de custo temporários
          const rateioData = tempRateioData.get(item.id);

          return {
            nfeItemId: item.id,
            produtoId: item.produtoAssociado?.id || '', // 🐛 FIX: Usar id (codprod) que é a FK correta
            associacoes: item.associacoes,
            meianota: rateioData?.meiaNota || false,
            precoUnitarioNF: rateioData?.meiaNota ? rateioData?.precoUnitarioNF : undefined,
            rateio: rateioData?.rateio,
            criterioRateio: rateioData?.criterioRateio,
            centroCusto: rateioData?.centroCusto,
            // 🧠 APRENDIZADO INTELIGENTE: Passar dados para salvar na dbref_fabrica
            referenciaNFe: item.referencia, // cProd da NFe (código do fornecedor)
            codMarca: item.produtoAssociado?.marca // marca do produto associado
          };
        });

      const response = await fetch('/api/entrada-xml/associar-itens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nfeId: nfe.id,
          associatedItems,
          userId,
          userName,
          _timestamp: new Date().getTime() // Debug - garantir codigo novo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar associações');
      }

      // Marcar que as associações foram salvas
      setAssociacoesSalvas(true);

      // ✅ NOVO: Preparar dados e mostrar modal de decisão
      const associatedItemsFinal: AssociatedItem[] = items
        .filter(item => item.status === 'associated')
        .map(item => ({
          nfeItemId: item.id,
          produtoId: item.produtoAssociado?.id || '', // 🐛 FIX: Usar id (codprod) que é a FK correta
          associacoes: item.associacoes,
          meianota: false
        }));

      // Guardar itens associados temporariamente
      setAssociatedItemsTemp(associatedItemsFinal);

      // Mostrar modal de decisão
      setShowDecisionModal(true);

    } catch (error) {
      console.error('Erro ao salvar associações:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setMessageData({
        title: 'Erro ao salvar associações',
        message: errorMessage || 'Não foi possível salvar as associações. Tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    } finally {
      setSalvandoAssociacoes(false);
    }
  };


  // 🤖 Função de associação automática
  const handleAssociacaoAutomatica = async () => {
    if (loadingAutoAssociacao) return;

    setLoadingAutoAssociacao(true);
    try {
      const itensParaAssociar = items
        .filter(item => item.status === 'pending')
        .map(item => ({
          nItem: item.id,
          cProd: item.referencia,
          xProd: item.descricao,
          qCom: item.quantidade,
          vUnCom: item.valorUnitario
        }));

      if (itensParaAssociar.length === 0) {
        toast.info('Todos os itens já estão associados');
        return;
      }

      const response = await fetch('/api/entrada-xml/associar-automatico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfeId: nfe.id,
          itens: itensParaAssociar,
          cnpjEmitente: nfe.cnpjEmitente
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro na associação automática');
      }

      // Aplicar associações no state
      const updatedItems = [...items];

      for (const assoc of result.associacoes) {
        if (assoc.status === 'not_found') continue;

        const itemIndex = updatedItems.findIndex(i => i.id === assoc.nfeItemId);
        if (itemIndex === -1) continue;

        const item = updatedItems[itemIndex];

        // Verificar se a quantidade alocada é suficiente
        const totalAlocado = assoc.pedidos.reduce((sum: number, p: any) => sum + p.quantidade, 0);
        const isCompleto = totalAlocado >= item.quantidade;

        updatedItems[itemIndex] = {
          ...item,
          status: isCompleto ? 'associated' : 'pending',
          produtoAssociado: {
            id: assoc.produtoId,
            referencia: assoc.produtoId,
            descricao: assoc.produtoDescricao,
            marca: '',
            estoque: 0,
            tipo: 'P'
          },
          associacoes: assoc.pedidos.map((p: any) => ({
            pedidoId: p.pedidoId,
            quantidade: p.quantidade,
            valorUnitario: p.valorUnitario
          }))
        };
      }

      setItems(updatedItems);

      // Toast com stats
      const { stats } = result;
      if (stats.associados > 0 && stats.nao_associados === 0 && stats.parciais === 0) {
        toast.success(`Todos os ${stats.associados} itens associados automaticamente!`);
      } else {
        const partes: string[] = [];
        if (stats.associados > 0) partes.push(`${stats.associados} associado(s)`);
        if (stats.parciais > 0) partes.push(`${stats.parciais} parcial(is)`);
        if (stats.nao_associados > 0) partes.push(`${stats.nao_associados} não encontrado(s)`);
        toast.info(`Resultado: ${partes.join(', ')}`, {
          description: stats.nao_associados > 0 ? 'Associe manualmente os itens restantes' : undefined,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Erro na associação automática:', error);
      toast.error('Erro na associação automática', {
        description: error instanceof Error ? error.message : 'Tente novamente'
      });
    } finally {
      setLoadingAutoAssociacao(false);
    }
  };

  const allItemsAssociated = items.every(item => item.status === 'associated');
  const associatedCount = items.filter(i => i.status === 'associated').length;

  // Bloqueia concluir se algum item marcado como Meia Nota estiver com preço
  // inválido (vazio, zero ou abaixo do preço da NF).
  const algumaMeiaNotaInvalida = items.some((it) => {
    if (it.status !== 'associated') return false;
    const cfg = tempRateioData.get(it.id);
    if (!cfg?.meiaNota) return false;
    const precoNf = Number((it as any).valorUnitario) || 0;
    return (
      cfg.precoUnitarioNF === undefined ||
      cfg.precoUnitarioNF <= 0 ||
      cfg.precoUnitarioNF < precoNf
    );
  });

  // Função para salvar progresso
  const handleSalvarProgresso = async () => {
    try {
      const response = await fetch('/api/entrada-xml/salvar-progresso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfeId: nfe.id,
          userId,
          userName,
          items: items.map(item => ({
            nfeItemId: item.id,
            produtoId: item.produtoAssociado?.id || '',
            associacoes: item.associacoes,
            status: item.status,
            referenciaNFe: item.referencia,
            codMarca: item.produtoAssociado?.marca
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();

        // ✅ Toast notification (NÃO fecha modal, usuário decide quando sair)
        toast.success('Progresso salvo com sucesso!', {
          description: `${result.stats?.associados || 0} itens associados. Você pode fechar e continuar depois através do menu "Continuar".`
        });

        // ✅ NÃO fechar modal automaticamente - usuário escolhe quando sair
        // onClose(); // REMOVIDO

        // Atualizar lista em background
        if (onRefetch) {
          onRefetch();
        }
      } else {
        throw new Error('Erro ao salvar progresso');
      }
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      toast.error('Erro ao salvar progresso', {
        description: 'Não foi possível salvar o progresso. Tente novamente.'
      });
    }
  };

  // ✅ NOVO: Handlers para o modal de decisão
  const handleContinuarAgora = () => {
    // Usuário escolheu continuar agora
    setShowDecisionModal(false);
    onComplete(associatedItemsTemp); // Chama callback para abrir próximo modal
    onClose(); // Fecha modal de associação
  };

  const handleFazerDepois = () => {
    // Usuário escolheu fazer depois
    setShowDecisionModal(false);
    onClose(); // Apenas fecha, NFe fica com exec='C'

    // ✅ Atualizar lista principal para mostrar novo status
    if (onRefetch) {
      onRefetch();
    }
  };

  // Função para buscar sugestões inteligentes
  const handleBuscarSugestoes = async () => {
    try {
      // Mapear itens da NFe para formato da API
      const itensNFe: ItemNFeAPI[] = items.map(item => ({
        codigo_produto: item.referencia,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario
      }));

      const fornecedorCnpj = nfe.cnpjEmitente || nfe.fornecedor?.cnpj || nfe.fornecedor?.cpf_cgc || '';
      const dataNFe = nfe.dataEmissao;

      if (!fornecedorCnpj) {
        setMessageData({
          title: 'CNPJ do Fornecedor Não Encontrado',
          message: 'Não foi possível identificar o CNPJ do fornecedor nesta NFe.',
          type: 'warning'
        });
        setShowMessage(true);
        return;
      }

      const success = await buscarSugestoes(fornecedorCnpj, itensNFe, dataNFe);

      if (success) {
        setShowSugestoesModal(true);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      setMessageData({
        title: 'Erro ao Buscar Sugestões',
        message: 'Não foi possível buscar sugestões de OCs. Tente novamente.',
        type: 'error'
      });
      setShowMessage(true);
    }
  };

  // Função chamada quando usuário seleciona uma sugestão
  const handleSelecionarSugestao = async (sugestao: any) => {
    // TODO: Implementar lógica para pré-popular associações com base na sugestão
    // Por enquanto, apenas fechar o modal e mostrar mensagem
    setShowSugestoesModal(false);

    setMessageData({
      title: 'Funcionalidade em Desenvolvimento',
      message: `Você selecionou a OC ${sugestao.req_id_composto}. A funcionalidade de auto-associação está em desenvolvimento.`,
      type: 'info'
    });
    setShowMessage(true);
  };

  // Itens visíveis (após o filtro por status) — base da navegação por teclado.
  const itensVisiveis = items.filter((i) =>
    filtroStatusItem === 'todos'
      ? true
      : filtroStatusItem === 'associated'
        ? i.status === 'associated'
        : i.status !== 'associated',
  );

  // Enquanto qualquer sub-modal estiver aberto, a navegação da lista fica inativa
  // (o sub-modal de associação tem seu próprio Esc/Enter).
  const algumSubmodalAberto =
    showProductSearch ||
    showProductDetails ||
    showPedidosModal ||
    showConfirmation ||
    showMessage ||
    showDecisionModal ||
    showSugestoesModal ||
    showSugestoesAutomaticas ||
    showSugestaoUnica ||
    showSugestoesMultiplas ||
    itemParaDesassociar !== null;

  // ⌨️ Navegação estilo Delphi: ↑/↓ move a linha, Enter abre a associação.
  // Espaço abre/recolhe os detalhes da linha; Esc recolhe; Delete desassocia.
  const { linhaSelecionada, setLinhaSelecionada } = useNavegacaoTecladoTabela<NFeItem>({
    data: itensVisiveis,
    ativo: isOpen && !algumSubmodalAberto,
    onEnter: (row) => {
      // Se tudo já foi associado, Enter CONCLUI; senão abre a associação da linha.
      const podeConcluir =
        allItemsAssociated && associatedCount > 0 && !loading && !salvandoAssociacoes && !algumaMeiaNotaInvalida;
      if (podeConcluir) {
        handleConfirmarAssociacoes();
      } else if (row) {
        handleAssociarProduto(row);
      }
    },
    atalhos: [
      {
        key: ' ',
        handler: (row) => {
          if (row) setItemExpandido((cur) => (cur === row.id ? null : row.id));
        },
      },
      {
        key: 'Escape',
        precisaLinha: false,
        handler: () => setItemExpandido(null),
      },
      {
        key: 'Delete',
        handler: (row) => {
          if (row && (row.produtoAssociado || (row.associacoes?.length ?? 0) > 0)) {
            setItemParaDesassociar(row);
          }
        },
      },
    ],
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <style>{`
        /* Remover setas dos inputs numéricos */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[96vw] max-w-[1600px] mx-4 h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Package2 className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Itens da Nota
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Associações ({items.filter(i => i.status === 'associated').length} de {items.length})
            </span>
          </div>
          <div className="flex items-center gap-3">
            {items.some(i => i.status === 'pending') && (
              <Button
                onClick={handleAssociacaoAutomatica}
                disabled={loadingAutoAssociacao || items.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white"
                size="sm"
              >
                {loadingAutoAssociacao ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Associando...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} className="mr-2" />
                    Associar Automaticamente
                  </>
                )}
              </Button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Alerta de Divergências de Preço - movido para dentro da área com scroll */}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Lista de Itens */}
          <div className="w-full flex flex-col min-h-0">
            {/* Sugestão automática (colapsável) — scroll próprio, não empurra os itens */}
            <div className="flex-shrink-0 px-6 pt-4 border-b border-gray-100 dark:border-zinc-800">
              {ordemAutomatica && !loadingOrdemAutomatica && (
                <button
                  type="button"
                  onClick={() => setMostrarSugestao((v) => !v)}
                  className="mb-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {mostrarSugestao ? '▲ Ocultar sugestão automática' : '▼ Mostrar sugestão automática'}
                </button>
              )}
              {mostrarSugestao && (
                <div className="max-h-[42vh] overflow-y-auto pr-1 pb-2">
            {/* ⚡ Banner de Ordem Encontrada Automaticamente */}
            {loadingOrdemAutomatica && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    Buscando ordem de compra automaticamente...
                  </span>
                </div>
              </div>
            )}

            {ordemAutomatica && !loadingOrdemAutomatica && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {metodoOrdemAutomatica === 'xped' ? (
                      <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : metodoOrdemAutomatica === 'infcpl' ? (
                      <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <Lightbulb className="h-6 w-6 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-green-800 dark:text-green-200 font-semibold text-lg">
                        Ordem Encontrada Automaticamente!
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        metodoOrdemAutomatica === 'xped'
                          ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : metodoOrdemAutomatica === 'infcpl'
                          ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                          : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                      }`}>
                        {metodoOrdemAutomatica === 'xped' ? 'Via xPed' :
                         metodoOrdemAutomatica === 'infcpl' ? 'Via Inf. Complementares' : 'Sugestão'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-green-600 dark:text-green-400 text-sm">Ordem:</span>
                        <p className="text-green-900 dark:text-green-100 font-bold text-xl">
                          {ordemAutomatica.req_id_composto}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 text-sm">Fornecedor:</span>
                        <p className="text-green-900 dark:text-green-100 font-medium truncate">
                          {ordemAutomatica.fornecedor_nome}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 text-sm">Data:</span>
                        <p className="text-green-900 dark:text-green-100">
                          {new Date(ordemAutomatica.data_ordem).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 text-sm">Valor Total:</span>
                        <p className="text-green-900 dark:text-green-100 font-medium">
                          {formatCurrency(ordemAutomatica.valor_total)}
                        </p>
                      </div>
                    </div>
                    {/* Só mostrar dropdown se houver mais de 1 ordem COM match */}
                    {ordensAutomaticas.filter(o => (o.itens_match?.length || 0) > 0).length > 1 && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-green-600 dark:text-green-400 text-sm">
                            {ordensAutomaticas.filter(o => (o.itens_match?.length || 0) > 0).length} ordem(ns) com itens correspondentes:
                          </p>
                          <select
                            value={ordemAutomatica?.req_id_composto || ''}
                            onChange={(e) => {
                              const selectedOrdem = ordensAutomaticas.find(
                                o => o.req_id_composto === e.target.value
                              );
                              if (selectedOrdem) {
                                setOrdemAutomatica(selectedOrdem);
                                toast.info(`Ordem ${selectedOrdem.req_id_composto} selecionada`);
                              }
                            }}
                            className="text-xs px-2 py-1 bg-green-100 dark:bg-green-800 border border-green-300 dark:border-green-600 rounded text-green-800 dark:text-green-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            {ordensAutomaticas
                              .filter(o => (o.itens_match?.length || 0) > 0) // Só mostrar ordens com match
                              .sort((a, b) => (b.itens_match?.length || 0) - (a.itens_match?.length || 0)) // Ordenar por mais matches
                              .map((ordem) => (
                              <option key={ordem.req_id_composto} value={ordem.req_id_composto}>
                                {ordem.req_id_composto} - {ordem.itens_match?.length || 0} item(ns) match
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {dadosCompraXML?.infCpl && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                        <p className="text-green-600 dark:text-green-400 text-xs mb-1">Inf. Complementares:</p>
                        <p className="text-green-800 dark:text-green-200 text-xs bg-green-100 dark:bg-green-800/50 p-2 rounded max-h-16 overflow-y-auto">
                          {dadosCompraXML.infCpl.substring(0, 200)}{dadosCompraXML.infCpl.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    )}

                    {/* TABELA 1: Correspondência NFe ↔ OC (sempre visível) */}
                    {ordemAutomatica.itens_match && ordemAutomatica.itens_match.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold mb-2">
                          <Package2 className="h-4 w-4" />
                          <span>Correspondência NFe ↔ OC ({ordemAutomatica.itens_match.length} item(ns)):</span>
                        </div>
                        <div className="bg-green-100 dark:bg-green-800/50 rounded-lg overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-green-200 dark:bg-green-700">
                              <tr>
                                <th className="px-2 py-1.5 text-left text-green-800 dark:text-green-100 whitespace-nowrap">#NFe</th>
                                <th className="px-2 py-1.5 text-left text-green-800 dark:text-green-100">Ref. Fornecedor</th>
                                <th className="px-2 py-1.5 text-center text-green-800 dark:text-green-100">→</th>
                                <th className="px-2 py-1.5 text-left text-green-800 dark:text-green-100">Referência Melo</th>
                                <th className="px-2 py-1.5 text-left text-green-800 dark:text-green-100">Descrição OC</th>
                                <th className="px-2 py-1.5 text-right text-green-800 dark:text-green-100">Qtd</th>
                                <th className="px-2 py-1.5 text-center text-green-800 dark:text-green-100">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ordemAutomatica.itens_match.map((itemMatch, idx) => {
                                // Encontrar o item da NFe correspondente APENAS pelo id (nItem_nfe)
                                // IMPORTANTE: Não usar referência como fallback pois itens com mesmo produto
                                // (ex: AMD0356 linha #2 e AMD0356 linha #4) têm referências iguais
                                const itemNFeCorrespondente = items.find(i =>
                                  i.id === itemMatch.nItem_nfe
                                );
                                const jaAssociado = itemNFeCorrespondente?.status === 'associated';

                                return (
                                  <tr
                                    key={idx}
                                    className={`border-t border-green-200 dark:border-green-700 transition-colors ${
                                      jaAssociado
                                        ? 'bg-green-300/50 dark:bg-green-600/30'
                                        : 'hover:bg-green-200 dark:hover:bg-green-700/50'
                                    }`}
                                  >
                                    <td className="px-2 py-1.5 font-mono text-green-900 dark:text-green-100 font-bold whitespace-nowrap">
                                      #{itemMatch.nItem_nfe || '?'}
                                    </td>
                                    <td className="px-2 py-1.5 text-green-800 dark:text-green-200 max-w-[120px]" title={itemMatch.descricao_nfe}>
                                      <span className="font-mono text-xs block">{itemMatch.cProd_nfe || '-'}</span>
                                      <span className="text-[10px] text-green-600 dark:text-green-400 truncate block">{itemMatch.descricao_nfe?.substring(0, 30)}...</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-green-500 dark:text-green-400 font-bold">
                                      →
                                    </td>
                                    <td className="px-2 py-1.5 font-mono text-green-900 dark:text-green-100 font-bold cursor-pointer hover:underline"
                                        onClick={() => {
                                          navigator.clipboard.writeText(itemMatch.referencia || itemMatch.codprod);
                                          toast.success(`Referência ${itemMatch.referencia || itemMatch.codprod} copiada!`);
                                        }}
                                        title={`Código: ${itemMatch.codprod} - Clique para copiar`}>
                                      {itemMatch.referencia || itemMatch.codprod}
                                    </td>
                                    <td className="px-2 py-1.5 text-green-800 dark:text-green-200 truncate max-w-[150px]" title={itemMatch.descricao}>
                                      {itemMatch.descricao}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-green-900 dark:text-green-100 whitespace-nowrap">
                                      {itemMatch.quantidade_nfe}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                      {jaAssociado ? (
                                        <span className="text-green-700 dark:text-green-300 text-xs font-medium">✓ Feito</span>
                                      ) : itemNFeCorrespondente ? (
                                        <button
                                          className="px-2 py-0.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Criar objeto ItemOC a partir do itemMatch
                                            const itemOC: ItemOC = {
                                              codprod: itemMatch.codprod,
                                              descricao: itemMatch.descricao,
                                              quantidade_oc: itemMatch.quantidade_oc,
                                              quantidade_atendida: itemMatch.quantidade_oc - itemMatch.quantidade_disponivel,
                                              quantidade_disponivel: itemMatch.quantidade_disponivel,
                                              valor_unitario: 0
                                            };
                                            // Passar o item da NFe diretamente para evitar problema de estado assíncrono
                                            handleAssociarItemOC(itemOC, itemNFeCorrespondente);
                                          }}
                                        >
                                          Associar
                                        </button>
                                      ) : (
                                        <span className="text-amber-600 dark:text-amber-400 text-xs">?</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-500 dark:text-green-400 text-xs mt-1 italic">
                          <Lightbulb className="h-3 w-3" />
                          <span>Clique em "Associar" para vincular automaticamente o item NFe ao produto correspondente</span>
                        </div>
                      </div>
                    )}

                    {/* TABELA 2: Todos os itens da Ordem */}
                    {/* Se não tem itens_match, mostra aberto por padrão. Se tem, mostra em accordion */}
                    {ordemAutomatica.itens_oc && ordemAutomatica.itens_oc.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                        {/* Se tem itens_match, mostra como accordion */}
                        {ordemAutomatica.itens_match && ordemAutomatica.itens_match.length > 0 ? (
                          <button
                            onClick={() => setShowAllItensOC(!showAllItensOC)}
                            className="w-full flex items-center justify-between text-green-600 dark:text-green-400 text-sm font-semibold hover:text-green-700 dark:hover:text-green-300 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Package2 className="h-4 w-4" />
                              <span>Todos os Itens da Ordem ({ordemAutomatica.itens_oc.length})</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform ${showAllItensOC ? 'rotate-180' : ''}`} />
                          </button>
                        ) : (
                          /* Se não tem itens_match, mostra título simples */
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold mb-2">
                            <Package2 className="h-4 w-4" />
                            <span>Itens da Ordem ({ordemAutomatica.itens_oc.length}):</span>
                          </div>
                        )}

                        {/* Indicador de quantos itens pendentes (quando não tem itens_match) */}
                        {(!ordemAutomatica.itens_match || ordemAutomatica.itens_match.length === 0) && (() => {
                          const pendentes = items.filter(i => i.status === 'pending');
                          if (pendentes.length === 1) {
                            return (
                              <div className="mb-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded text-xs text-blue-800 dark:text-blue-200">
                                Item da NFe: <strong>{pendentes[0].descricao?.substring(0, 50)}{pendentes[0].descricao && pendentes[0].descricao.length > 50 ? '...' : ''}</strong>
                              </div>
                            );
                          } else if (pendentes.length > 1 && selectedItem) {
                            return (
                              <div className="mb-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded text-xs text-blue-800 dark:text-blue-200">
                                Associando ao item: <strong>{selectedItem.descricao?.substring(0, 50)}{selectedItem.descricao && selectedItem.descricao.length > 50 ? '...' : ''}</strong>
                              </div>
                            );
                          } else if (pendentes.length > 1) {
                            return (
                              <div className="mb-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-200">
                                {pendentes.length} itens pendentes - selecione um abaixo ou clique em "Associar" para vincular
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Mostra tabela se: não tem itens_match OU accordion está aberto */}
                        {((!ordemAutomatica.itens_match || ordemAutomatica.itens_match.length === 0) || showAllItensOC) && (
                          <div className="mt-2 max-h-48 overflow-y-auto bg-green-100 dark:bg-green-800/50 rounded-lg">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-green-200 dark:bg-green-700">
                                <tr>
                                  <th className="px-2 py-1 text-left text-green-800 dark:text-green-100">Referência Melo</th>
                                  <th className="px-2 py-1 text-left text-green-800 dark:text-green-100">Descrição</th>
                                  <th className="px-2 py-1 text-right text-green-800 dark:text-green-100">Qtd</th>
                                  <th className="px-2 py-1 text-right text-green-800 dark:text-green-100">Disp.</th>
                                  <th className="px-2 py-1 text-right text-green-800 dark:text-green-100">Valor</th>
                                  <th className="px-2 py-1 text-center text-green-800 dark:text-green-100">Ação</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Obter descrição do item da NFe para comparação
                                  const pendentes = items.filter(i => i.status === 'pending');
                                  const itemNFeAtivo = selectedItem || (pendentes.length === 1 ? pendentes[0] : null);
                                  const descricaoNFe = itemNFeAtivo?.descricao || '';

                                  // Ordenar itens da OC por similaridade
                                  const itensOrdenados = [...(ordemAutomatica.itens_oc || [])].map(itemOC => ({
                                    ...itemOC,
                                    similaridade: calcularSimilaridade(descricaoNFe, itemOC.descricao)
                                  })).sort((a, b) => b.similaridade - a.similaridade);

                                  return itensOrdenados.map((itemOC, idx) => {
                                    const temMatch = itemOC.similaridade >= THRESHOLD_SIMILARIDADE;

                                    return (
                                      <tr
                                        key={idx}
                                        className={`border-t border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-700/50 cursor-pointer transition-colors ${
                                          temMatch ? 'bg-green-50 dark:bg-green-800/30' : ''
                                        }`}
                                        onClick={() => {
                                          navigator.clipboard.writeText(itemOC.referencia || itemOC.codprod);
                                          toast.success(`Referência ${itemOC.referencia || itemOC.codprod} copiada!`);
                                        }}
                                        title={`Código: ${itemOC.codprod} - Clique para copiar`}
                                      >
                                        <td className="px-2 py-1 font-mono text-green-900 dark:text-green-100 font-bold">
                                          {itemOC.referencia || itemOC.codprod}
                                        </td>
                                        <td className="px-2 py-1 text-green-800 dark:text-green-200 truncate max-w-[200px]" title={itemOC.descricao}>
                                          {itemOC.descricao}
                                          {temMatch && (
                                            <span className="ml-1 text-[10px] text-green-600 dark:text-green-400">
                                              ({itemOC.similaridade}%)
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 text-right text-green-900 dark:text-green-100">
                                          {itemOC.quantidade_oc}
                                        </td>
                                        <td className="px-2 py-1 text-right font-semibold text-green-900 dark:text-green-100">
                                          {itemOC.quantidade_disponivel}
                                        </td>
                                        <td className="px-2 py-1 text-right text-green-900 dark:text-green-100">
                                          {formatCurrency(itemOC.valor_unitario)}
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                          {/* Mostrar botão sempre que há itens pendentes - similaridade apenas destaca/ordena */}
                                          {items.some(i => i.status === 'pending') ? (
                                            <button
                                              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                                                temMatch
                                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                                  : 'bg-gray-500 hover:bg-gray-600 text-white'
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAssociarItemOC(itemOC);
                                              }}
                                              title={temMatch ? `Similaridade: ${itemOC.similaridade}%` : 'Associação manual'}
                                            >
                                              Associar
                                            </button>
                                          ) : (
                                            <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Dica quando não tem itens_match */}
                        {(!ordemAutomatica.itens_match || ordemAutomatica.itens_match.length === 0) && (
                          <div className="flex items-center gap-1.5 text-green-500 dark:text-green-400 text-xs mt-1 italic">
                            <Lightbulb className="h-3 w-3" />
                            <span>
                              {(() => {
                                const pendentes = items.filter(i => i.status === 'pending');
                                if (pendentes.length === 0) {
                                  return 'Todos os itens já foram associados';
                                }
                                // Verificar se há itens com match
                                const itemNFeAtivo = selectedItem || (pendentes.length === 1 ? pendentes[0] : null);
                                const descricaoNFe = itemNFeAtivo?.descricao || '';
                                const temItensComMatch = ordemAutomatica.itens_oc?.some(
                                  itemOC => calcularSimilaridade(descricaoNFe, itemOC.descricao) >= THRESHOLD_SIMILARIDADE
                                );
                                if (temItensComMatch) {
                                  return 'Itens ordenados por relevância - clique em "Associar" no item correspondente';
                                }
                                return 'Nenhum item da OC corresponde ao item da NFe - use a busca manual abaixo';
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!ordemAutomatica && !loadingOrdemAutomatica && items.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      Nenhuma ordem encontrada automaticamente
                    </span>
                    <p className="text-amber-600 dark:text-amber-400 text-sm">
                      Associe os itens manualmente selecionando o produto e a ordem de compra
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Divergências dentro da área com scroll - COMENTADO TEMPORARIAMENTE */}
            {/* <div className="mb-4">
              <DivergenciasPrecoAlert
                reqId={selectedItem?.associacoes?.[0]?.pedidoId}
                autoLoad={true}
              />
            </div> */}
                </div>
              )}
            </div>
            {/* Lista de itens da NFe — tabela compacta (rolagem própria) */}
            <div className="flex-1 min-h-0 flex flex-col px-6 py-3">
              {/* Filtro por status */}
              <div className="flex-shrink-0 flex items-center gap-2 mb-2 text-xs text-gray-600 dark:text-gray-400">
                <span>Filtrar:</span>
                <select
                  value={filtroStatusItem}
                  onChange={(e) => setFiltroStatusItem(e.target.value as any)}
                  className="border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100"
                >
                  <option value="todos">Todos ({items.length})</option>
                  <option value="pending">Pendentes ({items.filter((i) => i.status !== 'associated').length})</option>
                  <option value="associated">Associados ({items.filter((i) => i.status === 'associated').length})</option>
                </select>
                <span className="ml-auto italic">Clique na linha para ver os detalhes (NCM, CFOP, etc.)</span>
              </div>

              <div className="flex-1 min-h-0 overflow-auto border border-gray-200 dark:border-zinc-700 rounded-lg">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="w-6"></th>
                      <th className="px-2 py-2 text-center w-10">St</th>
                      <th className="px-2 py-2 text-center w-8">#</th>
                      <th className="px-2 py-2 text-left">Ref. / Descrição (NF)</th>
                      <th className="px-2 py-2 text-right w-16">Qt NF</th>
                      <th className="px-2 py-2 text-left">Produto Melo</th>
                      <th className="px-2 py-2 text-center w-20">Qt Ass.</th>
                      <th className="px-2 py-2 text-center w-44">Meia Nota</th>
                      <th className="px-2 py-2 text-center w-28">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensVisiveis
                      .map((item, visIndex) => {
                        const index = items.indexOf(item);
                        const selecionada = visIndex === linhaSelecionada;
                        const qtdAss = item.associacoes?.reduce((s, a) => s + a.quantidade, 0) || 0;
                        const expandido = itemExpandido === item.id;
                        const cfg = tempRateioData.get(item.id);
                        const meia = cfg?.meiaNota || false;
                        const preco = cfg?.precoUnitarioNF;
                        const rowBg =
                          item.status === 'associated'
                            ? 'bg-blue-50/50 dark:bg-blue-900/10'
                            : item.status === 'error'
                              ? 'bg-red-50/50 dark:bg-red-900/10'
                              : '';
                        const dotCor =
                          item.status === 'associated'
                            ? 'bg-blue-500'
                            : item.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-400';
                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              className={`border-t border-gray-200 dark:border-zinc-700 ${
                                selecionada
                                  ? `${CLASSE_LINHA_ATIVA} bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400`
                                  : rowBg
                              } hover:bg-gray-50 dark:hover:bg-zinc-800/60 cursor-pointer`}
                              onClick={() => {
                                setLinhaSelecionada(visIndex);
                                setItemExpandido(expandido ? null : item.id);
                              }}
                            >
                              <td className="px-1 text-center text-gray-400">
                                {expandido ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotCor}`} title={item.status} />
                              </td>
                              <td className="px-2 py-1.5 text-center text-gray-500">{index + 1}</td>
                              <td className="px-2 py-1.5">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{item.referencia}</div>
                                <div className="text-gray-500 dark:text-gray-400 truncate max-w-[240px]" title={item.descricao}>
                                  {item.descricao}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">{item.quantidade}</td>
                              <td className="px-2 py-1.5">
                                {item.produtoAssociado ? (
                                  <span className="text-blue-700 dark:text-blue-300">
                                    {item.produtoAssociado.referencia} - {item.produtoAssociado.descricao}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td
                                className={`px-2 py-1.5 text-center font-bold ${
                                  item.status === 'associated'
                                    ? 'text-green-600'
                                    : item.status === 'error'
                                      ? 'text-red-600'
                                      : 'text-gray-400'
                                }`}
                              >
                                {qtdAss}/{item.quantidade}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {item.status === 'associated' && meia ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-[0.7rem] font-medium">
                                    ✔ R$ {(preco ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={item.status === 'associated' ? 'default' : 'outline'}
                                    onClick={() => handleAssociarProduto(item)}
                                    disabled={loading}
                                    className={`h-7 text-xs ${
                                      item.status === 'associated'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : item.status === 'error'
                                          ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
                                          : ''
                                    }`}
                                  >
                                    <Search size={13} className="mr-1" />
                                    {item.status === 'associated' ? 'Reeditar' : item.status === 'error' ? 'Corrigir' : 'Associar'}
                                  </Button>
                                  {(item.produtoAssociado || (item.associacoes?.length ?? 0) > 0) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setItemParaDesassociar(item)}
                                      disabled={loading}
                                      title="Desassociar item (Delete)"
                                      className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                                    >
                                      <Trash2 size={13} />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expandido && (
                              <tr className={rowBg}>
                                <td colSpan={9} className="px-4 py-3 bg-gray-50 dark:bg-zinc-900/40 border-t border-gray-100 dark:border-zinc-800">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div><Label className="font-medium">NCM</Label><div>{item.ncm}</div></div>
                                    <div><Label className="font-medium">CFOP</Label><div>{item.cfop}</div></div>
                                    <div><Label className="font-medium">Unid.</Label><div>{item.unidade}</div></div>
                                    <div><Label className="font-medium">Cód. Barras</Label><div>{item.codigoBarras || '-'}</div></div>
                                    <div><Label className="font-medium">Qtde Trib.</Label><div>{item.quantidade}</div></div>
                                    <div><Label className="font-medium">Valor Prod.</Label><div>{formatCurrency(item.valorTotal)}</div></div>
                                    <div><Label className="font-medium">Desc</Label><div>-</div></div>
                                  </div>

                                  {/* Meia Nota (somente leitura — editar em "Reeditar") */}
                                  {item.status === 'associated' && meia && (
                                    <div className="mt-3 flex items-center gap-2 text-xs">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Meia Nota — Pr. Unit.:</span>
                                      <span className="text-yellow-800 dark:text-yellow-300 font-medium">
                                        R$ {(preco ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-gray-400">(altere em “Reeditar”)</span>
                                    </div>
                                  )}

                                  {/* Divergência de preço NF x OC */}
                                  {item.status === 'associated' && item.associacoes?.map((assoc, idx) => {
                                    const dif = item.valorUnitario && assoc.valorUnitario
                                      ? Math.abs((item.valorUnitario - assoc.valorUnitario) / assoc.valorUnitario * 100)
                                      : 0;
                                    if (dif <= 5) return null;
                                    return (
                                      <div key={idx} className="mt-2 inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300">
                                        <AlertCircle size={12} />
                                        Divergência de preço {dif.toFixed(0)}% (NF {formatCurrency(item.valorUnitario)} × OC {formatCurrency(assoc.valorUnitario)})
                                      </div>
                                    );
                                  })}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Painel lateral removido — status resumido no rodapé para dar espaço à tabela */}
        </div>

        {/* Footer com resumo do status */}
        <div className="flex justify-between items-center gap-4 px-6 py-3 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            {onVoltar && (
              <Button
                variant="outline"
                onClick={onVoltar}
                disabled={loading}
              >
                <ChevronLeft size={16} className="mr-2" />
                Voltar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              <X size={16} className="mr-2" />
              Cancelar
            </Button>
          </div>

          {/* Resumo do status (antes era o painel lateral) */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <span>Total: <strong className="text-gray-900 dark:text-gray-100">{items.length}</strong></span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              Associados: <strong className="text-blue-600">{items.filter(i => i.status === 'associated').length}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
              Pendentes: <strong className="text-orange-600">{items.filter(i => i.status !== 'associated').length}</strong>
            </span>
            {items.some(i => i.status === 'error') && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                Parciais: <strong className="text-red-600">{items.filter(i => i.status === 'error').length}</strong>
              </span>
            )}
          </div>

          {/* Botão unificado: Salvar Progresso ou Concluir Associações */}
          <Button
            onClick={allItemsAssociated ? handleConfirmarAssociacoes : handleSalvarProgresso}
            disabled={loading || associatedCount === 0 || salvandoAssociacoes || algumaMeiaNotaInvalida}
            title={algumaMeiaNotaInvalida ? 'Há item com Meia Nota e preço inválido' : undefined}
            className={`${allItemsAssociated
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
          >
            {salvandoAssociacoes ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Salvando...
              </>
            ) : allItemsAssociated ? (
              <>
                <CheckCircle size={16} className="mr-2" />
                Concluir Associações ({associatedCount}/{items.length})
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Salvar Progresso ({associatedCount}/{items.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmação de Desassociação */}
      <ConfirmationModal
        isOpen={itemParaDesassociar !== null}
        type="danger"
        title="Desassociar item"
        message={
          itemParaDesassociar
            ? `Remover a associação do item "${(itemParaDesassociar.descricao || '').substring(0, 60)}"?\n\nO produto e as ordens vinculadas serão removidos e o item voltará para "pendente". Salve o progresso para confirmar no banco.`
            : ''
        }
        confirmText="Desassociar"
        cancelText="Cancelar"
        onClose={() => setItemParaDesassociar(null)}
        onConfirm={() => itemParaDesassociar && handleDesassociarItem(itemParaDesassociar)}
      />

      {/* Modal de Busca de Produtos */}
      {showProductSearch && (
        <ProductSearchModal
          isOpen={showProductSearch}
          onClose={() => {
            setShowProductSearch(false);
            setSelectedItem(null); // Limpar item selecionado se cancelou busca
          }}
          onSelect={handleSelecionarProduto}
          searchTerm={selectedItem?.codigoBarras || selectedItem?.descricao || ''}
        />
      )}

      {/* Modal de Detalhes do Produto */}
      {showProductDetails && selectedProduct && (
        <ProductDetailsModal
          isOpen={showProductDetails}
          produto={selectedProduct}
          onClose={() => {
            setShowProductDetails(false);
            setSelectedProduct(null); // Limpar produto se cancelou
            setSelectedItem(null); // Limpar item se cancelou
          }}
          onConfirm={handleConfirmarProduto}
        />
      )}

      {/* Modal de Ordens de Compra Disponíveis */}
      {showPedidosModal && selectedItem && (
        <PedidosDisponiveisModal
          isOpen={showPedidosModal}
          onClose={() => {
            // Se for modo edição (já tem associações), não limpar o produto associado
            if (selectedItem && selectedItem.status !== 'associated') {
              const updatedItems = items.map(item =>
                item.id === selectedItem.id
                  ? {
                      ...item,
                      produtoAssociado: undefined, // Remover produto se não completou
                      associacoes: [], // Limpar associações também
                      status: 'pending' as const
                    }
                  : item
              );
              setItems(updatedItems);
            }
            setSelectedItem(null);
            setShowPedidosModal(false);
          }}
          item={{
            nfeItemId: selectedItem.id,
            produtoId: selectedItem.produtoAssociado?.id || '',
            codprod: selectedItem.produtoAssociado?.id || '', // codprod real para buscar OCs (itr_codprod)
            referencia: selectedItem.produtoAssociado?.referencia || selectedItem.produtoAssociado?.id || '',
            produtoDescricao: selectedItem.produtoAssociado?.descricao || selectedItem.descricao,
            quantidade: selectedItem.quantidade,
            valorUnitario: selectedItem.valorUnitario,
            produtoTipo: selectedItem.produtoAssociado?.tipo // Para validação de Material de Consumo
          }}
          fornecedorCnpj={nfe.cnpjEmitente} // Filtrar ordens apenas do fornecedor da NFe
          ordemIdSelecionada={ordemAutomatica?.orc_id?.toString()} // Filtrar pela ordem selecionada no dropdown
          associacoesExistentes={selectedItem.associacoes} // 🔄 Passar associações existentes para modo edição
          configExtraExistente={tempRateioData.get(selectedItem.id) || null} // 🔄 Reeditar: recarrega a Meia Nota salva
          onConfirm={(associacoes, configExtra) => {
            if (selectedItem) {
              const totalAssociado = associacoes.reduce((sum: number, a: any) => sum + a.quantidade, 0);
              const isCompleteAssociation = totalAssociado === selectedItem.quantidade;

              // Armazenar dados de rateio/centro de custo temporários
              if (configExtra) {
                tempRateioData.set(selectedItem.id, {
                  meiaNota: configExtra.meiaNota,
                  precoUnitarioNF: configExtra.precoUnitarioNF,
                  rateio: configExtra.rateio,
                  criterioRateio: configExtra.criterioRateio,
                  centroCusto: configExtra.centroCusto
                });
              }

              const updatedItems = items.map(item =>
                item.id === selectedItem.id
                  ? {
                      ...item,
                      associacoes,
                      status: isCompleteAssociation ? 'associated' as const : 'error' as const
                    }
                  : item
              );
              setItems(updatedItems);
              setSelectedItem(null);
            }
            setShowPedidosModal(false);
          }}
        />
      )}


      {/* Modal de Sugestões Inteligentes */}
      {showSugestoesModal && (
        <SugestoesOCModal
          isOpen={showSugestoesModal}
          sugestoes={sugestoes}
          totalOCsAnalisadas={totalOCsAnalisadas}
          criteriosUtilizados={criteriosUtilizados}
          onClose={() => setShowSugestoesModal(false)}
          onSelecionarSugestao={handleSelecionarSugestao}
        />
      )}

      {/* Modal de Sugestões Automáticas com IA */}
      {showSugestoesAutomaticas && produtoSugestaoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sugestões Automáticas</h2>
              <button
                onClick={() => setShowSugestoesAutomaticas(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <SugestoesAutomaticas
              produtoCod={produtoSugestaoSelecionado}
              fornecedorCod={nfe?.fornecedor?.cnpj}
              quantidadeNecessaria={selectedItem?.quantidade}
              onSelectSugestao={(sugestao) => {
                // Aplicar sugestão selecionada
                if (selectedItem) {
                  const novaAssociacao: ItemAssociation = {
                    pedidoId: sugestao.reqId,
                    quantidade: Math.min(sugestao.quantidadeDisponivel, selectedItem.quantidade),
                    valorUnitario: sugestao.valorUnitario
                  };

                  const updatedItems = items.map(i =>
                    i.id === selectedItem.id
                      ? {
                          ...i,
                          associacoes: [...(i.associacoes || []), novaAssociacao],
                          status: 'associated' as const
                        }
                      : i
                  );
                  setItems(updatedItems);
                  setShowSugestoesAutomaticas(false);

                  // Mostrar mensagem de sucesso
                  setMessageData({
                    title: 'Sugestão Aplicada',
                    message: `Associação automática realizada com sucesso para a requisição ${sugestao.reqIdComposto}`,
                    type: 'success'
                  });
                  setShowMessage(true);
                }
              }}
              onClose={() => setShowSugestoesAutomaticas(false)}
            />
          </div>
        </div>
      )}

      {/* Modais de validação */}
      <MessageModal
        isOpen={showMessage}
        onClose={() => setShowMessage(false)}
        title={messageData.title}
        message={messageData.message}
        type={messageData.type}
      />

      {/* ✅ NOVO: Modal de Decisão - Continuar ou Fazer Depois */}
      <DecisionModal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title="NFe Associada com Sucesso!"
        message="Deseja configurar o pagamento e gerar a entrada agora ou fazer isso depois?"
        onConfirm={handleContinuarAgora}
        onCancel={handleFazerDepois}
        confirmText="Continuar Agora"
        cancelText="Fazer Depois"
      />

      {/* 🧠 Sugestão Inteligente Única (alta ou média confiança) */}
      {showSugestaoUnica && sugestaoUnica && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <SugestaoInteligenteAlert
              produto={sugestaoUnica}
              onAceitar={handleAceitarSugestaoUnica}
              onRecusar={handleRecusarSugestaoUnica}
            />
          </div>
        </div>
      )}

      {/* 🧠 Lista de Múltiplas Sugestões */}
      {showSugestoesMultiplas && sugestoesMultiplas.length > 0 && (
        <ListaSugestoesInteligentes
          sugestoes={sugestoesMultiplas}
          onSelecionarProduto={handleSelecionarDaLista}
          onBuscarManualmente={handleBuscarManualmenteDaLista}
          onFechar={handleFecharListaSugestoes}
        />
      )}
    </div>
  );
};

// Componente para busca de produtos
interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (produto: Produto) => void;
  searchTerm: string;
}

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  searchTerm
}) => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Função para buscar produtos
  useEffect(() => {
    if (isOpen) {
      setSearch(searchTerm); // Pré-preencher com termo de busca
      // Buscar produtos automaticamente com base no searchTerm
      if (searchTerm) {
        buscarProdutos(searchTerm);
      }
    }
  }, [isOpen, searchTerm]);

  const buscarProdutos = async (termo: string) => {
    if (!termo.trim()) {
      setProdutos([]);
      return;
    }

    setLoading(true);
    try {
      // Usar API real do sistema
      const response = await fetch(`/api/entrada-xml/produtos/search?search=${encodeURIComponent(termo)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();

      if (apiData.success && apiData.data) {
        // Mapear dados da API para o formato esperado
        const produtosMapeados: Produto[] = apiData.data.map((produto: any) => ({
          id: produto.id,
          referencia: produto.referencia,
          ref: produto.ref,
          descricao: produto.descricao,
          codigoBarras: produto.codigoBarras,
          marca: produto.marca,
          estoque: produto.estoque,
          tipo: produto.tipo,
          localizacao: produto.localizacao
        }));

        setProdutos(produtosMapeados);
      } else {
        setProdutos([]);
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      // Fallback para alguns produtos mock em caso de erro
      setProdutos([
        {
          id: '999',
          referencia: 'ERRO',
          descricao: 'Erro ao conectar com banco - Produto de teste',
          codigoBarras: termo,
          marca: 'TESTE',
          estoque: 1,
          tipo: 'PRODUTO TESTE'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    buscarProdutos(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Buscar Produto</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <Label className="text-gray-700 dark:text-gray-300">Termo de busca</Label>
            <Input
              type="text"
              placeholder="Digite descrição ou referência do produto..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Buscando produtos...</p>
            </div>
          )}

          {!loading && produtos.length === 0 && search.trim() && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Nenhum produto encontrado para &quot;{search}&quot;</p>
            </div>
          )}

          {!loading && produtos.length === 0 && !search.trim() && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Digite um termo para buscar produtos</p>
            </div>
          )}

          {produtos.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {produtos.map(produto => (
                <div
                  key={produto.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => onSelect(produto)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span>Cód: {produto.id}</span>
                        {produto.ref && (
                          <span className="text-blue-700 dark:text-blue-300 font-mono text-sm">Ref: {produto.ref}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{produto.descricao}</div>
                      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>Marca: {produto.marca}</span>
                        <span>Estoque: {produto.estoque}</span>
                        <span>Tipo: {produto.tipo}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente para associar com pedidos
interface PedidosDisponiveisModalInternalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any; // Item da NFe com dados do produto (pode ser NFeItem ou objeto customizado)
  onConfirm: (
    associacoes: ItemAssociation[],
    configExtra?: {
      meiaNota: boolean;
      precoUnitarioNF?: number;
      rateio?: string;
      criterioRateio?: string;
      centroCusto?: string;
    },
  ) => void;
  fornecedorCnpj?: string; // CNPJ do fornecedor da NFe para filtrar ordens
  ordemIdSelecionada?: string; // ID da ordem selecionada no dropdown (quando vem da correspondência)
  associacoesExistentes?: ItemAssociation[]; // Para modo edição
  configExtraExistente?: { meiaNota?: boolean; precoUnitarioNF?: number } | null; // Reeditar: recarrega meia nota
}

const PedidosDisponiveisModal: React.FC<PedidosDisponiveisModalInternalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
  fornecedorCnpj,
  ordemIdSelecionada,
  associacoesExistentes,
  configExtraExistente
}) => {
  const [pedidos, setPedidos] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(false);

  // ⭐ MEIA NOTA (estilo Delphi): quando marcado, o preço unitário informado
  // (real) passa a valer para o cálculo do custo, no lugar do preço do XML.
  const precoNfXml = Number(item?.valorUnitario) || 0;
  const [meiaNota, setMeiaNota] = useState<boolean>(false);
  const [precoUnitarioNF, setPrecoUnitarioNF] = useState<number | undefined>(undefined);

  // Reeditar: recarrega a Meia Nota já salva ao (re)abrir o modal.
  useEffect(() => {
    if (isOpen) {
      const on = configExtraExistente?.meiaNota || false;
      setMeiaNota(on);
      setPrecoUnitarioNF(on ? configExtraExistente?.precoUnitarioNF : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Regra do legado: preço meia nota deve ser >= preço da NF (XML).
  const meiaNotaInvalida =
    meiaNota && (precoUnitarioNF === undefined || precoUnitarioNF <= 0 || precoUnitarioNF < precoNfXml);

  // Carregar pedidos disponíveis quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      const carregarPedidos = async () => {
        setLoading(true);
        try {
          // IMPORTANTE: Usar codprod (código real do produto no sistema) para buscar OCs
          // codprod = id do produto no dbprod, que é o mesmo que itr_codprod na ordem
          const codigoProduto = item?.codprod || item?.produtoId || item?.produtoAssociado?.referencia || item?.referencia || item?.codigo;

          if (codigoProduto) {
            // Usar API real para buscar pedidos disponíveis
            // Construir URL com parâmetros de filtro
            const params = new URLSearchParams();
            if (fornecedorCnpj) params.append('fornecedorCnpj', fornecedorCnpj);
            // NÃO filtra por ordemId: lista TODAS as OCs abertas do produto para
            // permitir dividir a quantidade entre várias ordens (a OC sugerida
            // pelo match automático é apenas pré-selecionada abaixo).

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const response = await fetch(`/api/entrada-xml/pedidos-disponiveis/${codigoProduto}${queryString}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const apiData = await response.json();

            if (apiData.success && apiData.data) {
              // Mapear dados da API para o formato esperado (OrdemCompra)
              const ordensMapeadas: OrdemCompra[] = apiData.data.map((ordem: any) => ({
                id: ordem.id,
                codigoRequisicao: ordem.codigoRequisicao,
                filial: ordem.filial,
                codCredor: ordem.codCredor,
                fornecedor: ordem.fornecedor,
                quantidadeDisponivel: ordem.quantidadeDisponivel,
                quantidadeAssociar: 0,
                valorUnitario: ordem.valorUnitario,
                dataPrevisao: ordem.dataPrevisao,
                multiplo: ordem.multiplo,
                descricaoMarca: ordem.descricaoMarca,
                precoCompra: ordem.precoCompra,
                dolar: ordem.dolar
              }));
              
              setPedidos(ordensMapeadas);

              // Pré-seleciona a OC sugerida (match automático) com a quantidade
              // possível — para o caso simples (uma OC) ser 1 clique. As demais
              // OCs ficam visíveis para o usuário dividir a quantidade.
              if ((!associacoesExistentes || associacoesExistentes.length === 0) && ordemIdSelecionada) {
                const sugerida = ordensMapeadas.find(
                  (o) => String(o.id) === String(ordemIdSelecionada),
                );
                if (sugerida) {
                  const qtd = Math.min(sugerida.quantidadeDisponivel, item.quantidade);
                  if (qtd > 0) {
                    setAssociacoes([
                      {
                        pedidoId: sugerida.id,
                        quantidade: qtd,
                        valorUnitario: sugerida.valorUnitario,
                      },
                    ]);
                  }
                }
              }
            } else {
              setPedidos([]);
            }
          } else {
            // Se não tiver produto associado, buscar ordens disponíveis do fornecedor
            try {
              // Passar CNPJ do fornecedor e ordem ID para filtrar
              const params = new URLSearchParams();
              if (fornecedorCnpj) {
                params.append('fornecedorCnpj', fornecedorCnpj);
              }
              // Sem filtro por ordemId: mostra todas as OCs do fornecedor.
              const response = await fetch(`/api/entrada-xml/ordens-compra-disponiveis?${params.toString()}`);
              const data = await response.json();

              if (data.success && data.data.length > 0) {
                const ordensFormatadas: OrdemCompra[] = data.data.map((ordem: any) => ({
                  id: ordem.id,
                  codigoRequisicao: ordem.codigoRequisicao,
                  filial: ordem.filial,
                  codCredor: ordem.codCredor,
                  fornecedor: ordem.fornecedor,
                  quantidadeDisponivel: ordem.quantidadeDisponivel,
                  quantidadeAssociar: 0,
                  valorUnitario: ordem.valorUnitario,
                  dataPrevisao: new Date().toISOString().split('T')[0],
                  multiplo: 1,
                  descricaoMarca: ordem.marca || ordem.descricaoMarca || 'SEM MARCA',
                  precoCompra: ordem.valorUnitario,
                  dolar: 5.20,
                  codprod: ordem.codprod,
                  descricaoProduto: ordem.descricaoProduto
                }));
                setPedidos(ordensFormatadas);
              } else {
                // Nenhuma ordem encontrada, lista vazia
                setPedidos([]);
              }
            } catch (error) {
              console.error('Erro ao buscar ordens disponíveis:', error);
              setPedidos([]);
            }
          }
        } catch (error) {
          console.error('Erro ao carregar pedidos:', error);
          // Fallback em caso de erro
          setPedidos([
            {
              id: 'erro-1',
              codigoRequisicao: 'ERRO-001',
              filial: 'TESTE',
              fornecedor: 'ERRO - FALLBACK',
              quantidadeDisponivel: item.quantidade,
              quantidadeAssociar: 0,
              valorUnitario: item.valorUnitario,
              dataPrevisao: '2024-09-15'
            }
          ]);
        } finally {
          setLoading(false);
        }
      };
      
      carregarPedidos();
    }
  }, [isOpen, item, fornecedorCnpj, ordemIdSelecionada]);

  const [associacoes, setAssociacoes] = useState<ItemAssociation[]>([]);

  // Inicializar com associações existentes (modo edição)
  useEffect(() => {
    if (isOpen && associacoesExistentes && associacoesExistentes.length > 0) {
      setAssociacoes(associacoesExistentes);
    } else if (isOpen) {
      setAssociacoes([]);
    }
  }, [isOpen, associacoesExistentes]);

  const handleQuantidadeChange = (pedidoId: string, quantidade: number) => {
    // 🔒 Validação em tempo real: limitar quantidade ao máximo disponível
    const pedido = pedidos.find(p => p.id === pedidoId);

    if (!pedido) return;

    // Calcular quanto já foi associado em OUTROS pedidos (excluindo este)
    const totalOutrosAssociados = associacoes
      .filter(a => a.pedidoId !== pedidoId)
      .reduce((sum, a) => sum + a.quantidade, 0);

    // Máximo permitido: menor valor entre disponível no pedido e quantidade restante no item
    const maxPermitido = Math.min(
      pedido.quantidadeDisponivel,
      item.quantidade - totalOutrosAssociados
    );

    // Limitar quantidade ao máximo permitido
    const quantidadeLimitada = Math.max(0, Math.min(quantidade, maxPermitido));

    // Se tentou digitar valor acima do limite, mostrar alerta
    if (quantidade > maxPermitido && quantidade > 0) {
      toast.warning(`Quantidade máxima disponível: ${maxPermitido}`);
    }

    const updatedAssociacoes = associacoes.filter(a => a.pedidoId !== pedidoId);
    if (quantidadeLimitada > 0) {
      updatedAssociacoes.push({
        pedidoId,
        quantidade: quantidadeLimitada,
        valorUnitario: pedido.valorUnitario
      });
    }
    setAssociacoes(updatedAssociacoes);
  };

  const totalAssociado = associacoes.reduce((sum, a) => sum + a.quantidade, 0);
  const podeConfirmar = totalAssociado === item.quantidade && !meiaNotaInvalida;

  // ⌨️ Esc fecha; Enter salva (quando a associação está válida). O foco pode
  // estar no input de quantidade ou na Meia Nota — Enter salva mesmo assim.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        // Se o foco estiver num botão, deixa o clique nativo agir.
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON') return;
        if (podeConfirmar) {
          e.preventDefault();
          e.stopPropagation();
          onConfirm(associacoes, { meiaNota, precoUnitarioNF });
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, podeConfirmar, associacoes, meiaNota, precoUnitarioNF, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[92vw] max-w-[1400px] mx-4 max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ordens de Compra Disponíveis</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Quantidade da nota: {item.quantidade} | 
              Associado: {totalAssociado} | 
              Restante: {item.quantidade - totalAssociado}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Carregando pedidos...</p>
            </div>
          ) : pedidos.length > 0 ? (
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded mb-3">
                <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">🔍 Ordens de Compra Disponíveis</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selecione as ordens de compra para associar com este item da NFe
                </p>
              </div>

              {/* Tabela estilo VM legada */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                <div className="bg-blue-600 text-white text-xs font-semibold grid grid-cols-9 gap-2 p-2">
                  <div>Ordem Compra</div>
                  <div>Filial</div>
                  <div>Cód Forn.</div>
                  <div>Fornecedor</div>
                  <div>Marca</div>
                  <div>Pr Unit</div>
                  <div>Quantidade</div>
                  <div>Múltiplo</div>
                  <div>Qtde Assoc.</div>
                </div>

                {pedidos.map((ordem, index) => {
                  const sugerida = ordemIdSelecionada && String(ordem.id) === String(ordemIdSelecionada);
                  return (
                  <div key={ordem.id} className={`grid grid-cols-9 gap-2 p-2 text-xs border-b border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-100 ${sugerida ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400' : index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-gray-50 dark:bg-zinc-800'} hover:bg-gray-100 dark:hover:bg-zinc-700`}>
                    <div className="font-medium text-blue-600 flex items-center gap-1">
                      {ordem.id}
                      {sugerida && <span className="text-[0.6rem] px-1 rounded bg-green-600 text-white">sugerida</span>}
                    </div>
                    <div>{ordem.filial}</div>
                    <div>{ordem.codCredor}</div>
                    <div className="truncate" title={ordem.fornecedor}>{ordem.fornecedor}</div>
                    <div>{ordem.descricaoMarca}</div>
                    <div className="font-medium">{formatCurrency(ordem.valorUnitario)}</div>
                    <div className="font-medium text-green-600">{ordem.quantidadeDisponivel}</div>
                    <div className="text-orange-600">{ordem.multiplo}x</div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        tabIndex={-1}
                        onClick={() => {
                          const currentQty = associacoes.find(a => a.pedidoId === ordem.id)?.quantidade || 0;
                          handleQuantidadeChange(ordem.id, Math.max(0, currentQty - 1));
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Minus size={12} />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        max={Math.min(ordem.quantidadeDisponivel, item.quantidade)}
                        value={associacoes.find(a => a.pedidoId === ordem.id)?.quantidade || 0}
                        onChange={(e) => handleQuantidadeChange(ordem.id, parseInt(e.target.value) || 0)}
                        className="w-20 h-7 text-sm text-center font-medium"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        tabIndex={-1}
                        onClick={() => {
                          const currentQty = associacoes.find(a => a.pedidoId === ordem.id)?.quantidade || 0;
                          const maxQty = Math.min(ordem.quantidadeDisponivel, item.quantidade - totalAssociado + currentQty);
                          handleQuantidadeChange(ordem.id, Math.min(maxQty, currentQty + 1));
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Informações adicionais */}
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-gray-900 dark:text-gray-100">
                <div className="flex justify-between items-center">
                  <span><strong>Quantidade da NFe:</strong> {item.quantidade}</span>
                  <span><strong>Já associado:</strong> {totalAssociado}</span>
                  <span className={`font-bold ${totalAssociado === item.quantidade ? 'text-green-600' : 'text-red-600'}`}>
                    <strong>Restante:</strong> {item.quantidade - totalAssociado}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Nenhum pedido disponível encontrado</p>
            </div>
          )}
          
          {!loading && totalAssociado > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
              <p className="text-sm text-orange-700">
                <strong>Faltam {item.quantidade - totalAssociado} unidades para associar</strong>
              </p>
            </div>
          )}

          {/* ⭐ Meia Nota */}
          <div className="mt-4 border-t border-gray-200 dark:border-zinc-700 pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pedMeiaNota"
                checked={meiaNota}
                onCheckedChange={(checked) => {
                  const on = checked as boolean;
                  setMeiaNota(on);
                  // Ao marcar, pré-preenche com o preço do XML (se ainda vazio);
                  // ao desmarcar, limpa. (No onChange, sem race de effect.)
                  setPrecoUnitarioNF((prev) => (on ? (prev ?? precoNfXml) : undefined));
                }}
              />
              <Label htmlFor="pedMeiaNota" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Meia Nota
              </Label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Marque se o preço na nota difere do preço real de compra. O preço informado passa a valer no cálculo do custo.
            </p>

            {meiaNota && (
              <div className="mt-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pr. Unit.: <span className="text-red-500">*</span>
                </Label>
                <InputMoeda
                  autoFocus
                  className="text-sm mt-1"
                  placeholder="Ex: 5.000,00"
                  value={precoUnitarioNF}
                  onChangeValue={(v) => setPrecoUnitarioNF(v)}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Valor mínimo permitido (preço da NF): R$ {precoNfXml.toFixed(4)}
                </p>
                {precoUnitarioNF !== undefined && precoUnitarioNF < precoNfXml && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-200">
                    <strong>❌ PREÇO UNITÁRIO INVÁLIDO</strong><br />
                    Deve ser maior ou igual ao valor da NF (R$ {precoNfXml.toFixed(4)})
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-between items-center p-6 border-t border-gray-200 dark:border-zinc-700">
          <div className="text-sm text-gray-600">
            {totalAssociado === item.quantidade ? (
              <span className="text-green-600 font-medium">✓ Quantidade correta associada</span>
            ) : (
              <span className="text-orange-600">
                Faltam {item.quantidade - totalAssociado} unidades para associar
              </span>
            )}
          </div>

          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => onConfirm(associacoes, { meiaNota, precoUnitarioNF })}
              disabled={!podeConfirmar}
              className="bg-blue-600 hover:bg-blue-700"
              title="Enter para salvar · Esc para fechar"
            >
              Confirmar Associação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para mostrar detalhes do produto selecionado
interface ProductDetailsModalProps {
  isOpen: boolean;
  produto: Produto;
  onClose: () => void;
  onConfirm: (data: {
    rateio: string;
    criterioRateio?: string;
    centroCusto?: string;
    meiaNota: boolean;
    precoUnitarioNF?: number;  // Só preço, quantidade sempre = quantidade do pedido
  }) => void;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  produto,
  onClose,
  onConfirm
}) => {
  const [rateio, setRateio] = useState<boolean>(false);
  const [criterioRateio, setCriterioRateio] = useState<string>('');
  const [centroCusto, setCentroCusto] = useState<string>('');
  const [centroCustoDescr, setCentroCustoDescr] = useState<string>('');
  const [meiaNota, setMeiaNota] = useState<boolean>(false);
  const [quantidadeNF, setQuantidadeNF] = useState<number | undefined>(undefined);
  const [precoUnitarioNF, setPrecoUnitarioNF] = useState<number | undefined>(undefined);
  const [showCentroCustoModal, setShowCentroCustoModal] = useState(false);
  const [errors, setErrors] = useState<{
    centroCusto?: string;
    criterioRateio?: string;
    quantidadeNF?: string;
    precoUnitarioNF?: string;
  }>({});

  // Determinar se é Material de Consumo (MC)
  const isMaterialConsumo = produto.tipo === 'MC';

  useEffect(() => {
    if (!isOpen) {
      // Reset ao fechar
      setRateio(false);
      setCriterioRateio('');
      setCentroCusto('');
      setCentroCustoDescr('');
      setMeiaNota(false);
      setQuantidadeNF(undefined);
      setPrecoUnitarioNF(undefined);
      setErrors({});
    }
  }, [isOpen]);

  // Preencher automaticamente campo de Preço quando checkbox é marcado
  useEffect(() => {
    if (meiaNota) {
      // Pre-preencher com valor do XML da NF (usuário só pode aumentar)
      setPrecoUnitarioNF(produto.valorUnitarioNF || 0);
    } else {
      // Limpar campo quando desmarcar
      setPrecoUnitarioNF(undefined);
      setErrors({
        ...errors,
        precoUnitarioNF: undefined
      });
    }
  }, [meiaNota]);

  const handleConfirm = () => {
    const newErrors: {
      centroCusto?: string;
      criterioRateio?: string;
      quantidadeNF?: string;
      precoUnitarioNF?: string;
    } = {};

    // Validar apenas se for Material de Consumo
    if (isMaterialConsumo) {
      if (rateio) {
        // Se rateio marcado, critério de rateio é obrigatório
        if (!criterioRateio) {
          newErrors.criterioRateio = 'Critério de Rateio é obrigatório quando Rateio está marcado';
        }
      } else {
        // Se rateio desmarcado, centro de custo é obrigatório
        if (!centroCusto) {
          newErrors.centroCusto = 'Centro de Custo é obrigatório para Material de Consumo';
        }
      }
    }

    // Validar campo de Meia Nota (só preço, quantidade sempre = quantidade do pedido)
    if (meiaNota) {
      if (!precoUnitarioNF || precoUnitarioNF <= 0) {
        newErrors.precoUnitarioNF = 'Preço Unitário é obrigatório quando Meia Nota está marcado';
      }
      // 🔒 REGRA CRÍTICA DO LEGADO: Preço Meia Nota deve ser >= Preço da NF XML
      else if (precoUnitarioNF && produto.valorUnitarioNF && precoUnitarioNF < produto.valorUnitarioNF) {
        newErrors.precoUnitarioNF = `PREÇO UNITÁRIO INVÁLIDO. Deve ser ≥ R$ ${produto.valorUnitarioNF.toFixed(4)}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    onConfirm({
      rateio: rateio ? 'S' : 'N',
      criterioRateio: rateio ? criterioRateio : undefined,
      centroCusto: !rateio && centroCusto ? centroCusto : undefined,
      meiaNota,
      // Quantidade NF não é enviada - sempre usa quantidade do pedido
      precoUnitarioNF: meiaNota ? precoUnitarioNF : undefined
    });
  };

  const handleSelectCentroCusto = (centro: { cod_ccusto: string; descr: string }) => {
    setCentroCusto(centro.cod_ccusto);
    setCentroCustoDescr(centro.descr);
    setErrors({ ...errors, centroCusto: undefined });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Localizar Referência</h3>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">Marca:</Label>
                <div className="text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 p-2 rounded border border-gray-300 dark:border-zinc-600">
                  {produto.marca || 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">Estoque:</Label>
                <div className="text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 p-2 rounded border border-gray-300 dark:border-zinc-600">
                  {produto.estoque}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">Descrição:</Label>
              <div className="text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 p-2 rounded border border-gray-300 dark:border-zinc-600">
                {produto.descricao}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">Localização:</Label>
              <div className="text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 p-2 rounded border border-gray-300 dark:border-zinc-600">
                {produto.localizacao || 'MERCADORIA'}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">Tipo:</Label>
              <div className="text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 p-2 rounded border border-gray-300 dark:border-zinc-600">
                {produto.tipo === 'MC' ? 'MC - MATERIAL DE CONSUMO' :
                 produto.tipo === 'ME' ? 'ME - MERCADORIA' :
                 produto.tipo === 'N' ? 'N - NORMAL' :
                 produto.tipo || 'NÃO INFORMADO'}
              </div>
            </div>

            {/* Rateio e Centro de Custo - SEMPRE mostrar, mas obrigatório apenas para MC */}
            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                {isMaterialConsumo && (
                  <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                    ⚠️ Material de Consumo: Rateio OU Centro de Custo é obrigatório
                  </div>
                )}
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="rateio"
                    checked={rateio}
                    onCheckedChange={(checked) => {
                      setRateio(checked as boolean);
                      if (checked) {
                        // Limpar centro de custo se marcar rateio
                        setCentroCusto('');
                        setCentroCustoDescr('');
                        setErrors({ ...errors, centroCusto: undefined });
                      } else {
                        // Limpar critério de rateio se desmarcar
                        setCriterioRateio('');
                        setErrors({ ...errors, criterioRateio: undefined });
                      }
                    }}
                  />
                  <Label htmlFor="rateio" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Habilitar Rateio
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Critério de Rateio */}
                  <div>
                    <Label className={`text-sm font-medium ${rateio ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>
                      Critério de Rateio: {(rateio && isMaterialConsumo) && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      className="text-sm"
                      placeholder="Código do critério"
                      value={criterioRateio}
                      onChange={(e) => {
                        setCriterioRateio(e.target.value);
                        setErrors({ ...errors, criterioRateio: undefined });
                      }}
                      disabled={!rateio}
                    />
                    {errors.criterioRateio && (
                      <p className="text-xs text-red-500 mt-1">{errors.criterioRateio}</p>
                    )}
                  </div>

                  {/* Centro de Custo */}
                  <div>
                    <Label className={`text-sm font-medium ${!rateio ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>
                      Centro de Custo: {(!rateio && isMaterialConsumo) && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        className="text-sm"
                        placeholder="Código"
                        value={centroCusto}
                        disabled={rateio}
                        readOnly
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCentroCustoModal(true)}
                        disabled={rateio}
                      >
                        ...
                      </Button>
                    </div>
                    {centroCustoDescr && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{centroCustoDescr}</p>
                    )}
                    {errors.centroCusto && (
                      <p className="text-xs text-red-500 mt-1">{errors.centroCusto}</p>
                    )}
                  </div>
                </div>
              </div>

            {/* Meia Nota */}
            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="meiaNota"
                  checked={meiaNota}
                  onCheckedChange={(checked) => setMeiaNota(checked as boolean)}
                />
                <Label htmlFor="meiaNota" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Meia Nota
                </Label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Marque se o preço na nota difere do preço de compra
              </p>

              {/* Painel condicional com campo de Meia Nota */}
              {meiaNota && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>Atenção:</strong> Informe o preço unitário conforme consta na Nota Fiscal.
                      A quantidade será a mesma do pedido. O preço pode divergir por motivos como desconto, negociação, ajuste fiscal, etc.
                    </p>
                  </div>

                  <div>
                    {/* Preço Unitário da NF */}
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pr. Unit.: <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      className="text-sm"
                      placeholder="Ex: 500.00"
                      value={precoUnitarioNF || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPrecoUnitarioNF(isNaN(val) ? undefined : val);
                        setErrors({ ...errors, precoUnitarioNF: undefined });
                      }}
                      min={0}
                      step={0.01}
                    />
                    {errors.precoUnitarioNF && (
                      <p className="text-xs text-red-500 mt-1">{errors.precoUnitarioNF}</p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Valor mínimo permitido: R$ {produto.valorUnitarioNF?.toFixed(4) || 'N/A'}
                    </p>
                    {/* Alerta em tempo real quando preço está abaixo do mínimo */}
                    {precoUnitarioNF !== undefined && produto.valorUnitarioNF !== undefined &&
                     precoUnitarioNF < produto.valorUnitarioNF && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-200">
                        <strong>❌ PREÇO UNITÁRIO INVÁLIDO</strong><br/>
                        Deve ser maior ou igual ao valor da NF XML (R$ {produto.valorUnitarioNF.toFixed(4)})
                      </div>
                    )}
                  </div>

                  {/* Cálculo de divergência em tempo real (só preço) */}
                  {precoUnitarioNF !== undefined && produto.valorUnitarioPedido !== undefined && (
                    <div className="pt-3 border-t border-yellow-300 dark:border-yellow-700">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Comparação de Preço:</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Preço do Pedido:</span>
                          <span className="font-medium">R$ {produto.valorUnitarioPedido.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Preço da NF:</span>
                          <span className="font-medium">R$ {precoUnitarioNF.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-yellow-300 dark:border-yellow-700">
                          <span className="text-gray-600 dark:text-gray-400">Diferença:</span>
                          <span className={`font-bold ${
                            precoUnitarioNF < produto.valorUnitarioPedido
                              ? 'text-green-600 dark:text-green-400'
                              : precoUnitarioNF > produto.valorUnitarioPedido
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {precoUnitarioNF < produto.valorUnitarioPedido && '- '}
                            {precoUnitarioNF > produto.valorUnitarioPedido && '+ '}
                            R$ {Math.abs(precoUnitarioNF - produto.valorUnitarioPedido).toFixed(4)}
                            {' '}
                            ({((precoUnitarioNF - produto.valorUnitarioPedido) / produto.valorUnitarioPedido * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-zinc-700 flex-shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              Avançar
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de seleção de Centro de Custo */}
      <CentroCustoModal
        isOpen={showCentroCustoModal}
        onClose={() => setShowCentroCustoModal(false)}
        onSelect={handleSelectCentroCusto}
      />
    </>
  );
};