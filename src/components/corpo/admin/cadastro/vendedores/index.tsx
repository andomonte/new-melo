import React, { useEffect, useRef, useState, useContext } from 'react';
import {
  Vendedores,
  getVendedores,
  getClassesVendedor,
} from '@/data/vendedores/vendedores';
import { useDebouncedCallback } from 'use-debounce';
import DataTablePadrao from '@/components/common/DataTablePadrao';
import SelectPadrao from '@/components/common/SelectPadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';
import Cadastrar from './modalCadastrar';
import Editar from './modalEditar';
import { GoPencil } from 'react-icons/go';
import { PlusIcon, CircleChevronDown, Ban, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';

const CLASSE_INATIVO = '001'; // classe que marca o vendedor como inativo (Delphi)

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

const VendedoresPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [vendedores, setVendedores] = useState<Vendedores>({} as Vendedores);
  const [loading, setLoading] = useState(true);
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [idVendedor, setIdVendedor] = useState<string>('');
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);

  const [colunasDbVendedor, setColunasDbVendedor] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasVendedores');
    return salvo ? parseInt(salvo, 10) : 10;
  });

  const { dismiss, toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

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

  // Situação (Ativo/Inativo/Todos) via classe INATIVO (001) — sem coluna nova.
  const [situacao, setSituacao] = useState<'ativo' | 'inativo' | 'todos'>(
    'ativo',
  );
  // Modal de reativação (operador escolhe a nova classe).
  const [reativarOpen, setReativarOpen] = useState(false);
  const [vendedorReativar, setVendedorReativar] = useState<any>(null);
  const [classeReativar, setClasseReativar] = useState('');
  const [salvandoSituacao, setSalvandoSituacao] = useState(false);
  const [classesOptions, setClassesOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // Filtro de situação convertido para o mecanismo de filtros do backend (coluna codcv).
  const filtroSituacao = (
    sit: 'ativo' | 'inativo' | 'todos',
  ): { campo: string; tipo: string; valor: string }[] =>
    sit === 'todos'
      ? []
      : [
          {
            campo: 'codcv',
            tipo: sit === 'inativo' ? 'igual' : 'diferente',
            valor: CLASSE_INATIVO,
          },
        ];

  // Carrega as classes uma vez (para o modal de reativação).
  useEffect(() => {
    getClassesVendedor({ page: 1, perPage: 999, search: '' })
      .then((r: any) =>
        setClassesOptions(
          (r?.data || [])
            .filter((c: any) => String(c.codcv) !== CLASSE_INATIVO)
            .map((c: any) => ({
              value: String(c.codcv),
              label: `${c.codcv} - ${c.descr}`,
            })),
        ),
      )
      .catch(() => {});
  }, []);

  const fetchVendedores = async ({
    page,
    perPage,
    filtros,
    sit,
    force,
  }: {
    page: number;
    perPage: number;
    filtros: { campo: string; tipo: string; valor: string }[];
    sit?: 'ativo' | 'inativo' | 'todos';
    force?: boolean;
  }) => {
    const filtrosEfetivos = [...filtros, ...filtroSituacao(sit ?? situacao)];
    const ultima = ultimaChamada.current;
    const filtrosString = JSON.stringify(filtrosEfetivos);
    const ultimaFiltrosString = JSON.stringify(ultima.filtros);

    // `force` ignora o cache (usado após inativar/reativar/cadastrar/editar).
    if (
      !force &&
      ultima.page === page &&
      ultima.perPage === perPage &&
      filtrosString === ultimaFiltrosString &&
      limiteColunas === ultima.limiteColunas
    ) {
      return;
    }

    ultimaChamada.current = {
      page,
      perPage,
      filtros: filtrosEfetivos,
      limiteColunas,
    };

    setLoading(true);

    try {
      // Sempre pela via de filtros (inclui a situação Ativo/Inativo).
      const data = await getVendedores({
        page,
        perPage,
        search: '',
        filtros: filtrosEfetivos,
      });
      setVendedores(data);

      if (data.data?.length > 0) {
        const colunasDinamicas = Object.keys(data.data[0]).filter(
          (coluna) => coluna !== 'ações',
        );
        const filtrasColunasDinamicas = colunasDinamicas.slice(
          0,
          limiteColunas,
        );
        setColunasDbVendedor(colunasDinamicas);
        if (!filtrasColunasDinamicas.includes('ações')) {
          filtrasColunasDinamicas.unshift('ações');
        }
        setHeaders(filtrasColunasDinamicas);
      }
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
      toast({
        title: 'Erro ao carregar vendedores',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendedores({ page: 1, perPage, filtros });
    dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limiteColunas]);

  useEffect(() => {
    if (headers.length)
      localStorage.setItem(
        'headersSelecionadosVendedores',
        JSON.stringify(headers),
      );
  }, [headers]);

  const fetchVendedoresUnico = async ({
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
      // Corrigido: mantém os filtros vazios para busca rápida
      const data = await getVendedores({ page, perPage, search, filtros: [] });
      setVendedores(data);
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
      toast({
        title: 'Erro ao carregar vendedores',
        description: 'Não foi possível obter os dados. Verifique sua conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearchUnico = useDebouncedCallback((value: string) => {
    setPage(1);
    fetchVendedoresUnico({ page: 1, perPage, search: value });
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
      const topPosition = rect.top + window.scrollY;

      let leftPosition = rect.right + window.scrollX + 5;

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

  const aplicarSituacao = (nova: 'ativo' | 'inativo' | 'todos') => {
    setSituacao(nova);
    setPage(1);
    fetchVendedores({ page: 1, perPage, filtros, sit: nova });
  };

  const alterarSituacaoVendedor = async (codvend: string, codcv: string) => {
    setSalvandoSituacao(true);
    try {
      const resp = await fetch('/api/vendedores/situacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codvend, codcv }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao alterar situação');
      toast({
        title:
          codcv === CLASSE_INATIVO
            ? 'Vendedor inativado'
            : 'Vendedor reativado',
      });
      fetchVendedores({ page, perPage, filtros, force: true });
      return true;
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: e.message || 'Não foi possível alterar a situação.',
      });
      return false;
    } finally {
      setSalvandoSituacao(false);
    }
  };

  const inativarVendedor = (vendedor: any) => {
    closeAllDropdowns();
    pedirConfirmacao(
      () => alterarSituacaoVendedor(vendedor.codvend, CLASSE_INATIVO),
      {
        title: 'Inativar vendedor',
        message: `Inativar o vendedor "${vendedor.nome || vendedor.codvend}"? A classe passa para INATIVO.`,
        type: 'warning',
        confirmText: 'Inativar',
        cancelText: 'Cancelar',
      },
    );
  };

  const abrirReativar = (vendedor: any) => {
    closeAllDropdowns();
    setVendedorReativar(vendedor);
    setClasseReativar('');
    setReativarOpen(true);
  };

  const confirmarReativar = async () => {
    if (!vendedorReativar || !classeReativar) return;
    const ok = await alterarSituacaoVendedor(
      vendedorReativar.codvend,
      classeReativar,
    );
    if (ok) {
      setReativarOpen(false);
      setVendedorReativar(null);
      setClasseReativar('');
    }
  };

  const rows = vendedores.data?.map((vendedor) => {
    const inativo = String((vendedor as any).codcv) === CLASSE_INATIVO;
    const linha: Record<string, any> = {};

    headers?.forEach((coluna) => {
      // Garantir que a coluna 'ações' não seja preenchida com dados do vendedor
      if (coluna !== 'ações') {
        linha[coluna] = vendedor[coluna as keyof typeof vendedor] ?? '';
      }
    });

    linha.ações = (
      <div className="relative">
        {userPermissions.editar && (
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[vendedor.codvend] = el;
              }
            }}
            onClick={(e) => toggleDropdown(vendedor.codvend, e.currentTarget)}
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            title="Mais Ações"
            style={{
              transform: iconRotations[vendedor.codvend]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
        )}

        {dropdownStates[vendedor.codvend] &&
          dropdownPositions[vendedor.codvend] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[vendedor.codvend] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                position: 'absolute',
                top: dropdownPositions[vendedor.codvend]?.top,
                left: dropdownPositions[vendedor.codvend]?.left,
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
                      setSelectedRow(vendedor);
                      setIdVendedor(vendedor.codvend);
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

                {userPermissions.editar &&
                  (inativo ? (
                    <button
                      onClick={() => abrirReativar(vendedor)}
                      className="flex items-center px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      role="menuitem"
                    >
                      <CheckCircle2 className="mr-2" size={16} />
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => inativarVendedor(vendedor)}
                      className="flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                      role="menuitem"
                    >
                      <Ban className="mr-2" size={16} />
                      Inativar
                    </button>
                  ))}
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
        // Correção para o replace: filtro para remover colB antes de adicionar,
        // para evitar duplicatas se colB já existir ou se for uma substituição real.
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
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 w-full overflow-hidden">
        <header className="mb-2 flex-shrink-0">
          <div className="flex justify-between mb-4">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Vendedores
            </div>
            <div className="flex items-center gap-2">
              {/* Situação: Ativo/Inativo/Todos (classe INATIVO) */}
              <div className="w-40">
                <SelectPadrao
                  placeholder="Situação"
                  value={situacao}
                  options={[
                    { value: 'ativo', label: 'Ativos' },
                    { value: 'inativo', label: 'Inativos' },
                    { value: 'todos', label: 'Todos' },
                  ]}
                  onValueChange={(v) =>
                    aplicarSituacao((v || 'ativo') as any)
                  }
                  required
                />
              </div>
              {userPermissions.cadastrar && (
                <DefaultButton
                  onClick={() => {
                    setSelectedRow('');
                    setCadastrarOpen(true);
                  }}
                  className="flex items-center gap-0 px-3 py-2 text-sm h-8"
                  text="Novo"
                  icon={<PlusIcon size={18} />}
                />
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-20 flex flex-col overflow-hidden">
        <DataTablePadrao
          screenKey="cadastro-vendedores"
          userName={user?.usuario}
          columnLabels={{
            codvend: 'Vendedor',
            NOMERAZAO: 'Apelido',
            nome: 'Nome',
            valobj: 'Valor Objetivo',
            comnormal: 'Comissão Normal',
            comtele: 'Comissão Telemkt',
            limite: 'Limite',
            codcv: 'Classe',
          }}
          semColunaDeAcaoPadrao={true}
          nonsortableColumns={['ações']}
          carregando={loading}
          headers={headers}
          rows={rows || []}
          onColunaSubstituida={handleColunaSubstituida}
          meta={vendedores.meta}
          onPageChange={(newPage: number) => {
            if (newPage !== page) setPage(newPage);
            fetchVendedores({ page: newPage, perPage, filtros });
          }}
          onPerPageChange={(newPerPage: number) => {
            if (newPerPage !== perPage) setPerPage(newPerPage);
            fetchVendedores({ page, perPage: newPerPage, filtros });
          }}
          onSearch={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          onSearchBlur={() => debouncedSearchUnico(search)}
          onSearchKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') debouncedSearchUnico(search);
          }}
          searchInputPlaceholder="Pesquisar por código, nome ou CPF/CNPJ..."
          colunasFiltro={colunasDbVendedor}
          onFiltroChange={(novosFiltros) => {
            setFiltros(novosFiltros);
            fetchVendedores({ page: 1, perPage, filtros: novosFiltros });
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite: number) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem(
              'limiteColunasVendedores',
              novoLimite.toString(),
            );
          }}
        />
        </div>
      </main>

      <Cadastrar
        isOpen={cadastrarOpen}
        onClose={() => {
          setCadastrarOpen(false);
          fetchVendedores({ page, perPage, filtros, force: true });
        }}
        title="Cadastrar Registro"
      >
        <div className="space-y-2">
          {selectedRow &&
            Object.entries(selectedRow).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {value?.toString()}
              </div>
            ))}
        </div>
      </Cadastrar>

      <Editar
        isOpen={editarOpen}
        onClose={() => {
          setEditarOpen(false);
          fetchVendedores({ page, perPage, filtros, force: true });
        }}
        title="Editar Registro"
        vendedorId={idVendedor}
      >
        <div className="space-y-2">
          {selectedRow &&
            Object.entries(selectedRow).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {value?.toString()}
              </div>
            ))}
        </div>
      </Editar>

      {/* Modal: Reativar vendedor (operador escolhe a nova classe) */}
      {reativarOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setReativarOpen(false)}
        >
          <div
            className="w-[92%] max-w-md rounded-lg bg-white dark:bg-slate-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-1 text-gray-700 dark:text-gray-100">
              Reativar vendedor
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {vendedorReativar?.nome || vendedorReativar?.codvend} — escolha a
              nova classe do vendedor.
            </p>
            <SelectPadrao
              searchable
              label="Classe"
              placeholder="Selecione a classe..."
              options={classesOptions}
              value={classeReativar}
              onValueChange={(v) => setClasseReativar(v)}
              required
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setReativarOpen(false)}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReativar}
                disabled={!classeReativar || salvandoSituacao}
                className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {salvandoSituacao ? 'Salvando…' : 'Reativar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {ConfirmacaoSalvarModal}
    </div>
  );
};

export default VendedoresPage;
