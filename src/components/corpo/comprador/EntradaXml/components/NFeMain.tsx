import React, { useState, useRef, useEffect, useContext } from 'react';
import { Upload, Package, CircleChevronDown, Eye, Settings, Trash2, DollarSign, Play, Filter, History, Unlock, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { AuthContext } from '@/contexts/authContexts';
import DataTableNFe from './DataTableNFe';
import { UploadXmlModal } from './UploadXmlModal';
import { ViewNFeModal } from './ViewNFeModal';
import { ProcessNFeModal } from './ProcessNFeModal';
import { ConfirmNFeDataModal, NFeConfirmationData } from './ConfirmNFeDataModal';
import { NFeItemsAssociationModal } from './NFeItemsAssociationModal';
import { GerarEntradaModal } from './GerarEntradaModal';
import GerarEntradaNFeModal from './GerarEntradaNFeModal';
import { ConfiguracaoPagamentoNFeModal } from './ConfiguracaoPagamentoNFeModal';
import { SelecionarPagamentosAntecipados } from './SelecionarPagamentosAntecipados';
import { NFeFiltrosAvancados, NFeFilters } from './NFeFiltrosAvancados';
import { HistoricoNFeModal } from './HistoricoNFeModal';
import MessageModal from '@/components/common/MessageModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useNFes } from '../hooks/useNFes';
import { useNFeTableImproved } from '../hooks/useNFeTableImproved';
import { useNFeActions } from '../hooks/useNFeActions';
import { colunasDbNFe } from '../colunasDbNFe';
import { NFeDTO } from '../types';
import { toast } from 'sonner';

// Versão atualizada sem coluna selecionar e com dropdown 3 pontos
export const NFeMain: React.FC = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGerarEntradaOpen, setIsGerarEntradaOpen] = useState(false);
  const [isGerarEntradaVerdeOpen, setIsGerarEntradaVerdeOpen] = useState(false);
  const [viewItem, setViewItem] = useState<NFeDTO | null>(null);
  const [processItem, setProcessItem] = useState<NFeDTO | null>(null);
  const [configureItem, setConfigureItem] = useState<NFeDTO | null>(null);
  const [itemsAssociationItem, setItemsAssociationItem] = useState<NFeDTO | null>(null);
  const [selectedNFeId, setSelectedNFeId] = useState<string>('');
  const [associatedItemsData, setAssociatedItemsData] = useState<any[]>([]);

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<NFeDTO | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [itemToReset, setItemToReset] = useState<NFeDTO | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [messageData, setMessageData] = useState({ title: '', message: '', type: 'info' as any });

  // Estados para Gerar Cobrança (configuração de pagamento standalone)
  const [showGerarCobranca, setShowGerarCobranca] = useState(false);
  const [nfeParaCobranca, setNfeParaCobranca] = useState<NFeDTO | null>(null);

  // Estados para seleção de pagamentos antecipados (antes de associar)
  const [showSelecionarAntecipados, setShowSelecionarAntecipados] = useState(false);
  const [nfeParaAntecipados, setNfeParaAntecipados] = useState<NFeDTO | null>(null);
  const [ordensAntecipadasSelecionadas, setOrdensAntecipadasSelecionadas] = useState<number[]>([]);
  const [valorAntecipadoSelecionado, setValorAntecipadoSelecionado] = useState(0);

  // Estados para Gerar Entrada (modal GerarEntradaModal - com associações carregadas)
  const [showGerarEntradaDireta, setShowGerarEntradaDireta] = useState(false);
  const [nfeParaEntradaDireta, setNfeParaEntradaDireta] = useState<NFeDTO | null>(null);
  const [associacoesCarregadas, setAssociacoesCarregadas] = useState<any[]>([]);
  const [carregandoAssociacoes, setCarregandoAssociacoes] = useState(false);

  // Estados para filtros avançados
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<NFeFilters>({});

  // Estados para Histórico
  const [showHistorico, setShowHistorico] = useState(false);
  const [nfeParaHistorico, setNfeParaHistorico] = useState<NFeDTO | null>(null);

  // Dropdown states for actions menu (following requisitions pattern)
  const [dropdownStates, setDropdownStates] = useState<{[key: string]: boolean}>({});
  const dropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const actionButtonRefs = useRef<{[key: string]: HTMLButtonElement | null}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: string]: {top: number; left: number} | null}>({});
  const [iconRotations, setIconRotations] = useState<{[key: string]: boolean}>({});

  const { canEdit } = usePermissions();
  const { user } = useContext(AuthContext);

  const {
    search,
    page,
    perPage,
    headers,
    filtros,
    limiteColunas,
    handleSearchChange,
    handleSearchBlur,
    handleSearchKeyDown,
    handlePageChange,
    handlePerPageChange,
    handleFiltroChange,
    handleColunaSubstituida,
    handleLimiteColunasChange,
    getApiParams,
  } = useNFeTableImproved({
    limiteColunas: 8,
    storageKey: 'nfe-entrada-xml-table-config-v2'
  });

  const { data, meta, loading, refetch, updateNFeStatus } = useNFes({
    page,
    perPage,
    search,
    filters: filtros,
    advancedFilters,
  });

  const {
    loading: actionLoading,
    uploadXml,
    processNFe,
    deleteNFe
  } = useNFeActions();

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      let shouldClose = true;

      // Verificar se o clique foi em qualquer dropdown ou botão de ação
      Object.keys(dropdownStates).forEach(nfeId => {
        const dropdown = dropdownRefs.current[parseInt(nfeId)];
        const actionButton = actionButtonRefs.current[parseInt(nfeId)];

        if (
          (dropdown && dropdown.contains(target)) ||
          (actionButton && actionButton.contains(target))
        ) {
          shouldClose = false;
        }
      });

      if (shouldClose && Object.keys(dropdownStates).some(id => dropdownStates[parseInt(id)])) {
        setDropdownStates({});
        setDropdownPositions({});
        setIconRotations({});
      }
    };

    // Só adiciona o listener se há dropdowns abertos
    const hasOpenDropdowns = Object.keys(dropdownStates).some(id => dropdownStates[parseInt(id)]);
    if (hasOpenDropdowns) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [dropdownStates]);

  const toggleDropdown = (nfeId: string, buttonElement: HTMLButtonElement) => {
    setDropdownStates(prevStates => {
      const newState = { ...prevStates, [nfeId]: !prevStates[nfeId] };
      return newState;
    });

    setIconRotations(prevRotations => ({
      ...prevRotations,
      [nfeId]: !prevRotations[nfeId]
    }));

    if (!dropdownStates[nfeId]) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 160; // largura aproximada do dropdown

      // Calcular posição left: se não couber à esquerda, posiciona à direita do botão
      let leftPosition = rect.left - dropdownWidth + rect.width;

      // Se o dropdown sairia da tela pela esquerda, posicionar à direita do botão
      if (leftPosition < 10) {
        leftPosition = rect.left;
      }

      // Se o dropdown sairia da tela pela direita, ajustar
      if (leftPosition + dropdownWidth > window.innerWidth - 10) {
        leftPosition = window.innerWidth - dropdownWidth - 10;
      }

      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [nfeId]: {
          top: rect.bottom + 4,
          left: leftPosition
        }
      }));
    } else {
      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [nfeId]: null
      }));
    }
  };

  const handleView = (item: NFeDTO) => {
    setViewItem(item);
  };

  const handleProcess = async (item: NFeDTO) => {
    try {
      // OTIMIZADO: Endpoint combinado que assume + extrai dados em uma unica chamada
      const response = await fetch('/api/entrada-xml/processar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfeId: item.id,
          userId: user?.codusr,
          userName: user?.usuario
        })
      });

      const data = await response.json();

      // Se NFe esta bloqueada por outro usuario
      if (response.status === 409) {
        toast.error(`Esta NFe esta sendo processada por ${data.processandoPor}`);
        return;
      }

      if (!response.ok) {
        toast.error(data.message || 'Erro ao processar NFe');
        return;
      }

      if (data.success && data.data?.itens) {
        // Adicionar os itens ao objeto NFe
        const nfeComItens = {
          ...item,
          itens: data.data.itens.map((itemData: any) => ({
            codigo: itemData.codigo_produto,
            descricao: itemData.descricao,
            quantidade: itemData.quantidade,
            valorUnitario: itemData.valor_unitario,
            valorTotal: itemData.valor_total,
            ncm: itemData.ncm,
            cfop: itemData.cfop,
            unidade: itemData.unidade
          }))
        };
        setProcessItem(nfeComItens);
      } else {
        setMessageData({
          title: 'Erro',
          message: 'Nao foi possivel carregar os itens da NFe',
          type: 'error'
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao processar NFe:', error);
      setMessageData({
        title: 'Erro',
        message: 'Erro ao processar NFe',
        type: 'error'
      });
      setShowMessage(true);
    }
  };

  // Handler para "Continuar" - vai direto para associacoes
  const handleContinuar = async (item: NFeDTO) => {
    try {
      // OTIMIZADO: Endpoint combinado que assume + extrai dados em uma unica chamada
      const response = await fetch('/api/entrada-xml/processar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfeId: item.id,
          userId: user?.codusr,
          userName: user?.usuario
        })
      });

      const data = await response.json();

      // Se NFe esta bloqueada por outro usuario
      if (response.status === 409) {
        toast.error(`Esta NFe esta sendo processada por ${data.processandoPor}`);
        return;
      }

      if (!response.ok) {
        toast.error(data.message || 'Erro ao continuar NFe');
        return;
      }

      if (data.success && data.data?.itens) {
        // Adicionar os itens ao objeto NFe
        const nfeComItens = {
          ...item,
          itens: data.data.itens.map((itemData: any) => ({
            codigo: itemData.codigo_produto,
            descricao: itemData.descricao,
            quantidade: itemData.quantidade,
            valorUnitario: itemData.valor_unitario,
            valorTotal: itemData.valor_total,
            ncm: itemData.ncm,
            cfop: itemData.cfop,
            unidade: itemData.unidade
          }))
        };

        // Vai DIRETO para modal de associacoes (pula etapas anteriores)
        setItemsAssociationItem(nfeComItens);
      } else {
        setMessageData({
          title: 'Erro',
          message: 'Nao foi possivel carregar os itens da NFe',
          type: 'error'
        });
        setShowMessage(true);
      }
    } catch (error) {
      console.error('Erro ao continuar NFe:', error);
      setMessageData({
        title: 'Erro',
        message: 'Erro ao continuar NFe',
        type: 'error'
      });
      setShowMessage(true);
    }
  };

  const handleConfigure = (item: NFeDTO) => {
    setConfigureItem(item);
  };

  // Handler para fechar modal de associacao (NAO libera - usuario continua como dono)
  const handleCloseItemsAssociationModal = () => {
    setItemsAssociationItem(null);
    // Atualiza lista para mostrar status atual
    refetch();
  };

  // Handler para fechar modal de processamento (NAO libera - usuario continua como dono)
  const handleCloseProcessModal = () => {
    setProcessItem(null);
    refetch();
  };

  // Handler para liberar NFe explicitamente (quando usuario quer desistir)
  const handleLiberarNfe = async (nfeId: string) => {
    try {
      const response = await fetch('/api/entrada-xml/liberar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfeId,
          userId: user?.codusr,
          userName: user?.usuario
        })
      });

      if (response.ok) {
        toast.success('NFe liberada com sucesso');
        refetch();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao liberar NFe');
      }
    } catch (error) {
      console.error('Erro ao liberar NFe:', error);
      toast.error('Erro ao liberar NFe');
    }
  };

  // Handler para Gerar Cobranca (configurar pagamento sem gerar entrada)
  const handleGerarCobranca = (nfe: NFeDTO) => {
    // Se a NFe já está associada (ASSOCIACAO_CONCLUIDA), vai direto para configuração
    if (nfe.status === 'ASSOCIACAO_CONCLUIDA') {
      setNfeParaCobranca(nfe);
      setShowGerarCobranca(true);
    } else {
      // Se a NFe ainda não está associada, abre modal de seleção de pagamentos antecipados
      setNfeParaAntecipados(nfe);
      setShowSelecionarAntecipados(true);
    }
  };

  // Handler quando usuário seleciona pagamentos antecipados e prossegue
  const handleProsseguirComAntecipados = (ordensIds: number[], valorTotal: number) => {
    setOrdensAntecipadasSelecionadas(ordensIds);
    setValorAntecipadoSelecionado(valorTotal);
    setShowSelecionarAntecipados(false);

    // Abrir modal de configuração de pagamento com as ordens selecionadas
    if (nfeParaAntecipados) {
      setNfeParaCobranca(nfeParaAntecipados);
      setShowGerarCobranca(true);
    }
    setNfeParaAntecipados(null);
  };

  // Handler quando não há pagamentos antecipados (ou usuário pula)
  const handleSemPagamentosAntecipados = () => {
    setShowSelecionarAntecipados(false);

    // Abrir modal de configuração de pagamento sem ordens antecipadas
    if (nfeParaAntecipados) {
      setNfeParaCobranca(nfeParaAntecipados);
      setOrdensAntecipadasSelecionadas([]);
      setValorAntecipadoSelecionado(0);
      setShowGerarCobranca(true);
    }
    setNfeParaAntecipados(null);
  };

  // Handler para Gerar Entrada (carrega associações e abre GerarEntradaModal)
  const handleGerarEntrada = async (nfe: NFeDTO) => {
    setCarregandoAssociacoes(true);

    try {
      // Buscar associações salvas da NFe usando a API carregar-progresso
      const response = await fetch(`/api/entrada-xml/carregar-progresso?nfeId=${nfe.id}`);
      const data = await response.json();

      if (data.success && data.data?.items?.length > 0) {
        // Transformar dados para o formato esperado pelo GerarEntradaModal
        const associacoesFormatadas = data.data.items.map((item: any) => ({
          nfeItemId: item.nfeItemId,
          produtoId: item.produtoId,
          associacoes: item.associacoes || [],
          meianota: false,
          precoReal: item.associacoes?.[0]?.valorUnitario
        }));

        setAssociacoesCarregadas(associacoesFormatadas);
        setNfeParaEntradaDireta(nfe);
        setShowGerarEntradaDireta(true);
      } else {
        toast.error('Não foi possível carregar as associações da NFe. Verifique se todos os itens foram associados.');
      }
    } catch (error) {
      console.error('Erro ao carregar associações:', error);
      toast.error('Erro ao carregar associações da NFe');
    } finally {
      setCarregandoAssociacoes(false);
    }
  };

  // Handler sucesso da configuração de cobrança
  const handleSuccessCobranca = async () => {
    setShowGerarCobranca(false);
    setNfeParaCobranca(null);
    await refetch();
    setMessageData({
      title: 'Sucesso',
      message: 'Cobrança configurada com sucesso!',
      type: 'success'
    });
    setShowMessage(true);
  };

  // Handler sucesso do processamento via GerarEntradaModal (dropdown)
  const handleEntradaGeradaDireta = (entradaId: number, numeroEntrada: string, nfeId: string) => {
    setShowGerarEntradaDireta(false);
    setNfeParaEntradaDireta(null);
    setAssociacoesCarregadas([]);
    updateNFeStatus(nfeId, 'PROCESSADA');
    refetch();
    setMessageData({
      title: 'NFe Processada',
      message: 'NFe processada com sucesso! Para gerar a entrada de estoque, acesse a tela de Entradas de Mercadorias.',
      type: 'success'
    });
    setShowMessage(true);
  };

  const handleDelete = (item: NFeDTO) => {
    setItemToDelete(item);
    setShowDeleteConfirmation(true);
  };

  // Handler para aplicar filtros avançados
  const handleApplyAdvancedFilters = (filters: NFeFilters) => {
    setAdvancedFilters(filters);
  };

  // Verificar se há filtros avançados ativos
  const hasAdvancedFilters = () => {
    return Object.values(advancedFilters).some(value =>
      Array.isArray(value) ? value.length > 0 : Boolean(value)
    );
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setShowDeleteConfirmation(false);
    const success = await deleteNFe(itemToDelete.id);
    if (success) {
      await refetch();
    }
    setItemToDelete(null);
  };

  // Handler para resetar NFe (TESTE)
  const handleResetNfe = (item: NFeDTO) => {
    setItemToReset(item);
    setShowResetConfirmation(true);
  };

  // Handler para confirmar reset da NFe (TESTE)
  const handleConfirmReset = async () => {
    if (!itemToReset) return;

    setIsResetting(true);
    try {
      const response = await fetch('/api/entrada-xml/resetar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfeId: itemToReset.id })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        await refetch();
      } else {
        toast.error(data.error || 'Erro ao resetar NFe');
      }
    } catch (error) {
      console.error('Erro ao resetar NFe:', error);
      toast.error('Erro ao resetar NFe');
    } finally {
      setIsResetting(false);
      setShowResetConfirmation(false);
      setItemToReset(null);
    }
  };

  const handleUploadSuccess = async () => {
    setIsUploadOpen(false);
    await refetch();
  };

  const handleEntradaGerada = async (entradaId: number, numeroEntrada: string, nfeId: string) => {
    // Fechar modal e limpar estados
    setIsGerarEntradaOpen(false);
    setSelectedNFeId('');
    setAssociatedItemsData([]);

    // Atualiza o status da NFe localmente (sem reload brusco)
    updateNFeStatus(nfeId, 'PROCESSADA');

    setMessageData({
      title: 'NFe Processada com Sucesso!',
      message: 'NFe processada com sucesso! Para gerar a entrada de estoque, acesse a tela de Entradas de Mercadorias.',
      type: 'success'
    });
    setShowMessage(true);
  };

  const handleProcessSuccess = async () => {
    // Após processar, vai direto para configuração
    const currentItem = processItem;
    setProcessItem(null);

    if (currentItem) {
      // Vai direto para a configuração/associação de itens
      setConfigureItem(currentItem);
    }

    await refetch();
  };

  const handleConfirmData = (data: NFeConfirmationData) => {
    // Vai para próxima etapa - associação de itens
    const currentItem = configureItem;
    setConfigureItem(null);
    
    if (currentItem) {
      setItemsAssociationItem(currentItem);
    }
  };

  const handleItemsAssociationComplete = async (associatedItemsData: any[]) => {
    if (!itemsAssociationItem) return;

    // As associações já foram salvas no próprio modal de associação
    // Agora apenas precisamos armazenar os dados e abrir o modal de gerar entrada

    // Armazenar NFe selecionada e dados associados para o modal de gerar entrada
    setSelectedNFeId(itemsAssociationItem.id);
    setAssociatedItemsData(associatedItemsData);

    // Fechar modal de associação
    setItemsAssociationItem(null);

    // Abrir modal de gerar entrada
    setIsGerarEntradaOpen(true);
  };


  // Função para renderizar ações seguindo padrão das requisições
  const renderActions = (nfe: NFeDTO) => {
    return (
      <div className="flex justify-center">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[nfe.id] = el;
            }
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown(nfe.id, e.currentTarget);
          }}
          className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          title="Ações"
          style={{
            transform: iconRotations[nfe.id] ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <CircleChevronDown size={20} />
        </button>
        {dropdownStates[nfe.id] && dropdownPositions[nfe.id] && createPortal(
          <div
            key={`portal-dropdown-${nfe.id}`}
            ref={(el) => {
              if (el) {
                dropdownRefs.current[nfe.id] = el;
              }
            }}
            className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
            style={{
              position: 'fixed',
              top: dropdownPositions[nfe.id]?.top,
              left: dropdownPositions[nfe.id]?.left,
              minWidth: '144px',
              borderRadius: '0.375rem',
              boxShadow: '0 10px 25px 0 rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 9999,
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <div className="py-1" role="menu" aria-orientation="vertical">
              {/* Ver sempre disponível */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleView(nfe);
                  setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                }}
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                role="menuitem"
              >
                <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                Ver
              </button>

              {/* Histórico sempre disponível */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNfeParaHistorico(nfe);
                  setShowHistorico(true);
                  setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                }}
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                role="menuitem"
              >
                <History className="mr-2 text-purple-500 dark:text-purple-400" size={16} />
                Historico
              </button>

              {/* Liberar NFe - apenas para quem esta processando */}
              {canEdit && nfe.processandoPor && nfe.processandoPor === user?.codusr && nfe.status !== 'PROCESSADA' && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLiberarNfe(nfe.id);
                    setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                  }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Unlock className="mr-2 text-orange-500 dark:text-orange-400" size={16} />
                  Liberar NFe
                </button>
              )}

              {/* Ações baseadas no status */}
              {/* NFes RECEBIDAS: Podem ser processadas, gerar cobrança ou excluídas */}
              {canEdit && nfe.status === 'RECEBIDA' && (
                <>
                  <button
                    onClick={() => {
                      handleProcess(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Settings className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Processar
                  </button>
                  <button
                    onClick={() => {
                      handleGerarCobranca(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <DollarSign className="mr-2 text-yellow-500 dark:text-yellow-400" size={16} />
                    Gerar Cobrança
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Trash2 className="mr-2 text-red-500 dark:text-red-400" size={16} />
                    Excluir
                  </button>
                </>
              )}

              {/* NFes EM_ANDAMENTO: Tem progresso salvo, mostrar "Continuar" e "Gerar Cobrança" */}
              {canEdit && nfe.status === 'EM_ANDAMENTO' && (
                <>
                  <button
                    onClick={() => {
                      handleContinuar(nfe); // FIXED: Era handleProcess, agora é handleContinuar
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Settings className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Continuar
                  </button>
                  <button
                    onClick={() => {
                      handleGerarCobranca(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <DollarSign className="mr-2 text-yellow-500 dark:text-yellow-400" size={16} />
                    Gerar Cobrança
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Trash2 className="mr-2 text-red-500 dark:text-red-400" size={16} />
                    Excluir
                  </button>
                </>
              )}

              {/* NFes ASSOCIACAO_CONCLUIDA: Pode gerar cobrança e/ou entrada */}
              {canEdit && nfe.status === 'ASSOCIACAO_CONCLUIDA' && (
                <>
                  <button
                    onClick={() => {
                      handleGerarCobranca(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <DollarSign className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Gerar Cobrança
                  </button>
                  <button
                    onClick={() => {
                      handleGerarEntrada(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Play className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                    Confirmar NFe
                  </button>
                </>
              )}

              {/* NFes PROCESSADAS: Já está processada, apenas visualização */}
              {nfe.status === 'PROCESSADA' && (
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 italic">
                  NFe já processada
                </div>
              )}

              {/* Separador - Opcoes de Teste */}
              {canEdit && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                  <button
                    onClick={() => {
                      handleResetNfe(nfe);
                      setDropdownStates(prev => ({ ...prev, [nfe.id]: false }));
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/30 focus:text-red-600 dark:focus:text-red-400 w-full text-red-600 dark:text-red-400"
                    role="menuitem"
                  >
                    <RotateCcw className="mr-2" size={16} />
                    Resetar NFe (Teste)
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  // Função para formatar os dados para o DataTableFiltroV3
  const formatTableData = () => {
    return data.map((nfe) => ({
      ...nfe,
      numeroNF: nfe.numeroNF || '',
      serie: nfe.serie || '',
      chaveNFe: nfe.chaveNFe ? nfe.chaveNFe.substring(0, 20) + '...' : '',
      emitente: nfe.emitente || 'N/A',
      dataEmissao: nfe.dataEmissao ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR') : '',
      valorTotal: nfe.valorTotal ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(nfe.valorTotal) : 'R$ 0,00',
      status: (
        <div className="flex flex-col gap-1">
          {/* Badge de status principal */}
          <span className={`px-2 py-1 text-xs rounded-full ${
            nfe.status === 'PROCESSADA'
              ? 'text-green-700 bg-green-100 font-semibold'
              : nfe.status === 'EM_ANDAMENTO'
              ? 'text-yellow-700 bg-yellow-100 font-semibold'
              : nfe.status === 'ASSOCIACAO_CONCLUIDA'
              ? 'text-purple-600 bg-purple-50'
              : nfe.status === 'RECEBIDA'
              ? 'text-blue-600 bg-blue-50'
              : nfe.status === 'ERRO'
              ? 'text-red-600 bg-red-50'
              : 'text-gray-600 bg-gray-50'
          }`}>
            {nfe.status === 'PROCESSADA' ? 'Processada' :
             nfe.status === 'EM_ANDAMENTO' ? 'Em Andamento' :
             nfe.status === 'ASSOCIACAO_CONCLUIDA' ? 'Associada' :
             nfe.status === 'RECEBIDA' ? 'Recebida' :
             nfe.status === 'ERRO' ? 'Erro' :
             nfe.status || 'N/A'}
          </span>
          {/* Badge de controle de usuario */}
          {nfe.status !== 'PROCESSADA' && (
            <span
              className={`px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap ${
                // Iniciado por voce (verde)
                nfe.processandoPor && nfe.processandoPor === user?.codusr
                  ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50'
                  // Iniciado por outro usuario (vermelho)
                  : nfe.processandoPor && nfe.processandoPor !== user?.codusr
                  ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50'
                  // Iniciado e livre (amarelo) - tem progresso mas ninguem processando
                  : nfe.status !== 'RECEBIDA'
                  ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50'
                  // Procedimento nao iniciado (cinza)
                  : 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
              }`}
              title={
                nfe.processandoPor && nfe.processandoPor === user?.codusr
                  ? 'Voce esta processando esta NFe'
                  : nfe.processandoPor && nfe.processandoPor !== user?.codusr
                  ? `${nfe.processandoNome || 'Outro usuario'} esta processando`
                  : nfe.status !== 'RECEBIDA'
                  ? 'NFe iniciada e livre para continuar'
                  : 'Processamento nao iniciado'
              }
            >
              {nfe.processandoPor && nfe.processandoPor === user?.codusr
                ? 'Iniciado por voce'
                : nfe.processandoPor && nfe.processandoPor !== user?.codusr
                ? `Iniciado por ${nfe.processandoNome || 'outro'}`
                : nfe.status !== 'RECEBIDA'
                ? 'Iniciado e livre'
                : 'Nao iniciado'}
            </span>
          )}
          {/* Badge de Pagamento Configurado */}
          {nfe.pagamentoConfigurado && (
            <span
              className="px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/50"
              title="Pagamento já foi configurado para esta NFe"
            >
              Pgto Configurado
            </span>
          )}
        </div>
      ),
      dataUpload: nfe.dataUpload ? new Date(nfe.dataUpload).toLocaleString('pt-BR') : '',
      // Mapeamento para campos que podem estar faltando
      fornecedorCnpj: nfe.cnpjEmitente || '',
      natOperacao: nfe.naturezaOperacao || '',
      modelo: '55', // NFe sempre é modelo 55
      versao: nfe.versao || '',
      protocolo: nfe.protocolo || '',
      totalProdutos: nfe.valorProdutos ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(nfe.valorProdutos) : 'R$ 0,00',
      totalIcms: nfe.valorICMS ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(nfe.valorICMS) : 'R$ 0,00',
      totalIpi: nfe.valorIPI ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(nfe.valorIPI) : 'R$ 0,00',
      pesoLiquido: nfe.pesoLiquido ? `${nfe.pesoLiquido.toFixed(2)} kg` : '',
      pesoBruto: nfe.pesoBruto ? `${nfe.pesoBruto.toFixed(2)} kg` : '',
      tipoFrete: nfe.modalidadeFrete === 0 ? 'Emitente' :
                 nfe.modalidadeFrete === 1 ? 'Destinatário' :
                 nfe.modalidadeFrete === 2 ? 'Terceiros' : '',
      acoes: renderActions(nfe)
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Header compacto - seguindo padrão do sistema */}
      <div className="px-10 pt-4 pb-1 flex-shrink-0">
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
            Entrada por XML/NFe
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                >
                  <Upload size={18} />
                  Upload XML
                </Button>

                <Button
                  onClick={() => setIsGerarEntradaVerdeOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 text-sm h-8 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Package size={18} />
                  Processar XML
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de NFes */}
      <div className="flex-1 min-h-0 px-4">
        <DataTableNFe
          headers={headers}
          rows={formatTableData()}
          meta={meta}
          carregando={loading}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={handleLimiteColunasChange}
          onSearch={handleSearchChange}
          onSearchBlur={handleSearchBlur}
          onSearchKeyDown={handleSearchKeyDown}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onFiltroChange={handleFiltroChange}
          onColunaSubstituida={handleColunaSubstituida}
          colunasFiltro={colunasDbNFe.map(col => col.campo)}
          colunasFixas={['acoes', 'AÇÕES']}
          searchInputPlaceholder="Buscar por NFe, chave, emitente..."
          exportEndpoint="/api/entrada-xml/exportar"
          exportFileName="nfes.xlsx"
        />
      </div>

      {/* Modais */}
      {isUploadOpen && (
        <UploadXmlModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={handleUploadSuccess}
          loading={actionLoading}
        />
      )}

      {isGerarEntradaOpen && selectedNFeId && (
        <GerarEntradaModal
          isOpen={isGerarEntradaOpen}
          onClose={() => {
            setIsGerarEntradaOpen(false);
            setSelectedNFeId('');
            setAssociatedItemsData([]);
          }}
          nfeId={selectedNFeId}
          associatedItems={associatedItemsData}
          onConfirm={handleEntradaGerada}
          loading={actionLoading}
        />
      )}

      {viewItem && (
        <ViewNFeModal
          isOpen={!!viewItem}
          nfe={viewItem}
          onClose={() => setViewItem(null)}
        />
      )}

      {processItem && (
        <ProcessNFeModal
          isOpen={!!processItem}
          nfe={processItem}
          onClose={handleCloseProcessModal}
          onSuccess={handleProcessSuccess}
          loading={actionLoading}
        />
      )}

      {configureItem && (
        <ConfirmNFeDataModal
          isOpen={!!configureItem}
          nfe={configureItem}
          onClose={() => setConfigureItem(null)}
          onConfirm={handleConfirmData}
          loading={actionLoading}
        />
      )}

      {itemsAssociationItem && (
        <NFeItemsAssociationModal
          isOpen={!!itemsAssociationItem}
          nfe={itemsAssociationItem}
          onClose={handleCloseItemsAssociationModal}
          onComplete={handleItemsAssociationComplete}
          onRefetch={refetch}
          loading={actionLoading}
          userId={user?.codusr || ''}
          userName={user?.usuario || ''}
        />
      )}

      {/* Modal Botão Verde - Processar NFes já Associadas */}
      <GerarEntradaNFeModal
        isOpen={isGerarEntradaVerdeOpen}
        onClose={() => setIsGerarEntradaVerdeOpen(false)}
        onEntradaGerada={(entradaId, numeroEntrada, nfeId) => {
          setIsGerarEntradaVerdeOpen(false);
          updateNFeStatus(nfeId, 'PROCESSADA');
          refetch();
        }}
      />

      {/* Modal Seleção de Pagamentos Antecipados (para NFes não associadas) */}
      {nfeParaAntecipados && (
        <SelecionarPagamentosAntecipados
          isOpen={showSelecionarAntecipados}
          onClose={() => {
            setShowSelecionarAntecipados(false);
            setNfeParaAntecipados(null);
          }}
          nfe={nfeParaAntecipados}
          onProsseguir={handleProsseguirComAntecipados}
          onSemPagamentos={handleSemPagamentosAntecipados}
        />
      )}

      {/* Modal Gerar Cobrança (configuração de pagamento standalone) */}
      {nfeParaCobranca && (
        <ConfiguracaoPagamentoNFeModal
          isOpen={showGerarCobranca}
          onClose={() => {
            setShowGerarCobranca(false);
            setNfeParaCobranca(null);
            setOrdensAntecipadasSelecionadas([]);
            setValorAntecipadoSelecionado(0);
          }}
          nfeId={nfeParaCobranca.id}
          onSuccess={handleSuccessCobranca}
          userId={user?.codusr || ''}
          userName={user?.usuario || ''}
          ordensAntecipadas={ordensAntecipadasSelecionadas}
          valorAntecipado={valorAntecipadoSelecionado}
        />
      )}

      {/* Modal Gerar Entrada Direta (via dropdown da NFe com associação concluída) */}
      {showGerarEntradaDireta && nfeParaEntradaDireta && (
        <GerarEntradaModal
          isOpen={showGerarEntradaDireta}
          onClose={() => {
            setShowGerarEntradaDireta(false);
            setNfeParaEntradaDireta(null);
            setAssociacoesCarregadas([]);
          }}
          nfeId={nfeParaEntradaDireta.id}
          associatedItems={associacoesCarregadas}
          onConfirm={handleEntradaGeradaDireta}
          loading={carregandoAssociacoes}
        />
      )}

      {/* Modais de confirmação e mensagens */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={itemToDelete ? `Deseja realmente excluir a NFe ${itemToDelete.numeroNF}/${itemToDelete.serie}?` : ''}
        type="danger"
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
      />

      <ConfirmationModal
        isOpen={showResetConfirmation}
        onClose={() => !isResetting && setShowResetConfirmation(false)}
        onConfirm={handleConfirmReset}
        title="Resetar NFe (TESTE)"
        message={itemToReset ? `ATENÇÃO: Esta ação irá REMOVER todos os dados da NFe ${itemToReset.numeroNF}/${itemToReset.serie}:\n\n• Associações de itens\n• Entrada de estoque\n• Romaneio e Alocação\n• Pagamentos\n• Histórico\n• Quantidade atendida nas OCs\n• Estoque geral e por armazém\n\nEsta ação NÃO pode ser desfeita. Deseja continuar?` : ''}
        type="danger"
        confirmText="Sim, Resetar"
        cancelText="Cancelar"
        loading={isResetting}
      />

      <MessageModal
        isOpen={showMessage}
        onClose={() => setShowMessage(false)}
        title={messageData.title}
        message={messageData.message}
        type={messageData.type}
      />

      {/* Modal de Filtros Avançados */}
      <NFeFiltrosAvancados
        isOpen={showFiltrosAvancados}
        onClose={() => setShowFiltrosAvancados(false)}
        onApplyFilters={handleApplyAdvancedFilters}
        initialFilters={advancedFilters}
      />

      {/* Modal de Histórico */}
      {nfeParaHistorico && (
        <HistoricoNFeModal
          isOpen={showHistorico}
          onClose={() => {
            setShowHistorico(false);
            setNfeParaHistorico(null);
          }}
          nfeId={nfeParaHistorico.id}
          nfeNumero={nfeParaHistorico.numeroNF}
        />
      )}
    </div>
  );
};