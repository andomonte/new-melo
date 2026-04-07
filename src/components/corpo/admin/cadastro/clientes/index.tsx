import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
} from 'react';
import {
  Clientes,
  buscaClientes,
  getClientes,
  Cliente,
} from '@/data/clientes/clientes';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTableFiltro';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import ClientFormModal from '@/components/corpo/admin/cadastro/clientes/ClientFormModal';
import { ClientZoomModal } from '@/components/corpo/admin/cadastro/clientes/ClientZoomModal';
import { MudarClasseModal } from '@/components/corpo/admin/cadastro/clientes/MudarClasseModal';
import { AlterarBancoModal } from '@/components/corpo/admin/cadastro/clientes/AlterarBancoModal';
import { StatusCompraModal } from '@/components/corpo/admin/cadastro/clientes/StatusCompraModal';
import { IntervaloCompraModal } from '@/components/corpo/admin/cadastro/clientes/IntervaloCompraModal';
import { ExportExcelModal } from '@/components/corpo/admin/cadastro/clientes/ExportExcelModal';
import { GoPencil } from 'react-icons/go';
import {
  PlusIcon,
  CircleChevronDown,
  Eye,
  CreditCard,
  Building2,
  ShoppingCart,
  Calendar,
  FileDown,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';

// Tipos de permissão e usuário
export type Permissao = {
  cadastrar?: boolean;
  editar?: boolean;
  remover?: boolean;
  consultar?: boolean;
  grupoId: string;
  id: number;
  tb_telas: {
    CODIGO_TELA: number;
    PATH_TELA: string;
    NOME_TELA: string;
  };
};

type User = {
  usuario: string;
  perfil: string;
  obs: string;
  codusr: string;
  filial: string;
  permissoes?: Permissao[];
  funcoes?: string[];
};

interface AuthContextProps {
  user: User | null;
}

const ClientesPage = () => {
  // Estados principais
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [clientes, setClientes] = useState<Clientes>({} as Clientes);
  const [loading, setLoading] = useState(true);

  // Modal State - Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Cliente | null>(null);

  // Zoom Modal State
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [clientToZoom, setClientToZoom] = useState<Cliente | null>(null);

  // Bulk Actions Modal State
  const [isClasseModalOpen, setIsClasseModalOpen] = useState(false);
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);

  // Individual Actions Modal State
  const [isStatusCompraOpen, setIsStatusCompraOpen] = useState(false);
  const [isIntervaloCompraOpen, setIsIntervaloCompraOpen] = useState(false);
  const [clientForAction, setClientForAction] = useState<Cliente | null>(null);

  // Export Excel Modal State
  const [isExportExcelOpen, setIsExportExcelOpen] = useState(false);

  // Estados de filtros e colunas
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);
  const [colunasDb, setColunasDb] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Limite de colunas com persistência
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasClientes');
    return salvo ? parseInt(salvo, 10) : 5;
  });

  const [forceUpdate, setForceUpdate] = useState(0);
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;

  // Permissões do usuário
  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  // Seleção de clientes para ações coletivas
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    new Set(),
  );
  const [selectAll, setSelectAll] = useState(false);

  // Refs para dropdown customizado
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: string]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: string]: boolean;
  }>({});

  /**
   * Busca dados com base em search ou filtros
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (search) {
        response = await getClientes({ page, perPage, search });
      } else {
        response = await buscaClientes({ page, perPage, filtros });
      }

      setClientes(response);

      // Configura colunas dinâmicas
      if (response.data?.length > 0) {
        const colunasDinamicas = Object.keys(response.data[0]).filter(
          (coluna) => !['selecionar', 'ações'].includes(coluna.toLowerCase()),
        );

        const colunasFiltradas = colunasDinamicas.slice(0, limiteColunas);
        setColunasDb(colunasDinamicas);

        // Headers: selecionar, ações, e colunas dinâmicas
        setHeaders(['selecionar', 'ações', ...colunasFiltradas]);
      } else {
        setHeaders(['selecionar', 'ações']);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: 'Erro ao carregar clientes',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, filtros, limiteColunas, toast]);

  /**
   * Busca dados ao montar ou quando dependências mudarem
   */
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, forceUpdate]);

  /**
   * Persiste headers selecionados no localStorage
   */
  useEffect(() => {
    if (headers.length > 0) {
      localStorage.setItem(
        'headersSelecionadosClientes',
        JSON.stringify(headers),
      );
    }
  }, [headers]);

  /**
   * Debounce para busca
   */
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setFiltros([]);
    setSearch(value);
  }, 500);

  /**
   * Verifica permissões do usuário
   */
  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        const telaHref = sessionStorage.getItem('telaAtualMelo');
        let parsedTelaHref: string | undefined;

        if (telaHref) {
          try {
            parsedTelaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('telaHref não era um JSON válido', e);
            parsedTelaHref = telaHref;
          }
        }

        const telaPerfil = user.permissoes.find(
          (permissao) => permissao.tb_telas?.PATH_TELA === parsedTelaHref,
        );

        if (telaPerfil) {
          setUserPermissions({
            cadastrar: telaPerfil.cadastrar || false,
            editar: telaPerfil.editar || false,
            remover: telaPerfil.remover || false,
            consultar: telaPerfil.consultar || true,
          });
        } else {
          setUserPermissions({
            cadastrar: false,
            editar: false,
            remover: false,
            consultar: true,
          });
        }
      }
    };

    checkPermissions();
  }, [user]);

  /**
   * Fecha todos os dropdowns abertos
   */
  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  /**
   * Alterna estado do dropdown customizado
   */
  const toggleDropdown = (id: string, buttonElement: HTMLButtonElement) => {
    const wasOpen = dropdownStates[id];
    closeAllDropdowns();

    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 180;
      const estimatedDropdownHeight = 250; // Altura estimada do dropdown

      // Calcula posição horizontal
      let leftPosition = rect.right + window.scrollX + 5;
      if (window.innerWidth - rect.right < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }

      // Calcula posição vertical - abre para cima se não houver espaço abaixo
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      let topPosition;

      if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
        // Abre para cima - posiciona para que o bottom do dropdown fique próximo ao topo do botão
        topPosition = rect.bottom + window.scrollY - estimatedDropdownHeight + 10;
      } else {
        // Abre para baixo (padrão)
        topPosition = rect.top + window.scrollY;
      }

      setDropdownStates({ [id]: true });
      setIconRotations({ [id]: true });
      setDropdownPositions({ [id]: { top: topPosition, left: leftPosition } });
    }
  };

  /**
   * Fecha dropdown ao clicar fora
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = true;
      for (const id in dropdownStates) {
        if (
          dropdownRefs.current[id]?.contains(event.target as Node) ||
          actionButtonRefs.current[id]?.contains(event.target as Node)
        ) {
          shouldClose = false;
          break;
        }
      }
      if (shouldClose) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [dropdownStates, closeAllDropdowns]);

  // ========== HANDLERS DE AÇÕES ==========

  /**
   * Editar cliente
   */
  const handleEdit = (cliente: Cliente) => {
    setClientToEdit(cliente);
    setIsModalOpen(true);
    closeAllDropdowns();
  };

  /**
   * Novo cliente
   */
  const handleNew = () => {
    setClientToEdit(null);
    setIsModalOpen(true);
  };

  /**
   * Sucesso em operação individual
   */
  const handleSuccess = () => {
    setForceUpdate((prev) => prev + 1);
  };

  /**
   * Sucesso em operação coletiva
   */
  const handleBulkUpdateSuccess = () => {
    setSelectedClients(new Set());
    setSelectAll(false);
    setForceUpdate((prev) => prev + 1);
  };

  /**
   * Zoom (Inspeção detalhada)
   */
  const handleZoom = (cliente: Cliente) => {
    setClientToZoom(cliente);
    setIsZoomOpen(true);
    closeAllDropdowns();
  };

  /**
   * Status de Compra
   */
  const handleStatusCompra = (cliente: Cliente) => {
    setClientForAction(cliente);
    setIsStatusCompraOpen(true);
    closeAllDropdowns();
  };

  /**
   * Intervalo de Compra
   */
  const handleIntervaloCompra = (cliente: Cliente) => {
    setClientForAction(cliente);
    setIsIntervaloCompraOpen(true);
    closeAllDropdowns();
  };

  /**
   * Mudar Classe de Pagamento (coletivo)
   */
  const handleMudarClassePagamento = () => {
    if (selectedClients.size === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        description: 'Selecione pelo menos um cliente.',
        variant: 'destructive',
      });
      return;
    }
    setIsClasseModalOpen(true);
  };

  /**
   * Alterar Banco (coletivo)
   */
  const handleAlterarBanco = () => {
    if (selectedClients.size === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        description: 'Selecione pelo menos um cliente.',
        variant: 'destructive',
      });
      return;
    }
    setIsBancoModalOpen(true);
  };

  /**
   * Exportar para Excel
   */
  const handleExportarExcel = () => {
    setIsExportExcelOpen(true);
  };

  /**
   * Selecionar Tudo (via API) - placeholder
   */
  const handleSelecionarTudo = () => {
    toast({
      title: 'Funcionalidade em desenvolvimento',
      description: 'Seleção de todos os registros via API.',
    });
  };

  // ========== FUNÇÕES DE SELEÇÃO ==========

  /**
   * Alterna seleção de um cliente
   */
  const toggleSelectClient = (codcli: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(codcli)) {
      newSelected.delete(codcli);
    } else {
      newSelected.add(codcli);
    }
    setSelectedClients(newSelected);
    setSelectAll(false);
  };

  /**
   * Seleciona/Desmarca todos da página atual
   */
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedClients(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(clientes.data?.map((c) => c.codcli) || []);
      setSelectedClients(allIds);
      setSelectAll(true);
    }
  };

  /**
   * Handler para substituição/troca de colunas
   */
  const handleColunaSubstituida = (
    colA: string,
    colB: string,
    tipo: 'swap' | 'replace' = 'replace',
  ) => {
    setHeaders((prev) => {
      const novaOrdem = [...prev];
      const indexA = novaOrdem.indexOf(colA);
      const indexB = novaOrdem.indexOf(colB);

      if (tipo === 'swap' && indexA !== -1 && indexB !== -1) {
        // Troca posições
        [novaOrdem[indexA], novaOrdem[indexB]] = [
          novaOrdem[indexB],
          novaOrdem[indexA],
        ];
      } else if (tipo === 'replace' && indexA !== -1) {
        // Substitui coluna
        const filteredHeaders = novaOrdem.filter((h) => h !== colB);
        const actualIndexA = filteredHeaders.indexOf(colA);
        if (actualIndexA !== -1) {
          filteredHeaders[actualIndexA] = colB;
        }
        return filteredHeaders;
      }

      return novaOrdem;
    });
  };

  // ========== MONTAGEM DAS LINHAS DA TABELA ==========

  const rows = clientes.data?.map((cliente) => {
    const linha: Record<string, any> = {};
    const id = cliente.codcli;

    headers?.forEach((coluna) => {
      const colunaLower = coluna.toLowerCase();

      // Coluna de seleção (checkbox)
      if (colunaLower === 'selecionar') {
        linha[coluna] = (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selectedClients.has(id)}
              onCheckedChange={() => toggleSelectClient(id)}
              aria-label={`Selecionar cliente ${cliente.nome || id}`}
            />
          </div>
        );
      }
      // Coluna de ações (dropdown customizado)
      else if (colunaLower === 'ações') {
        linha[coluna] = (
          <div className="relative flex items-center justify-center">
            <button
              ref={(el) => {
                if (el) actionButtonRefs.current[id] = el;
              }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 ${
                iconRotations[id] ? 'rotate-180' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDropdown(id, e.currentTarget);
              }}
              aria-label="Ações do cliente"
            >
              <CircleChevronDown size={18} />
            </button>

            {dropdownStates[id] &&
              dropdownPositions[id] &&
              createPortal(
                <div
                  ref={(el) => {
                    if (el) dropdownRefs.current[id] = el;
                  }}
                  className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  style={{
                    position: 'absolute',
                    top: dropdownPositions[id]?.top,
                    left: dropdownPositions[id]?.left,
                    minWidth: '180px',
                    zIndex: 999,
                  }}
                >
                  <div className="py-1" role="menu">
                    {/* ZOOM */}
                    <button
                      onClick={() => handleZoom(cliente)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Inspeção detalhada do cliente"
                    >
                      <Eye
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      ZOOM (Inspeção)
                    </button>

                    {/* Editar */}
                    {userPermissions.editar && (
                      <button
                        onClick={() => handleEdit(cliente)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      >
                        <GoPencil
                          className="mr-2 text-gray-400 dark:text-gray-500"
                          size={16}
                        />
                        Editar
                      </button>
                    )}

                    {/* Status de Compra */}
                    <button
                      onClick={() => handleStatusCompra(cliente)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Alterar status de compra individual"
                    >
                      <ShoppingCart
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Status de Compra
                    </button>

                    {/* Intervalo de Compra */}
                    <button
                      onClick={() => handleIntervaloCompra(cliente)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      title="Consultar compras por período"
                    >
                      <Calendar
                        className="mr-2 text-gray-400 dark:text-gray-500"
                        size={16}
                      />
                      Intervalo de Compra
                    </button>
                  </div>
                </div>,
                document.body,
              )}
          </div>
        );
      }
      // Demais colunas (dados do cliente)
      else {
        linha[coluna] = cliente[coluna as keyof typeof cliente] ?? '';
      }
    });

    return linha;
  });

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        {/* Cabeçalho */}
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
                Clientes
              </div>
              {selectedClients.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({selectedClients.size} selecionado
                  {selectedClients.size > 1 ? 's' : ''})
                </span>
              )}
            </div>

            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={handleNew}
                className="flex items-center gap-0 px-3 py-2 text-sm h-8"
                text="Novo"
                icon={<PlusIcon size={18} />}
              />
            )}
          </div>
        </header>

        {/* DataTable */}
        <DataTable
          carregando={loading}
          headers={headers}
          rows={rows || []}
          semColunaDeAcaoPadrao={true}
          onColunaSubstituida={handleColunaSubstituida}
          meta={clientes.meta}
          // Paginação
          onPageChange={setPage}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          // Busca
          onSearch={(e) => debouncedSearch(e.target.value)}
          onSearchBlur={() => {}}
          onSearchKeyDown={() => {}}
          searchInputPlaceholder="Pesquisar por código, nome, fantasia ou CPF/CNPJ..."
          // Filtros
          colunasFiltro={colunasDb}
          onFiltroChange={(novosFiltros) => {
            setPage(1);
            setSearch('');
            setFiltros(novosFiltros);
          }}
          // Limite de colunas
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem(
              'limiteColunasClientes',
              novoLimite.toString(),
            );
          }}
          // Ações customizadas no header
          customHeaderActions={
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Ações Coletivas
              </DropdownMenuLabel>

              <DropdownMenuItem onClick={handleMudarClassePagamento}>
                <CreditCard className="mr-2 size-4 text-purple-500 dark:text-purple-300" />
                Mudar Classe de Pagamento
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleAlterarBanco}>
                <Building2 className="mr-2 size-4 text-indigo-500 dark:text-indigo-300" />
                Alterar Banco de Cliente
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleExportarExcel}>
                <FileDown className="mr-2 size-4 text-green-500 dark:text-green-300" />
                Exportar para Excel
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Seleção
              </DropdownMenuLabel>

              <DropdownMenuItem onClick={toggleSelectAll}>
                <Checkbox
                  checked={selectAll}
                  className="mr-2 size-4 pointer-events-none"
                />
                {selectAll ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleSelecionarTudo}>
                <ShoppingCart className="mr-2 size-4 text-cyan-500 dark:text-cyan-300" />
                Selecionar Tudo (API)
              </DropdownMenuItem>
            </>
          }
        />
      </main>

      {/* Modal Cadastrar/Editar */}
      <ClientFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientToEdit={clientToEdit}
        onSuccess={handleSuccess}
      />

      {/* Modal Zoom (Inspeção) */}
      <ClientZoomModal
        isOpen={isZoomOpen}
        onClose={() => {
          setIsZoomOpen(false);
          setClientToZoom(null);
        }}
        cliente={clientToZoom}
      />

      {/* Modal Mudar Classe */}
      <MudarClasseModal
        isOpen={isClasseModalOpen}
        onClose={() => setIsClasseModalOpen(false)}
        selectedClients={selectedClients}
        onSuccess={handleBulkUpdateSuccess}
      />

      {/* Modal Alterar Banco */}
      <AlterarBancoModal
        isOpen={isBancoModalOpen}
        onClose={() => setIsBancoModalOpen(false)}
        selectedClients={selectedClients}
        onSuccess={handleBulkUpdateSuccess}
      />

      {/* Modal Status de Compra */}
      <StatusCompraModal
        isOpen={isStatusCompraOpen}
        onClose={() => {
          setIsStatusCompraOpen(false);
          setClientForAction(null);
        }}
        cliente={clientForAction}
        onSuccess={handleSuccess}
      />

      {/* Modal Intervalo de Compra */}
      <IntervaloCompraModal
        isOpen={isIntervaloCompraOpen}
        onClose={() => {
          setIsIntervaloCompraOpen(false);
          setClientForAction(null);
        }}
        cliente={clientForAction}
      />

      {/* Modal Exportar Excel */}
      <ExportExcelModal
        isOpen={isExportExcelOpen}
        onClose={() => setIsExportExcelOpen(false)}
        colunas={colunasDb}
        colunasVisiveis={headers}
        filtros={filtros}
        search={search}
        selectedClients={selectedClients}
      />
    </div>
  );
};

export default ClientesPage;
