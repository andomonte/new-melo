import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { GoPencil } from 'react-icons/go';
import { PlusIcon, CircleChevronDown, Trash2 } from 'lucide-react';

import DataTable from '@/components/common/DataTableFiltro';
import { DefaultButton } from '@/components/common/Buttons';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { GenericFormModal, FormComponentProps } from './GenericFormModal';

// ... (Nenhuma alteração nas interfaces e tipos) ...
export type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

export interface PaginationMeta {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
}

interface ListApiResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CrudApi<T> {
  list: (params: {
    page: number;
    perPage: number;
    search: string;
    filtros: Filtro[];
  }) => Promise<ListApiResponse<T>>;
  getById?: (id: string | number) => Promise<T>;
  create?: (data: T) => Promise<any>;
  update?: (id: string | number, data: T) => Promise<any>;
  remove: (id: string | number) => Promise<void>;
}

export interface CrudColumn<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
}

interface GenericCrudPageProps<T> {
  title: string;
  entityName: string;
  idKey: keyof T;
  api: CrudApi<T>;
  columns: CrudColumn<T>[];
  permissions: {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
  FormComponent: React.ComponentType<FormComponentProps<T>>;
  validationSchema: z.Schema<T>;
  emptyState: T;
}

export function GenericCrudPage<T extends { [key: string]: any }>({
  title,
  entityName,
  idKey,
  api,
  columns,
  permissions,
  FormComponent,
  validationSchema,
  emptyState,
}: GenericCrudPageProps<T>) {
  const [data, setData] = useState<ListApiResponse<T>>({
    data: [],
    meta: {} as PaginationMeta,
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [limiteColunas, setLimiteColunas] = useState<number>(() => {
    const savedLimit = localStorage.getItem(`limiteColunas_${entityName}`);
    return savedLimit ? parseInt(savedLimit, 10) : 7;
  });
  // Estados para controlar colunas dinâmicas
  const [colunasDb, setColunasDb] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const { toast } = useToast();
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<T | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | number | null>(
    null,
  );
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownStates, setDropdownStates] = useState<{
    [key: number]: boolean;
  }>({});
  const [dropdownPositions, setDropdownPositions] = useState<{
    [key: number]: { top: number; left: number } | null;
  }>({});
  const [iconRotations, setIconRotations] = useState<{
    [key: number]: boolean;
  }>({});
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const actionButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>(
    {},
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.list({ page, perPage, search: '', filtros });
      // Se a resposta for válida, atualiza o estado.
      // Se a resposta for undefined, o estado não muda, prevenindo erros.
      if (response && response.data) {
        setData(response);

        // Implementar lógica de colunas dinâmicas similar à página de clientes
        if (response.data.length > 0) {
          const colunasDinamicas = Object.keys(response.data[0]).filter(
            (coluna) => coluna !== 'ações' && coluna !== 'Ações',
          );
          const colunasFiltradas = colunasDinamicas.slice(0, limiteColunas);
          setColunasDb(colunasDinamicas);

          // Adicionar 'Ações' no início se não estiver presente
          if (!colunasFiltradas.includes('Ações')) {
            colunasFiltradas.unshift('Ações');
          }
          setHeaders(colunasFiltradas);
        }
      } else {
        // Garante que o estado não fique inconsistente se a API retornar algo inesperado
        setData({ data: [], meta: {} as PaginationMeta });
        setHeaders([]);
        setColunasDb([]);
      }
    } catch (error) {
      console.error(`Erro ao buscar ${entityName}s:`, error);
      // Em caso de erro, garante que os dados sejam um array vazio para não quebrar a UI
      setData({ data: [], meta: {} as PaginationMeta });
      setHeaders([]);
      setColunasDb([]);
    } finally {
      setLoading(false);
    }
  }, [api, page, perPage, filtros, entityName, limiteColunas]);

  const fetchDataWithSearch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.list({ page, perPage, search, filtros: [] });
      // Se a resposta for válida, atualiza o estado.
      if (response && response.data) {
        setData(response);

        // Atualizar colunas dinâmicas também na busca
        if (response.data.length > 0) {
          const colunasDinamicas = Object.keys(response.data[0]).filter(
            (coluna) => coluna !== 'ações' && coluna !== 'Ações',
          );
          const colunasFiltradas = colunasDinamicas.slice(0, limiteColunas);
          setColunasDb(colunasDinamicas);

          // Adicionar 'Ações' no início se não estiver presente
          if (!colunasFiltradas.includes('Ações')) {
            colunasFiltradas.unshift('Ações');
          }
          setHeaders(colunasFiltradas);
        }
      } else {
        setData({ data: [], meta: {} as PaginationMeta });
      }
    } catch (error) {
      console.error(`Erro ao buscar ${entityName}s:`, error);
      setData({ data: [], meta: {} as PaginationMeta });
    } finally {
      setLoading(false);
    }
  }, [api, page, perPage, search, entityName, limiteColunas]);

  const debouncedSearchData = useDebouncedCallback(() => {
    setPage(1);
    fetchDataWithSearch();
  }, 500);

  useEffect(() => {
    if (search) {
      fetchDataWithSearch();
    } else {
      fetchData();
    }
  }, [page, perPage, fetchData, fetchDataWithSearch, search]);

  // Efeito para refetch quando limiteColunas muda
  useEffect(() => {
    // Sempre usar fetchData para recarregar colunas, depois aplicar busca se necessário
    fetchData();
  }, [limiteColunas, fetchData]);

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

  const closeAllDropdowns = useCallback(() => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  }, []);

  const closeModals = () => {
    setFormModalOpen(false);
    setDeleteModalOpen(false);
    setCurrentItem(null);
    setSelectedItemId(null);
  };

  const handleOpenEdit = async (id: string | number) => {
    if (!permissions.canEdit || !api.getById) return;
    closeAllDropdowns();
    setIsLoadingItem(true);
    setFormModalOpen(true);
    try {
      const itemData = await api.getById(id);
      setCurrentItem(itemData);
    } catch (error) {
      console.error(`Erro ao buscar ${entityName} para edição:`, error);
      closeModals();
    } finally {
      setIsLoadingItem(false);
    }
  };

  const handleOpenDelete = (id: string | number) => {
    if (!permissions.canDelete) return;
    closeAllDropdowns();
    setSelectedItemId(id);
    setDeleteModalOpen(true);
  };

  const handleOpenCreate = () => {
    if (!permissions.canCreate) return;
    setCurrentItem(emptyState);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (formData: T) => {
    setIsSaving(true);
    try {
      const isEditMode = currentItem && currentItem[idKey];

      if (isEditMode && api.update) {
        await api.update(currentItem[idKey], formData);
        // ✅ 3. Feedback de sucesso na atualização
        toast({
          title: 'Sucesso!',
          description: `${
            entityName.charAt(0).toUpperCase() + entityName.slice(1)
          } atualizado(a) com sucesso.`,
        });
      } else if (api.create) {
        await api.create(formData);
        // ✅ 3. Feedback de sucesso na criação
        toast({
          title: 'Sucesso!',
          description: `${
            entityName.charAt(0).toUpperCase() + entityName.slice(1)
          } cadastrado(a) com sucesso.`,
        });
      }

      await fetchData();
      closeModals();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || `Ocorreu um erro ao salvar.`;
      // ✅ 3. Feedback de erro
      toast({
        title: `Erro ao Salvar ${entityName}`,
        description: errorMessage,
        variant: 'destructive',
      });
      console.error(`Erro ao salvar ${entityName}:`, error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedItemId) return;
    try {
      await api.remove(selectedItemId);
      // ✅ 3. Feedback de sucesso na exclusão
      toast({
        title: 'Sucesso!',
        description: `${
          entityName.charAt(0).toUpperCase() + entityName.slice(1)
        } excluído(a) com sucesso.`,
      });
      await fetchData();
      closeModals();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || `Ocorreu um erro ao excluir.`;
      // ✅ 3. Feedback de erro
      toast({
        title: `Erro ao Excluir ${entityName}`,
        description: errorMessage,
        variant: 'destructive',
      });
      console.error(`Erro ao deletar ${entityName}:`, error);
      throw error;
    }
  };

  const toggleDropdown = (uiKey: number, buttonElement: HTMLButtonElement) => {
    const wasOpen = dropdownStates[uiKey];
    closeAllDropdowns();
    if (!wasOpen) {
      const rect = buttonElement.getBoundingClientRect();
      const top = rect.bottom + window.scrollY + 4;
      const left = rect.left + window.scrollX;
      setDropdownPositions({ [uiKey]: { top, left } });
      setIconRotations({ [uiKey]: true });
      setDropdownStates({ [uiKey]: true });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = true;
      Object.keys(dropdownStates).forEach((keyStr) => {
        const key = parseInt(keyStr, 10);
        if (
          dropdownRefs.current[key]?.contains(event.target as Node) ||
          actionButtonRefs.current[key]?.contains(event.target as Node)
        ) {
          shouldClose = false;
        }
      });
      if (shouldClose) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mouseup', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [dropdownStates, closeAllDropdowns]);

  // ✅ CORREÇÃO SEGURA: Usamos (data?.data || []) para garantir que `.map` sempre opere sobre um array.
  // Isso previne o erro se `data` ou `data.data` estiverem temporariamente `undefined`.
  const tableRows = (data?.data || []).map((item, index) => {
    const originalId = item[idKey];
    const uiKey = index;
    const rowData: { [key: string]: React.ReactNode } = {};

    // Usar headers dinâmicos em vez de visibleColumns fixas
    headers.forEach((headerName) => {
      if (headerName !== 'ações' && headerName !== 'Ações') {
        // Verificar se existe uma coluna correspondente na configuração
        const column = columns.find((col) => col.header === headerName);
        if (column) {
          rowData[headerName] = column.cell(item);
        } else {
          // Se não há coluna configurada, usar o valor direto do item
          rowData[headerName] = item[headerName] ?? '';
        }
      }
    });

    return {
      Ações: (
        <div className="relative">
          <button
            ref={(el) => {
              actionButtonRefs.current[uiKey] = el;
            }}
            onClick={(e) => toggleDropdown(uiKey, e.currentTarget)}
            className="p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-transform duration-200"
            style={{
              transform: iconRotations[uiKey]
                ? 'rotate(180deg)'
                : 'rotate(0deg)',
            }}
          >
            <CircleChevronDown size={18} />
          </button>
          {dropdownStates[uiKey] &&
            dropdownPositions[uiKey] &&
            createPortal(
              <div
                ref={(el) => {
                  dropdownRefs.current[uiKey] = el;
                }}
                className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600"
                style={{
                  position: 'absolute',
                  top: dropdownPositions[uiKey]?.top,
                  left: dropdownPositions[uiKey]?.left,
                  zIndex: 50,
                  minWidth: '144px',
                  borderRadius: '0.375rem',
                  boxShadow:
                    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
              >
                <div className="py-1">
                  {permissions.canEdit && api.getById && api.update && (
                    <button
                      onClick={() => handleOpenEdit(originalId)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center"
                    >
                      <GoPencil className="mr-2" size={16} /> Editar
                    </button>
                  )}
                  {permissions.canDelete && (
                    <button
                      onClick={() => handleOpenDelete(originalId)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="mr-2" size={16} /> Excluir
                    </button>
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>
      ),
      ...rowData,
    };
  });

  return (
    <div className="h-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
              {title}
            </h1>
            {permissions.canCreate && api.create && (
              <DefaultButton
                onClick={handleOpenCreate}
                variant="primary"
                text="Novo"
                icon={<PlusIcon size={16} />}
              />
            )}
          </div>
        </header>

        <DataTable
          carregando={loading}
          headers={headers}
          rows={tableRows}
          semColunaDeAcaoPadrao={true}
          onColunaSubstituida={handleColunaSubstituida}
          meta={data.meta}
          onPageChange={(newPage) => {
            setPage(newPage);
            if (search) {
              // Se há busca ativa, usar função de busca
              fetchDataWithSearch();
            } else {
              // Se não há busca, usar função de filtros
              fetchData();
            }
          }}
          onPerPageChange={(newPerPage) => {
            setPage(1);
            setPerPage(newPerPage);
            if (search) {
              fetchDataWithSearch();
            } else {
              fetchData();
            }
          }}
          onSearch={(e) => setSearch(e.target.value)}
          onSearchBlur={() => debouncedSearchData()}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') debouncedSearchData();
          }}
          searchInputPlaceholder={`Pesquisar em ${entityName}...`}
          colunasFiltro={colunasDb}
          onFiltroChange={(novosFiltros) => {
            setPage(1);
            setFiltros(novosFiltros);
            // Ao aplicar filtros, limpar a busca e usar função de filtros
            setSearch('');
            fetchData();
          }}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={(novoLimite) => {
            setLimiteColunas(novoLimite);
            localStorage.setItem(
              `limiteColunas_${entityName}`,
              novoLimite.toString(),
            );
          }}
        />
      </main>

      {isFormModalOpen && (
        <GenericFormModal<T>
          isOpen={isFormModalOpen}
          onClose={closeModals}
          onSubmit={handleFormSubmit}
          title={
            currentItem?.[idKey]
              ? `Editar ${entityName}`
              : `Cadastrar ${entityName}`
          }
          initialData={currentItem}
          validationSchema={validationSchema}
          FormComponent={FormComponent}
          isSaving={isSaving}
          isLoading={isLoadingItem}
        />
      )}

      {isDeleteModalOpen && (
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={closeModals}
          onConfirm={handleConfirmDelete}
          entityName={entityName}
          itemName={String(selectedItemId)}
        />
      )}
    </div>
  );
}
