import React, { useEffect, useState, useRef, useContext } from 'react';
import { Marcas, getMarcas, Marca, deleteMarca } from '@/data/marcas/marcas';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import Cadastrar from './modalCadastrar';
import Editar from './modalEditar';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';

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

interface ConfirmDeleteMarcaModalProps {
  isOpen: boolean;
  onClose: () => void;
  marcaId?: string | null;
  onConfirm: (id: string) => Promise<void>;
}

const ConfirmDeleteMarcaModal: React.FC<ConfirmDeleteMarcaModalProps> = ({
  isOpen,
  onClose,
  marcaId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (marcaId) {
      try {
        await onConfirm(marcaId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar a Marca. Tente mais tarde ou comunique a equipe técnica.',
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
                Tem certeza que deseja remover permanentemente a marca com
                código &quot;{marcaId}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando a Marca..." />
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

const MarcasPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [idMarcaDeletar, setIdMarcaDeletar] = useState<string | null>(null);
  const [marcaParaEditar, setMarcaParaEditar] = useState<Marca | null>(null);
  const [marcas, setMarcas] = useState({} as Marcas);
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

  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleMarcas = async () => {
    try {
      console.log('🔍 Buscando marcas com:', { page, perPage, search });
      const data = await getMarcas({ page, perPage, search });
      console.log('✅ Marcas encontradas:', data);
      setMarcas(data);
    } catch (error) {
      console.error('❌ Erro ao buscar marcas:', error);
      toast({
        title: 'Erro ao carregar marcas',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  const debouncedFetchMarcas = useDebouncedCallback(() => {
    setPage(1); // Reset para primeira página ao pesquisar
    handleMarcas();
  }, 500);

  useEffect(() => {
    handleMarcas();
    dismiss(); // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const headers = ['Ações', 'Código', 'Descrição', 'Bloquear Preço'];

  const toggleDropdown = (
    marcaId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [marcaId]: !prevStates[marcaId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [marcaId]: !prevRotations[marcaId],
    }));

    if (!dropdownStates[marcaId]) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 144;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let leftPosition = rect.left + window.scrollX;

      if (leftPosition + dropdownWidth > windowWidth) {
        leftPosition = rect.right - dropdownWidth + window.scrollX;
      }

      if (leftPosition < 0) {
        leftPosition = 10;
      }

      let topPosition = rect.bottom + 4 + window.scrollY;

      if (topPosition + 100 > windowHeight + window.scrollY) {
        topPosition = rect.top - 100 - 4 + window.scrollY;
      }

      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [marcaId]: {
          top: topPosition,
          left: leftPosition,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [marcaId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleEditarClick = (marca: Marca) => {
    setMarcaParaEditar(marca);
    setEditarOpen(true);
    closeAllDropdowns();
  };

  const handleDeletarClick = (marcaId: string) => {
    setIdMarcaDeletar(marcaId);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDelete = async (idToDelete: string) => {
    try {
      await deleteMarca(idToDelete);
      toast({
        title: 'Sucesso',
        description: 'Marca deletada com sucesso!',
        variant: 'default',
      });
    } catch (error: any) {
      // Verificar se é erro de constraint (marca sendo usada)
      if (error.response?.status === 400) {
        throw new Error(
          error.response.data.message ||
            'Esta marca não pode ser deletada pois está sendo utilizada por outros registros.',
        );
      } else {
        throw new Error(
          error.response?.data?.error ||
            'Erro ao deletar marca. Tente novamente.',
        );
      }
    } finally {
      handleMarcas();
      setIdMarcaDeletar(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletarOpen(false);
    setIdMarcaDeletar(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const marcaId in dropdownStates) {
        if (dropdownStates[marcaId]) {
          const dropdownNode = dropdownRefs.current[marcaId];
          const actionButtonNode = actionButtonRefs.current[marcaId];
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

  const rows = marcas.data?.map((marcaItem) => ({
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[marcaItem.codmarca] = el;
            }
          }}
          onClick={(e) => toggleDropdown(marcaItem.codmarca, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[marcaItem.codmarca]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[marcaItem.codmarca] &&
          dropdownPositions[marcaItem.codmarca] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[marcaItem.codmarca] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[marcaItem.codmarca]?.top,
                left: dropdownPositions[marcaItem.codmarca]?.left,
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
                    onClick={() => handleEditarClick(marcaItem)}
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
                    onClick={() => handleDeletarClick(marcaItem.codmarca)}
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
    codmarca: marcaItem.codmarca,
    descr: marcaItem.descr,
    bloquear_preco: marcaItem.bloquear_preco ?? 'S',
  }));

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Marcas
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => setCadastrarOpen(true)}
                className="px-3 py-1 text-sm h-8 flex items-center gap-1 hover:bg-blue-600 dark:hover:bg-blue-800"
                text="Novo"
                icon={<PlusIcon size={18} />}
              />
            )}
          </div>
        </header>
        <DataTable
          headers={headers}
          rows={rows}
          meta={marcas.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            debouncedFetchMarcas();
          }}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setPage(1);
              handleMarcas();
            }
          }}
          searchInputPlaceholder="Pesquisar por código ou descrição..."
        />
      </main>
      <Cadastrar
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        title="Cadastrar Marca"
        onSuccess={() => {
          setCadastrarOpen(false);
          handleMarcas();
        }}
      />
      <Editar
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        title="Editar Marca"
        marcaId={marcaParaEditar?.codmarca || ''}
        onSuccess={() => {
          setEditarOpen(false);
          setMarcaParaEditar(null);
          handleMarcas();
        }}
      />
      <ConfirmDeleteMarcaModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        marcaId={idMarcaDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default MarcasPage;
