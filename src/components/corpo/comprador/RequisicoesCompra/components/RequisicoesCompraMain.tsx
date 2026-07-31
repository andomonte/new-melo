import React, { useState, useEffect, useLayoutEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useRequisitions } from '../hooks/useRequisitions';
import { useRequisicoesTable } from '../hooks/useRequisicoesTable';
import { colunasDbRequisicao } from '../colunasDbRequisicao';
import { formatTableData } from '../utils/tableHelpers';
import DataTable from '@/components/common/DataTablePadrao';
import { useNavegacaoTecladoTabela, CLASSE_LINHA_ATIVA } from '@/hooks/useNavegacaoTecladoTabela';
import SelectInput from '@/components/common/SelectPadrao';
import { DefaultButton } from '@/components/common/Buttons';
// OrdensComprasListImproved removed - managed by ComprasTabManager
import { PlusIcon, CircleChevronDown, Package, Send, CheckCircle, XCircle, Eye, Edit3, Trash2, Ban, FileDown, DollarSign, ChevronDown, Copy, History, FileSpreadsheet } from 'lucide-react';
// Dropdown imports removed - managed by ComprasTabManager
import { NovaRequisicaoModal } from './NovaRequisicaoModal';
import EditRequisitionModal from '../Form/EditRequisitionModal';
import ViewRequisitionModal from '../Form/ViewRequisitionModal';
import { RequisitionItemsManager } from './RequisitionItemsManager';
import { BudgetModal } from './BudgetModal';
import { HistoricoModal } from './HistoricoModal';
import { createPortal } from 'react-dom';
import api from '@/components/services/api';
import { AuthContext } from '@/contexts/authContexts';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';

interface RequisicoesCompraMainProps {
  showNewButton?: boolean;
  triggerNewModal?: boolean;
  onModalStateChange?: (state: boolean) => void;
}

export const RequisicoesCompraMain: React.FC<RequisicoesCompraMainProps> = ({
  showNewButton = true,
  triggerNewModal = false,
  onModalStateChange
}) => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editItem, setEditItem] = useState<RequisitionDTO | null>(null);
  const [viewItem, setViewItem] = useState<RequisitionDTO | null>(null);
  const [itemsManagerRequisition, setItemsManagerRequisition] = useState<RequisitionDTO | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<RequisitionDTO | null>(null);
  // Removed activeTab - managed by parent ComprasTabManager
  const [showBudget, setShowBudget] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoItem, setHistoricoItem] = useState<RequisitionDTO | null>(null);
  
  // Detectar quando o botão do header quer abrir o modal
  useEffect(() => {
    if (triggerNewModal) {
      setIsNewOpen(true);
      // Reset the trigger
      onModalStateChange?.(false);
    }
  }, [triggerNewModal, onModalStateChange]);
  
  // Context para verificar perfil do usuário
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  // Confirmação no modal central (padrão do sistema), nunca toast no canto.
  const { pedirConfirmacao, ConfirmacaoSalvarModal, aberto: confirmacaoAberta } = useConfirmarSalvar();
  // Modal central de reprovação (com motivo) — individual ou em lote.
  const [reprovarAlvo, setReprovarAlvo] = useState<{ itens: RequisitionDTO[] } | null>(null);
  const [motivoReprovar, setMotivoReprovar] = useState('');
  // Alerta central (mensagem no meio da tela, botão OK) — para os resultados
  // das ações (submetido/aprovado/reprovado/cancelado), no lugar do toast do canto.
  const alertaCentral = useCallback(
    (title: string, message: string, type: 'success' | 'danger' | 'info' = 'success') => {
      pedirConfirmacao(() => {}, { title, message, type, somenteOk: true, confirmText: 'OK' });
    },
    [pedirConfirmacao],
  );

  // Verifica permissões baseado nas FUNÇÕES do banco (sem hardcode de perfis)
  // Suporta tanto objetos {sigla: '...'} quanto strings diretas
  const getFuncaoSigla = (f: any): string => typeof f === 'string' ? f : f?.sigla || '';

  const canApproveRequisitions = user?.funcoes?.some((f: any) =>
    getFuncaoSigla(f) === 'APROVAR_ORDENS_COMPRA'
  );
  const canSubmitRequisitions = user?.funcoes?.some((f: any) =>
    getFuncaoSigla(f) === 'SUBMETER_REQUISICOES_COMPRA'
  );
  const canCancelAny = user?.funcoes?.some((f: any) =>
    getFuncaoSigla(f) === 'CANCELAR_REQUISICOES_COMPRA'
  );
  const canCancelOwn = user?.funcoes?.some((f: any) =>
    getFuncaoSigla(f) === 'CANCELAR_PROPRIAS_REQUISICOES'
  );

  // Verifica se o usuário pode cancelar requisições
  const canCancelRequisitions = (item: RequisitionDTO) => {
    // Pode cancelar qualquer requisição se tem a função CANCELAR_REQUISICOES_COMPRA
    if (canCancelAny) {
      return true;
    }

    // Pode cancelar apenas suas próprias requisições ANTES da aprovação se tem CANCELAR_PROPRIAS_REQUISICOES
    if (canCancelOwn) {
      return item.compradorNome === user?.usuario &&
             (['P', 'Pendente'].includes(item.statusRequisicao || ''));
    }

    return false;
  };
  
  // Dropdown states for actions menu
  const [dropdownStates, setDropdownStates] = useState<{[key: number]: boolean}>({});
  const dropdownRefs = useRef<{[key: number]: HTMLDivElement | null}>({});
  const actionButtonRefs = useRef<{[key: number]: HTMLButtonElement | null}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: number]: {top: number; left: number} | null}>({});
  const [iconRotations, setIconRotations] = useState<{[key: number]: boolean}>({});

  const {
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
  } = useRequisicoesTable(colunasDbRequisicao);

  // Filtro por status via Select (o filtro rápido de coluna usava "contém" com
  // o rótulo digitado, que não bate com o código 'A'/'S'/...). Aqui injetamos
  // um filtro igual pelo código, combinando com os demais filtros de coluna.
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const filtrosComStatus = useMemo(() => {
    const base = (filtros || []).filter((f) => f.campo !== 'statusRequisicao');
    return statusFiltro
      ? [...base, { campo: 'statusRequisicao', tipo: 'igual', valor: statusFiltro }]
      : base;
  }, [filtros, statusFiltro]);

  // Ordenação server-side (ordena todas as páginas, não só a visível).
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: 'asc' | 'desc' } | null>(null);

  const { data, meta, loading, error, refetch } = useRequisitions({
    page,
    perPage,
    search,
    filtros: filtrosComStatus,
    ordenacao,
  });

  // Debounced refetch para evitar múltiplas chamadas
  const debouncedRefetch = useDebouncedCallback(() => {
    refetch();
  }, 300);

  // Handler para mudança de perPage - DEVE estar no topo com outros hooks
  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
    debouncedRefetch();
  }, [perPage, setPerPage, setPage, debouncedRefetch]);






  const handleView = (item: RequisitionDTO) => {
    setViewItem(item);
  };

  const handleSubmit = async (item: RequisitionDTO) => {
    if (!item.id) {
      toast({
        title: "Erro",
        description: "ID da requisição não encontrado",
        variant: "destructive"
      });
      return;
    }
    
    pedirConfirmacao(
      async () => {
        try {
          const response = await api.put('/api/requisicoesCompra/actions/submit', {
            requisitionId: item.id,
            version: item.versao,
            userId: user?.codusr,
            userName: user?.usuario,
          });

          if (response.data.success) {
            // Limpar seleção se o item estava selecionado
            if (selectedItems.has(item.id)) {
              const newSelected = new Set(selectedItems);
              newSelected.delete(item.id);
              setSelectedItems(newSelected);
              if (newSelected.size === 0) {
                setSelectedStatus(null);
              }
            }
            await refetch();
            alertaCentral('Sucesso', 'Requisição submetida com sucesso!', 'success');
          } else {
            alertaCentral('Erro', response.data.message || 'Erro ao submeter requisição', 'danger');
          }
        } catch (error: any) {
          console.error('Erro ao submeter:', error);
          toast({
            title: "Erro",
            description: error.response?.data?.message || 'Erro interno ao submeter requisição',
            variant: "destructive"
          });
        }
      },
      {
        title: 'Submeter requisição',
        message: `Tem certeza que deseja submeter a requisição ${item.requisicao} para aprovação?`,
        confirmText: 'Sim, submeter',
        type: 'info',
      },
    );
  };

  const handleApprove = async (item: RequisitionDTO) => {
    if (!item.id) {
      toast({
        title: "Erro",
        description: "ID da requisição não encontrado",
        variant: "destructive"
      });
      return;
    }
    
    // Verificar se a requisição pode ser aprovada
    if (item.statusRequisicao !== 'S') {
      toast({
        title: "Ação não permitida",
        description: `Apenas requisições com status "Submetida" podem ser aprovadas. Status atual: ${item.statusRequisicao}`,
        variant: "destructive"
      });
      return;
    }
    
    pedirConfirmacao(
      async () => {
        try {
          const response = await api.put('/api/requisicoesCompra/actions/approve', {
            requisitionId: item.id,
            version: item.versao,
            userId: user?.codusr,
            userName: user?.usuario,
            comments: 'Aprovação via interface'
          });

          if (response.data.success) {
            await refetch();
            alertaCentral('Sucesso', 'Requisição aprovada com sucesso!', 'success');
          } else {
            alertaCentral('Erro', response.data.message || 'Erro ao aprovar requisição', 'danger');
          }
        } catch (error: any) {
          console.error('Erro ao aprovar:', error);
          toast({
            title: "Erro",
            description: error.response?.data?.message || 'Erro interno ao aprovar requisição',
            variant: "destructive"
          });
        }
      },
      {
        title: 'Confirmar aprovação',
        message: `Tem certeza que deseja aprovar a requisição ${item.requisicao}?`,
        confirmText: 'Sim, aprovar',
        type: 'info',
      },
    );
  };

  const handleReject = async (item: RequisitionDTO) => {
    if (!item.id) {
      toast({
        title: "Erro",
        description: "ID da requisição não encontrado",
        variant: "destructive"
      });
      return;
    }
    
    // Verificar se a requisição pode ser rejeitada
    if (item.statusRequisicao !== 'S') {
      toast({
        title: "Ação não permitida",
        description: `Apenas requisições com status "Submetida" podem ser rejeitadas. Status atual: ${item.statusRequisicao}`,
        variant: "destructive"
      });
      return;
    }
    
    // Abre o modal central estilizado para informar o motivo (padrão do sistema).
    setMotivoReprovar('');
    setReprovarAlvo({ itens: [item] });
  };

  // Executa a reprovação (individual ou em lote) com o motivo do modal central.
  const confirmarReprovacao = async () => {
    const alvo = reprovarAlvo;
    if (!alvo || alvo.itens.length === 0) return;
    setReprovarAlvo(null);
    const motivo = motivoReprovar.trim() || 'Reprovação via interface';

    let successCount = 0;
    let errorCount = 0;
    for (const item of alvo.itens) {
      if (!item.id) { errorCount++; continue; }
      try {
        const response = await api.put('/api/requisicoesCompra/actions/reject', {
          requisitionId: item.id,
          version: item.versao,
          userId: user?.codusr,
          userName: user?.usuario,
          comments: motivo,
        });
        if (response.data.success) successCount++; else errorCount++;
      } catch (error: any) {
        console.error('Erro ao reprovar:', error);
        errorCount++;
      }
    }

    setSelectedItems(new Set());
    setSelectedStatus(null);
    await refetch();

    if (alvo.itens.length === 1) {
      alertaCentral(
        successCount ? 'Sucesso' : 'Erro',
        successCount ? 'Requisição reprovada com sucesso!' : 'Não foi possível reprovar a requisição.',
        successCount ? 'success' : 'danger',
      );
    } else {
      alertaCentral(
        'Reprovação concluída',
        `${successCount} sucesso(s), ${errorCount} erro(s)`,
        errorCount > 0 ? 'danger' : 'success',
      );
    }
  };


  const handleCancel = async (item: RequisitionDTO) => {
    if (!item.id) {
      toast({
        title: "Erro",
        description: "ID da requisição não encontrado",
        variant: "destructive"
      });
      return;
    }

    pedirConfirmacao(
      async () => {
        try {
          const response = await api.put('/api/requisicoesCompra/actions/cancel', {
            requisitionId: item.id,
            version: item.versao,
            userId: user?.codusr,
            userName: user?.usuario,
            comments: 'Cancelamento via interface'
          });

          if (response.data.success) {
            await refetch();
            alertaCentral('Sucesso', 'Requisição cancelada com sucesso!', 'success');
          } else {
            alertaCentral('Erro', response.data.message || 'Erro ao cancelar requisição', 'danger');
          }
        } catch (error: any) {
          console.error('Erro ao cancelar:', error);
          alertaCentral('Erro', 'Erro interno ao cancelar requisição', 'danger');
        }
      },
      {
        title: 'Confirmar cancelamento',
        message: `Tem certeza que deseja cancelar a requisição ${item.requisicao}?`,
        confirmText: 'Sim, cancelar',
        type: 'danger',
      },
    );
  };

  const handleDelete = async (item: RequisitionDTO) => {
    if (confirm(`Tem certeza que deseja excluir a requisição ${item.requisicao}? Esta ação não pode ser desfeita.`)) {
      try {
        const response = await api.delete(`/api/requisicoesCompra/${item.id}`);
        
        if (response.data.success) {
          toast({
            title: "Sucesso",
            description: "Requisição excluída com sucesso!"
          });
          await refetch();
        } else {
          toast({
            title: "Erro",
            description: response.data.message || 'Erro ao excluir requisição',
            variant: "destructive"
          });
        }
      } catch (error: any) {
        console.error('Erro ao excluir:', error);
        toast({
          title: "Erro",
          description: error.response?.data?.message || 'Erro ao excluir requisição',
          variant: "destructive"
        });
      }
    }
  };

  const handleDuplicate = (item: RequisitionDTO) => {
    // Abrir modal de nova requisição com dados preenchidos
    setDuplicateData(item);
    setIsNewOpen(true);
  };

  const handleHistorico = (item: RequisitionDTO) => {
    setHistoricoItem(item);
    setHistoricoModalOpen(true);
    closeAllDropdowns();
  };

  const handleExportExcel = async (item: RequisitionDTO) => {
    closeAllDropdowns();
    try {
      const response = await fetch('/api/compras/requisicoes/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          colunas: [],
          filtros: { req_id: item.id },
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
      a.download = `requisicao-${item.id}-${new Date().toISOString().split('T')[0]}.xlsx`;
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

  // Ações em lote para aprovadores
  const handleBulkApprove = async () => {
    if (!canApproveRequisitions) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para aprovar requisições",
        variant: "destructive"
      });
      return;
    }

    const selectedRequisitions = data.filter(item => selectedItems.has(item.id));
    const submittedRequisitions = selectedRequisitions.filter(item => item.statusRequisicao === 'S');
    
    if (submittedRequisitions.length === 0) {
      toast({
        title: "Nenhuma requisição disponível",
        description: "Nenhuma requisição selecionada está em status 'Submetida' para aprovação",
        variant: "destructive"
      });
      return;
    }

    pedirConfirmacao(
      async () => {
        let successCount = 0;
        let errorCount = 0;

        for (const item of submittedRequisitions) {
          if (!item.id) {
            console.error('Item sem id:', item);
            errorCount++;
            continue;
          }

          try {
            const response = await api.put('/api/requisicoesCompra/actions/approve', {
              requisitionId: item.id,
              version: item.versao,
              userId: user?.codusr,
              userName: user?.usuario,
              comments: 'Aprovação em lote via interface'
            });

            if (response.data.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error: any) {
            console.error('Erro ao aprovar:', error);
            errorCount++;
          }
        }

        setSelectedItems(new Set());
        setSelectedStatus(null);
        await refetch();
        alertaCentral(
          'Aprovação concluída',
          `${successCount} sucesso(s), ${errorCount} erro(s)`,
          errorCount > 0 ? 'danger' : 'success',
        );
      },
      {
        title: 'Confirmar aprovação',
        message: `Tem certeza que deseja aprovar ${submittedRequisitions.length} requisição(ões)?`,
        confirmText: 'Sim, aprovar',
        type: 'info',
      },
    );
  };

  const handleBulkReject = async () => {
    if (!canApproveRequisitions) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para reprovar requisições",
        variant: "destructive"
      });
      return;
    }

    const selectedRequisitions = data.filter(item => selectedItems.has(item.id));
    const submittedRequisitions = selectedRequisitions.filter(item => item.statusRequisicao === 'S');
    
    if (submittedRequisitions.length === 0) {
      toast({
        title: "Nenhuma requisição disponível",
        description: "Nenhuma requisição selecionada está em status 'Submetida' para reprovação",
        variant: "destructive"
      });
      return;
    }

    // Abre o modal central de reprovação (com motivo) para as selecionadas.
    setMotivoReprovar('');
    setReprovarAlvo({ itens: submittedRequisitions });
  };

  const handleBulkSubmit = async () => {
    const selectedRequisitions = data.filter(item => selectedItems.has(item.id));
    const pendingRequisitions = selectedRequisitions.filter(item => 
      ['P', 'Pendente'].includes(item.statusRequisicao || '')
    );
    
    if (pendingRequisitions.length === 0) {
      toast({
        title: "Nenhuma requisição disponível",
        description: "Nenhuma requisição selecionada está em status 'Pendente' para submissão",
        variant: "destructive"
      });
      return;
    }

    pedirConfirmacao(
      async () => {
        let successCount = 0;
        let errorCount = 0;

        for (const item of pendingRequisitions) {
          if (!item.id) {
            console.error('Item sem id:', item);
            errorCount++;
            continue;
          }

          try {
            const response = await api.put('/api/requisicoesCompra/actions/submit', {
              requisitionId: item.id,
              version: item.versao,
              userId: user?.codusr,
              userName: user?.usuario,
            });

            if (response.data.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error: any) {
            console.error('Erro ao submeter:', error);
            errorCount++;
          }
        }

        setSelectedItems(new Set());
        setSelectedStatus(null);
        await refetch();
        alertaCentral(
          'Submissão concluída',
          `${successCount} sucesso(s), ${errorCount} erro(s)`,
          errorCount > 0 ? 'danger' : 'success',
        );
      },
      {
        title: 'Confirmar submissão',
        message: `Tem certeza que deseja submeter ${pendingRequisitions.length} requisição(ões) para aprovação?`,
        confirmText: 'Sim, submeter',
        type: 'info',
      },
    );
  };

  const handleManageItems = async (item: RequisitionDTO) => {
    
    // Se o item está com dados inválidos, buscar pelos dados mapeados corretos
    if (!item.id || !item.versao || isNaN(item.id) || isNaN(item.versao)) {
      // Recarregar os dados para pegar IDs mais recentes
      await refetch();
      
      // Buscar o item correto pelos dados únicos disponíveis
      const correctItem = data.find(d => 
        (d.requisicao === item.requisicao && d.requisicao) ||
        (d.fornecedorNome === item.fornecedorNome && d.fornecedorNome) ||
        (d.compradorNome === item.compradorNome && d.compradorNome)
      );
      
      if (correctItem && correctItem.id && correctItem.versao && !isNaN(correctItem.id) && !isNaN(correctItem.versao)) {
        setItemsManagerRequisition(correctItem);
        return;
      }
      
      // Se ainda não encontrou, mostrar erro
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da requisição. Tente recarregar a página.",
        variant: "destructive"
      });
      return;
    }
    
    setItemsManagerRequisition(item);
    closeAllDropdowns();
  };

  const toggleDropdown = (requisitionId: number, buttonElement: HTMLButtonElement) => {
    // Se este já está aberto, fecha. Senão, abre SÓ este (fechando os demais —
    // antes usava ...prevStates e deixava vários menus abertos ao mesmo tempo).
    if (dropdownStates[requisitionId]) {
      closeAllDropdowns();
      return;
    }

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

    // Estados só com a linha atual — garante um único menu aberto.
    setDropdownStates({ [requisitionId]: true });
    setIconRotations({ [requisitionId]: true });
    setDropdownPositions({
      [requisitionId]: {
        top: rect.bottom + 4 + window.scrollY, // Abre abaixo do botão (ajustado abaixo se não couber)
        left: leftPosition,
      },
    });
  };

  // Se o menu aberto não couber abaixo (últimas linhas), abre para CIMA. Roda
  // antes do paint (useLayoutEffect) — mede a altura real e reposiciona sem piscar.
  useLayoutEffect(() => {
    const abertoId = Object.keys(dropdownStates).find((id) => dropdownStates[parseInt(id, 10)]);
    if (!abertoId) return;
    const id = parseInt(abertoId, 10);
    const menu = dropdownRefs.current[id];
    const btn = actionButtonRefs.current[id];
    if (!menu || !btn) return;
    const menuH = menu.offsetHeight;
    const btnRect = btn.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - btnRect.bottom;
    if (espacoAbaixo < menuH + 8 && btnRect.top > menuH) {
      const topCima = btnRect.top + window.scrollY - menuH - 4;
      setDropdownPositions((prev) => {
        const atual = prev[id];
        if (!atual || atual.top === topCima) return prev;
        return { ...prev, [id]: { ...atual, top: topCima } };
      });
    }
  }, [dropdownStates]);

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!itemsManagerRequisition) return;

    try {
      await api.put('/api/requisicoesCompra/update', {
        id: itemsManagerRequisition.id,
        statusRequisicao: newStatus,
        userId: user?.codusr,
        userName: user?.usuario,
      });
      
      // Close items manager and refresh main list
      setItemsManagerRequisition(null);
      await refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da requisição",
        variant: "destructive"
      });
    }
  };

  const handleExportarCSV = () => {
    const headers = ['Requisição', 'Fornecedor', 'Status', 'Data', 'Comprador', 'Tipo'];
    const rows = data.map(item => [
      item.requisicao || '',
      item.fornecedorNome || '',
      item.statusRequisicao || '',
      item.dataRequisicao || '',
      item.compradorNome || '',
      item.tipo || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requisicoes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const calcularValorTotal = () => {
    // Calcula valor total das requisições pendentes/submetidas
    return data
      .filter(item => ['P', 'S'].includes(item.statusRequisicao || ''))
      .reduce((total, item) => total + (item.valorTotal || 0), 0);
  };

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const requisitionId in dropdownStates) {
        if (dropdownStates[requisitionId]) {
          const dropdownNode = dropdownRefs.current[parseInt(requisitionId, 10)];
          const actionButtonNode = actionButtonRefs.current[parseInt(requisitionId, 10)];
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

  // Format table data
  const controlledHeaders = headers;
  
  // Format table data with controlled headers
  const formattedData = formatTableData(data, controlledHeaders);
  
  // Add selection checkbox and actions menu columns
  const rows = formattedData.map((row, index) => {
    const item = data[index];
    
    const baseRow: Record<string, any> = {
      ...row,
      __index: index,
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
                <button
                  onClick={() => { handleView(item); closeAllDropdowns(); }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Ver
                  <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">V</kbd>
                </button>
                <button
                  onClick={() => { handleDuplicate(item); closeAllDropdowns(); }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Copy className="mr-2 text-purple-500 dark:text-purple-400" size={16} />
                  Duplicar
                  <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">D</kbd>
                </button>
                <button
                  onClick={() => { handleHistorico(item); }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <History className="mr-2 text-indigo-500 dark:text-indigo-400" size={16} />
                  Histórico
                  <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">H</kbd>
                </button>
                <button
                  onClick={() => { handleExportExcel(item); }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <FileSpreadsheet className="mr-2 text-emerald-500 dark:text-emerald-400" size={16} />
                  Exportar Excel
                </button>
                {/* Mostra Editar se status for Pendente, Rejeitada ou Submetida */}
                {['P', 'Pendente', 'R', 'Rejeitada', 'S', 'Submetida'].includes(item.statusRequisicao || '') && (
                  <button
                    onClick={() => { setEditItem(item); closeAllDropdowns(); }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Edit3 className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                    Editar
                    <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">E</kbd>
                  </button>
                )}
                <button
                  onClick={() => { handleManageItems(item); }}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Package className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Itens
                  <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">I</kbd>
                </button>
                {item.statusRequisicao === 'P' && (
                  <button
                    onClick={() => { handleSubmit(item); closeAllDropdowns(); }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-green-100 dark:hover:bg-green-700 focus:outline-none focus:bg-green-100 dark:focus:bg-green-700 focus:text-green-900 dark:focus:text-green-100 w-full"
                    role="menuitem"
                  >
                    <Send className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Submeter
                    <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">S</kbd>
                  </button>
                )}
                {item.statusRequisicao && item.statusRequisicao === 'S' && canApproveRequisitions && (
                  <>
                    <button
                      onClick={() => { handleApprove(item); closeAllDropdowns(); }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                      role="menuitem"
                    >
                      <CheckCircle className="mr-2 text-green-500 dark:text-green-400" size={16} />
                      Aprovar
                      <kbd className="ml-auto rounded border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">A</kbd>
                    </button>
                    <button
                      onClick={() => { handleReject(item); closeAllDropdowns(); }}
                      className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                      role="menuitem"
                    >
                      <XCircle className="mr-2 text-red-400 dark:text-red-500" size={16} />
                      Reprovar
                    </button>
                  </>
                )}
                {item.statusRequisicao && ['P', 'S'].includes(item.statusRequisicao) && canApproveRequisitions && (
                  <button
                    onClick={() => { handleCancel(item); closeAllDropdowns(); }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                    role="menuitem"
                  >
                    <Ban className="mr-2 text-red-400 dark:text-red-500" size={16} />
                    Cancelar
                    <kbd className="ml-auto rounded border border-red-300 dark:border-red-700 px-1.5 text-[10px] font-semibold text-red-500 dark:text-red-400">Del</kbd>
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      )
    };

    // Adiciona checkbox de seleção para usuários que podem aprovar ou submeter
    if (canApproveRequisitions || canSubmitRequisitions) {
      return {
        ...baseRow,
        selecionar: (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={selectedItems.has(item.id)}
              disabled={selectedStatus !== null && selectedStatus !== item.statusRequisicao}
              onChange={(e) => {
                const newSelected = new Set(selectedItems);
                if (e.target.checked) {
                  // Se é a primeira seleção, define o status permitido
                  if (selectedItems.size === 0) {
                    setSelectedStatus(item.statusRequisicao || '');
                  }
                  newSelected.add(item.id);
                } else {
                  newSelected.delete(item.id);
                  // Se não há mais itens selecionados, limpa o status
                  if (newSelected.size === 0) {
                    setSelectedStatus(null);
                  }
                }
                setSelectedItems(newSelected);
              }}
              className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                selectedStatus !== null && selectedStatus !== item.statusRequisicao 
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
              }`}
            />
          </div>
        )
      };
    }

    return baseRow;
  });

  // ===== Navegação por teclado (estilo Delphi) =====
  const algumModalAberto =
    isNewOpen ||
    !!editItem ||
    !!viewItem ||
    !!itemsManagerRequisition ||
    budgetModalOpen ||
    historicoModalOpen ||
    !!reprovarAlvo ||
    confirmacaoAberta; // confirmação central aberta → pausa navegação por teclado

  const podeEditarRequisicao = (r: RequisitionDTO | undefined) =>
    !!r &&
    ['P', 'Pendente', 'R', 'Rejeitada', 'S', 'Submetida'].includes(
      r.statusRequisicao || '',
    );

  const { linhaSelecionada, setLinhaSelecionada } =
    useNavegacaoTecladoTabela<RequisitionDTO>({
      data,
      ativo: !algumModalAberto,
      onEnter: (row) => {
        if (row) handleView(row);
      },
      atalhos: [
        {
          key: 'n',
          ctrl: true,
          precisaLinha: false,
          handler: () => {
            if (showNewButton) setIsNewOpen(true);
          },
        },
        // Atalhos de ação na linha selecionada (mesmas regras do menu Ações).
        { key: 'v', handler: (row) => row && handleView(row) },
        { key: 'd', handler: (row) => row && handleDuplicate(row) },
        { key: 'h', handler: (row) => row && handleHistorico(row) },
        { key: 'i', handler: (row) => row && handleManageItems(row) },
        { key: 'e', handler: (row) => { if (podeEditarRequisicao(row)) setEditItem(row!); } },
        {
          key: 's',
          handler: (row) => { if (row && row.statusRequisicao === 'P') handleSubmit(row); },
        },
        {
          key: 'a',
          handler: (row) => {
            if (row && row.statusRequisicao === 'S' && canApproveRequisitions) handleApprove(row);
          },
        },
        {
          key: 'Delete',
          handler: (row) => {
            if (row && ['P', 'S'].includes(row.statusRequisicao || '') && canApproveRequisitions) {
              handleCancel(row);
            }
          },
        },
      ],
    });

  // Esc fecha o modal aberto no topo (os confirmes tratam o próprio Esc/Enter).
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (itemsManagerRequisition) setItemsManagerRequisition(null);
      else if (editItem) setEditItem(null);
      else if (viewItem) setViewItem(null);
      else if (historicoModalOpen) { setHistoricoModalOpen(false); setHistoricoItem(null); }
      else if (isNewOpen) setIsNewOpen(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [itemsManagerRequisition, editItem, viewItem, historicoModalOpen, isNewOpen]);

  // Exportação da lista para Excel (mesmo endpoint que o grid antigo usava).
  const handleExportarLista = useCallback(async () => {
    try {
      const res = await fetch('/api/requisicoesCompra/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colunas: [], filtros: {}, busca: search }),
      });
      if (!res.ok) throw new Error('Falha na exportação');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'requisicoes-compra.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar requisições:', e);
    }
  }, [search]);

  // Early return moved after all hooks to prevent hook order issues
  const shouldShowItemsManager = itemsManagerRequisition !== null;

  // Função para renderizar ações em lote dinâmicas baseadas no status
  const renderDynamicBulkActions = () => {
    
    if (selectedItems.size === 0) {
      return null;
    }


    const selectedRequisitions = data.filter(item => {
      const hasItem = selectedItems.has(item.id);
      return hasItem;
    });


    if (selectedRequisitions.length === 0) {
      return null;
    }

    // Analisa os status das requisições selecionadas
    const statusCounts = selectedRequisitions.reduce((acc, item) => {
      const status = item.statusRequisicao || '';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);


    const hasOnlyPending = Object.keys(statusCounts).length === 1 && 
                          (statusCounts['P'] || statusCounts['Pendente']);
    const hasOnlySubmitted = Object.keys(statusCounts).length === 1 && 
                           (statusCounts['S'] || statusCounts['Submetida']);
    const hasOnlyApproved = Object.keys(statusCounts).length === 1 && 
                          (statusCounts['A'] || statusCounts['Aprovada']);


    // Determina quais ações mostrar baseado no perfil e status
    const canSubmit = canSubmitRequisitions && hasOnlyPending;
    const canApprove = canApproveRequisitions && hasOnlySubmitted;
    const canReject = canApproveRequisitions && hasOnlySubmitted;


    // Se não há ações disponíveis, não mostra nada
    if (!canSubmit && !canApprove && !canReject) {
      return null;
    }

    
    return (
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
              {selectedItems.size} requisição(ões) selecionada(s)
            </span>
            {selectedStatus && (
              <span className="text-green-600 dark:text-green-400 text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                Status bloqueado: {selectedStatus === 'P' ? 'Pendente' : selectedStatus === 'S' ? 'Submetida' : selectedStatus === 'A' ? 'Aprovada' : selectedStatus}
              </span>
            )}
            {Object.keys(statusCounts).length > 1 && (
              <span className="text-orange-600 dark:text-orange-400 text-xs">
                (Status diferentes - ações limitadas)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canSubmit && (
              <DefaultButton
                onClick={() => handleBulkSubmit()}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                text="Submeter Selecionadas"
                icon={<Send size={14} />}
              />
            )}
            {canApprove && (
              <DefaultButton
                onClick={() => handleBulkApprove()}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                text="Aprovar Selecionadas"
                icon={<CheckCircle size={14} />}
              />
            )}
            {canReject && (
              <DefaultButton
                onClick={() => handleBulkReject()}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white"
                text="Reprovar Selecionadas"
                icon={<XCircle size={14} />}
              />
            )}
            {hasOnlyApproved && (
              <span className="px-3 py-1 text-xs bg-gray-400 text-white rounded opacity-50">
                Requisições já aprovadas
              </span>
            )}
            <DefaultButton
              onClick={() => {
                setSelectedItems(new Set());
                setSelectedStatus(null);
              }}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white"
              text="Limpar Seleção"
            />
          </div>
        </div>
      </div>
    );
  };

  // Renderizar ItemsManager se necessário - DEPOIS de todas as funções serem definidas
  if (shouldShowItemsManager && itemsManagerRequisition) {
    return (
      <RequisitionItemsManager
        requisitionId={itemsManagerRequisition.id}
        requisitionVersion={itemsManagerRequisition.versao}
        requisitionData={{
          req_id_composto: itemsManagerRequisition.requisicao || '',
          req_status: itemsManagerRequisition.statusRequisicao || '',
          fornecedor_nome: itemsManagerRequisition.fornecedorNome || '',
          comprador_nome: itemsManagerRequisition.compradorNome || '',
        }}
        onBack={() => setItemsManagerRequisition(null)}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="px-4 w-full flex-1 flex flex-col overflow-hidden">
        <header className="mb-0 flex-shrink-0">
          
          {showNewButton && (
            <div className="flex justify-end mb-4 mr-6 ml-6">
              {/* Botões do Header */}
              <div className="flex items-center gap-2">
                  <DefaultButton
                    onClick={() => setIsNewOpen(true)}
                    className="flex items-center gap-0 px-3 py-2 text-sm h-8"
                    text="Nova Requisição"
                    icon={<PlusIcon size={18} />}
                  />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Budget Control - Só aparece quando botão Budget é clicado */}
          {showBudget && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">💰 Budget do Mês:</span>
                    <span className="ml-2 font-semibold text-green-600">R$ 50.000,00</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">📊 Utilizado:</span>
                    <span className="ml-2 font-semibold text-blue-600">R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">💳 Disponível:</span>
                    <span className={`ml-2 font-semibold ${(50000 - calcularValorTotal()) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {(50000 - calcularValorTotal()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {calcularValorTotal() > 50000 && (
                    <div className="text-red-600 text-sm font-medium">
                      ⚠️ Budget excedido!
                    </div>
                  )}
                  <DefaultButton
                    onClick={() => setShowBudget(false)}
                    className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white"
                    text="✕"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ações em lote dinâmicas baseadas no status */}
          {renderDynamicBulkActions()}
        </header>

        {/* Conteúdo de requisições de compra */}
          <div className="flex-1 min-h-20 flex flex-col">
          <DataTable
            screenKey="compras-requisicoes"
            userName={user?.usuario}
            carregando={loading}
            headers={controlledHeaders}
            rows={rows}
            meta={meta}
            semColunaDeAcaoPadrao
            persistPerPage={false}
            ordenacaoServidor
            onSort={(campo, direcao) => {
              setOrdenacao({ campo, direcao });
              setPage(1);
            }}
            nonsortableColumns={['AÇÕES', 'selecionar']}
            onPageChange={setPage}
            onPerPageChange={handlePerPageChange}
            onColunaSubstituida={handleColumnChange}
            searchValue={search}
            onSearch={handleSearch}
            onSearchBlur={handleSearchBlur}
            onSearchKeyDown={handleSearchKeyDown}
            searchInputPlaceholder="Pesquisar por requisição, fornecedor, comprador..."
            colunasFiltro={colunasDbRequisicao.map((c) => c.campo)}
            onFiltroChange={handleFiltroChange}
            mostrarFiltrosSempre
            onExportarExcel={handleExportarLista}
            searchRightSlot={
              <div className="w-44">
                <SelectInput
                  name="statusRequisicao"
                  options={[
                    { value: 'todos', label: 'Todos os status' },
                    { value: 'P', label: 'Pendente' },
                    { value: 'S', label: 'Submetida' },
                    { value: 'A', label: 'Aprovada' },
                    { value: 'R', label: 'Rejeitada' },
                    { value: 'C', label: 'Cancelada' },
                    { value: 'L', label: 'Liberada' },
                  ]}
                  value={statusFiltro || 'todos'}
                  onValueChange={(v) => {
                    setStatusFiltro(v === 'todos' ? '' : v);
                    setPage(1);
                  }}
                />
              </div>
            }
            customHeaderActions={
              <button
                type="button"
                onClick={() => setBudgetModalOpen(true)}
                title="Budget"
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <DollarSign size={16} className="text-green-500 dark:text-green-400" />
                <span>Budget</span>
              </button>
            }
            rowClassName={(row) =>
              (row as any).__index === linhaSelecionada
                ? `bg-blue-100 dark:bg-blue-900/50 ${CLASSE_LINHA_ATIVA}`
                : ''
            }
            onRowClick={(row) =>
              setLinhaSelecionada((row as any).__index ?? -1)
            }
            columnLabels={colunasDbRequisicao.reduce((acc, col) => {
              acc[col.campo] = col.label;
              return acc;
            }, { 'AÇÕES': 'Ações', selecionar: 'Sel.' } as Record<string, string>)}
          />
          </div>
      </main>

      <NovaRequisicaoModal
        isOpen={isNewOpen}
        onClose={() => {
          setIsNewOpen(false);
          setDuplicateData(null); // Limpar dados de duplicação
        }}
        onSuccess={() => {
          setIsNewOpen(false);
          setDuplicateData(null); // Limpar dados de duplicação
          refetch();
        }}
        onRequisitionCreated={(requisition) => {
          setIsNewOpen(false);
          setDuplicateData(null); // Limpar dados de duplicação
          // Forçar atualização da primeira página para ver a nova requisição
          setPage(1);
          setTimeout(() => {
            refetch(); // Apenas recarrega a listagem, não abre tela de itens
          }, 500);
        }}
        initialData={duplicateData} // Passar dados para duplicação
      />

      {editItem && (
        <EditRequisitionModal
          isOpen
          requisition={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            setEditItem(null);
            refetch();
          }}
        />
      )}

      {viewItem && (
        <ViewRequisitionModal
          isOpen
          requisition={viewItem}
          onClose={() => setViewItem(null)}
        />
      )}

      <BudgetModal
        isOpen={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        valorUtilizado={calcularValorTotal()}
      />

      {historicoItem && (
        <HistoricoModal
          isOpen={historicoModalOpen}
          onClose={() => {
            setHistoricoModalOpen(false);
            setHistoricoItem(null);
          }}
          requisitionId={historicoItem.id}
          requisitionVersion={historicoItem.versao}
          requisitionNumber={historicoItem.requisicao}
        />
      )}

      {/* Modal central de confirmação (Submeter / Aprovar) */}
      {ConfirmacaoSalvarModal}

      {/* Modal central de REPROVAÇÃO (com motivo) — individual ou em lote */}
      {reprovarAlvo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-red-700 dark:text-red-300">
                  Reprovar requisição{reprovarAlvo.itens.length > 1 ? `ões (${reprovarAlvo.itens.length})` : ` ${reprovarAlvo.itens[0]?.requisicao || ''}`}
                </h3>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">
                  Informe o motivo da reprovação (opcional).
                </p>
              </div>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Motivo
              </label>
              <textarea
                autoFocus
                value={motivoReprovar}
                onChange={(e) => setMotivoReprovar(e.target.value)}
                rows={4}
                placeholder="Ex.: fora do orçamento, fornecedor não homologado..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={() => setReprovarAlvo(null)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReprovacao}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-2"
              >
                <XCircle size={16} />
                Reprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};