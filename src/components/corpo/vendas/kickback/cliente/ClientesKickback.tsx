import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Trash2, Upload } from 'lucide-react';

// --- Imports ---
import DataTable from '@/components/common/DataTablePromocao';
import { DefaultButton } from '@/components/common/Buttons';
import Carregamento from '@/utils/carregamento';
import { useToast } from '@/hooks/use-toast';
import ImportKickbackModal from '../ImportKickbackModal';

import { AuthContext } from '@/contexts/authContexts';

import {
  ClientesKickbackResponse,
  getClientesKickback,
  deleteClienteKickback,
  ClienteKickback,
} from '@/data/kickback/clientes/cliente_kickback';

// --- Tipos de Permissão e Usuário (Definição local completa) ---
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

// --- CORREÇÃO 2: A interface 'AuthContextProps' foi removida pois não era necessária ---

// --- Modal de Confirmação de Exclusão (sem alterações) ---
interface ConfirmDeleteClienteKickbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteCod: string | null;
  onConfirm: (cod: string) => Promise<void>;
}
// ... (código do modal continua o mesmo)
const ConfirmDeleteClienteKickbackModal: React.FC<
  ConfirmDeleteClienteKickbackModalProps
> = ({ isOpen, onClose, clienteCod, onConfirm }) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!clienteCod) return;
    setDeleteStatus('loading');
    try {
      await onConfirm(clienteCod);
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteStatus('idle');
        onClose();
      }, 1500);
    } catch (error: any) {
      setDeleteStatus('error');
      setErrorMessage(
        error.message ||
          'Ocorreu um problema ao deletar. Tente novamente mais tarde.',
      );
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setDeleteStatus('idle');
        setErrorMessage(null);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg w-[90%] max-w-lg flex flex-col">
        {deleteStatus === 'idle' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Confirmar Exclusão
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Tem certeza que deseja remover permanentemente o cliente kickback
              com código &quot;{clienteCod}&quot;?
            </p>
            <div className="flex justify-end gap-2">
              <DefaultButton
                onClick={onClose}
                variant="cancel"
                text="Cancelar"
              />
              <DefaultButton
                onClick={handleConfirm}
                variant="confirm"
                text="Sim, Excluir"
              />
            </div>
          </>
        )}
        {deleteStatus === 'loading' && <Carregamento texto="Deletando..." />}
        {deleteStatus === 'success' && (
          <div className="flex items-center justify-center py-4 text-green-600 dark:text-green-400">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            Deletado com sucesso!
          </div>
        )}
        {deleteStatus === 'error' && (
          <>
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">
              Erro ao Excluir
            </h2>
            <p className="text-red-500 dark:text-red-400 mb-6">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <DefaultButton onClick={onClose} variant="cancel" text="Fechar" />
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

// --- Componente Principal da Página ---
const ClientesKickbackPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [clientesKickback, setClientesKickback] =
    useState<ClientesKickbackResponse>({
      data: [],
      meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 },
    });
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [codClienteDeletar, setCodClienteDeletar] = useState<string | null>(
    null,
  );
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // --- CORREÇÃO 3: Tipo aplicado diretamente na desestruturação ---
  const { user } = useContext(AuthContext) as { user: User | null };

  const { toast } = useToast();
  const [userPermissions, setUserPermissions] = useState({
    cadastrar: false,
    editar: false,
    remover: false,
    consultar: true,
  });
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

  const handleClientesKickback = useCallback(async () => {
    try {
      const data = await getClientesKickback({ page, perPage, search });
      setClientesKickback(data);
    } catch (error) {
      console.error('Erro ao buscar clientes kickback:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível obter os clientes. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [page, perPage, search, toast]);

  const handleSearch = useDebouncedCallback(() => {
    handleClientesKickback();
  }, 300);

  const handleConfirmDelete = async (codToDelete: string) => {
    try {
      await deleteClienteKickback(Number(codToDelete));
      toast({
        title: 'Sucesso',
        description: `Cliente Kickback ${codToDelete} deletado com sucesso!`,
        variant: 'default',
      });
      await handleClientesKickback();
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar',
        description: error.message || 'Ocorreu um erro ao deletar o cliente.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handlePerPageChange = (newPerPage: number) => setPerPage(newPerPage);

  const handleDeletarClick = (codcli: string) => {
    setCodClienteDeletar(codcli);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleCancelDelete = () => {
    setDeletarOpen(false);
    setCodClienteDeletar(null);
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const toggleDropdown = (codcli: string, buttonElement: HTMLButtonElement) => {
    const isOpening = !dropdownStates[codcli];
    closeAllDropdowns();
    if (isOpening) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownStates({ [codcli]: true });
      setIconRotations({ [codcli]: true });
      setDropdownPositions({
        [codcli]: {
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX - 120,
        },
      });
    }
  };

  useEffect(() => {
    handleClientesKickback();
  }, [handleClientesKickback]);

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        const telaHref = sessionStorage.getItem('telaAtualMelo') || '';
        const telaPerfil = user.permissoes.find(
          (p) => p.tb_telas?.PATH_TELA === telaHref.replace(/"/g, ''),
        );
        if (telaPerfil) {
          setUserPermissions({
            cadastrar: telaPerfil.cadastrar || false,
            editar: telaPerfil.editar || false,
            remover: telaPerfil.remover || false,
            consultar: telaPerfil.consultar || true,
          });
        }
      }
    };
    checkPermissions();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = true;
      for (const id in dropdownStates) {
        if (dropdownStates[id]) {
          const dropdownNode = dropdownRefs.current[id];
          const buttonNode = actionButtonRefs.current[id];
          if (
            (dropdownNode && dropdownNode.contains(event.target as Node)) ||
            (buttonNode && buttonNode.contains(event.target as Node))
          ) {
            shouldClose = false;
            break;
          }
        }
      }
      if (shouldClose) closeAllDropdowns();
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [dropdownStates]);

  const headers = ['Código', 'Classificação', 'Status', 'Ações'];

  const rows = clientesKickback.data?.map((cliente: ClienteKickback) => ({
    codcli: cliente.codcli,
    class: cliente.class || 'N/A',
    status: (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          cliente.status === 'A'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}
      >
        {cliente.status === 'A' ? 'Ativo' : 'Inativo'}
      </span>
    ),
    action: (
      <div className="flex justify-center">
        <button
          ref={(el) => {
            if (el) actionButtonRefs.current[cliente.codcli] = el;
          }}
          onClick={(e) => toggleDropdown(cliente.codcli, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          style={{
            transform: iconRotations[cliente.codcli]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[cliente.codcli] &&
          dropdownPositions[cliente.codcli] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) dropdownRefs.current[cliente.codcli] = el;
              }}
              className="absolute bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 py-1 z-10"
              style={{
                top: dropdownPositions[cliente.codcli]?.top,
                left: dropdownPositions[cliente.codcli]?.left,
                minWidth: '140px',
              }}
            >
              {userPermissions.remover && (
                <button
                  onClick={() => handleDeletarClick(cliente.codcli)}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-100 dark:hover:bg-red-700"
                  role="menuitem"
                >
                  <Trash2 className="mr-2 text-red-500" size={16} />
                  Deletar
                </button>
              )}
            </div>,
            document.body,
          )}
      </div>
    ),
  }));

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-gray-800">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between items-center mb-4 mx-6">
            <h1 className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Clientes Kickback
            </h1>
            <div className="flex gap-2">
              {userPermissions.cadastrar && (
                <DefaultButton
                  onClick={() => setIsImportModalOpen(true)}
                  text="Importar Excel"
                  icon={<Upload size={18} />}
                />
              )}
              {userPermissions.cadastrar && (
                <DefaultButton
                  onClick={() =>
                    toast({
                      title: 'Aviso',
                      description: 'Função "Novo" não implementada.',
                    })
                  }
                  text="Novo"
                  icon={<PlusIcon size={18} />}
                />
              )}
            </div>
          </div>
        </header>

        <DataTable
          headers={headers}
          rows={rows || []}
          meta={clientesKickback.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar por código ou classificação..."
        />
      </main>

      <ConfirmDeleteClienteKickbackModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        clienteCod={codClienteDeletar}
        onConfirm={handleConfirmDelete}
      />

      <ImportKickbackModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          toast({
            title: 'Importação Concluída',
            description: 'A lista de clientes será atualizada.',
          });
          handleClientesKickback();
        }}
      />
    </div>
  );
};

export default ClientesKickbackPage;
