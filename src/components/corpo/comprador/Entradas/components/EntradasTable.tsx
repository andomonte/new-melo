import React, { useState, useRef, useEffect } from 'react';
import { ChangeEvent, KeyboardEvent } from 'react';
import { CircleChevronDown, Eye, Edit3, Trash2, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import DataTableFiltroV3 from '@/components/common/DataTableFiltroV3';
import { EntradaDTO, EntradasMeta } from '../types';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../utils/formatters';

interface EntradasTableProps {
  data: EntradaDTO[];
  meta: EntradasMeta;
  loading: boolean;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onView: (item: EntradaDTO) => void;
  onEdit: (item: EntradaDTO) => void;
  onDelete: (item: EntradaDTO) => void;
  canManageEntradas: boolean;
}

export const EntradasTable: React.FC<EntradasTableProps> = ({
  data,
  meta,
  loading,
  onSearch,
  onSearchBlur,
  onSearchKeyDown,
  onPageChange,
  onPerPageChange,
  onView,
  onEdit,
  onDelete,
  canManageEntradas,
}) => {
  // Estados para dropdown de ações
  const [dropdownStates, setDropdownStates] = useState<{[key: string]: boolean}>({});
  const dropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const actionButtonRefs = useRef<{[key: string]: HTMLButtonElement | null}>({});
  const [dropdownPositions, setDropdownPositions] = useState<{[key: string]: {top: number; left: number} | null}>({});
  const [iconRotations, setIconRotations] = useState<{[key: string]: boolean}>({});

  // Configuração das colunas da tabela
  const colunasEntradas = [
    'numeroNF',
    'serie', 
    'fornecedorNome',
    'dataEmissao',
    'dataEntrada',
    'valorTotal',
    'status',
    'tipoEntrada',
    'acoes'
  ];

  // Funções para dropdown de ações
  const toggleDropdown = (id: string, buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const isOpen = dropdownStates[id];
    
    // Fechar todos os dropdowns primeiro
    setDropdownStates({});
    setIconRotations({});
    
    if (!isOpen) {
      setDropdownStates({ [id]: true });
      setIconRotations({ [id]: true });
      setDropdownPositions({
        [id]: {
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX - 100
        }
      });
    }
  };

  const closeAllDropdowns = () => {
    setDropdownStates({});
    setIconRotations({});
    setDropdownPositions({});
  };

  // Effect para fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let shouldClose = false;
      for (const entradaId in dropdownStates) {
        if (dropdownStates[entradaId]) {
          const dropdownNode = dropdownRefs.current[entradaId];
          const actionButtonNode = actionButtonRefs.current[entradaId];
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

  const handleViewAction = (entrada: EntradaDTO) => {
    closeAllDropdowns();
    onView(entrada);
  };

  const handleEditAction = (entrada: EntradaDTO) => {
    closeAllDropdowns();
    onEdit(entrada);
  };

  const handleDeleteAction = (entrada: EntradaDTO) => {
    closeAllDropdowns();
    onDelete(entrada);
  };

  // Formatar dados para a tabela
  const formatTableData = () => {
    return data.map(entrada => ({
      ...entrada,
      dataEmissao: formatDate(entrada.dataEmissao),
      dataEntrada: formatDate(entrada.dataEntrada),
      valorTotal: formatCurrency(entrada.valorTotal),
      status: (
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(entrada.status)}`}>
          {getStatusLabel(entrada.status)}
        </span>
      ),
      tipoEntrada: (
        <span className="flex items-center gap-1">
          {entrada.tipoEntrada === 'XML' ? <FileText size={14} /> : <Edit3 size={14} />}
          {entrada.tipoEntrada}
        </span>
      ),
      acoes: (
        <div className="flex justify-center">
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[entrada.id] = el;
              }
            }}
            onClick={(e) => toggleDropdown(entrada.id, e.currentTarget)}
            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            title="Ações"
            style={{
              transform: iconRotations[entrada.id] ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <CircleChevronDown size={20} />
          </button>
          {dropdownStates[entrada.id] && dropdownPositions[entrada.id] && createPortal(
            <div
              key={`portal-dropdown-${entrada.id}`}
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[entrada.id] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-600"
              style={{
                position: 'absolute',
                top: dropdownPositions[entrada.id]?.top,
                left: dropdownPositions[entrada.id]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000
              }}
            >
              <div className="py-1" role="menu" aria-orientation="vertical">
                <button
                  onClick={() => handleViewAction(entrada)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Ver
                </button>
                {canManageEntradas && entrada.status === 'P' && (
                  <button
                    onClick={() => handleEditAction(entrada)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Edit3 className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                    Editar
                  </button>
                )}
                {canManageEntradas && entrada.status === 'P' && (
                  <button
                    onClick={() => handleDeleteAction(entrada)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-700 focus:outline-none focus:bg-red-100 dark:focus:bg-red-700 focus:text-red-900 dark:focus:text-red-100 w-full"
                    role="menuitem"
                  >
                    <Trash2 className="mr-2 text-red-400 dark:text-red-500" size={16} />
                    Excluir
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      )
    }));
  };

  return (
    <DataTableFiltroV3
      headers={colunasEntradas}
      rows={formatTableData()}
      meta={meta}
      carregando={loading}
      onSearch={onSearch}
      onSearchBlur={onSearchBlur}
      onSearchKeyDown={onSearchKeyDown}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      searchInputPlaceholder="Buscar por NF, fornecedor..."
      limiteColunas={colunasEntradas.length}
      onLimiteColunasChange={() => {}}
    />
  );
};