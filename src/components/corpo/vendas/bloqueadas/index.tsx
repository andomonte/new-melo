import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import {
  getVendasBloqueadas,
  VendaBloqueada,
  VendasBloqueadasResponse,
} from '@/data/vendas/bloqueadas';
import { CircleChevronDown, Eye, LockOpen, Keyboard } from 'lucide-react';
import DataTable from '@/components/common/DataTablePadrao';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import ModalVerItensVenda from '../centralVendas/ModalVerItensVenda';
import ModalAnaliseLiberacao from './ModalAnaliseLiberacao';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';

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

const VendasBloqueadasPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [vendasBloqueadas, setVendasBloqueadas] = useState<VendasBloqueadasResponse>({
    data: [],
    meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 },
  });

  const { user } = useContext(AuthContext) as AuthContextProps;
  const [userPermissions, setUserPermissions] = useState<{ editar: boolean }>({ editar: false });

  const [dropdownStates, setDropdownStates] = useState<{ [key: string]: boolean }>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{ [key: string]: { top: number; left: number } | null }>({});
  const [iconRotations, setIconRotations] = useState<{ [key: string]: boolean }>({});

  const [verItensOpen, setVerItensOpen] = useState(false);
  const [vendaParaVer, setVendaParaVer] = useState<VendaBloqueada | null>(null);
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const [vendaParaAnalise, setVendaParaAnalise] = useState<string | null>(null);
  const [linhaSelecionada, setLinhaSelecionada] = useState(-1);

  // ---------- Busca ----------
  const handleVendas = useCallback(async (p?: number, pp?: number, s?: string) => {
    setLoading(true);
    try {
      const data = await getVendasBloqueadas({
        page: p ?? page,
        perPage: pp ?? perPage,
        codvenda: s ?? search,
      });
      setVendasBloqueadas(data);
    } catch {
      toast({
        title: 'Erro ao carregar vendas bloqueadas',
        description: 'Não foi possível obter os dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, toast]);

  useEffect(() => {
    handleVendas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // ---------- Permissões ----------
  useEffect(() => {
    if (user?.permissoes) {
      let telaHref = sessionStorage.getItem('telaAtualMelo');
      let telaPerfil: Permissao | undefined;
      if (telaHref) {
        try { telaHref = JSON.parse(telaHref); } catch {}
        telaPerfil = user.permissoes.find((p) => p.tb_telas?.PATH_TELA === telaHref);
      }
      if (telaPerfil) {
        setUserPermissions({ editar: telaPerfil.editar || false });
      }
    }
  }, [user]);

  // ---------- Headers ----------
  const headers = ['ações', 'nrovenda', 'codcli', 'cliente', 'data_venda', 'valor_total', 'status'];
  const columnLabels: Record<string, string> = {
    ações: 'Ações',
    nrovenda: 'Nº Venda',
    codcli: 'Cód. Cliente',
    cliente: 'Cliente',
    data_venda: 'Data',
    valor_total: 'Valor Total',
    status: 'Status',
  };

  // ---------- Dropdown ----------
  const toggleDropdown = (vendaId: string, buttonElement: HTMLButtonElement) => {
    const wasOpen = dropdownStates[vendaId];
    closeAllDropdowns();
    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 180;
      const estimatedHeight = 120;
      let left = rect.right + window.scrollX + 5;
      if (window.innerWidth - rect.right < dropdownWidth) left = rect.left + window.scrollX - dropdownWidth;
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = spaceBelow < estimatedHeight && rect.top > spaceBelow
        ? rect.bottom + window.scrollY - estimatedHeight + 10
        : rect.top + window.scrollY;
      setDropdownStates({ [vendaId]: true });
      setIconRotations({ [vendaId]: true });
      setDropdownPositions({ [vendaId]: { top, left } });
    }
  };

  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  // ---------- Ações ----------
  const handleVerItensClick = (venda: VendaBloqueada) => {
    setVendaParaVer(venda);
    setVerItensOpen(true);
    closeAllDropdowns();
  };

  const handleAnalisarClick = (venda: VendaBloqueada) => {
    setVendaParaAnalise(venda.codvenda);
    setAnaliseOpen(true);
    closeAllDropdowns();
  };

  const handleCloseAnaliseModal = () => {
    setAnaliseOpen(false);
    setVendaParaAnalise(null);
  };

  const handleConfirmarLiberacao = async () => {
    if (!vendaParaAnalise) return;
    try {
      const { unblockVenda } = await import('@/data/vendas/bloqueadas');
      await unblockVenda({ codvenda: vendaParaAnalise, newStatus: 'L' });
      toast({ title: 'Sucesso!', description: `Venda ${vendaParaAnalise} liberada.` });
      handleCloseAnaliseModal();
      handleVendas();
    } catch {
      toast({ title: 'Erro ao liberar', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ---------- Atalhos ----------
  const linhaSelecionadaRef = useRef(linhaSelecionada);
  linhaSelecionadaRef.current = linhaSelecionada;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (analiseOpen || verItensOpen) return;
      const data = vendasBloqueadas.data;
      if (!data || data.length === 0) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const sel = linhaSelecionadaRef.current;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLinhaSelecionada((prev) => Math.min(prev + 1, data.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLinhaSelecionada((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (emInput) return;

      if (e.key === 'Enter' && sel >= 0 && userPermissions.editar) {
        e.preventDefault();
        handleAnalisarClick(data[sel]);
      } else if (e.key === 'v' && sel >= 0) {
        e.preventDefault();
        handleVerItensClick(data[sel]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [vendasBloqueadas.data, analiseOpen, verItensOpen, userPermissions]);

  // ---------- Click outside dropdown ----------
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      let shouldClose = false;
      for (const vendaId in dropdownStates) {
        if (dropdownStates[vendaId]) {
          const dd = dropdownRefs.current[vendaId];
          const btn = actionButtonRefs.current[vendaId];
          if (dd && !dd.contains(event.target as Node) && btn && !btn.contains(event.target as Node)) {
            shouldClose = true;
            break;
          }
        }
      }
      if (shouldClose) closeAllDropdowns();
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [dropdownStates, closeAllDropdowns]);

  // ---------- Rows ----------
  const rows = vendasBloqueadas.data?.map((v) => {
    const total = v.total ? parseFloat(v.total.toString()) : 0;
    const linha: Record<string, any> = {};

    headers.forEach((h) => {
      if (h === 'ações') {
        linha[h] = (
          <div className="relative flex items-center justify-center">
            <button
              ref={(el) => { if (el) actionButtonRefs.current[v.codvenda] = el; }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 ${iconRotations[v.codvenda] ? 'rotate-180' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleDropdown(v.codvenda, e.currentTarget); }}
            >
              <CircleChevronDown size={18} />
            </button>
            {dropdownStates[v.codvenda] && dropdownPositions[v.codvenda] &&
              createPortal(
                <div
                  ref={(el) => { if (el) dropdownRefs.current[v.codvenda] = el; }}
                  className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5"
                  style={{ position: 'absolute', top: dropdownPositions[v.codvenda]?.top, left: dropdownPositions[v.codvenda]?.left, minWidth: '180px', zIndex: 999 }}
                >
                  <div className="py-1" role="menu">
                    <button onClick={() => handleVerItensClick(v)} className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left" role="menuitem">
                      <Eye className="mr-2 text-blue-500" size={16} /> Ver Itens
                      <span className="ml-auto text-[10px] text-gray-400 pl-4">V</span>
                    </button>
                    {userPermissions.editar ? (
                      <button onClick={() => handleAnalisarClick(v)} className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left" role="menuitem">
                        <LockOpen className="mr-2 text-green-500" size={16} /> Analisar / Desbloquear
                        <span className="ml-auto text-[10px] text-gray-400 pl-4">Enter</span>
                      </button>
                    ) : null}
                  </div>
                </div>,
                document.body,
              )}
          </div>
        );
      } else if (h === 'nrovenda') {
        linha[h] = v.codvenda;
      } else if (h === 'codcli') {
        linha[h] = v.codcli || '-';
      } else if (h === 'cliente') {
        linha[h] = v.dbclien?.nomefant || v.dbclien?.nome || '-';
      } else if (h === 'data_venda') {
        linha[h] = v.data ? new Date(v.data).toLocaleDateString('pt-BR') : '-';
      } else if (h === 'valor_total') {
        linha[h] = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      } else if (h === 'status') {
        linha[h] = (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-900/50">
            Bloqueada
          </span>
        );
      }
    });
    return linha;
  });

  const vendaSelecionada = linhaSelecionada >= 0 && vendasBloqueadas.data?.[linhaSelecionada]
    ? vendasBloqueadas.data[linhaSelecionada] : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
          <main className="flex-1 flex flex-col p-4 overflow-hidden">
            <header className="mb-2">
              <div className="flex justify-between items-center mb-2 px-2">
                <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
                  Desbloqueio de Vendas
                </div>
              </div>
            </header>

            <div className="flex-1 min-h-20 flex flex-col">
              <DataTable
                screenKey="vendas-bloqueadas"
                userName={user?.usuario}
                carregando={loading}
                headers={headers}
                rows={rows || []}
                meta={vendasBloqueadas.meta}
                columnLabels={columnLabels}
                semColunaDeAcaoPadrao={true}
                nonsortableColumns={['ações']}
                filtrarSomenteAoConfirmar={true}
                onPageChange={(newPage) => { if (newPage !== page) setPage(newPage); }}
                onPerPageChange={(newPerPage) => { if (newPerPage !== perPage) setPerPage(newPerPage); }}
                searchValue={search}
                onSearch={(e) => setSearch(e.target.value)}
                onSearchKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVendas(1, perPage, search);
                    setPage(1);
                  }
                }}
                onSearchBlur={() => {
                  if (search.trim().length >= 3 && search !== vendasBloqueadas.data?.[0]?.codvenda) {
                    handleVendas(1, perPage, search);
                    setPage(1);
                  }
                }}
                searchInputPlaceholder="Pesquisar e pressione Enter..."
                noDataMessage="Nenhuma venda bloqueada encontrada."
                rowClassName={(_row, idx) => idx === linhaSelecionada ? 'bg-blue-50 dark:bg-blue-950' : ''}
                onRowClick={(row: any) => {
                  const idx = vendasBloqueadas.data?.findIndex((v) => v.codvenda === row.nrovenda) ?? -1;
                  setLinhaSelecionada(idx);
                }}
              />
            </div>

            <ModalVerItensVenda
              isOpen={verItensOpen}
              onClose={() => { setVerItensOpen(false); setVendaParaVer(null); }}
              venda={vendaParaVer as any}
            />

            {vendaParaAnalise ? (
              <ModalAnaliseLiberacao
                isOpen={analiseOpen}
                onClose={handleCloseAnaliseModal}
                codvenda={vendaParaAnalise}
                onLiberar={handleConfirmarLiberacao}
              />
            ) : null}
          </main>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="text-xs text-gray-500">
          {vendaSelecionada ? `Venda: ${vendaSelecionada.codvenda}` : 'Nenhuma selecionada (use ↑↓)'}
        </ContextMenuLabel>
        <ContextMenuItem
          disabled={!vendaSelecionada}
          onClick={() => { if (vendaSelecionada) handleVerItensClick(vendaSelecionada); }}
        >
          <Eye size={14} className="mr-2" /> Ver Itens
          <span className="ml-auto text-[10px] text-gray-400">V</span>
        </ContextMenuItem>
        {userPermissions.editar ? (
          <ContextMenuItem
            disabled={!vendaSelecionada}
            onClick={() => { if (vendaSelecionada) handleAnalisarClick(vendaSelecionada); }}
          >
            <LockOpen size={14} className="mr-2" /> Analisar / Desbloquear
            <span className="ml-auto text-[10px] text-gray-400">Enter</span>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuLabel className="text-xs text-gray-400">
          <Keyboard size={12} className="inline mr-1" />
          ↑↓ navegar | Enter analisar | V ver itens
        </ContextMenuLabel>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default VendasBloqueadasPage;
