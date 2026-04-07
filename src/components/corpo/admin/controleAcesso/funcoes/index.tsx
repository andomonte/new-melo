import React, { useEffect, useState, useRef, useContext } from 'react';
import { Funcao, getFuncoes, deletarFuncao } from '@/data/funcoes/funcoes';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTableFuncao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import CadastrarFuncaoModal from './modalCadastrarFuncao'; // Renomeado
import EditarFuncaoModal from './modalEditar'; // Renomeado
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
  funcaoId?: number | null;
  onConfirm: (id: number) => Promise<void>;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  funcaoId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (funcaoId) {
      try {
        await onConfirm(funcaoId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar a Funcao. Tente mais tarde ou comunique a equipe técnica.',
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
                Tem certeza que deseja remover permanentemente a função com ID
                &quot;
                {funcaoId}&quot;?
              </p>
            </div>
          )}

          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando a Funcao..." />
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

const FuncaosPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarFuncaoOpen, setCadastrarFuncaoOpen] = useState(false);
  const [editarFuncaoOpen, setEditarFuncaoOpen] = useState(false);
  const [deletarFuncaoOpen, setDeletarFuncaoOpen] = useState(false);
  const [idFuncaoDeletar, setIdFuncaoDeletar] = useState<number | null>(null);
  const [funcaoParaEditar, setFuncaoParaEditar] = useState<Funcao | null>(null); // Novo estado para a função a ser editada
  const [funcoes, setFuncoes] = useState<{ data: Funcao[]; meta: any }>({
    data: [],
    meta: {},
  });
  const { user } = useContext(AuthContext) as AuthContextProps;
  const isFirstLoad = useRef(true);

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
  const [newRows, setNewRows]: any = useState('inicial');
  const handlePageChange = (page: number) => setPage(page);
  const handlePerPageChange = (perPage: number) => setPerPage(perPage);

  const handleSearch = useDebouncedCallback(() => {
    handleFuncoes();
  }, 300);

  const handleFuncoes = async () => {
    try {
      const data = await getFuncoes({ page, perPage, search });
      setFuncoes(data);
    } catch (error) {
      console.error('Erro ao buscar funções:', error);
      toast({
        title: 'Erro ao carregar funções',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      handleFuncoes();
    }

    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        console.log ('user.permissoes', user.permissoes)
        let telaHref = sessionStorage.getItem('telaAtualMelo');
        let funcaoPerfil: Permissao | undefined;

        if (telaHref) {
          try {
            telaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('funcaoHref não era um JSON válido', e);
          }
          funcaoPerfil = user.permissoes.find(
            (permissao: Permissao) =>
              permissao.tb_telas?.PATH_TELA === telaHref,
          );
        }

        if (funcaoPerfil) {
          setUserPermissions({
            cadastrar: funcaoPerfil.cadastrar || false,
            editar: funcaoPerfil.editar || false,
            remover: funcaoPerfil.remover || false,
            consultar: funcaoPerfil.consultar || true,
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

  // Adicione 'Usado Em' aos headers
  const headers = ['Descrição', 'Sigla', 'Usado Em', 'Ações'];

  const toggleDropdown = (
    funcaoId: number,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [funcaoId]: !prevStates[funcaoId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [funcaoId]: !prevRotations[funcaoId],
    }));

    if (!dropdownStates[funcaoId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [funcaoId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [funcaoId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleDeletarClick = (funcaoId: number) => {
    setIdFuncaoDeletar(funcaoId);
    setDeletarFuncaoOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDelete = async (idToDelete: number) => {
    try {
      await deletarFuncao(idToDelete);
    } catch (error: any) {
      throw error;
    } finally {
      handleFuncoes();
      setIdFuncaoDeletar(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletarFuncaoOpen(false);
    setIdFuncaoDeletar(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const funcaoId in dropdownStates) {
        if (dropdownStates[funcaoId]) {
          const dropdownNode = dropdownRefs.current[funcaoId];
          const actionButtonNode = actionButtonRefs.current[funcaoId];
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

  // Adicione a coluna 'Usado Em' nos dados das linhas
  const rows = funcoes.data?.map((funcao) => ({
    Descrição: funcao.descricao,
    Sigla: funcao.sigla,
    'Usado Em': funcao.usadoEm, // Adicionado 'Usado Em'
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[funcao.id_functions] = el;
            }
          }}
          onClick={(e) => toggleDropdown(funcao.id_functions, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[funcao.id_functions]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>

        {dropdownStates[funcao.id_functions] &&
          dropdownPositions[funcao.id_functions] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[funcao.id_functions] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[funcao.id_functions]?.top,
                left: dropdownPositions[funcao.id_functions]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow:
                  '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 10,
              }}
            >
              <div className="py-1" role="menu" aria-orientation="vertical">
                {userPermissions.editar && (
                  <button
                    onClick={() => {
                      setFuncaoParaEditar(funcao); // Envia os dados completos da função
                      setEditarFuncaoOpen(true);
                      closeAllDropdowns();
                    }}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
                    role="menuitem"
                  >
                    <Pencil className="mr-2 text-gray-400" size={16} />
                    Editar
                  </button>
                )}
                {userPermissions.remover && (
                  <button
                    onClick={() => handleDeletarClick(funcao.id_functions)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none w-full"
                  >
                    <Trash2 className="mr-2 text-red-400" size={16} />
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
              Funcões
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => {
                  // setSelectedRow(''); // Não é mais necessário, pois o modal de cadastro é diferente
                  setCadastrarFuncaoOpen(true);
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
          meta={funcoes.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome da funcao..."
        />
      </main>

      <CadastrarFuncaoModal
        isOpen={cadastrarFuncaoOpen}
        onClose={() => setCadastrarFuncaoOpen(false)}
        onSuccess={() => {
          setCadastrarFuncaoOpen(false);
          handleFuncoes();
        }}
      />

      {funcaoParaEditar && (
        <EditarFuncaoModal
          isOpen={editarFuncaoOpen}
          onClose={() => setEditarFuncaoOpen(false)}
          title="Editar Funcao"
          funcaoData={funcaoParaEditar} // Passando os dados completos da função
          onSuccess={() => {
            setEditarFuncaoOpen(false);
            setFuncaoParaEditar(null); // Limpa o estado após a edição
            handleFuncoes();
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deletarFuncaoOpen}
        onClose={handleCancelDelete}
        funcaoId={idFuncaoDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default FuncaosPage;
