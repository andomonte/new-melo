import React, { useEffect, useState, useRef, useContext } from 'react';
import { Tela, getTelas, deletarTela } from '@/data/telas/telas';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTableTela';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarTelaModal from './modalCadastrarTela'; // Renomeado
import EditarTelaModal from './modalEditarTela'; // Renomeado
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';
import type { Permissao } from '@/data/Permissoes/permissao';

interface AuthContextProps {
  user: any; // Ajuste o tipo conforme sua necessidade
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  telaId?: number | null;
  onConfirm: (id: number) => Promise<void>;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  telaId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus]: any = useState('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (telaId) {
      try {
        await onConfirm(telaId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar a Tela. Tente mais tarde ou comunique a equipe técnica.',
        );
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[80%] h-[60%] flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {deleteStatus === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que deseja remover permanentemente a tela com ID
                &quot;
                {telaId}&quot;?
              </p>
            </div>
          )}

          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando a Tela..." />
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

const TelasPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarTelaOpen, setCadastrarTelaOpen] = useState(false);
  const [editarTelaOpen, setEditarTelaOpen] = useState(false);
  const [deletarTelaOpen, setDeletarTelaOpen] = useState(false);
  const [idTelaDeletar, setIdTelaDeletar] = useState<number | null>(null);
  const [telaParaEditar, setTelaParaEditar] = useState<Tela | null>(null); // Estado para armazenar os dados da tela a ser editada
  const [telas, setTelas] = useState<{ data: Tela[]; meta: any }>({
    data: [],
    meta: {},
  });
  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  const [dropdownStates, setDropdownStates] = useState<{
    [key: number]: boolean;
  }>({});
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: number]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: number]: boolean;
  }>({});

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    handleTelas();
  }, 300);

  const handleTelas = async () => {
    try {
      const data = await getTelas({ page, perPage, search });
      setTelas(data);
    } catch (error) {
      console.error('Erro ao buscar telas:', error);
      toast({
        title: 'Erro ao carregar telas',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    handleTelas();
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

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
            (permissao: Permissao) =>
              permissao.tb_telas?.PATH_TELA === telaHref,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]);

  const headers = ['Nome da Tela', 'Path da Tela', 'Ações'];

  const toggleDropdown = (telaId: number, buttonElement: HTMLButtonElement) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [telaId]: !prevStates[telaId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [telaId]: !prevRotations[telaId],
    }));

    if (!dropdownStates[telaId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [telaId]: {
          top: rect.top - (rect.height + 6), // Posiciona acima do botão com um pequeno espaço
          left: rect.left - 150 + 2 + window.scrollX, // Alinhado à direita + 2px
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [telaId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleDeletarClick = (telaId: number) => {
    setIdTelaDeletar(telaId);
    setDeletarTelaOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDelete = async (idToDelete: number) => {
    try {
      await deletarTela(idToDelete);
    } catch (error: any) {
      throw error;
    } finally {
      handleTelas();
      setIdTelaDeletar(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletarTelaOpen(false);
    setIdTelaDeletar(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const telaId in dropdownStates) {
        if (dropdownStates[telaId]) {
          const dropdownNode = dropdownRefs.current[telaId];
          const actionButtonNode = actionButtonRefs.current[telaId];
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
  const [newRows, setNewRows]: any = useState('inicial');
  const rows = telas.data?.map((tela) => ({
    NOME_TELA: tela.NOME_TELA,
    PATH_TELA: tela.PATH_TELA,
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[tela.CODIGO_TELA] = el;
            }
          }}
          onClick={(e) => toggleDropdown(tela.CODIGO_TELA, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[tela.CODIGO_TELA]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>

        {dropdownStates[tela.CODIGO_TELA] &&
          dropdownPositions[tela.CODIGO_TELA] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[tela.CODIGO_TELA] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[tela.CODIGO_TELA]?.top,
                left: dropdownPositions[tela.CODIGO_TELA]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow:
                  '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 10,
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
                    onClick={() => {
                      setTelaParaEditar(tela); // Envia os dados completos da tela
                      setEditarTelaOpen(true);
                      closeAllDropdowns();
                    }}
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
                    onClick={() => handleDeletarClick(tela.CODIGO_TELA)}
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
  useEffect(() => {
    if (rows.length) setNewRows(rows);
  }, [rows]);
  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Telas
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => {
                  // setSelectedRow(''); // Não é mais necessário, pois o modal de cadastro é diferente
                  setCadastrarTelaOpen(true);
                }}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Novo"
                icon={<PlusIcon size={18} />}
              />
            )}
          </div>
        </header>

        <DataTable
          headers={headers}
          rows={newRows}
          meta={telas.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome da tela..."
        />
      </main>

      <CadastrarTelaModal
        isOpen={cadastrarTelaOpen}
        onClose={() => setCadastrarTelaOpen(false)}
        onSuccess={() => {
          setCadastrarTelaOpen(false);
          handleTelas();
        }}
      />

      {telaParaEditar && ( // Renderiza o modal de edição se telaParaEditar tiver dados
        <EditarTelaModal
          isOpen={editarTelaOpen}
          onClose={() => setEditarTelaOpen(false)}
          title="Editar Tela"
          telaData={telaParaEditar} // Envia os dados completos da tela para o modal de edição
          onSuccess={() => {
            setEditarTelaOpen(false);
            setTelaParaEditar(null); // Limpa o estado após o sucesso
            handleTelas();
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deletarTelaOpen}
        onClose={handleCancelDelete}
        telaId={idTelaDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default TelasPage;
