// src/pages/grupos-de-produtos/index.tsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { PlusIcon, Pencil, Trash2, CircleChevronDown } from 'lucide-react';
import DataTablePadrao from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';
import { createPortal } from 'react-dom';

import {
  GruposDeProdutosResponse,
  getGruposDeProdutos,
  buscaGruposDeProdutos,
  deletarGrupoProduto,
  GrupoProduto,
  Filtro,
} from '@/data/gruposDeProdutos/gruposDeProdutos';

import CadastrarGrupoProdutoModal from './modalCadastrarGrupoProduto';
import EditarGrupoProdutoModal from './modalEditarGrupoProduto';

// Rótulos das colunas conforme o Delphi (Arquivo de Grupo de Produtos - Descontos)
const COLUNAS_GRUPO_LABELS: Record<string, string> = {
  codgpp: 'Código',
  descr: 'Descrição',
  comgpp: '%Com. Externo',
  comgpptmk: '%Com. Tmk.',
  comgppextmk: '%Com. Ex. Tmk.',
  descbalcao: 'Balcão',
  dscrev30: 'Rev_30',
  dscrev45: 'Rev_45',
  dscrev60: 'Rev_60',
  dscrv30: 'Rv_30',
  dscrv45: 'Rv_45',
  dscrv60: 'Rv_60',
  dscbv30: 'Bv_30',
  dscbv45: 'Bv_45',
  dscbv60: 'Bv_60',
  dscpv30: 'Pv_30',
  dscpv45: 'Pv_45',
  dscpv60: 'Pv_60',
  codvend: 'Vendedor',
  codseg: 'Segmento',
  diasreposicao: 'Dias Repos.',
  codcomprador: 'Comprador',
  ramonegocio: 'Negócio',
  p_comercial: 'Prazo Com.',
  v_marketing: 'Verba Mkt.',
  codgpc: 'Gp. Contábil',
  margem_min_venda: 'Marg. Mín.',
  margem_med_venda: 'Marg. Méd.',
  margem_ide_venda: 'Marg. Ideal',
  bloquear_preco: 'Bloq. Preço',
  DSCBALCAO: 'Desc. Balcão',
};

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

interface ConfirmDeleteGrupoProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  grupoProdutoCodgpp?: string | null;
  onConfirm: (codgpp: string) => Promise<void>;
}

const ConfirmDeleteGrupoProdutoModal: React.FC<
  ConfirmDeleteGrupoProdutoModalProps
> = ({ isOpen, onClose, grupoProdutoCodgpp, onConfirm }) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (grupoProdutoCodgpp) {
      try {
        await onConfirm(grupoProdutoCodgpp);
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        setErrorMessage(
          error.message ||
            'Tivemos problemas ao tentar deletar o Grupo de Produto. Tente mais tarde ou comunique a equipe técnica.',
        );
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[999]">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[80%] h-[60%] flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {deleteStatus === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que deseja remover permanentemente o Grupo de
                Produto com CODGP_P &quot;{grupoProdutoCodgpp}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-blue-500"></span>
              <Carregamento texto="Deletando o Grupo de Produto..." />
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

// --- Componente Principal da Página ---
const GruposDeProdutosPage = () => {
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(10);
  const { dismiss, toast } = useToast();
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [deletarOpen, setDeletarOpen] = useState(false);
  const [codgppDeletar, setCodgppDeletar] = useState<string | null>(null);
  const [grupoProdutoParaEditar, setGrupoProdutoParaEditar] =
    useState<GrupoProduto | null>(null);
  const [gruposProdutos, setGruposProdutos] = useState(
    {} as GruposDeProdutosResponse,
  );
  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  // --- Novos estados para o DataTableFiltro ---
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [colunasDbGpp, setColunasDbGpp] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasGruposProdutos');
    return salvo ? parseInt(salvo, 10) : 10;
  });
  const [headers, setHeaders] = useState<string[]>([]);

  // --- Estados para o Dropdown de Ações ---
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

  // --- Ref para otimização de chamadas API ---
  const ultimaChamada = useRef({
    page: 0,
    perPage: 0,
    filtros: [] as Filtro[],
    search: '',
    limiteColunas,
  });

  const fetchGruposProdutos = async ({
    page,
    perPage,
    search,
    filtros,
  }: {
    page: number;
    perPage: number;
    search: string;
    filtros: Filtro[];
  }) => {
    const ultima = ultimaChamada.current;
    const filtrosString = JSON.stringify(filtros);
    const ultimaFiltrosString = JSON.stringify(ultima.filtros);

    if (
      ultima.page === page &&
      ultima.perPage === perPage &&
      ultima.search === search &&
      filtrosString === ultimaFiltrosString &&
      limiteColunas === ultima.limiteColunas
    ) {
      return;
    }

    ultimaChamada.current = { page, perPage, search, filtros, limiteColunas };

    try {
      let data: GruposDeProdutosResponse;
      // Busca simples (search) usa o GET (que filtra por ILIKE). O POST de
      // buscaGruposDeProdutos só é necessário para filtros avançados.
      if (filtros.length > 0) {
        data = await buscaGruposDeProdutos({
          page,
          perPage,
          search,
          filtros,
        });
      } else {
        data = await getGruposDeProdutos({
          page,
          perPage,
          search,
        });
      }
      setGruposProdutos(data);

      if (data.data?.length > 0) {
        const todasAsColunasDoBackend = Object.keys(data.data[0]);

        const colunasAExibirNoDataTable = todasAsColunasDoBackend.filter(
          (coluna) => !['action', 'ações'].includes(coluna.toLowerCase()),
        );

        setColunasDbGpp(colunasAExibirNoDataTable);
        // Headers: coluna de ações + TODAS as colunas (a visibilidade é
        // gerenciada internamente pelo DataTablePadrao / gerenciador de colunas)
        setHeaders(['ações', ...colunasAExibirNoDataTable]);
      } else {
        setColunasDbGpp([]);
        setHeaders(['ações']);
      }
    } catch (error) {
      console.error('Erro ao buscar grupos de produtos:', error);
      toast({
        title: 'Erro ao carregar grupos de produtos',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      // setLoading(false);
    }
  };

  useEffect(() => {
    fetchGruposProdutos({ page, perPage, search, filtros });
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, JSON.stringify(filtros), limiteColunas]);

  useEffect(() => {
    if (headers.length) {
      localStorage.setItem(
        'headersSelecionadosGruposProdutos',
        JSON.stringify(headers),
      );
    }
  }, [headers]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, 500);

  // Funções de clique agora fecham todos os dropdowns
  const handleEditarClick = (grupoProduto: GrupoProduto) => {
    setGrupoProdutoParaEditar(grupoProduto);
    setEditarOpen(true);
    closeAllDropdowns(); // Fecha os dropdowns após a ação
  };

  const handleDeletarClick = (codgpp: string) => {
    setCodgppDeletar(codgpp);
    setDeletarOpen(true);
    closeAllDropdowns(); // Fecha os dropdowns após a ação
  };

  const handleConfirmDelete = async (codgppToDelete: string) => {
    try {
      await deletarGrupoProduto(codgppToDelete);
    } catch (error: any) {
      throw error;
    } finally {
      fetchGruposProdutos({ page, perPage, search, filtros });
      setCodgppDeletar(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletarOpen(false);
    setCodgppDeletar(null);
  };

  useEffect(() => {
    const checkPermissions = () => {
      if (user?.permissoes && Array.isArray(user.permissoes)) {
        const telaHref = sessionStorage.getItem('telaAtualMelo');
        let parsedTelaHref: string | undefined;

        if (telaHref) {
          try {
            parsedTelaHref = JSON.parse(telaHref);
          } catch (e) {
            console.warn('telaHref não era um JSON válido', e);
            parsedTelaHref = telaHref;
          }
        }

        const telaPerfil = user.permissoes.find(
          (permissao) => permissao.tb_telas?.PATH_TELA === parsedTelaHref,
        );

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

  // --- Funções de controle do Dropdown ---
  const toggleDropdown = (
    id: string, // Usamos codgpp como ID único
    buttonElement: HTMLButtonElement,
  ) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [id]: !prevStates[id], // Inverte o estado de visibilidade do dropdown
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [id]: !prevRotations[id], // Inverte o estado de rotação do ícone
    }));

    if (!dropdownStates[id]) {
      // Se o dropdown está prestes a abrir
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 144; // Largura aproximada do seu dropdown (min-w-[144px])
      // A altura não é tão crítica aqui, pois vamos alinhar verticalmente com o botão
      // const dropdownHeight = 80;

      // Calcular o espaço disponível à direita da borda do botão
      const spaceRightOfButton = window.innerWidth - rect.right;

      let leftPosition: number;

      // Vertical positioning: Always align with the top of the button
      // `rect.top` é a posição do topo do botão em relação à viewport.
      // `window.scrollY` é o quanto a página rolou. Somando os dois, obtemos a posição absoluta.
      const topPosition = rect.top + window.scrollY;

      // Horizontal positioning: Open to the right of the button
      // A borda esquerda do dropdown deve começar na borda direita do botão.
      leftPosition = rect.right + window.scrollX + 5;

      // Adicionalmente, verificar se há espaço suficiente à direita.
      // Se não houver espaço suficiente para abrir para a direita,
      // ele tentará abrir para a esquerda do botão.
      if (spaceRightOfButton < dropdownWidth) {
        // Não há espaço suficiente à direita, abre para a esquerda do botão
        // Alinha a borda direita do dropdown com a borda esquerda do botão
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }
      // Considerar um pequeno offset para não ficar colado no botão, se desejar.
      // Ex: leftPosition = rect.right + window.scrollX + 5; // Abre 5px à direita do botão

      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [id]: {
          top: topPosition,
          left: leftPosition,
        },
      }));
    } else {
      // Se o dropdown está prestes a fechar
      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [id]: null,
      }));
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const id in dropdownStates) {
        if (dropdownStates[id]) {
          // Se o dropdown está aberto
          const dropdownNode = dropdownRefs.current[id];
          const actionButtonNode = actionButtonRefs.current[id];
          if (
            dropdownNode &&
            !dropdownNode.contains(event.target as Node) &&
            actionButtonNode &&
            !actionButtonNode.contains(event.target as Node)
          ) {
            shouldClose = true;
            break; // Fecha todos se um for clicado fora
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

  // Mapeia os dados dos grupos de produtos para as linhas da tabela
  const rows = gruposProdutos.data?.map((grupoProdutoItem) => {
    const linha: Record<string, any> = {};

    linha.ações = (
      <div className="relative">
        {(userPermissions.editar || userPermissions.remover) && (
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[grupoProdutoItem.codgpp] = el;
              }
            }}
            onClick={(e) =>
              toggleDropdown(grupoProdutoItem.codgpp, e.currentTarget)
            }
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[grupoProdutoItem.codgpp]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
        )}

        {dropdownStates[grupoProdutoItem.codgpp] &&
          dropdownPositions[grupoProdutoItem.codgpp] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[grupoProdutoItem.codgpp] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                position: 'absolute',
                top: dropdownPositions[grupoProdutoItem.codgpp]?.top,
                left: dropdownPositions[grupoProdutoItem.codgpp]?.left,
                minWidth: '144px',
                zIndex: 999,
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
                    onClick={() => handleEditarClick(grupoProdutoItem)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 w-full text-left"
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
                    onClick={() => handleDeletarClick(grupoProdutoItem.codgpp)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 w-full text-left"
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
    );

    // Popula TODAS as colunas de dados (a visibilidade é gerenciada pelo
    // DataTablePadrao, então o valor precisa existir mesmo se a coluna
    // estiver oculta no momento).
    colunasDbGpp.forEach((coluna) => {
      const valor = (grupoProdutoItem as any)[coluna];
      linha[coluna] = valor ?? '';
    });

    return linha;
  });

  return (
    <div className="h-full w-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 w-full overflow-hidden">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Grupos de Produtos
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
        <div className="flex-1 min-h-20 flex flex-col">
        <DataTablePadrao
          screenKey="cadastro-grupos-produtos"
          userName={user?.usuario}
          headers={headers}
          columnLabels={COLUNAS_GRUPO_LABELS}
          rows={rows || []}
          semColunaDeAcaoPadrao={true}
          nonsortableColumns={['ações']}
          meta={gruposProdutos.meta}
          onPageChange={(newPage) => {
            if (newPage !== page) setPage(newPage);
          }}
          onPerPageChange={(newPerPage) => {
            if (newPerPage !== perPage) setPerPage(newPerPage);
          }}
          onSearch={(e) => debouncedSearch(e.target.value)}
          onSearchBlur={() => {}}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') debouncedSearch(search);
          }}
          searchInputPlaceholder="Pesquisar por código, descrição ou código do vendedor..."
          colunasFiltro={colunasDbGpp}
          onFiltroChange={(novosFiltros) => {
            setFiltros(novosFiltros);
            setPage(1);
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem(
              'limiteColunasGruposProdutos',
              novoLimite.toString(),
            );
          }}
          carregando={false}
        />
        </div>
      </main>

      <CadastrarGrupoProdutoModal
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        title="Cadastrar Grupo de Produto"
        onSuccess={() => {
          setCadastrarOpen(false);
          fetchGruposProdutos({ page: 1, perPage, search, filtros });
        }}
      />

      <EditarGrupoProdutoModal
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        title="Editar Grupo de Produto"
        grupoProduto={grupoProdutoParaEditar}
        onSuccess={() => {
          setEditarOpen(false);
          setGrupoProdutoParaEditar(null);
          fetchGruposProdutos({ page, perPage, search, filtros });
        }}
      />

      <ConfirmDeleteGrupoProdutoModal
        isOpen={deletarOpen}
        onClose={handleCancelDelete}
        grupoProdutoCodgpp={codgppDeletar}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default GruposDeProdutosPage;
