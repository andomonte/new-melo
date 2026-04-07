import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
} from 'react';
import {
  LocaisPecas,
  getLocaisPecas,
  deletarLocalPeca,
  LocalPeca,
} from '@/data/locaisPecas/locaisPecas';
import { Meta } from '@/data/common/meta';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';

import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';
import CadastrarLocalPecaModal from './modalCadastrarLocalPeca';
import EditarLocalPecaModal from './modalEditarLocalPeca';
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

interface ConfirmDeleteLocalPecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  localId?: string | null;
  onConfirm: (id: string) => Promise<void>;
}

const ConfirmDeleteLocalPecaModal: React.FC<
  ConfirmDeleteLocalPecaModalProps
> = ({ isOpen, onClose, localId, onConfirm }) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (localId !== null && localId !== undefined) {
      try {
        await onConfirm(localId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar o Local da Peça. Tente mais tarde ou comunique a equipe técnica.',
        );
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[80%] h-[60%] flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {deleteStatus === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que deseja remover permanentemente o local da peça
                com ID &quot;{localId}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando o Local da Peça..." />
            </div>
          )}
          {deleteStatus === 'success' && (
            <div className="flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-500 mr-2"
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
              <p className="text-lg font-semibold text-green-600">
                Deletado com sucesso!
              </p>
            </div>
          )}
          {deleteStatus === 'error' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">
                Erro ao Excluir
              </h2>
              <p className="text-red-500 dark:text-red-400 mb-4">
                {errorMessage}
              </p>
            </div>
          )}
        </div>
        {(deleteStatus === 'idle' || deleteStatus === 'error') && (
          <div className="flex justify-end gap-2">
            {deleteStatus === 'error' && (
              <DefaultButton
                onClick={() => setDeleteStatus('idle')}
                variant="secondary"
                text="Fechar"
              />
            )}
            {deleteStatus === 'idle' && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LocaisPecasPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Contador para forçar refresh
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [idLocalDeletar, setIdLocalDeletar] = useState<string | null>(null);
  const [localParaEditar, setLocalParaEditar] = useState<LocalPeca | null>(
    null,
  );
  const [locaisPecas, setLocaisPecas] = useState<LocaisPecas>({
    data: [],
    meta: {} as Meta,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset para primeira página ao mudar items por página
  }, []);

  const handleSearch = useDebouncedCallback(() => {
    setPage(1); // Reset para primeira página ao buscar
  }, 300);

  // useEffect para carregar dados quando page, perPage, search ou refreshTrigger mudam
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await getLocaisPecas({ page, perPage, search });
        setLocaisPecas(data);
      } catch (error) {
        console.error('🚨 Erro ao buscar locais de peças:', error);
        // Toast com ref para não criar dependência circular
        toast({
          title: 'Erro ao carregar locais de peças',
          description:
            'Não foi possível obter os dados. Verifique sua conexão.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, refreshTrigger]); // toast removido intencionalmente

  // useEffect inicial apenas para dismiss
  useEffect(() => {
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        let telaHref = sessionStorage.getItem('telaAtualMelo');
        let telaPerfil: Permissao | undefined;

        if (telaHref) {
          try {
            telaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('telaHref não era um JSON válido', e);
          }
          telaPerfil = user.permissoes.find(
            (permissao) => permissao.tb_telas?.PATH_TELA === telaHref,
          );
        }

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
          toast({
            variant: 'destructive',
            title: 'Erro de Permissão',
            description: 'Você não tem permissão para acessar esta página.',
          });
        }
      } else {
        setUserPermissions({
          cadastrar: false,
          editar: false,
          remover: false,
          consultar: true,
        });
        toast({
          variant: 'destructive',
          title: 'Erro de Permissão',
          description: 'Você não tem permissão para acessar esta página.',
        });
      }
    };
    checkPermissions();
  }, [user, toast]);

  const headers = [
    'ID Local',
    'Armazém',
    'Descrição',
    'Tipo',
    'Capacidade',
    'Unidade',
    'Ações',
  ];

  const toggleDropdown = (
    localId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [localId]: !prevStates[localId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [localId]: !prevRotations[localId],
    }));

    if (!dropdownStates[localId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [localId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [localId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleEditarClick = useCallback((local: LocalPeca) => {
    setLocalParaEditar(local);
    setEditarOpen(true);
    closeAllDropdowns();
  }, []);

  const handleDeletarClick = useCallback((localId: string) => {
    setIdLocalDeletar(localId);
    setDeletarOpen(true);
    closeAllDropdowns();
  }, []);

  const handleConfirmDelete = useCallback(
    async (idToDelete: string) => {
      try {
        await deletarLocalPeca(idToDelete);
        toast({
          title: 'Local da peça deletado',
          description: `Local com ID ${idToDelete} deletado com sucesso!`,
          variant: 'default',
        });
        // Força refresh incrementando o contador
        setRefreshTrigger((prev) => prev + 1);
      } catch (error: any) {
        toast({
          title: 'Erro ao deletar local da peça',
          description:
            error.message || 'Ocorreu um erro ao deletar o local da peça.',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setDeletarOpen(false);
        setIdLocalDeletar(null);
      }
    },
    [toast],
  );

  const handleCancelDelete = useCallback(() => {
    setDeletarOpen(false);
    setIdLocalDeletar(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const localId in dropdownStates) {
        if (dropdownStates[localId]) {
          const dropdownNode = dropdownRefs.current[localId];
          const actionButtonNode = actionButtonRefs.current[localId];
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

  const rows = locaisPecas.data?.map((localItem) => ({
    id_local: localItem.id_local,
    armazem: localItem.armazem?.nome || 'N/A',
    descricao: localItem.descricao || '-',
    tipo_local: localItem.tipo_local || '-',
    capacidade: localItem.capacidade
      ? `${localItem.capacidade} ${localItem.unidade || ''}`.trim()
      : '-',
    unidade: localItem.unidade || '-',
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[localItem.id_local] = el;
            }
          }}
          onClick={(e) => toggleDropdown(localItem.id_local, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[localItem.id_local]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[localItem.id_local] &&
          dropdownPositions[localItem.id_local] &&
          createPortal(
            <div
              key={`portal-dropdown-${localItem.id_local}`}
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[localItem.id_local] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[localItem.id_local]?.top,
                left: dropdownPositions[localItem.id_local]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow:
                  '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000,
              }}
            >
              <div
                className="py-1"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="options-menu-button"
              >
                {userPermissions.editar && (
                  <button
                    key={`edit-${localItem.id_local}`}
                    onClick={() => handleEditarClick(localItem)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Pencil
                      className="mr-2 text-gray-400 dark:text-gray-500"
                      size={16}
                    />
                    Editar
                  </button>
                )}
                {userPermissions.remover && (
                  <button
                    key={`delete-${localItem.id_local}`}
                    onClick={() => handleDeletarClick(localItem.id_local)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                    role="menuitem"
                  >
                    <Trash2
                      className="mr-2 text-red-400 dark:text-gray-500"
                      size={16}
                    />
                    Deletar
                  </button>
                )}
              </div>
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
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Locais de Peças
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => setCadastrarOpen(true)}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Novo"
                icon={<PlusIcon size={18} />}
                disabled={isLoading}
              />
            )}
          </div>
        </header>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Carregamento />
          </div>
        ) : (
          <DataTable
            headers={headers}
            rows={rows}
            meta={locaisPecas.meta}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
            onSearch={(e) => {
              setSearch(e.target.value);
              handleSearch();
            }}
            searchInputPlaceholder="Pesquisar locais de peças..."
          />
        )}
      </main>

      {/* Modal para cadastrar local */}
      {cadastrarOpen && (
        <CadastrarLocalPecaModal
          isOpen={cadastrarOpen}
          onClose={() => setCadastrarOpen(false)}
          onSuccess={() => {
            setCadastrarOpen(false);
            setRefreshTrigger((prev) => prev + 1); // Força refresh
          }}
        />
      )}

      {/* Modal para editar local */}
      {editarOpen && localParaEditar && (
        <EditarLocalPecaModal
          isOpen={editarOpen}
          onClose={() => setEditarOpen(false)}
          local={localParaEditar}
          onSuccess={() => {
            setEditarOpen(false);
            setLocalParaEditar(null);
            setRefreshTrigger((prev) => prev + 1); // Força refresh
          }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      <ConfirmDeleteLocalPecaModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        localId={idLocalDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default LocaisPecasPage;
