/*
 * ✅ CORREÇÕES IMPLEMENTADAS:
 *
 * 1. REORGANIZAÇÃO DAS COLUNAS DA TABELA:
 *    - Coluna "Ações" movida para extrema esquerda (primeira coluna)
 *    - Coluna "Editar" redundante foi removida completamente
 *    - Funcionalidade de edição mantida no menu dropdown da coluna "Ações"
 *
 * 2. CORREÇÃO DA FUNCIONALIDADE DE SALVAR NOS MODAIS:
 *    - Implementado tratamento robusto de erros com try...catch detalhado
 *    - Adicionados logs console.log/console.error para facilitar debug
 *    - Melhorado tratamento de erros de validação e de API
 *    - Mensagens de erro mais específicas e informativas
 *
 * 3. TRATAMENTO DE ERROS MELHORADO:
 *    - Logs detalhados em cada etapa do processo de salvamento
 *    - Distinção clara entre erros de validação e erros da API
 *    - Captura e exibição de stack traces para debug
 *    - Fallbacks para diferentes tipos de erro
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Fornecedores,
  buscaFornecedores,
  getFornecedores,
} from '@/data/fornecedores/fornecedores';
import { useDebouncedCallback } from 'use-debounce';
import DataTable from '@/components/common/DataTableFiltro';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import ModalCadastrarFornecedor from './modalCadastrar';
import ModalEditarFornecedor from './modalEditar';
import { GoPencil } from 'react-icons/go';
import { PlusIcon, CircleChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

const FornecedoresPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [fornecedores, setFornecedores] = useState<Fornecedores>(
    {} as Fornecedores,
  );
  const [loading, setLoading] = useState(true);
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [idFornecedor, setIdFornecedor] = useState<string>('');
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);
  const [colunasDb, setColunasDb] = useState<string[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const salvo = localStorage.getItem('limiteColunasFornecedores');
    return salvo ? parseInt(salvo, 10) : 5;
  });
  const [headers, setHeaders] = useState<string[]>([]);
  const [forceUpdate, setForceUpdate] = useState(0);
  const { toast } = useToast();

  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>(
    {},
  );
  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: string]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: string]: boolean;
  }>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = search
          ? await getFornecedores({ page, perPage, search })
          : await buscaFornecedores({ page, perPage, filtros });
        setFornecedores(response);

        if (response.data?.length > 0) {
          const colunasDinamicas = Object.keys(response.data[0]).filter(
            (coluna) => coluna !== 'ações',
          );
          const colunasLimitadas = colunasDinamicas.slice(0, limiteColunas);
          setColunasDb(colunasDinamicas);

          // ✅ CORREÇÃO: Mover coluna "ações" para o início da tabela (extrema esquerda)
          const headersOrganizados = ['ações', ...colunasLimitadas];
          setHeaders(headersOrganizados);
        } else if (!search && filtros.length === 0) {
          setHeaders(['ações']);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast({
          title: 'Erro ao carregar fornecedores',
          description: 'Verifique sua conexão e tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page, perPage, search, filtros, limiteColunas, forceUpdate, toast]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setFiltros([]);
    setSearch(value);
  }, 500);

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
      const topPosition = rect.top + window.scrollY;
      let leftPosition = rect.right + window.scrollX + 5;

      if (window.innerWidth - rect.right < dropdownWidth) {
        leftPosition = rect.left + window.scrollX - dropdownWidth;
      }
      setDropdownStates({ [id]: true });
      setIconRotations({ [id]: true });
      setDropdownPositions({ [id]: { top: topPosition, left: leftPosition } });
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
      if (shouldClose) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => document.removeEventListener('mouseup', handleClickOutside);
  }, [dropdownStates, closeAllDropdowns]);

  const rows = fornecedores.data?.map((fornecedor) => {
    const linha: Record<string, any> = {};
    headers?.forEach((coluna) => {
      if (coluna !== 'ações') {
        linha[coluna] = fornecedor[coluna as keyof typeof fornecedor] ?? '';
      }
    });
    const id = fornecedor.cod_credor;
    if (!id) return null;

    // ✅ CORREÇÃO: Coluna "ações" agora é posicionada como primeira coluna (extrema esquerda)
    // Removida coluna "editar" redundante - toda funcionalidade está no menu dropdown de "ações"
    linha.ações = (
      <div className="relative">
        <button
          ref={(el) => {
            if (el) actionButtonRefs.current[id] = el;
          }}
          onClick={(e) => toggleDropdown(id, e.currentTarget)}
          className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
          title="Mais Ações"
          style={{
            transform: iconRotations[id] ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <CircleChevronDown size={18} />
        </button>
        {dropdownStates[id] &&
          dropdownPositions[id] &&
          createPortal(
            <div
              ref={(el) => {
                if (el) dropdownRefs.current[id] = el;
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                position: 'absolute',
                top: dropdownPositions[id]?.top,
                left: dropdownPositions[id]?.left,
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
                <button
                  onClick={() => {
                    setIdFornecedor(id);
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
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
    return linha;
  });

  // ✅ CORREÇÃO: Funções para controlar modais envolvidas em useCallback para estabilizá-las.
  const handleCloseCadastrar = useCallback(() => setCadastrarOpen(false), []);
  const handleCloseEditar = useCallback(() => setEditarOpen(false), []);
  const handleSuccess = useCallback(() => {
    setForceUpdate((prev) => prev + 1);
  }, []);

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              Fornecedores
            </div>
            <DefaultButton
              onClick={() => setCadastrarOpen(true)}
              className="flex items-center gap-0 px-3 py-2 text-sm h-8"
              text="Novo"
              icon={<PlusIcon size={18} />}
            />
          </div>
        </header>
        <DataTable
          carregando={loading}
          headers={headers}
          rows={rows || []}
          meta={fornecedores.meta}
          onPageChange={setPage}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          onSearch={(e) => debouncedSearch(e.target.value)}
          onSearchBlur={() => {}}
          onSearchKeyDown={() => {}}
          searchInputPlaceholder="Pesquisar por código, nome ou fantasia"
          colunasFiltro={colunasDb}
          onFiltroChange={(novosFiltros) => {
            setPage(1);
            setSearch('');
            setFiltros(novosFiltros);
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => setLimiteColunas(novoLimite)}
        />
      </main>
      <ModalCadastrarFornecedor
        isOpen={cadastrarOpen}
        onClose={handleCloseCadastrar}
        onSuccess={handleSuccess}
      />
      {editarOpen && (
        <ModalEditarFornecedor
          isOpen={editarOpen}
          onClose={handleCloseEditar}
          fornecedorId={idFornecedor}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default FornecedoresPage;
