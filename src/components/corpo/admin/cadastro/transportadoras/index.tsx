import React, { useEffect, useRef, useState, useContext } from 'react';
import {
  Transportadoras,
  buscaTransportadoras,
  getTransportadoras,
} from '@/data/transportadoras/transportadoras';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTableFiltro';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import Cadastrar from './modalCadastrar';
import Editar from './modalEditar';
import { GoPencil } from 'react-icons/go';
import { PlusIcon, CircleChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';

// Tipos de permissão e usuário
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

const TransportadorasPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [transportadoras, setTransportadoras] = useState<Transportadoras>(
    {} as Transportadoras,
  );
  const [loading, setLoading] = useState(true);
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [idTransportadora, setIdTransportadora] = useState<string>('');
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);

  const [colunasDbTransp, setColunasDbTransp] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(5);

  const { dismiss, toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;

  const [userPermissions, setUserPermissions] = useState<{
    cadastrar: boolean;
    editar: boolean;
    remover: boolean;
    consultar: boolean;
  }>({ cadastrar: false, editar: false, remover: false, consultar: true });

  // Estados para o Dropdown de Ações
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

  const ultimaChamada = useRef({
    page: 0,
    perPage: 0,
    filtros: [] as { campo: string; tipo: string; valor: string }[],
    limiteColunas,
  });

  const ultimaChamadaUnico = useRef({
    page: 0,
    perPage: 0,
    search: '',
  });
  const [headers, setHeaders] = useState<string[]>([]);

  const fetchTransportadoras = async ({
    page,
    perPage,
    filtros,
  }: {
    page: number;
    perPage: number;
    filtros: { campo: string; tipo: string; valor: string }[];
  }) => {
    const ultima = ultimaChamada.current;
    const filtrosString = JSON.stringify(filtros);
    const ultimaFiltrosString = JSON.stringify(ultima.filtros);

    if (
      ultima.page === page &&
      ultima.perPage === perPage &&
      filtrosString === ultimaFiltrosString &&
      limiteColunas === ultima.limiteColunas
    ) {
      return;
    }

    ultimaChamada.current = { page, perPage, filtros, limiteColunas };

    setLoading(true);

    try {
      const data = await buscaTransportadoras({ page, perPage, filtros });
      setTransportadoras(data);

      if (data.data?.length > 0) {
        const colunasDinamicas = Object.keys(data.data[0]).filter(
          (coluna) => coluna !== 'ações',
        );
        const filtrasColunasDinamicas = colunasDinamicas.slice(
          0,
          limiteColunas,
        );
        setColunasDbTransp(colunasDinamicas);
        if (!filtrasColunasDinamicas.includes('ações')) {
          filtrasColunasDinamicas.push('ações');
        }
        setHeaders(filtrasColunasDinamicas);
      }
    } catch (error) {
      console.error('Erro ao buscar transportadoras:', error);
      toast({
        title: 'Erro ao carregar transportadoras',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (search) {
      fetchTransportadorasUnico({ page, perPage, search });
    } else {
      fetchTransportadoras({ page, perPage, filtros });
    }
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, filtros, limiteColunas]);

  useEffect(() => {
    // Carregar limiteColunas do localStorage apenas no cliente
    const salvo = localStorage.getItem('limiteColunasTransportadoras');
    if (salvo) {
      setLimiteColunas(parseInt(salvo, 10));
    }
  }, []);

  useEffect(() => {
    if (headers.length)
      localStorage.setItem(
        'headersSelecionadosTransportadoras',
        JSON.stringify(headers),
      );
  }, [headers]);

  const fetchTransportadorasUnico = async ({
    page,
    perPage,
    search,
  }: {
    page: number;
    perPage: number;
    search: string;
  }) => {
    const ultima = ultimaChamadaUnico.current;
    if (
      ultima.page === page &&
      ultima.perPage === perPage &&
      ultima.search === search
    ) {
      return;
    }

    ultimaChamadaUnico.current = { page, perPage, search };

    setLoading(true);
    try {
      const data = await getTransportadoras({ page, perPage, search });
      setTransportadoras(data);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearchUnico = useDebouncedCallback((value: string) => {
    setPage(1);
    if (value) {
      fetchTransportadorasUnico({ page: 1, perPage, search: value });
    } else {
      fetchTransportadoras({ page: 1, perPage, filtros });
    }
  }, 500);

  // Funções de controle do Dropdown
  const toggleDropdown = (id: string, buttonElement: HTMLButtonElement) => {
    setDropdownStates((prevStates) => ({
      ...prevStates,
      [id]: !prevStates[id],
    }));

    setIconRotations((prevRotations) => ({
      ...prevRotations,
      [id]: !prevRotations[id],
    }));

    if (!dropdownStates[id]) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 144;
      const spaceRightOfButton = window.innerWidth - rect.right;

      let leftPosition: number;
      const topPosition = rect.top + window.scrollY;

      leftPosition = rect.right + window.scrollX + 5;

      if (spaceRightOfButton < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }

      setDropdownPositions((prevPositions) => ({
        ...prevPositions,
        [id]: {
          top: topPosition,
          left: leftPosition,
        },
      }));
    } else {
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
          const dropdownNode = dropdownRefs.current[id];
          const actionButtonNode = actionButtonRefs.current[id];
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

  const rows = transportadoras.data?.map((transportadora) => {
    const linha: Record<string, any> = {};

    headers?.forEach((coluna) => {
      if (coluna !== 'ações') {
        linha[coluna] =
          transportadora[coluna as keyof typeof transportadora] ?? '';
      }
    });

    linha.ações = (
      <div className="relative">
        {userPermissions.editar && (
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[transportadora.codtransp] = el;
              }
            }}
            onClick={(e) =>
              toggleDropdown(transportadora.codtransp, e.currentTarget)
            }
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[transportadora.codtransp]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
        )}

        {dropdownStates[transportadora.codtransp] &&
          dropdownPositions[transportadora.codtransp] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[transportadora.codtransp] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                position: 'absolute',
                top: dropdownPositions[transportadora.codtransp]?.top,
                left: dropdownPositions[transportadora.codtransp]?.left,
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
                    onClick={() => {
                      setIdTransportadora(transportadora.codtransp);
                      setEditarOpen(true);
                      closeAllDropdowns();
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 w-full text-left"
                    role="menuitem"
                  >
                    <GoPencil
                      className="mr-2 text-gray-400 dark:text-gray-500"
                      size={16}
                    />
                    Editar
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );

    return linha;
  });

  const handleColunaSubstituida = (
    colA: string,
    colB: string,
    tipo: 'swap' | 'replace' = 'replace',
  ) => {
    setHeaders((prev) => {
      const novaOrdem = [...prev];
      const indexA = novaOrdem.indexOf(colA);
      const indexB = novaOrdem.indexOf(colB);

      if (tipo === 'swap' && indexA !== -1 && indexB !== -1) {
        [novaOrdem[indexA], novaOrdem[indexB]] = [
          novaOrdem[indexB],
          novaOrdem[indexA],
        ];
      } else if (tipo === 'replace' && indexA !== -1) {
        const filteredHeaders = novaOrdem.filter((h) => h !== colB);
        const actualIndexA = filteredHeaders.indexOf(colA);
        if (actualIndexA !== -1) {
          filteredHeaders[actualIndexA] = colB;
        }
        return filteredHeaders;
      }
      return novaOrdem;
    });
  };

  return (
    <div className=" h-full flex flex-col flex-grow border border-gray-300  bg-white dark:bg-slate-900">
      <main className="p-4  w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Transportadoras
            </div>
            {userPermissions.cadastrar && (
              <DefaultButton
                onClick={() => {
                  setCadastrarOpen(true);
                }}
                className="flex items-center gap-0 px-3 py-2 text-sm h-8"
                text="Novo"
                icon={<PlusIcon size={18} />}
              />
            )}
          </div>
        </header>

        <DataTable
          carregando={loading}
          headers={headers}
          rows={rows || []}
          onColunaSubstituida={handleColunaSubstituida}
          meta={transportadoras.meta}
          onPageChange={(newPage) => {
            setPage(newPage);
          }}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1); // Reset para primeira página ao mudar perPage
          }}
          onSearch={(e) => setSearch(e.target.value)}
          onSearchBlur={() => debouncedSearchUnico(search)}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') debouncedSearchUnico(search);
          }}
          searchInputPlaceholder="Pesquisar por código, nome, fantasia ou CPF/CNPJ..."
          colunasFiltro={colunasDbTransp}
          onFiltroChange={(novosFiltros) => {
            setFiltros(novosFiltros);
            setPage(1); // Reset para primeira página ao mudar filtros
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem(
              'limiteColunasTransportadoras',
              novoLimite.toString(),
            );
          }}
        />
      </main>

      <Cadastrar
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={() => {
          setPage(1);
          if (search) {
            fetchTransportadorasUnico({ page: 1, perPage, search });
          } else {
            fetchTransportadoras({ page: 1, perPage, filtros });
          }
        }}
      />

      <Editar
        isOpen={editarOpen}
        onClose={() => setEditarOpen(false)}
        transportadoraId={idTransportadora}
        onSuccess={() => {
          if (search) {
            fetchTransportadorasUnico({ page, perPage, search });
          } else {
            fetchTransportadoras({ page, perPage, filtros });
          }
        }}
      />
    </div>
  );
};

export default TransportadorasPage;
