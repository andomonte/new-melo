import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {
  Transportadoras,
  buscaTransportadoras,
  getTransportadoras,
} from '@/data/transportadoras/transportadoras';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import Cadastrar from './modalCadastrar';
import Editar from './modalEditar';
import { GoPencil } from 'react-icons/go';
import { BsTruck } from 'react-icons/bs';
import { PlusIcon, CircleChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/authContexts';

const TransportadorasPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [transportadoras, setTransportadoras] = useState<Transportadoras>(
    { data: [], meta: { total: 0, lastPage: 1, currentPage: 1, perPage: 10 } } as any,
  );
  const [loading, setLoading] = useState(false);
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [idTransportadora, setIdTransportadora] = useState<string>('');
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);
  const [colunasDbTransp, setColunasDbTransp] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const salvo = localStorage.getItem('limiteColunasTransportadoras');
      return salvo ? parseInt(salvo, 10) : 10;
    }
    return 10;
  });
  const [headers, setHeaders] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as any;

  // Dropdown
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [dropdownStates, setDropdownStates] = useState<{ [key: string]: boolean }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{ [key: string]: { top: number; left: number } | null }>({});
  const [iconRotations, setIconRotations] = useState<{ [key: string]: boolean }>({});

  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  const toggleDropdown = (id: string, buttonElement: HTMLButtonElement) => {
    const wasOpen = dropdownStates[id];
    closeAllDropdowns();
    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownWidth = 144;
      let leftPosition = rect.right + window.scrollX + 5;
      if (window.innerWidth - rect.right < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }
      setDropdownStates({ [id]: true });
      setIconRotations({ [id]: true });
      setDropdownPositions({ [id]: { top: rect.top + window.scrollY, left: leftPosition } });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = true;
      for (const id in dropdownStates) {
        if (
          dropdownRefs.current[id]?.contains(event.target as Node) ||
          actionButtonRefs.current[id]?.contains(event.target as Node)
        ) {
          shouldClose = false;
          break;
        }
      }
      if (shouldClose) closeAllDropdowns();
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [dropdownStates, closeAllDropdowns]);

  // Busca — exige 3+ caracteres
  const fetchData = useCallback(async () => {
    const temBusca = search && search.length >= 3;
    const temFiltros = filtros && filtros.length > 0;

    if (!temBusca && !temFiltros) {
      setTransportadoras({ data: [], meta: { total: 0, lastPage: 1, currentPage: 1, perPage } } as any);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = temBusca
        ? await getTransportadoras({ page, perPage, search })
        : await buscaTransportadoras({ page, perPage, filtros });
      setTransportadoras(response);

      if (response.data?.length > 0) {
        const colunasDinamicas = Object.keys(response.data[0]).filter(
          (coluna) => !['ações'].includes(coluna.toLowerCase()),
        );
        setColunasDbTransp(colunasDinamicas);
        setHeaders(['ações', ...colunasDinamicas]);
      } else {
        setHeaders(['ações']);
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar transportadoras',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, filtros, limiteColunas, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setFiltros([]);
    setSearch(value);
  }, 500);

  // Após salvar (novo/edição), filtra a listagem pela transportadora salva
  const handleSuccess = (busca?: string) => {
    const termo = (busca || '').trim();
    if (termo) {
      setFiltros([]);
      setPage(1);
      setSearch(termo);
    } else {
      fetchData();
    }
  };

  const rows = transportadoras.data?.map((transportadora) => {
    const linha: Record<string, any> = {};
    const id = transportadora.codtransp;

    headers?.forEach((coluna) => {
      if (coluna.toLowerCase() === 'ações') {
        linha[coluna] = (
          <div className="relative flex items-center justify-center">
            <button
              ref={(el) => { if (el) actionButtonRefs.current[id] = el; }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 ${iconRotations[id] ? 'rotate-180' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleDropdown(id, e.currentTarget); }}
              aria-label="Ações"
            >
              <CircleChevronDown size={18} />
            </button>
            {dropdownStates[id] && dropdownPositions[id] && createPortal(
              <div
                ref={(el) => { if (el) dropdownRefs.current[id] = el; }}
                className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5"
                style={{ position: 'absolute', top: dropdownPositions[id]?.top, left: dropdownPositions[id]?.left, minWidth: '144px', zIndex: 999 }}
              >
                <button
                  onClick={() => { setIdTransportadora(id); setEditarOpen(true); closeAllDropdowns(); }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 w-full text-left"
                >
                  <GoPencil className="mr-2 text-gray-400 dark:text-gray-500" size={16} />
                  Editar
                </button>
              </div>,
              document.body,
            )}
          </div>
        );
      } else {
        linha[coluna] = transportadora[coluna as keyof typeof transportadora] ?? '';
      }
    });

    return linha;
  });

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-black dark:text-white">
              Transportadoras
            </h1>
          </div>
          <div className="flex gap-2 items-center">
            <DefaultButton
              variant="primary"
              size="default"
              onClick={() => setCadastrarOpen(true)}
              text="Novo"
              icon={<PlusIcon size={16} />}
            />
          </div>
        </div>

        {/* DataTable */}
        <div className="flex-1 min-h-20 flex flex-col">
          <DataTable
            screenKey="cadastro-transportadoras"
            userName={user?.usuario}
            carregando={loading}
            headers={headers}
            rows={rows || []}
            semColunaDeAcaoPadrao={true}
            nonsortableColumns={['ações']}
            meta={transportadoras.meta}
            onPageChange={setPage}
            onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
            onSearch={(e) => debouncedSearch(e.target.value)}
            onSearchBlur={() => {}}
            onSearchKeyDown={() => {}}
            searchInputPlaceholder="Digite pelo menos 3 caracteres para buscar..."
            noDataMessage={!search || search.length < 3 ? (
              <div className="flex flex-col items-center">
                <BsTruck className="dark:text-purple-300 text-purple-600" size={60} />
                <div className="text-center font-bold dark:text-purple-300 text-purple-600 mt-3">PESQUISAR UMA TRANSPORTADORA</div>
                <div className="text-purple-600 dark:text-purple-300 text-xs mt-1">Digite pelo menos 3 caracteres e pressione enter...</div>
              </div>
            ) : 'Nenhuma transportadora encontrada'}
            colunasFiltro={colunasDbTransp}
            onFiltroChange={(novosFiltros) => { setPage(1); setSearch(''); setFiltros(novosFiltros); }}
            limiteColunas={limiteColunas}
            onLimiteColunasChange={(novoLimite) => {
              setLimiteColunas(novoLimite);
              localStorage.setItem('limiteColunasTransportadoras', novoLimite.toString());
            }}
          />
        </div>
      </main>

      <Cadastrar
        isOpen={cadastrarOpen}
        onClose={() => setCadastrarOpen(false)}
        onSuccess={handleSuccess}
        onEditarTransportadora={(id) => {
          setCadastrarOpen(false);
          setIdTransportadora(id);
          setEditarOpen(true);
        }}
      />

      {editarOpen && (
        <Editar
          isOpen={editarOpen}
          onClose={() => setEditarOpen(false)}
          transportadoraId={idTransportadora}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default TransportadorasPage;
