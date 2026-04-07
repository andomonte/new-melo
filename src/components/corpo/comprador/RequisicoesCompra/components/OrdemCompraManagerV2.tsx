import React, { useState, useEffect, useRef, useContext } from 'react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useOrdens } from '../hooks/useOrdens';
import { useOrdensTableImproved } from '../hooks/useOrdensTableImproved';
import { colunasDbOrdem } from '../colunasDbOrdem';
import DataTableFiltroV3 from '@/components/common/DataTableFiltroV3';
import { PlusIcon, CircleChevronDown, Package, Send, CheckCircle, XCircle, Eye, Edit3, Trash2, Ban, FileDown, DollarSign, Calendar, Truck, Replace, Archive, Download, CheckSquare, X, FileSpreadsheet, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';
import api from '@/components/services/api';
import { AuthContext } from '@/contexts/authContexts';
import AlterarPrevisaoChegadaModal from './AlterarPrevisaoChegadaModal';
import { AdicionarProdutosModal } from './AdicionarProdutosModal';
import { PagamentoAntecipadoModal } from './PagamentoAntecipadoModal';
import { VerificarPagamentoModal } from './VerificarPagamentoModal';
import { HistoricoOrdemModal } from '../../OrdensCompra/components/HistoricoOrdemModal';
import { FecharItemModal } from './FecharItemModal';
import { BaixarPendenciaModal } from './BaixarPendenciaModal';
import { useToast } from '@/hooks/use-toast';

interface OrdemCompraDTO {
  orc_id: number;
  orc_req_id: number;
  orc_req_versao: number;
  orc_data: string;
  orc_status: string;
  req_id_composto?: string;
  req_status?: string;
  fornecedor_nome?: string;
  fornecedor_codigo?: string;
  comprador_nome?: string;
  orc_valor_total?: number;
  orc_observacao?: string;
  orc_previsao_chegada?: string;
  local_entrega?: string;
  local_destino?: string;
  prazo_entrega?: number;
  orc_fornecedor_cod?: string;
  orc_data_finalizacao?: string;
  orc_usuario_responsavel?: string;
  orc_pagamento_configurado?: boolean; // Indica se pagamento já foi configurado
}

interface OrdensComprasListImprovedProps {
  className?: string;
}

export default function OrdensComprasListImproved({
  className = '',
}: OrdensComprasListImprovedProps) {
  // Context para verificar perfil do usuário
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  
  // Verifica permissões baseado nas FUNÇÕES do banco (sem hardcode de perfis)
  const getFuncaoSigla = (f: any): string => typeof f === 'string' ? f : f?.sigla || '';
  const canApproveOrdens = user?.funcoes?.some((f: any) => getFuncaoSigla(f) === 'APROVAR_ORDENS_COMPRA');
  
  // Dropdown states for actions menu
  const [dropdownStates, setDropdownStates] = useState<{[key: number]: boolean}>({});
  const dropdownRefs = useRef<{[key: number]: HTMLDivElement | null}>({});
  const actionButtonRefs = useRef<{[key: number]: HTMLButtonElement | null}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: number]: {top: number; left: number} | null}>({});
  const [iconRotations, setIconRotations] = useState<{[key: number]: boolean}>({});

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: 'default' | 'destructive';
  }>({
    isOpen: false,
    title: '',
    message: '',
    details: [],
    onConfirm: () => {},
    confirmText: 'Confirmar',
    confirmVariant: 'default'
  });

  const [alterarPrevisaoModal, setAlterarPrevisaoModal] = useState<{
    isOpen: boolean;
    ordemId: number;
    previsaoAtual?: string;
  }>({
    isOpen: false,
    ordemId: 0,
    previsaoAtual: undefined
  });

  const [verItensModal, setVerItensModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
  }>({
    isOpen: false,
    ordem: null
  });

  const [substituirItemModal, setSubstituirItemModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
    itensOriginais: any[];
    itensSelecionados: Set<number>;
    itensSubstituidos: Set<number>; // itens que já foram substituídos
    itemAtualSubstituicao: number; // índice do item atual sendo substituído
    showProdutosModal: boolean;
  }>({
    isOpen: false,
    ordem: null,
    itensOriginais: [],
    itensSelecionados: new Set(),
    itensSubstituidos: new Set(),
    itemAtualSubstituicao: -1,
    showProdutosModal: false
  });

  const [pagamentoModal, setPagamentoModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
  }>({
    isOpen: false,
    ordem: null
  });

  // Estado para verificar parcelas de pagamento
  const [verificarPagamentoModal, setVerificarPagamentoModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
  }>({
    isOpen: false,
    ordem: null
  });

  // Estado para modal de histórico
  const [historicoModal, setHistoricoModal] = useState<{
    isOpen: boolean;
    ordemId: number;
    ordemNumero?: string;
  }>({
    isOpen: false,
    ordemId: 0,
    ordemNumero: undefined
  });

  // Estado para modal de fechar item
  const [fecharItemModal, setFecharItemModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
  }>({
    isOpen: false,
    ordem: null
  });

  // Estado para modal de baixar pendência
  const [baixarPendenciaModal, setBaixarPendenciaModal] = useState<{
    isOpen: boolean;
    ordem: OrdemCompraDTO | null;
  }>({
    isOpen: false,
    ordem: null
  });

  const {
    inputSearch,
    search,
    page,
    perPage,
    headers,
    limiteColunas,
    filtros,
    setPage,
    setPerPage,
    handleLimiteColunasChange,
    handleColumnChange,
    handleSearch,
    handleSearchBlur,
    handleSearchKeyDown,
    handleFiltroChange,
  } = useOrdensTableImproved(colunasDbOrdem);

  const { data, meta, loading, error, refetch } = useOrdens({
    page,
    perPage,
    search,
    filtros,
  });

  const toggleDropdown = (ordemId: number, buttonElement: HTMLButtonElement) => {

    setDropdownStates(prevStates => ({
      ...prevStates,
      [ordemId]: !prevStates[ordemId]
    }));

    setIconRotations(prevRotations => ({
      ...prevRotations,
      [ordemId]: !prevRotations[ordemId]
    }));

    if (!dropdownStates[ordemId]) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 180; // largura aproximada do dropdown

      // Calcular left: se não houver espaço à esquerda, abre à direita
      let leftPosition = rect.left - (dropdownWidth - rect.width) + window.scrollX;

      // Se o dropdown sairia da tela pela esquerda, posiciona à direita do botão
      if (leftPosition < 10) {
        leftPosition = rect.left + window.scrollX;
      }

      // Se sairia pela direita, ajusta para caber
      if (leftPosition + dropdownWidth > window.innerWidth - 10) {
        leftPosition = window.innerWidth - dropdownWidth - 10;
      }

      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [ordemId]: {
          top: rect.bottom + 4 + window.scrollY, // Abre abaixo do botão
          left: leftPosition
        }
      }));
    } else {
      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [ordemId]: null
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleAlterarPrevisao = (ordem: OrdemCompraDTO) => {
    closeAllDropdowns();
    setAlterarPrevisaoModal({
      isOpen: true,
      ordemId: ordem.orc_id,
      previsaoAtual: ordem.orc_previsao_chegada
    });
  };

  const handleClosePrevisaoModal = () => {
    setAlterarPrevisaoModal({
      isOpen: false,
      ordemId: 0,
      previsaoAtual: undefined
    });
  };

  const handlePrevisaoSuccess = () => {
    refetch(); // Recarregar dados da tabela
  };

  const handleVerItens = (ordem: OrdemCompraDTO) => {
    closeAllDropdowns();
    setVerItensModal({
      isOpen: true,
      ordem: ordem
    });
  };

  const handleSubstituirItem = async (ordem: OrdemCompraDTO) => {
    closeAllDropdowns();
    
    // Carregar itens da ordem
    try {
      const response = await api.get(`/api/requisicoesCompra/items?req_id=${ordem.orc_req_id}&req_versao=${ordem.orc_req_versao}`);
      const itens = response.data?.data || [];
      
      setSubstituirItemModal({
        isOpen: true,
        ordem: ordem,
        itensOriginais: itens,
        itensSelecionados: new Set(),
        itensSubstituidos: new Set(),
        itemAtualSubstituicao: -1,
        showProdutosModal: false
      });
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      setSubstituirItemModal({
        isOpen: true,
        ordem: ordem,
        itensOriginais: [],
        itensSelecionados: new Set(),
        itensSubstituidos: new Set(),
        itemAtualSubstituicao: -1,
        showProdutosModal: false
      });
    }
  };

  const handleCloseVerItensModal = () => {
    setVerItensModal({
      isOpen: false,
      ordem: null
    });
  };

  // Função para cancelar ordem de compra
  const handleCancelarOrdem = (ordem: OrdemCompraDTO) => {
    closeAllDropdowns();

    // Verificar se pode cancelar (status A = Aberta)
    if (ordem.orc_status !== 'A') {
      toast({
        title: "Não permitido",
        description: "Apenas ordens abertas podem ser canceladas",
        variant: "destructive"
      });
      return;
    }

    // Abrir modal de confirmação
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Ordem de Compra',
      message: `Tem certeza que deseja cancelar a ordem #${ordem.orc_id}?`,
      details: [
        `Fornecedor: ${ordem.fornecedor_nome || 'Não informado'}`,
        `Valor: R$ ${(ordem.orc_valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ],
      confirmText: 'Cancelar Ordem',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        try {
          const response = await api.put(`/api/ordens/${ordem.orc_id}/cancel`, {
            userId: user?.codusr,
            userName: user?.usuario,
            motivo: 'Ordem cancelada pelo usuário'
          });

          if (response.data.success) {
            toast({
              title: "Sucesso",
              description: "Ordem cancelada com sucesso!"
            });
            refetch(); // Recarregar lista
          } else {
            toast({
              title: "Erro",
              description: response.data.message || "Erro ao cancelar ordem",
              variant: "destructive"
            });
          }
        } catch (error: any) {
          console.error('Erro ao cancelar ordem:', error);
          const errorMessage = error.response?.data?.message || "Erro ao cancelar ordem";
          toast({
            title: "Erro",
            description: errorMessage,
            variant: "destructive"
          });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExportExcel = async (ordem: OrdemCompraDTO) => {
    closeAllDropdowns();
    try {
      const response = await fetch('/api/compras/ordens/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colunas: [],
          filtros: { orc_id: ordem.orc_id },
          busca: '',
          incluirItens: true
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao exportar Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordem-compra-${ordem.orc_id}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "Excel exportado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar arquivo Excel",
        variant: "destructive"
      });
    }
  };

  const handleCloseSubstituirItemModal = () => {
    setSubstituirItemModal({
      isOpen: false,
      ordem: null,
      itensOriginais: [],
      itensSelecionados: new Set(),
      itensSubstituidos: new Set(),
      itemAtualSubstituicao: -1,
      showProdutosModal: false
    });
  };

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const ordemId in dropdownStates) {
        if (dropdownStates[ordemId]) {
          const dropdownNode = dropdownRefs.current[parseInt(ordemId, 10)];
          const actionButtonNode = actionButtonRefs.current[parseInt(ordemId, 10)];
          if (
            dropdownNode &&
            !dropdownNode.contains(event.target as Node) &&
            actionButtonNode &&
            !actionButtonNode.contains(event.target as Node)
          ) {
            shouldClose = true;
            break;
          }
        }
      }
      if (shouldClose) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mouseup', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [dropdownStates]);

  // Format table data for orders
  const formattedData = data.map((item) => {
    const row: Record<string, any> = {};

    headers.forEach((col) => {
      if (col === 'selecionar' || col === 'AÇÕES') return;

      let v = item[col as keyof OrdemCompraDTO];

      // Mapear campos específicos das ordens
      if (col === 'ordem') {
        // Usar mesmo padrão das requisições - sem padStart, apenas o ID original  
        v = item.orc_id ? String(item.orc_id) : '';
      } else if (col === 'requisicao') {
        // Usar orc_req_id que é o ID completo da requisição, igual ao padrão das requisições
        v = item.orc_req_id ? String(item.orc_req_id) : '';
      } else if (col === 'dataOrdem') {
        v = item.orc_data;
      } else if (col === 'statusOrdem') {
        v = item.orc_status || '-';
      } else if (col === 'statusRequisicao') {
        v = item.req_status || '-';
      } else if (col === 'fornecedorNome') {
        v = item.fornecedor_nome || '';
      } else if (col === 'fornecedor_completo') {
        v = item.fornecedor_completo || '';
      } else if (col === 'compradorNome') {
        v = item.comprador_nome || '';
      } else if (col === 'comprador_completo') {
        v = item.comprador_completo || '';
      } else if (col === 'valorTotal') {
        v = item.orc_valor_total ? `R$ ${Number(item.orc_valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
      } else if (col === 'observacao') {
        v = item.orc_observacao || '-';
      } else if (col === 'previsaoChegada') {
        v = item.orc_previsao_chegada || '-';
      } else if (col === 'localEntrega') {
        v = item.local_entrega || '-';
      } else if (col === 'localDestino') {
        v = item.local_destino || '-';
      } else if (col === 'prazoEntrega') {
        v = item.prazo_entrega ? `${item.prazo_entrega} dias` : '-';
      } else if (col === 'fornecedorCod') {
        v = item.orc_fornecedor_cod || item.fornecedor_codigo || '-';
      } else if (col === 'dataFinalizacao') {
        v = item.orc_data_finalizacao || '-';
      } else if (col === 'usuarioResponsavel') {
        v = item.orc_usuario_responsavel || '-';
      } else if (col === 'orc_pagamento_configurado') {
        // Formatar coluna Pagamento Configurado com badge
        const pagamentoConfigurado = item.orc_pagamento_configurado || false;
        v = (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              pagamentoConfigurado
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {pagamentoConfigurado ? 'SIM' : 'NÃO'}
          </span>
        );
      }

      // Format dates
      if (
        typeof v === 'string' &&
        (col.toLowerCase().includes('data') ||
          col.toLowerCase().includes('date') ||
          col === 'previsaoChegada')
      ) {
        try {
          const date = new Date(v);
          if (!isNaN(date.getTime())) {
            v = date.toLocaleDateString('pt-BR');
          }
        } catch {
          // Ignore date parsing errors
        }
      }

      // Format status with colored badges
      if (col.toLowerCase().includes('status')) {
        // Determinar se é status de ordem ou requisição
        const isOrdemStatus = col.toLowerCase().includes('ordem');

        const statusOrdemMap: Record<string, { label: string; color: string }> = {
          'A': { label: 'Aberta', color: 'text-green-600 bg-green-50' },
          'B': { label: 'Bloqueada', color: 'text-red-600 bg-red-50' },
          'F': { label: 'Fechada', color: 'text-blue-600 bg-blue-50' },
          'C': { label: 'Cancelada', color: 'text-gray-600 bg-gray-50' },
        };

        const statusRequisicaoMap: Record<string, { label: string; color: string }> = {
          'P': { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50' },
          'A': { label: 'Aprovada', color: 'text-green-600 bg-green-50' },
          'R': { label: 'Reprovada', color: 'text-red-600 bg-red-50' },
          'C': { label: 'Cancelada', color: 'text-gray-600 bg-gray-50' },
          'S': { label: 'Submetida', color: 'text-blue-600 bg-blue-50' },
          'E': { label: 'Em Análise', color: 'text-purple-600 bg-purple-50' },
          'F': { label: 'Finalizada', color: 'text-blue-600 bg-blue-50' },
        };

        const statusMap = isOrdemStatus ? statusOrdemMap : statusRequisicaoMap;
        const statusKey = String(v).toUpperCase();
        const statusInfo = statusMap[statusKey];

        if (statusInfo) {
          v = (
            <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          );
        }
      }

      // Truncate long text fields
      if (typeof v === 'string' && (col === 'observacao' || col === 'fornecedorNome')) {
        if (v.length > 30) {
          v = v.substring(0, 30) + '...';
        }
      }
      
      row[col] = v ?? '';
    });

    return row;
  });
  
  // Add selection checkbox and actions menu columns
  const rows = formattedData.map((row, index) => {
    const item = data[index];
    
    const baseRow = {
      ...row,
      AÇÕES: (
        <div className="flex justify-center">
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[item.orc_id] = el;
              }
            }}
            onClick={(e) => toggleDropdown(item.orc_id, e.currentTarget)}
            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            title="Ações"
            style={{
              transform: iconRotations[item.orc_id] ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <CircleChevronDown size={20} />
          </button>
          {dropdownStates[item.orc_id] && dropdownPositions[item.orc_id] && createPortal(
            <div
              key={`portal-dropdown-${item.orc_id}`}
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[item.orc_id] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[item.orc_id]?.top,
                left: dropdownPositions[item.orc_id]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000
              }}
            >
              <div className="py-1" role="menu" aria-orientation="vertical">
                {/* Ver Itens */}
                <button
                  onClick={() => handleVerItens(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Package className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Ver Itens
                </button>

                {/* Exportar PDF */}
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    const url = `/api/ordens/${item.orc_id}/pdf`;
                    window.open(url, '_blank');
                  }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <FileDown className="mr-2 text-red-500 dark:text-red-400" size={16} />
                  Exportar PDF
                </button>

                {/* Exportar Excel */}
                <button
                  onClick={() => handleExportExcel(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <FileSpreadsheet className="mr-2 text-emerald-500 dark:text-emerald-400" size={16} />
                  Exportar Excel
                </button>

                {/* Pagamento Antecipado */}
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setPagamentoModal({
                      isOpen: true,
                      ordem: item
                    });
                  }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <DollarSign className="mr-2 text-orange-500 dark:text-orange-400" size={16} />
                  Pagamento Antecipado
                </button>

                {/* Verificar Pagamento (Grid de Parcelas) */}
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setVerificarPagamentoModal({
                      isOpen: true,
                      ordem: {
                        ...item,
                        orc_id: item.orc_id,
                        orc_valor_total: item.orc_valor_total,
                        fornecedor_nome: item.fornecedor_nome || 'Fornecedor não informado',
                        comprador_nome: item.comprador_nome || 'Comprador não informado',
                        orc_data: item.orc_data
                      }
                    });
                  }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <DollarSign className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Verificar Pagamento
                </button>

                {/* Ver Histórico */}
                <button
                  onClick={() => {
                    closeAllDropdowns();
                    setHistoricoModal({
                      isOpen: true,
                      ordemId: item.orc_id,
                      ordemNumero: `Ordem #${item.orc_id}`
                    });
                  }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Clock className="mr-2 text-indigo-500 dark:text-indigo-400" size={16} />
                  Ver Histórico
                </button>

                {/* Alterar previsão de chegada */}
                <button
                  onClick={() => handleAlterarPrevisao(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full whitespace-nowrap"
                  role="menuitem"
                >
                  <Calendar className="mr-2 text-orange-500 dark:text-orange-400 flex-shrink-0" size={16} />
                  Alterar Previsão
                </button>
                
                {/* Substituir Item */}
                <button
                  onClick={() => handleSubstituirItem(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Replace className="mr-2 text-purple-500 dark:text-purple-400" size={16} />
                  Substituir Item
                </button>
                
                {/* Fechar Item - apenas se ordem estiver aberta */}
                {item.orc_status === 'A' && (
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      setFecharItemModal({
                        isOpen: true,
                        ordem: item
                      });
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Archive className="mr-2 text-green-600 dark:text-green-400" size={16} />
                    Fechar Item
                  </button>
                )}

                {/* Baixar Pendência - apenas se ordem estiver aberta */}
                {item.orc_status === 'A' && (
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      setBaixarPendenciaModal({
                        isOpen: true,
                        ordem: item
                      });
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <CheckSquare className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Baixar Pendência
                  </button>
                )}

                {/* Cancelar Ordem - só mostra se status for A (Aberta) */}
                {item.orc_status === 'A' && (
                  <button
                    onClick={() => handleCancelarOrdem(item)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 w-full"
                    role="menuitem"
                  >
                    <Ban className="mr-2" size={16} />
                    Cancelar Ordem
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      )
    };

    // Não adicionar checkbox de seleção para ordens de compra
    return baseRow;
  });


  return (
    <>
      <DataTableFiltroV3
        carregando={loading}
        headers={headers}
        rows={rows}
        meta={meta}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        onColunaSubstituida={handleColumnChange}
        onSearch={handleSearch}
        onSearchBlur={handleSearchBlur}
        onSearchKeyDown={handleSearchKeyDown}
        searchInputPlaceholder="Pesquisar por ordem, requisição, fornecedor..."
        colunasFiltro={colunasDbOrdem.map((c) => c.campo)}
        limiteColunas={limiteColunas}
        onLimiteColunasChange={handleLimiteColunasChange}
        colunasFixas={['AÇÕES']}
        exportEndpoint="/api/ordens/exportar"
        exportFileName="ordens-compra.xlsx"
        onFiltroChange={handleFiltroChange}
        showAdvancedFilters={true}
        columnLabels={colunasDbOrdem.reduce((acc, col) => {
          acc[col.campo] = col.label;
          return acc;
        }, {} as Record<string, string>)}
      />

      {/* Modal para alterar previsão de chegada */}
      <AlterarPrevisaoChegadaModal
        isOpen={alterarPrevisaoModal.isOpen}
        onClose={handleClosePrevisaoModal}
        ordemId={alterarPrevisaoModal.ordemId}
        previsaoAtual={alterarPrevisaoModal.previsaoAtual}
        onSuccess={handlePrevisaoSuccess}
      />

      {/* Modal para ver itens da ordem */}
      {verItensModal.isOpen && verItensModal.ordem && (
        <VerItensModal
          key={`${verItensModal.ordem.orc_id}-${Date.now()}`}
          ordem={verItensModal.ordem}
          onClose={handleCloseVerItensModal}
          onRefresh={refetch}
        />
      )}

      {/* Modal para substituir item da ordem */}
      {substituirItemModal.isOpen && substituirItemModal.ordem && (
        <SubstituirItemModalV3
          ordem={substituirItemModal.ordem}
          itensOriginais={substituirItemModal.itensOriginais}
          itensSelecionados={substituirItemModal.itensSelecionados}
          itensSubstituidos={substituirItemModal.itensSubstituidos}
          itemAtualSubstituicao={substituirItemModal.itemAtualSubstituicao}
          showProdutosModal={substituirItemModal.showProdutosModal}
          onClose={handleCloseSubstituirItemModal}
          onToggleItemSelecionado={(index) => {
            setSubstituirItemModal(prev => {
              const newSet = new Set(prev.itensSelecionados);
              if (newSet.has(index)) {
                newSet.delete(index);
              } else {
                newSet.add(index);
              }
              return { ...prev, itensSelecionados: newSet };
            });
          }}
          onIniciarSubstituicoes={() => {
            const indices = Array.from(substituirItemModal.itensSelecionados).sort((a, b) => a - b);
            if (indices.length > 0) {
              setSubstituirItemModal(prev => ({
                ...prev,
                itemAtualSubstituicao: 0, // Começar do primeiro índice
                showProdutosModal: true
              }));
            }
          }}
          onFinalizar={() => {
            toast({
              title: 'Sucesso!',
              description: 'Substituições finalizadas!'
            });
            // Fechar modal de ver itens se estiver aberto
            setVerItensModal({ isOpen: false, ordem: null });
            // Recarregar dados
            refetch();
            handleCloseSubstituirItemModal();
          }}
          onConfirmarSubstituicao={async (produtoSubstituto) => {
            const indices = Array.from(substituirItemModal.itensSelecionados).sort((a, b) => a - b);
            const itemOriginal = substituirItemModal.itensOriginais[indices[substituirItemModal.itemAtualSubstituicao]];
            const proximoIndice = substituirItemModal.itemAtualSubstituicao + 1;
            
            try {
              // Chamar API para substituir o item
              await api.put(`/api/requisicoesCompra/items/substituir`, {
                req_id: substituirItemModal.ordem?.orc_req_id,
                req_versao: substituirItemModal.ordem?.orc_req_versao,
                codprod_original: itemOriginal.codprod, // Usar codprod ao invés do fake id
                novo_produto: {
                  codprod: produtoSubstituto.codprod,
                  quantidade: itemOriginal.quantidade, // Manter a mesma quantidade
                  preco_unitario: produtoSubstituto.preco_unitario,
                  preco_total: itemOriginal.quantidade * produtoSubstituto.preco_unitario
                },
                userId: user?.codusr,
                userName: user?.usuario,
              });
              
              toast({
                title: 'Item substituído!',
                description: `${itemOriginal.produto?.descr || itemOriginal.produto_descr || 'N/A'} → ${produtoSubstituto.descr}`
              });
              
              // Recarregar itens atualizados da API
              const response = await api.get(`/api/requisicoesCompra/items?req_id=${substituirItemModal.ordem?.orc_req_id}&req_versao=${substituirItemModal.ordem?.orc_req_versao}`);
              const itensAtualizados = response.data?.data || [];
              
              // Marcar item como substituído
              const indiceItemAtual = indices[substituirItemModal.itemAtualSubstituicao];
              setSubstituirItemModal(prev => {
                const newSubstituidos = new Set(prev.itensSubstituidos);
                newSubstituidos.add(indiceItemAtual);
                
                return {
                  ...prev,
                  itensOriginais: itensAtualizados, // Atualizar lista com dados novos
                  itensSubstituidos: newSubstituidos,
                  itemAtualSubstituicao: -1,
                  showProdutosModal: false
                };
              });
            } catch (error) {
              console.error('Erro ao substituir item:', error);
              toast({
                title: 'Erro',
                description: 'Erro ao substituir item. Tente novamente.',
                variant: 'destructive'
              });
              // Voltar ao modal de seleção em caso de erro
              setSubstituirItemModal(prev => ({
                ...prev,
                itemAtualSubstituicao: -1,
                showProdutosModal: false
              }));
            }
          }}
          onCancelarSubstituicao={() => {
            setSubstituirItemModal(prev => ({
              ...prev,
              itemAtualSubstituicao: -1,
              showProdutosModal: false
            }));
          }}
        />
      )}

      {/* Modal de Confirmação */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {confirmModal.title}
              </h3>
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                {confirmModal.message}
              </p>

              {confirmModal.details && confirmModal.details.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Isso irá:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {confirmModal.details.map((detail, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-md transition-colors ${
                  confirmModal.confirmVariant === 'destructive'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento Antecipado */}
      {pagamentoModal.isOpen && pagamentoModal.ordem && (
        <PagamentoAntecipadoModal
          isOpen={pagamentoModal.isOpen}
          onClose={() => setPagamentoModal({ isOpen: false, ordem: null })}
          ordem={pagamentoModal.ordem}
          onSuccess={() => {
            setPagamentoModal({ isOpen: false, ordem: null });
            refetch();
            toast({
              title: 'Sucesso!',
              description: 'Status de pagamento atualizado com sucesso'
            });
          }}
          userId={user?.codusr}
          userName={user?.usuario}
        />
      )}

      {/* Modal de Verificação de Pagamento (Grid de Parcelas) */}
      {verificarPagamentoModal.isOpen && verificarPagamentoModal.ordem && (
        <VerificarPagamentoModal
          isOpen={verificarPagamentoModal.isOpen}
          onClose={() => setVerificarPagamentoModal({ isOpen: false, ordem: null })}
          ordem={verificarPagamentoModal.ordem}
          onSuccess={() => {
            setVerificarPagamentoModal({ isOpen: false, ordem: null });
            refetch();
            toast({
              title: 'Sucesso!',
              description: 'Dados atualizados com sucesso'
            });
          }}
        />
      )}

      {/* Modal de Histórico da Ordem */}
      <HistoricoOrdemModal
        isOpen={historicoModal.isOpen}
        onClose={() => setHistoricoModal({ isOpen: false, ordemId: 0, ordemNumero: undefined })}
        ordemId={historicoModal.ordemId}
        ordemNumero={historicoModal.ordemNumero}
      />

      {/* Modal de Fechar Item */}
      {fecharItemModal.isOpen && fecharItemModal.ordem && (
        <FecharItemModal
          isOpen={fecharItemModal.isOpen}
          onClose={() => setFecharItemModal({ isOpen: false, ordem: null })}
          ordemId={fecharItemModal.ordem.orc_id}
          reqId={fecharItemModal.ordem.orc_req_id}
          reqVersao={fecharItemModal.ordem.orc_req_versao}
          onSuccess={() => {
            setFecharItemModal({ isOpen: false, ordem: null });
            refetch();
          }}
          userId={user?.codusr}
          userName={user?.usuario}
        />
      )}

      {/* Modal de Baixar Pendência */}
      {baixarPendenciaModal.isOpen && baixarPendenciaModal.ordem && (
        <BaixarPendenciaModal
          isOpen={baixarPendenciaModal.isOpen}
          onClose={() => setBaixarPendenciaModal({ isOpen: false, ordem: null })}
          ordemId={baixarPendenciaModal.ordem.orc_id}
          reqId={baixarPendenciaModal.ordem.orc_req_id}
          reqVersao={baixarPendenciaModal.ordem.orc_req_versao}
          onSuccess={() => {
            setBaixarPendenciaModal({ isOpen: false, ordem: null });
            refetch();
          }}
          userId={user?.codusr}
          userName={user?.usuario}
        />
      )}
    </>
  );
}

// Modal simples para ver itens da ordem
function VerItensModal({ ordem, onClose, onRefresh }: { ordem: OrdemCompraDTO; onClose: () => void; onRefresh?: () => void }) {
  const { user } = useContext(AuthContext);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estado para baixar pendência inline
  const [baixarItem, setBaixarItem] = useState<any | null>(null);
  const [baixarQuantidade, setBaixarQuantidade] = useState(1);
  const [baixarSubmitting, setBaixarSubmitting] = useState(false);

  const fetchItens = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/requisicoesCompra/items?req_id=${ordem.orc_req_id}&req_versao=${ordem.orc_req_versao}`);
      if (response.data?.data) {
        setItens(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItens();
  }, [ordem, refreshKey]);

  // Calcular pendência de um item
  const calcularPendencia = (item: any) => {
    const quantidade = Number(item.quantidade) || 0;
    const atendida = Number(item.quantidade_atendida) || 0;
    return quantidade - atendida;
  };

  // Formatar quantidade (remove decimais desnecessários)
  const formatarQtd = (valor: number | string) => {
    const num = Number(valor) || 0;
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  };

  // Iniciar baixa de pendência para um item
  const iniciarBaixa = (item: any) => {
    const pendencia = calcularPendencia(item);
    setBaixarItem(item);
    setBaixarQuantidade(Math.min(1, pendencia - 1)); // Começa com 1, max = pendencia - 1
  };

  // Confirmar baixa de pendência
  const confirmarBaixa = async () => {
    if (!baixarItem) return;

    setBaixarSubmitting(true);
    try {
      const response = await api.post(`/api/ordens/${ordem.orc_id}/baixar-pendencia`, {
        codprod: baixarItem.codprod,
        quantidade: baixarQuantidade,
        userId: user?.codusr,
        userName: user?.usuario
      });

      if (response.data.success) {
        setBaixarItem(null);
        setBaixarQuantidade(1);
        setRefreshKey(prev => prev + 1); // Recarregar itens
        onRefresh?.(); // Notificar parent para atualizar lista de ordens
      } else {
        alert(response.data.message || 'Erro ao baixar pendência');
      }
    } catch (error: any) {
      console.error('Erro ao baixar pendência:', error);
      alert(error.response?.data?.message || 'Erro ao baixar pendência');
    } finally {
      setBaixarSubmitting(false);
    }
  };

  // Verificar se ordem permite baixar pendência (status A = Aberta)
  const podeAlterar = ordem.orc_status === 'A';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-5xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Package className="text-blue-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Itens da Ordem #{ordem.orc_id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <XCircle size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {itens.length === 0 ? (
              <p className="text-gray-500 text-center">Nenhum item encontrado para esta ordem.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-300">Código</th>
                      <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                      <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Qtd</th>
                      <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Atendida</th>
                      <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Pendência</th>
                      <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Preço Unit.</th>
                      <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                      {podeAlterar && <th className="text-center p-2 font-semibold text-gray-700 dark:text-gray-300">Ação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, index) => {
                      const pendencia = calcularPendencia(item);
                      const atendida = Number(item.quantidade_atendida) || 0;
                      const isBaixando = baixarItem?.codprod === item.codprod;
                      const maxBaixar = pendencia - 1; // Máximo = pendência - 1 (se for total, usar Fechar Item)

                      return (
                        <tr key={index} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="p-2 text-gray-900 dark:text-gray-100 font-mono text-sm">{item.codprod}</td>
                          <td className="p-2 text-gray-900 dark:text-gray-100">
                            <div>{item.produto?.descr || item.produto_descr || item.descricao || 'Produto não encontrado'}</div>
                            {item.produto?.ref && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Ref: {item.produto.ref}</div>
                            )}
                          </td>
                          <td className="p-2 text-right text-gray-900 dark:text-gray-100">{formatarQtd(item.quantidade)}</td>
                          <td className="p-2 text-right text-green-600 dark:text-green-400 font-medium">{formatarQtd(atendida)}</td>
                          <td className={`p-2 text-right font-bold ${pendencia > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatarQtd(pendencia)}
                          </td>
                          <td className="p-2 text-right text-gray-900 dark:text-gray-100">R$ {Number(item.precoUnitario || item.preco_unitario || 0).toFixed(2)}</td>
                          <td className="p-2 text-right text-gray-900 dark:text-gray-100">R$ {Number(item.precoTotal || item.preco_total || 0).toFixed(2)}</td>
                          {podeAlterar && (
                            <td className="p-2 text-center">
                              {isBaixando ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setBaixarQuantidade(Math.max(1, baixarQuantidade - 1))}
                                    disabled={baixarQuantidade <= 1 || baixarSubmitting}
                                    className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-sm disabled:opacity-50"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={baixarQuantidade}
                                    onChange={(e) => {
                                      const val = Math.max(1, Math.min(maxBaixar, Number(e.target.value) || 1));
                                      setBaixarQuantidade(val);
                                    }}
                                    className="w-12 text-center border rounded px-1 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                                    min={1}
                                    max={maxBaixar}
                                  />
                                  <button
                                    onClick={() => setBaixarQuantidade(Math.min(maxBaixar, baixarQuantidade + 1))}
                                    disabled={baixarQuantidade >= maxBaixar || baixarSubmitting}
                                    className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-sm disabled:opacity-50"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={confirmarBaixa}
                                    disabled={baixarSubmitting}
                                    className="ml-1 px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50"
                                  >
                                    {baixarSubmitting ? '...' : 'OK'}
                                  </button>
                                  <button
                                    onClick={() => setBaixarItem(null)}
                                    disabled={baixarSubmitting}
                                    className="px-2 py-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded text-xs disabled:opacity-50"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : pendencia > 1 ? (
                                <button
                                  onClick={() => iniciarBaixa(item)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs transition-colors"
                                  title="Baixar parte da pendência"
                                >
                                  Baixar
                                </button>
                              ) : pendencia === 1 ? (
                                <span className="text-xs text-gray-400" title="Use 'Fechar Item' para baixar 100% da pendência">
                                  -
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 dark:text-green-400">Fechado</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {podeAlterar && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Baixar:</strong> Reduz parte da pendência (não pode baixar 100%).
                  Para fechar toda a pendência de um item, use o botão "Fechar Item" no menu de ações da ordem.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Novo modal de substituir item (V2) - funciona como "Alterar Itens"
function SubstituirItemModalV2({
  ordem,
  step,
  itemSelecionado,
  itensOriginais,
  onClose,
  onSelecionarItem,
  onVoltar,
  onSuccess
}: {
  ordem: OrdemCompraDTO;
  step: 'select' | 'replace';
  itemSelecionado: any | null;
  itensOriginais: any[];
  onClose: () => void;
  onSelecionarItem: (item: any) => void;
  onVoltar: () => void;
  onSuccess: () => void;
}) {
  const [showProdutosModal, setShowProdutosModal] = useState(false);
  const [produtoSubstituto, setProdutoSubstituto] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmarSubstituicao = async () => {
    if (!itemSelecionado || produtoSubstituto.length !== 1) {
      alert('Selecione exatamente 1 produto para substituir o item.');
      return;
    }

    setSubmitting(true);
    try {
      // Simular API de substituição
      console.log('Substituindo item:', {
        ordemId: ordem.orc_id,
        itemOriginal: itemSelecionado.codprod,
        novoItem: produtoSubstituto[0].codprod,
        quantidade: produtoSubstituto[0].quantidade,
        preco: produtoSubstituto[0].preco_unitario
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Item substituído com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao substituir item:', error);
      alert('Erro ao substituir item. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'select') {
    // Step 1: Selecionar item para substituir
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Replace className="text-purple-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Selecionar Item para Substituir
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Ordem #{ordem.orc_id} - Selecione o item que deseja substituir:
            </p>
            
            {itensOriginais.length === 0 ? (
              <p className="text-gray-500 text-center">Nenhum item encontrado para esta ordem.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-3">Código</th>
                      <th className="text-left p-3">Descrição</th>
                      <th className="text-left p-3">Quantidade</th>
                      <th className="text-left p-3">Preço Unit.</th>
                      <th className="text-left p-3">Total</th>
                      <th className="text-center p-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensOriginais.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-3">{item.codprod}</td>
                        <td className="p-3">{item.produto?.descr || item.produto_descr || item.descricao || 'Produto não encontrado'}</td>
                        <td className="p-3">{item.quantidade}</td>
                        <td className="p-3">R$ {Number(item.preco_unitario || 0).toFixed(2)}</td>
                        <td className="p-3">R$ {Number(item.preco_total || 0).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onSelecionarItem(item)}
                            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-sm transition-colors"
                          >
                            Substituir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Escolher produto substituto (usa o mesmo modal de produtos)
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-[95vw] h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                <Replace className="text-purple-500" size={20} />
                Substituir Item
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ordem #{ordem.orc_id}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onVoltar}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
              >
                Voltar
              </button>
              <button
                onClick={() => setShowProdutosModal(true)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Substituir Itens
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Item a ser substituído */}
          <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Item a ser substituído:</h4>
            <div className="text-sm text-red-700 dark:text-red-300">
              <strong>Código:</strong> {itemSelecionado?.codprod} | 
              <strong> Descrição:</strong> {itemSelecionado?.produto?.descr || itemSelecionado?.produto_descr || 'Produto não encontrado'} | 
              <strong> Qtd:</strong> {itemSelecionado?.quantidade} | 
              <strong> Preço:</strong> R$ {Number(itemSelecionado?.preco_unitario || 0).toFixed(2)}
            </div>
          </div>

          {/* Produto substituto */}
          <div className="flex-1 overflow-y-auto p-6">
            {produtoSubstituto.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-4">Nenhum produto substituto selecionado</p>
                  <p className="text-gray-400 text-sm">Clique em "Substituir Itens" para escolher o produto</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  Produto Substituto ({produtoSubstituto.length})
                </h4>
                {produtoSubstituto.map((produto, index) => (
                  <div key={`${produto.codprod}-${index}`} className="grid grid-cols-10 gap-6 items-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    {/* Checkbox */}
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={true}
                        readOnly
                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Produto */}
                    <div className="col-span-5">
                      <div className="font-medium text-slate-800 dark:text-gray-100">
                        {produto.descr}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        COD: {produto.codprod} | Marca: {produto.marca}
                      </div>
                    </div>

                    {/* Quantidade */}
                    <div className="col-span-2 text-center">
                      <span className="text-slate-800 dark:text-gray-100">
                        {produto.quantidade}
                      </span>
                    </div>

                    {/* Preço Unitário */}
                    <div className="col-span-1 text-center">
                      <span className="text-slate-800 dark:text-gray-100">
                        R$ {(produto.preco_unitario || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="col-span-1 text-center">
                      <span className="font-medium text-slate-800 dark:text-gray-100">
                        R$ {(produto.preco_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <div className="text-lg font-medium text-slate-800 dark:text-gray-100">
              Total do Substituto: R$ {produtoSubstituto.reduce((total, p) => total + (p.preco_total || 0), 0).toFixed(2)}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarSubstituicao}
                disabled={submitting || produtoSubstituto.length !== 1}
                className="px-6 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Substituindo...' : 'Confirmar Substituição'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de selecionar produtos substitutos */}
      {showProdutosModal && (
        <AdicionarProdutosModal
          isOpen={showProdutosModal}
          onClose={() => setShowProdutosModal(false)}
          onConfirm={(produtos) => {
            // Só permitir 1 produto para substituição
            if (produtos.length > 1) {
              alert('Você pode selecionar apenas 1 produto para substituição.');
              return;
            }
            setProdutoSubstituto(produtos);
            setShowProdutosModal(false);
          }}
          produtosJaAdicionados={produtoSubstituto}
        />
      )}
    </>
  );
}

// SubstituirItemModalV3 - Seleção múltipla com processo sequencial
function SubstituirItemModalV3({
  ordem,
  itensOriginais,
  itensSelecionados,
  itensSubstituidos,
  itemAtualSubstituicao,
  showProdutosModal,
  onClose,
  onToggleItemSelecionado,
  onIniciarSubstituicoes,
  onFinalizar,
  onConfirmarSubstituicao,
  onCancelarSubstituicao
}: {
  ordem: OrdemCompraDTO;
  itensOriginais: any[];
  itensSelecionados: Set<number>;
  itensSubstituidos: Set<number>;
  itemAtualSubstituicao: number;
  showProdutosModal: boolean;
  onClose: () => void;
  onToggleItemSelecionado: (index: number) => void;
  onIniciarSubstituicoes: () => void;
  onFinalizar: () => void;
  onConfirmarSubstituicao: (produto: any) => void;
  onCancelarSubstituicao: () => void;
}) {
  const { toast } = useToast();

  // State local para armazenar produtos selecionados no modal
  const [produtosSelecionadosModal, setProdutosSelecionadosModal] = useState<any[]>([]);

  // State para modal de confirmação
  const [localConfirmModal, setLocalConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Limpar produtos selecionados quando mudar de item ou cancelar
  useEffect(() => {
    if (!showProdutosModal) {
      setProdutosSelecionadosModal([]);
    }
  }, [showProdutosModal, itemAtualSubstituicao]);

  // Se showProdutosModal é true, mostrar o modal de produtos
  if (showProdutosModal) {
    const indices = Array.from(itensSelecionados).sort((a, b) => a - b);
    const itemAtual = itensOriginais[indices[itemAtualSubstituicao]];
    
    return (
      <>
        {/* Modal de fundo escurecido para mostrar progresso */}
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="text-center">
              <Replace className="mx-auto h-12 w-12 text-purple-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Substituindo Itens
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Substituindo item {itemAtualSubstituicao + 1} de {indices.length}
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md mb-4">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <strong>Item Atual:</strong> {itemAtual?.produto?.descr || itemAtual?.produto_descr || 'Produto não encontrado'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Código: {itemAtual?.codprod}
                </p>
              </div>
              <button
                onClick={onCancelarSubstituicao}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              >
                Cancelar Processo
              </button>
            </div>
          </div>
        </div>

        {/* Modal de produtos por cima */}
        <AdicionarProdutosModal
          isOpen={true}
          onClose={() => {
            setProdutosSelecionadosModal([]);
            onCancelarSubstituicao();
          }}
          onConfirm={(produtos) => {
            if (produtos.length !== 1) {
              toast({
                title: 'Erro',
                description: 'Selecione exatamente 1 produto para substituição.',
                variant: 'destructive'
              });
              return;
            }

            // Confirmar substituição
            const indices = Array.from(itensSelecionados).sort((a, b) => a - b);
            const itemOriginal = itensOriginais[indices[itemAtualSubstituicao]];
            const produtoSubstituto = produtos[0];

            // Abrir modal de confirmação
            setLocalConfirmModal({
              isOpen: true,
              title: 'Confirmar Substituição',
              message: `Deseja substituir o item ${itemOriginal?.produto?.descr || itemOriginal?.produto_descr || 'N/A'} por ${produtoSubstituto.descr}?`,
              onConfirm: () => {
                setLocalConfirmModal(prev => ({ ...prev, isOpen: false }));
                onConfirmarSubstituicao(produtoSubstituto);
                setProdutosSelecionadosModal([]); // Limpar após confirmar
              }
            });
          }}
          produtosJaAdicionados={produtosSelecionadosModal}
        />
      </>
    );
  }

  // Modal principal de seleção de itens
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Replace className="text-purple-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Substituir Itens
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-purple-800 dark:text-purple-200 text-sm">
              <strong>Ordem #{ordem.orc_id}</strong> - Selecione os itens que deseja substituir usando os checkboxes. 
              Depois clique em "Iniciar Substituições" para substituir cada item sequencialmente.
            </p>
          </div>
          
          {itensOriginais.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum item encontrado para esta ordem.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-700">
                    <th className="text-center p-3 w-12">
                      <input
                        type="checkbox"
                        checked={itensSelecionados.size === itensOriginais.length && itensOriginais.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Selecionar todos
                            itensOriginais.forEach((_, index) => {
                              if (!itensSelecionados.has(index)) {
                                onToggleItemSelecionado(index);
                              }
                            });
                          } else {
                            // Desselecionar todos
                            Array.from(itensSelecionados).forEach(index => {
                              onToggleItemSelecionado(index);
                            });
                          }
                        }}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                      />
                    </th>
                    <th className="text-left p-3">Código</th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-left p-3">Quantidade</th>
                    <th className="text-left p-3">Preço Unit.</th>
                    <th className="text-left p-3">Total</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itensOriginais.map((item, index) => (
                    <tr 
                      key={index} 
                      className={`border-b hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        itensSelecionados.has(index) ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={itensSelecionados.has(index)}
                          onChange={() => onToggleItemSelecionado(index)}
                          className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                        />
                      </td>
                      <td className="p-3">{item.codprod}</td>
                      <td className="p-3">{item.produto?.descr || item.produto_descr || item.descricao || 'Produto não encontrado'}</td>
                      <td className="p-3">{item.quantidade}</td>
                      <td className="p-3">R$ {Number(item.preco_unitario || 0).toFixed(2)}</td>
                      <td className="p-3">R$ {Number(item.preco_total || 0).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        {itensSubstituidos.has(index) ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                            ✓ Substituído
                          </span>
                        ) : itensSelecionados.has(index) ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                            • Selecionado
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer com informações e botões */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="flex flex-col gap-1">
              <div>
                {itensSelecionados.size > 0 ? (
                  `${itensSelecionados.size} item${itensSelecionados.size > 1 ? 'ns' : ''} selecionado${itensSelecionados.size > 1 ? 's' : ''}`
                ) : (
                  'Nenhum item selecionado'
                )}
              </div>
              {itensSubstituidos.size > 0 && (
                <div className="text-green-600 dark:text-green-400">
                  {itensSubstituidos.size} item{itensSubstituidos.size > 1 ? 'ns' : ''} substituído{itensSubstituidos.size > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors"
            >
              Cancelar
            </button>
            
            {/* Mostrar botão de finalizar se houver itens substituídos */}
            {itensSubstituidos.size > 0 && (
              <button
                onClick={onFinalizar}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
              >
                Finalizar ({itensSubstituidos.size} substituído{itensSubstituidos.size > 1 ? 's' : ''})
              </button>
            )}
            
            {/* Botão para substituir próximo item selecionado */}
            {itensSelecionados.size > 0 && (
              (() => {
                const itensRestantes = Array.from(itensSelecionados).filter(index => !itensSubstituidos.has(index));
                if (itensRestantes.length > 0) {
                  return (
                    <button
                      onClick={() => {
                        // Substituir próximo item não substituído
                        const proximoIndex = itensRestantes.sort((a, b) => a - b)[0];
                        const posicaoNaLista = Array.from(itensSelecionados).sort((a, b) => a - b).indexOf(proximoIndex);
                        onIniciarSubstituicoes(); // Usar a função passada como prop
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                    >
                      Substituir Próximo ({itensRestantes.length} restante{itensRestantes.length > 1 ? 's' : ''})
                    </button>
                  );
                }
                return null;
              })()
            )}
            
            {/* Botão inicial para começar substituições */}
            {itensSelecionados.size > 0 && itensSubstituidos.size === 0 && (
              <button
                onClick={onIniciarSubstituicoes}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Iniciar Substituições
              </button>
            )}
          </div>
        </div>

        {/* Modal de Confirmação local para substituições */}
        {localConfirmModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {localConfirmModal.title}
                </h3>
                <button
                  onClick={() => setLocalConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300">
                  {localConfirmModal.message}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setLocalConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    localConfirmModal.onConfirm();
                    setLocalConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 rounded-md transition-colors bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}