import React, { useEffect, useState, useRef, useContext } from 'react';
import { getPerfis, deletarPerfil } from '@/data/perfis/perfis';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown } from 'lucide-react';
import DataTable from '@/components/common/DataTablePerfil';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarPerfil from './modalCadastrarPerfil';
import EditarPerfil from './modalEditarPerfil';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Carregamento from '@/utils/carregamento';
import { AuthContext } from '@/contexts/authContexts';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  perfilId?: string;
  onConfirm: (id: string) => Promise<void>;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  perfilId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    try {
      await onConfirm(perfilId!);
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteStatus('idle');
        onClose();
      }, 1500);
    } catch (error: any) {
      setDeleteStatus('error');
      setErrorMessage(
        error.message ||
          'Tivemos problemas ao tentar deletar o Perfil. Tente mais tarde ou comunique a equipe técnica.',
      );
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
                Tem certeza que deseja remover permanentemente o perfil &quot;
                {perfilId}&quot;?
              </p>
            </div>
          )}

          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando o Perfil..." />
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

// Defina a interface Permissao corretamente com as permissões individuais
export type Permissao = {
  cadastrar?: boolean;
  editar?: boolean;
  remover?: boolean; // Usando 'remover' conforme os seus dados
  consultar?: boolean;
  grupoId: string;
  id: number;
  tb_telas: {
    CODIGO_TELA: number;
    PATH_TELA: string;
    NOME_TELA: string;
  };
};

// Atualize a interface User para corresponder à estrutura real
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
  // Outras propriedades e métodos do contexto
}

const PerfisPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [perfilParaEditar, setPerfilParaEditar] = useState<any | null>(null);
  const [idPerfilDeletar, setIdPerfilDeletar] = useState<string>();
  const [perfis, setPerfis] = useState<any>(null);
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
  const { user } = useContext(AuthContext) as AuthContextProps;
  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    handlePerfis();
  }, 300);

  const handlePerfis = async () => {
    try {
      const data = await getPerfis({ page, perPage, search });
      setPerfis(data);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
      toast({
        title: 'Erro ao carregar perfis',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    handlePerfis();
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // Verifica as permissões do usuário
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
            remover: telaPerfil.remover || false, // Usando 'remover' do telaPerfil
            consultar: true,
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

  const headers = ['Perfil', 'Telas', 'Usuários', 'Funções', 'Ações'];

  const toggleDropdown = (
    perfilId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [perfilId]: !prevStates[perfilId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [perfilId]: !prevRotations[perfilId],
    }));

    if (!dropdownStates[perfilId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [perfilId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [perfilId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleDeletarClick = (perfilId: string) => {
    setIdPerfilDeletar(perfilId);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDelete = async () => {
    if (idPerfilDeletar)
      try {
        await deletarPerfil(idPerfilDeletar);
        // O estado do modal é atualizado no ConfirmDeleteModal
      } catch (error: any) {
        // O erro será capturado e o estado do modal atualizado lá
        throw error;
      } finally {
        handlePerfis();
        setIdPerfilDeletar(undefined);
      }
  };

  const handleCancelDelete = () => {
    setDeletarOpen(false);
    setIdPerfilDeletar(undefined);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const perfilId in dropdownStates) {
        if (dropdownStates[perfilId]) {
          const dropdownNode = dropdownRefs.current[perfilId];
          const actionButtonNode = actionButtonRefs.current[perfilId];
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

  const rows = perfis?.data?.map((perfil: any) => ({
    perfil: perfil.login_perfil_name,
    qtd_telas: perfil.telasPermissoes.length,
    qtd_usuarios: perfil.usuarios.length,
    qtd_funcoes: perfil.funcoes.length,
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[perfil.login_perfil_name] = el;
            }
          }}
          onClick={(e) =>
            toggleDropdown(perfil.login_perfil_name, e.currentTarget)
          }
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[perfil.login_perfil_name]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>

        {dropdownStates[perfil.login_perfil_name] &&
          dropdownPositions[perfil.login_perfil_name] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[perfil.login_perfil_name] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[perfil.login_perfil_name]?.top,
                left: dropdownPositions[perfil.login_perfil_name]?.left,
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
                      setPerfilParaEditar(perfil); // Envia o perfil completo
                      setEditarOpen(true);
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
                    onClick={() => handleDeletarClick(perfil.login_perfil_name)}
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
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Perfis
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => {
                  setCadastrarOpen(true);
                }}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Novo"
                icon={<Plus size={18} />}
              />
            )}
          </div>
        </header>

        <DataTable
          headers={headers}
          rows={rows}
          meta={perfis?.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome do perfil..."
        />
      </main>

      <CadastrarPerfil
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={() => {
          setCadastrarOpen(false);
          handlePerfis();
        }}
      />

      {perfilParaEditar && (
        <EditarPerfil
          isOpen={editarOpen}
          onClose={() => setEditarOpen(false)}
          perfilData={perfilParaEditar} // Envia os dados completos do perfil
          onSuccess={() => {
            setEditarOpen(false);
            handlePerfis();
            setPerfilParaEditar(null);
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        perfilId={idPerfilDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default PerfisPage;
