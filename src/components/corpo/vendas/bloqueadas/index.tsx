// components/corpo/vendas/bloqueadas/index.tsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  getVendasBloqueadas,
  unblockVenda,
  VendaBloqueada,
  VendasBloqueadasResponse,
} from '@/data/vendas/bloqueadas';
import { useDebounce } from 'use-debounce';
import { CircleChevronDown, Eye, LockOpen } from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
// AVISO: Certifique-se que o caminho para o Modal está correto a partir da sua nova pasta
import ModalVerItensVenda from '../centralVendas/ModalVerItensVenda';
import ModalAnaliseLiberacao from './ModalAnaliseLiberacao';

// Tipos de permissão e usuário (mantidos para consistência)
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
  // ... (toda a definição de estados permanece a mesma) ...
  const [codVenda, setCodVenda] = useState<string>('');
  const [debouncedCodvendFilter] = useDebounce(codVenda, 500);
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { toast } = useToast();

  const [vendasBloqueadas, setVendasBloqueadas] =
    useState<VendasBloqueadasResponse>({
      data: [],
      meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 },
    });

  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    editar: boolean;
  }>({ editar: false });

  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: string]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: string]: boolean;
  }>({});

  const [verItensOpen, setVerItensOpen] = useState(false);
  const [vendaParaVer, setVendaParaVer] = useState<VendaBloqueada | null>(null);

  // Estados para o modal de análise de liberação
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const [vendaParaAnalise, setVendaParaAnalise] = useState<string | null>(null);

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleVendas = async () => {
    try {
      const data = await getVendasBloqueadas({
        page,
        perPage,
        codvenda: debouncedCodvendFilter,
      });
      setVendasBloqueadas(data);
    } catch {
      toast({
        title: 'Erro ao carregar vendas bloqueadas',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    handleVendas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, debouncedCodvendFilter]);
  // ... (outros useEffects e funções auxiliares permanecem os mesmos) ...
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCodvendFilter]);

  useEffect(() => {
    if (user?.permissoes) {
      let telaHref = sessionStorage.getItem('telaAtualMelo');
      let telaPerfil: Permissao | undefined;
      if (telaHref) {
        try {
          telaHref = JSON.parse(telaHref);
        } catch (e) {
          console.warn('telaHref não era um JSON válido', e);
        }
        telaPerfil = user.permissoes.find(
          (p) => p.tb_telas?.PATH_TELA === telaHref,
        );
      }
      if (telaPerfil) {
        setUserPermissions({
          editar: telaPerfil.editar || false,
        });
      }
    }
  }, [user]);

  const headers = [
    'Código',
    'Cliente',
    'Data',
    'Valor Total',
    'Status',
    'Ações',
  ];

  const toggleDropdown = (
    vendaId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...Object.keys(prevStates).reduce(
        (acc, key) => ({ ...acc, [key]: false }),
        {},
      ),
      [vendaId]: !prevStates[vendaId],
    }));
    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [vendaId]: !prevRotations[vendaId],
    }));
    if (!dropdownStates[vendaId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions({
        [vendaId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (150 - rect.width) + window.scrollX,
        },
      });
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleVerItensClick = (venda: VendaBloqueada) => {
    setVendaParaVer(venda);
    setVerItensOpen(true);
    closeAllDropdowns();
  };

  // Abrir modal de análise para liberação
  const handleAnalisarClick = (venda: VendaBloqueada) => {
    setVendaParaAnalise(venda.codvenda);
    setAnaliseOpen(true);
    closeAllDropdowns();
  };

  // Fechar modal de análise
  const handleCloseAnaliseModal = () => {
    setAnaliseOpen(false);
    setVendaParaAnalise(null);
  };

  // Confirmar liberação (chamado pelo modal após análise)
  const handleConfirmarLiberacao = async () => {
    if (!vendaParaAnalise) return;

    try {
      await unblockVenda({
        codvenda: vendaParaAnalise,
        newStatus: 'L', // 'L' para Liberada
      });

      toast({
        title: 'Sucesso!',
        description: `A venda ${vendaParaAnalise} foi liberada.`,
      });

      handleCloseAnaliseModal();
      handleVendas();
    } catch (error) {
      toast({
        title: 'Erro ao liberar',
        description: 'Não foi possível completar a operação. Tente novamente.',
        variant: 'destructive',
      });
      console.error('Falha ao liberar venda:', error);
    }
  };

  // Função legada de desbloqueio (mantida para compatibilidade, mas agora abre modal)
  const handleDesbloquearClick = (venda: VendaBloqueada) => {
    handleAnalisarClick(venda);
  };

  const handleCloseVerItensModal = () => {
    setVerItensOpen(false);
    setVendaParaVer(null);
  };

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      let shouldClose = false;
      for (const vendaId in dropdownStates) {
        if (dropdownStates[vendaId]) {
          const dropdownNode = dropdownRefs.current[vendaId];
          const actionButtonNode = actionButtonRefs.current[vendaId];
          if (
            dropdownNode &&
            !dropdownNode.contains(_event.target as Node) &&
            actionButtonNode &&
            !actionButtonNode.contains(_event.target as Node)
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

  // O restante do seu componente (a parte do `return` com o JSX) permanece o mesmo.
  // A função `onClick` do botão 'Desbloquear' já está chamando `handleDesbloquearClick`.
  const rows = vendasBloqueadas.data?.map((vendaItem) => {
    const valorNumerico = vendaItem.total
      ? parseFloat(vendaItem.total.toString())
      : 0;

    return {
      codvenda: vendaItem.codvenda,
      codcliente:
        vendaItem.dbclien?.nomefant ||
        vendaItem.dbclien?.nome ||
        vendaItem.codcli,
      data_venda: vendaItem.data
        ? new Date(vendaItem.data).toLocaleDateString('pt-BR')
        : 'N/A',
      valor_total: valorNumerico.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      status: (
        <span className="px-2.5 py-1 text-sm font-semibold text-amber-800 bg-amber-100 dark:text-amber-100 dark:bg-amber-900/50 rounded-full">
          Bloqueada
        </span>
      ),
      action: (
        <div className="relative">
          <button
            ref={(el) => {
              if (el) actionButtonRefs.current[vendaItem.codvenda] = el;
            }}
            onClick={(e) => toggleDropdown(vendaItem.codvenda, e.currentTarget)}
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[vendaItem.codvenda]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
          {dropdownStates[vendaItem.codvenda] &&
            dropdownPositions[vendaItem.codvenda] &&
            createPortal(
              <div
                key={`portal-dropdown-${vendaItem.codvenda}`}
                ref={(el) => {
                  if (el) dropdownRefs.current[vendaItem.codvenda] = el;
                }}
                className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
                style={{
                  position: 'absolute',
                  top: dropdownPositions[vendaItem.codvenda]?.top,
                  left: dropdownPositions[vendaItem.codvenda]?.left,
                  minWidth: '144px',
                  borderRadius: '0.375rem',
                  boxShadow:
                    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                  zIndex: 1000,
                }}
              >
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    key={`view-items-${vendaItem.codvenda}`}
                    onClick={() => handleVerItensClick(vendaItem)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                    role="menuitem"
                  >
                    <Eye
                      className="mr-2 text-blue-500 dark:text-blue-400"
                      size={16}
                    />
                    Ver Itens
                  </button>
                  {userPermissions.editar && (
                    <button
                      key={`unblock-${vendaItem.codvenda}`}
                      onClick={() => handleDesbloquearClick(vendaItem)}
                      className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                      role="menuitem"
                    >
                      <LockOpen
                        className="mr-2 text-green-500 dark:text-green-400"
                        size={16}
                      />
                      Desbloquear
                    </button>
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>
      ),
    };
  });

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Desbloqueio de Vendas
            </div>
          </div>
        </header>
        <DataTable
          headers={headers}
          rows={rows}
          meta={vendasBloqueadas.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => setCodVenda(e.target.value)}
          searchInputPlaceholder="Pesquisar por Código da Venda..."
        />
      </main>

      <ModalVerItensVenda
        isOpen={verItensOpen}
        onClose={handleCloseVerItensModal}
        venda={vendaParaVer as any} // Cast para 'any' para garantir compatibilidade com o modal reutilizado
      />

      {/* Modal de Análise para Liberação */}
      {vendaParaAnalise && (
        <ModalAnaliseLiberacao
          isOpen={analiseOpen}
          onClose={handleCloseAnaliseModal}
          codvenda={vendaParaAnalise}
          onLiberar={handleConfirmarLiberacao}
        />
      )}
    </div>
  );
};

export default VendasBloqueadasPage;
