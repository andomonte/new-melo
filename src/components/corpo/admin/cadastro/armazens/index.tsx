// src/pages/cadastro/armazens/index.tsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  Armazens,
  getArmazens,
  deletarArmazem,
  Armazem, // <-- Certifique-se que esta interface está atualizada em 'armazens.ts'
} from '@/data/armazem/armazens';
import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';

import CadastrarArmazemModal from './modalCadastrarArmazem';
import EditarArmazemModal from './modalEditarArmazem';

import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';

// Defina a interface Permissao corretamente com as permissões individuais
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
  user: User | null; // Outras propriedades e métodos do contexto
}

interface ConfirmDeleteArmazemModalProps {
  isOpen: boolean;
  onClose: () => void;
  armazemId?: number | null;
  onConfirm: (id: number) => Promise<void>;
}

const ConfirmDeleteArmazemModal: React.FC<ConfirmDeleteArmazemModalProps> = ({
  isOpen,
  onClose,
  armazemId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (armazemId !== null && armazemId !== undefined) {
      try {
        await onConfirm(armazemId);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar o Armazém. Tente mais tarde ou comunique a equipe técnica.',
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
                Tem certeza que deseja remover permanentemente o armazém com ID
                &quot;{armazemId}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando o Armazém..." />
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

const ArmazensPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [idArmazemDeletar, setIdArmazemDeletar] = useState<number | null>(null);
  const [armazemParaEditar, setArmazemParaEditar] = useState<Armazem | null>(
    null,
  );
  const [armazens, setArmazens] = useState({} as Armazens);
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
    handleArmazens();
  }, 300);

  const handleArmazens = async () => {
    try {
      const data = await getArmazens({ page, perPage, search });
      setArmazens(data);
    } catch (error) {
      console.error('Erro ao buscar armazéns:', error);
      toast({
        title: 'Erro ao carregar armazéns',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    handleArmazens();
    dismiss(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, handleSearch]);

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

  // ALTERADO: Adicionado 'Inscrição Estadual' ao cabeçalho da tabela
  const headers = [
    'Código',
    'Nome',
    'Filial',
    'Inscrição Estadual',
    'Status',
    'Ações',
  ];

  const toggleDropdown = (
    armazemId: number,
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [armazemId]: !prevStates[armazemId],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [armazemId]: !prevRotations[armazemId],
    }));

    if (!dropdownStates[armazemId]) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [armazemId]: {
          top: rect.top - (rect.height + 6),
          left: rect.left - (174 - rect.width) + 2 + window.scrollX,
        },
      }));
    } else {
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [armazemId]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleEditarArmazemClick = (armazem: Armazem) => {
    setArmazemParaEditar(armazem);
    setEditarOpen(true);
    closeAllDropdowns();
  };

  const handleDeletarArmazemClick = (armazemId: number) => {
    setIdArmazemDeletar(armazemId);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDeleteArmazem = async (idToDelete: number) => {
    try {
      await deletarArmazem(idToDelete);
      toast({
        title: 'Sucesso!',
        description: 'Armazém deletado com êxito.',
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar',
        description:
          error.message ||
          'Não foi possível deletar o armazém. Tente novamente.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      handleArmazens();
      setIdArmazemDeletar(null);
    }
  };

  const handleCancelDeleteArmazem = () => {
    setDeletarOpen(false);
    setIdArmazemDeletar(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const armazemIdString in dropdownStates) {
        const armazemId = Number(armazemIdString);
        if (dropdownStates[armazemId]) {
          const dropdownNode = dropdownRefs.current[armazemId];
          const actionButtonNode = actionButtonRefs.current[armazemId];
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

  const rows = armazens.data?.map((armazemItem) => ({
    id: armazemItem.id_armazem,
    nome: armazemItem.nome,
    filial: armazemItem.filial,
    inscricaoestadual: armazemItem.inscricaoestadual, // <-- ADICIONADO AQUI
    status: armazemItem.ativo ? 'Ativo' : 'Inativo',
    action: (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[armazemItem.id_armazem] = el;
            }
          }}
          onClick={(e) =>
            toggleDropdown(armazemItem.id_armazem, e.currentTarget)
          }
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[armazemItem.id_armazem]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[armazemItem.id_armazem] &&
          dropdownPositions[armazemItem.id_armazem] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[armazemItem.id_armazem] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[armazemItem.id_armazem]?.top,
                left: dropdownPositions[armazemItem.id_armazem]?.left,
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
                    onClick={() => handleEditarArmazemClick(armazemItem)}
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
                    onClick={() =>
                      handleDeletarArmazemClick(armazemItem.id_armazem)
                    }
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
              Armazéns
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
          meta={armazens.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar nome do armazém..."
        />
      </main>
      <CadastrarArmazemModal
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        title="Cadastrar Armazém"
        onSuccess={() => {
          setCadastrarOpen(false);
          handleArmazens();
        }}
      />
      <EditarArmazemModal
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        title="Editar Armazém"
        armazem={armazemParaEditar}
        onSuccess={() => {
          setEditarOpen(false);
          setArmazemParaEditar(null);
          handleArmazens();
        }}
      />
      <ConfirmDeleteArmazemModal
        isOpen={deletarOpen}
        onClose={handleCancelDeleteArmazem}
        armazemId={idArmazemDeletar}
        onConfirm={handleConfirmDeleteArmazem}
      />
    </div>
  );
};

export default ArmazensPage;
