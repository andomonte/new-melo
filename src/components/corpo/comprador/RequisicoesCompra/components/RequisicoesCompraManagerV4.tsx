import React, { useState, useEffect, useRef, useContext } from 'react';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useRequisitions } from '../hooks/useRequisitions';
import { useRequisicoesTableImproved } from '../hooks/useRequisicoesTableImproved';
import { colunasDbRequisicao } from '../colunasDbRequisicao';
import DataTableFiltroV3 from '@/components/common/DataTableFiltroV3';
import { PlusIcon, CircleChevronDown, Package, Send, CheckCircle, XCircle, Eye, Edit3, Trash2, Ban, FileDown, DollarSign, Calendar, Truck, Replace, Archive, Download, CheckSquare, Settings, FileSpreadsheet } from 'lucide-react';
import { createPortal } from 'react-dom';
import api from '@/components/services/api';
import { AuthContext } from '@/contexts/authContexts';
import { RequisitionItemsManager } from './RequisitionItemsManagerV3';
import EditRequisitionModal from '../Form/EditRequisitionModal';
import { NovaRequisicaoModal } from './NovaRequisicaoModal';
import { AcoesSistemaModal } from './AcoesSistemaModal';

interface RequisicoesCompraManagerV4Props {
  className?: string;
}

export default function RequisicoesCompraManagerV4({
  className = '',
}: RequisicoesCompraManagerV4Props) {
  // Context para verificar perfil do usuário
  const { user } = useContext(AuthContext);
  
  // Verifica permissões baseado nas FUNÇÕES do banco (sem hardcode de perfis)
  const getFuncaoSigla = (f: any): string => typeof f === 'string' ? f : f?.sigla || '';
  const canApproveRequisitions = user?.funcoes?.some((f: any) => getFuncaoSigla(f) === 'APROVAR_ORDENS_COMPRA');
  
  // Dropdown states for actions menu
  const [dropdownStates, setDropdownStates] = useState<{[key: number]: boolean}>({});
  const dropdownRefs = useRef<{[key: number]: HTMLDivElement | null}>({});
  const actionButtonRefs = useRef<{[key: number]: HTMLButtonElement | null}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: number]: {top: number; left: number} | null}>({});
  const [iconRotations, setIconRotations] = useState<{[key: number]: boolean}>({});

  // Modal states
  const [managingItemsRequisition, setManagingItemsRequisition] = useState<RequisitionDTO | null>(null);
  const [editingRequisition, setEditingRequisition] = useState<RequisitionDTO | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [acoesSistemaModal, setAcoesSistemaModal] = useState<{
    isOpen: boolean;
    requisicao: RequisitionDTO | null;
  }>({ isOpen: false, requisicao: null });

  const {
    search,
    page,
    perPage,
    headers,
    filtros,
    handleSearchChange,
    handleSearchKeyDown,
    handleSearchBlur,
    handlePageChange,
    handlePerPageChange,
    handleLimiteColunasChange,
    handleColunaSubstituida,
    handleFiltroChange,
    limiteColunas,
  } = useRequisicoesTableImproved();

  const { data, meta, loading, error, refetch } = useRequisitions({
    page,
    perPage,
    search,
    filtros,
  });

  const toggleDropdown = (reqId: number, buttonElement: HTMLButtonElement) => {
    console.log('🔧 DEBUG: Toggle dropdown para requisição:', reqId);
    console.log('🔧 DEBUG: Estado atual dropdown:', dropdownStates[reqId]);
    
    setDropdownStates(prevStates => ({
      ...prevStates,
      [reqId]: !prevStates[reqId]
    }));

    setIconRotations(prevRotations => ({
      ...prevRotations,
      [reqId]: !prevRotations[reqId]
    }));

    if (!dropdownStates[reqId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [reqId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX
        }
      }));
    } else {
      setDropdownPositions(prevPositions => ({
        ...prevPositions,
        [reqId]: null
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleManageItems = (requisition: RequisitionDTO) => {
    closeAllDropdowns();
    setManagingItemsRequisition(requisition);
  };

  const handleEdit = (requisition: RequisitionDTO) => {
    closeAllDropdowns();
    setEditingRequisition(requisition);
  };

  const handleView = (requisition: RequisitionDTO) => {
    closeAllDropdowns();
    console.log('Ver requisição:', requisition.id);
  };

  const handleAcoesSistema = (requisition: RequisitionDTO) => {
    closeAllDropdowns();
    setAcoesSistemaModal({
      isOpen: true,
      requisicao: requisition
    });
  };

  const handleStatusChange = async (requisition: RequisitionDTO, newStatus: string) => {
    closeAllDropdowns();
    try {
      let endpoint = '';
      switch (newStatus) {
        case 'S': // Submetida
          endpoint = '/api/requisicoesCompra/actions/submit';
          break;
        case 'A': // Aprovada
          endpoint = '/api/requisicoesCompra/actions/approve';
          break;
        case 'R': // Reprovada
          endpoint = '/api/requisicoesCompra/actions/reject';
          break;
        case 'C': // Cancelada
          endpoint = '/api/requisicoesCompra/actions/cancel';
          break;
        default:
          throw new Error('Status inválido');
      }

      await api.put(endpoint, {
        id: requisition.id,
        versao: requisition.versao
      });

      refetch(); // Recarregar dados da tabela
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const handleExportExcel = async (requisition: RequisitionDTO) => {
    closeAllDropdowns();
    try {
      const response = await fetch('/api/compras/requisicoes/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colunas: [],
          filtros: { req_id: requisition.id },
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
      a.download = `requisicao-${requisition.id}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      alert('Erro ao gerar arquivo Excel');
    }
  };

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const reqId in dropdownStates) {
        if (dropdownStates[reqId]) {
          const dropdownNode = dropdownRefs.current[parseInt(reqId, 10)];
          const actionButtonNode = actionButtonRefs.current[parseInt(reqId, 10)];
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

  // Format table data for requisitions
  const formattedData = data.map((item) => {
    const row: Record<string, any> = {};

    headers.forEach((col) => {
      if (col === 'selecionar' || col === 'AÇÕES') return;

      let v = item[col as keyof RequisitionDTO];

      // Mapear campos específicos das requisições
      if (col === 'requisicao') {
        v = item.requisicao || `${item.id}/${item.versao}`;
      } else if (col === 'dataRequisicao') {
        v = item.dataRequisicao;
      } else if (col === 'statusRequisicao') {
        v = item.statusRequisicao;
      } else if (col === 'fornecedorCompleto') {
        v = item.fornecedorCompleto || '';
      } else if (col === 'compradorCompleto') {
        v = item.compradorCompleto || '';
      } else if (col === 'valorTotal') {
        v = item.valorTotal ? `R$ ${Number(item.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
      } else if (col === 'observacao') {
        v = item.observacao || '-';
      } else if (col === 'previsaoChegada') {
        v = item.previsaoChegada || '-';
      } else if (col === 'destino') {
        v = item.destino || '-';
      } else if (col === 'versao') {
        v = item.versao ? `v${item.versao}` : '-';
      } else if (col === 'fornecedorCpfCnpj') {
        v = item.fornecedorCpfCnpj || '-';
      }

      // Format dates
      if (
        typeof v === 'string' &&
        (col.toLowerCase().includes('data') ||
          col.toLowerCase().includes('date'))
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
      if (typeof v === 'string' && (col === 'observacao' || col === 'fornecedorCompleto')) {
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
    console.log('🔧 DEBUG: Renderizando requisição:', item.id, 'Status:', item.statusRequisicao);
    
    const baseRow = {
      ...row,
      AÇÕES: (
        <div className="flex justify-center">
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[item.id] = el;
              }
            }}
            onClick={(e) => toggleDropdown(item.id, e.currentTarget)}
            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            title="Ações"
            style={{
              transform: iconRotations[item.id] ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <CircleChevronDown size={20} />
          </button>
          {dropdownStates[item.id] && dropdownPositions[item.id] && createPortal(
            <div
              key={`portal-dropdown-${item.id}`}
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[item.id] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[item.id]?.top,
                left: dropdownPositions[item.id]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000
              }}
            >
              <div className="py-1" role="menu" aria-orientation="vertical">
                {/* Ver Detalhes */}
                <button
                  onClick={() => handleView(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Ver Detalhes
                </button>
                
                {/* Gerenciar Itens */}
                <button
                  onClick={() => handleManageItems(item)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Package className="mr-2 text-green-500 dark:text-green-400" size={16} />
                  Gerenciar Itens
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

                {/* Editar */}
                {(item.statusRequisicao === 'P' || item.statusRequisicao === 'R') && (
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Edit3 className="mr-2 text-yellow-500 dark:text-yellow-400" size={16} />
                    Editar
                  </button>
                )}
                
                {/* Submeter */}
                {item.statusRequisicao === 'P' && (
                  <button
                    onClick={() => handleStatusChange(item, 'S')}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Send className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                    Submeter
                  </button>
                )}

                {/* Aprovar/Reprovar */}
                {item.statusRequisicao === 'S' && canApproveRequisitions && (
                  <>
                    <button
                      onClick={() => handleStatusChange(item, 'A')}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                      role="menuitem"
                    >
                      <CheckCircle className="mr-2 text-green-500 dark:text-green-400" size={16} />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleStatusChange(item, 'R')}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                      role="menuitem"
                    >
                      <XCircle className="mr-2 text-red-500 dark:text-red-400" size={16} />
                      Reprovar
                    </button>
                  </>
                )}

                {/* Ações do Sistema */}
                {item.statusRequisicao === 'A' && (
                  <button
                    onClick={() => handleAcoesSistema(item)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Settings className="mr-2 text-purple-500 dark:text-purple-400" size={16} />
                    Ações do Sistema
                  </button>
                )}

                {/* Cancelar */}
                {['P', 'S'].includes(item.statusRequisicao || '') && (
                  <button
                    onClick={() => handleStatusChange(item, 'C')}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Trash2 className="mr-2 text-gray-500 dark:text-gray-400" size={16} />
                    Cancelar
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      )
    };

    return baseRow;
  });

  // Se está gerenciando itens, mostrar o componente específico
  if (managingItemsRequisition) {
    return (
      <RequisitionItemsManager
        requisitionId={managingItemsRequisition.id}
        requisitionVersion={managingItemsRequisition.versao}
        requisitionData={managingItemsRequisition}
        onBack={() => setManagingItemsRequisition(null)}
        onStatusChange={(newStatus) => handleStatusChange(managingItemsRequisition, newStatus)}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Requisições de Compra V4
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gerencie suas requisições com filtros rápidos e avançados
          </p>
        </div>
        
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Requisição
        </button>
      </div>

      <DataTableFiltroV3
        carregando={loading}
        headers={headers}
        rows={rows}
        meta={meta}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        onColunaSubstituida={handleColunaSubstituida}
        onSearch={handleSearchChange}
        onSearchBlur={handleSearchBlur}
        onSearchKeyDown={handleSearchKeyDown}
        searchInputPlaceholder="Pesquisar por requisição, fornecedor, comprador..."
        colunasFiltro={colunasDbRequisicao.map((c) => c.campo)}
        limiteColunas={limiteColunas}
        onLimiteColunasChange={handleLimiteColunasChange}
        colunasFixas={['AÇÕES']}
        exportEndpoint="/api/requisicoesCompra/exportar"
        exportFileName="requisicoes-compra.xlsx"
        onFiltroChange={handleFiltroChange}
        showAdvancedFilters={true}
        columnLabels={colunasDbRequisicao.reduce((acc, col) => {
          acc[col.campo] = col.label;
          return acc;
        }, {} as Record<string, string>)}
      />

      {/* Modal para nova requisição */}
      {isNewModalOpen && (
        <NovaRequisicaoModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            refetch();
          }}
        />
      )}

      {/* Modal para editar requisição */}
      {editingRequisition && (
        <EditRequisitionModal
          isOpen={!!editingRequisition}
          onClose={() => setEditingRequisition(null)}
          onSuccess={() => {
            setEditingRequisition(null);
            refetch();
          }}
          requisition={editingRequisition}
        />
      )}

      {/* Modal de Ações do Sistema */}
      {acoesSistemaModal.isOpen && acoesSistemaModal.requisicao && (
        <AcoesSistemaModal
          isOpen={acoesSistemaModal.isOpen}
          onClose={() => setAcoesSistemaModal({ isOpen: false, requisicao: null })}
          requisicao={acoesSistemaModal.requisicao}
          onSuccess={() => {
            setAcoesSistemaModal({ isOpen: false, requisicao: null });
            refetch();
          }}
        />
      )}
    </>
  );
}