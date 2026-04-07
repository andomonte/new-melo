// src/pages/cadastro/dadosEmpresa/index.tsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  DadosEmpresa,
  getDadosEmpresas,
  deletarDadosEmpresa,
  DadosEmpresaListResponse,
} from '@/data/dadosEmpresa/dadosEmpresas';

import { Meta } from '@/data/common/meta';

import { useDebouncedCallback } from 'use-debounce';
import { CircleChevronDown, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTableDadosEmpresa'; // O SEU COMPONENTE DATATABLE
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';

// Certifique-se que estes modais foram renomeados e adaptados para DadosEmpresa
import CadastrarDadosEmpresaModal from './modalCadastrarDadosEmpresa';
import EditarDadosEmpresaModal from './modalEditarDadosEmpresa';

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

interface ConfirmDeleteDadosEmpresaModalProps {
  isOpen: boolean;
  onClose: () => void;
  cgcEmpresa?: string | null;
  onConfirm: (cgc: string) => Promise<void>;
}

const ConfirmDeleteDadosEmpresaModal: React.FC<
  ConfirmDeleteDadosEmpresaModalProps
> = ({ isOpen, onClose, cgcEmpresa, onConfirm }) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (cgcEmpresa !== null && cgcEmpresa !== undefined) {
      try {
        await onConfirm(cgcEmpresa);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar os Dados da Empresa. Tente mais tarde ou comunique a equipe técnica.',
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
                Tem certeza que deseja remover permanentemente os dados da
                empresa com CGC &quot;{cgcEmpresa}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando Dados da Empresa..." />
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

const DadosEmpresaPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [cgcEmpresaDeletar, setCgcEmpresaDeletar] = useState<string | null>(
    null,
  );
  const [dadosEmpresaParaEditar, setDadosEmpresaParaEditar] =
    useState<DadosEmpresa | null>(null);
  const [dadosEmpresas, setDadosEmpresas] = useState<DadosEmpresaListResponse>({
    data: [],
    meta: {} as Meta,
  });
  const { user } = useContext(AuthContext) as AuthContextProps;

  // ESTADO DE LOADING ADICIONADO PARA O DATATABLE
  const [loadingData, setLoadingData] = useState<boolean>(true);

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
  const handlePerPageChange = (perPage: number) => {
    setPerPage(perPage);
    setPage(1); // Resetar para a primeira página ao mudar o "por página"
  };

  const handleSearch = useDebouncedCallback(() => {
    handleDadosEmpresas();
  }, 300);

  const handleDadosEmpresas = async () => {
    setLoadingData(true); // Ativa o loading ao iniciar a busca
    try {
      const data = await getDadosEmpresas({ page, perPage, search });
      setDadosEmpresas(data);
    } catch (error) {
      console.error('Erro ao buscar dados de empresas:', error);
      toast({
        title: 'Erro ao carregar dados de empresas',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
      // Garante que 'dadosEmpresas' não seja undefined em caso de erro
      setDadosEmpresas({
        data: [],
        meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 },
      });
    } finally {
      setLoadingData(false); // Desativa o loading após a busca, mesmo em caso de erro
    }
  };

  useEffect(() => {
    handleDadosEmpresas();
    dismiss(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Verifica se o clique foi fora de todos os dropdowns e botões de ação
      const clickedOutside = Object.keys(dropdownStates).every((cgc) => {
        const dropdown = dropdownRefs.current[cgc];
        const button = actionButtonRefs.current[cgc];

        return (
          (!dropdown || !dropdown.contains(target)) &&
          (!button || !button.contains(target))
        );
      });

      if (clickedOutside) {
        closeAllDropdowns();
      }
    };

    // Adiciona o listener apenas se houver algum dropdown aberto
    const hasOpenDropdown = Object.values(dropdownStates).some(Boolean);
    if (hasOpenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownStates]);

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        const telaHref = sessionStorage.getItem('telaAtualMelo');
        let telaPerfil: Permissao | undefined;

        if (telaHref) {
          try {
            const parsedTelaHref =
              typeof telaHref === 'string' ? JSON.parse(telaHref) : telaHref;
            telaPerfil = user.permissoes.find(
              (permissao) => permissao.tb_telas?.PATH_TELA === parsedTelaHref,
            );
          } catch (e) {
            console.warn(
              'telaHref não era um JSON válido ou não era uma string:',
              e,
            );
            telaPerfil = user.permissoes.find(
              (permissao) => permissao.tb_telas?.PATH_TELA === telaHref,
            );
          }
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
    'Ações',
    'CGC',
    'Nome Contribuinte',
    'Inscrição Estadual',
    // 'Município', // REMOVIDO conforme solicitado
    // 'UF',        // REMOVIDO conforme solicitado
  ];

  const toggleDropdown = (cgc: string, buttonElement: HTMLButtonElement) => {
    const isCurrentlyOpen = dropdownStates[cgc];

    // Fecha todos os dropdowns antes de abrir o novo
    closeAllDropdowns();

    // Se o dropdown clicado já estava aberto, não abre novamente (toggle off)
    if (isCurrentlyOpen) {
      return;
    }

    // Abre o dropdown clicado
    setDropdownStates({
      [cgc]: true,
    });

    setIconRotations({
      [cgc]: true,
    });

    const rect = buttonElement.getBoundingClientRect();
    const dropdownWidth = 144; // Largura mínima do dropdown
    const dropdownHeight = 80; // Altura aproximada do dropdown
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Verifica se há espaço suficiente à direita
    const spaceOnRight = viewportWidth - rect.right;
    const spaceOnLeft = rect.left;

    // Define a posição horizontal (esquerda ou direita do botão)
    let leftPosition;
    if (spaceOnRight >= dropdownWidth || spaceOnLeft < dropdownWidth) {
      // Posiciona à direita do botão
      leftPosition = rect.right + 8 + window.scrollX;
    } else {
      // Posiciona à esquerda do botão
      leftPosition = rect.left - dropdownWidth - 8 + window.scrollX;
    }

    // Define a posição vertical (alinhado com o topo do botão, ou ajustado se não couber)
    let topPosition = rect.top + window.scrollY;

    // Se não couber abaixo, ajusta para cima
    if (rect.top + dropdownHeight > viewportHeight) {
      topPosition = rect.bottom - dropdownHeight + window.scrollY;
    }

    setDropdownPositions({
      [cgc]: {
        top: topPosition,
        left: leftPosition,
      },
    });
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  const handleEditarDadosEmpresaClick = (dadosEmpresa: DadosEmpresa) => {
    setDadosEmpresaParaEditar(dadosEmpresa);
    setEditarOpen(true);
    closeAllDropdowns();
  };

  const handleDeletarDadosEmpresaClick = (cgcToDelete: string) => {
    setCgcEmpresaDeletar(cgcToDelete);
    setDeletarOpen(true);
    closeAllDropdowns();
  };

  const handleConfirmDeleteDadosEmpresa = async (cgcToDelete: string) => {
    try {
      await deletarDadosEmpresa(cgcToDelete);
      toast({
        title: 'Sucesso!',
        description: 'Dados da Empresa deletados com êxito.',
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar',
        description:
          error.message ||
          'Não foi possível deletar os dados da empresa. Tente novamente.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      handleDadosEmpresas();
      setCgcEmpresaDeletar(null);
    }
  };

  const handleCancelDeleteDadosEmpresa = () => {
    setDeletarOpen(false);
    setCgcEmpresaDeletar(null);
  };

  const rows =
    dadosEmpresas.data?.map((empresaItem) => [
      // ESTE É O ÚNICO LOCAL ALTERADO
      // A ORDEM AQUI DEVE CORRESPONDER EXATAMENTE À ORDEM DOS HEADERS
      <div key={empresaItem.cgc} className="relative">
        <button
          ref={(el) => {
            if (el) {
              actionButtonRefs.current[empresaItem.cgc] = el;
            }
          }}
          onClick={(e) => toggleDropdown(empresaItem.cgc, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[empresaItem.cgc]
              ? 'rotate(180deg)'
              : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[empresaItem.cgc] &&
          dropdownPositions[empresaItem.cgc] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[empresaItem.cgc] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800"
              style={{
                position: 'absolute',
                top: dropdownPositions[empresaItem.cgc]?.top,
                left: dropdownPositions[empresaItem.cgc]?.left,
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
                    onClick={() => handleEditarDadosEmpresaClick(empresaItem)}
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
                      handleDeletarDadosEmpresaClick(empresaItem.cgc)
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
      </div>,
      empresaItem.cgc, // Valor para a coluna 'CGC'
      empresaItem.nomecontribuinte, // Valor para a coluna 'Nome Contribuinte'
      empresaItem.inscricaoestadual, // Valor para a coluna 'Inscrição Estadual'
    ]) || [];

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Dados da Empresa
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
          meta={dadosEmpresas.meta}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          onSearch={(e) => {
            setSearch(e.target.value);
            handleSearch();
          }}
          searchInputPlaceholder="Pesquisar CGC ou Nome do Contribuinte..."
          loading={loadingData} // Passando o estado de carregamento para o DataTable
        />
      </main>
      <CadastrarDadosEmpresaModal
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        title="Cadastrar Dados da Empresa"
        onSuccess={() => {
          setCadastrarOpen(false);
          handleDadosEmpresas();
        }}
      />
      <EditarDadosEmpresaModal
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        title="Editar Dados da Empresa"
        dadosEmpresa={dadosEmpresaParaEditar}
        onSuccess={() => {
          setEditarOpen(false);
          setDadosEmpresaParaEditar(null);
          handleDadosEmpresas();
        }}
      />
      <ConfirmDeleteDadosEmpresaModal
        isOpen={deletarOpen}
        onClose={handleCancelDeleteDadosEmpresa}
        cgcEmpresa={cgcEmpresaDeletar}
        onConfirm={handleConfirmDeleteDadosEmpresa}
      />
    </div>
  );
};

export default DadosEmpresaPage;
