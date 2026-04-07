import React, { useState, useRef, useEffect } from 'react';
import { ChangeEvent, KeyboardEvent } from 'react';
import { CircleChevronDown, Eye, Play, Trash2, Settings } from 'lucide-react';
import { createPortal } from 'react-dom';
import DataTableFiltroV3 from '@/components/common/DataTableFiltroV3';
import { NFeDTO, NFesMeta } from '../types';
import { formatCurrency, formatDateTime, getNFeStatusLabel, getNFeStatusColor, formatChaveNFe, isNFeProcessable } from '../utils/formatters';

interface NFeTableProps {
  data: NFeDTO[];
  meta: NFesMeta;
  loading: boolean;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onView: (item: NFeDTO) => void;
  onProcess: (item: NFeDTO) => void;
  onConfigure: (item: NFeDTO) => void;
  onDelete: (item: NFeDTO) => void;
  canManageEntradas: boolean;
}

export const NFeTable: React.FC<NFeTableProps> = ({
  data,
  meta,
  loading,
  onSearch,
  onSearchBlur,
  onSearchKeyDown,
  onPageChange,
  onPerPageChange,
  onView,
  onProcess,
  onConfigure,
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
  const colunasNFe = [
    'numeroNF',
    'serie', 
    'chaveNFe',
    'emitente',
    'dataEmissao',
    'valorTotal',
    'status',
    'dataUpload',
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
      for (const nfeId in dropdownStates) {
        if (dropdownStates[nfeId]) {
          const dropdownNode = dropdownRefs.current[nfeId];
          const actionButtonNode = actionButtonRefs.current[nfeId];
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

  const handleViewAction = (nfe: NFeDTO) => {
    closeAllDropdowns();
    onView(nfe);
  };

  const handleProcessAction = (nfe: NFeDTO) => {
    closeAllDropdowns();
    onProcess(nfe);
  };

  const handleConfigureAction = (nfe: NFeDTO) => {
    closeAllDropdowns();
    onConfigure(nfe);
  };

  const handleDeleteAction = (nfe: NFeDTO) => {
    closeAllDropdowns();
    onDelete(nfe);
  };

  // Formatar dados para a tabela
  const formatTableData = () => {
    return data.map(nfe => ({
      ...nfe,
      chaveNFe: (
        <span className="font-mono text-sm" title={nfe.chaveNFe}>
          {formatChaveNFe(nfe.chaveNFe)}
        </span>
      ),
      dataEmissao: formatDateTime(nfe.dataEmissao),
      dataUpload: formatDateTime(nfe.dataUpload),
      valorTotal: formatCurrency(nfe.valorTotal),
      status: (
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-1 text-xs rounded-full ${getNFeStatusColor(nfe.status)}`}>
            {getNFeStatusLabel(nfe.status)}
          </span>
          {/* DEBUG: Mostrar sempre para testar */}
          {(nfe as any).statusAssociacao && (
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                (nfe as any).statusAssociacao.status === 'COMPLETA'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : (nfe as any).statusAssociacao.status === 'PARCIAL'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
              title={`${(nfe as any).statusAssociacao.itensAssociados} de ${(nfe as any).statusAssociacao.totalItens} itens associados (${(nfe as any).statusAssociacao.percentual}%)`}
            >
              {(nfe as any).statusAssociacao.status === 'COMPLETA' && '🟢'}
              {(nfe as any).statusAssociacao.status === 'PARCIAL' && '🟡'}
              {(nfe as any).statusAssociacao.status === 'NAO_INICIADA' && '⚪'}
              {' '}
              {(nfe as any).statusAssociacao.itensAssociados}/{(nfe as any).statusAssociacao.totalItens}
            </span>
          )}
        </div>
      ),
      acoes: (
        <div className="flex justify-center">
          <button
            ref={(el) => {
              if (el) {
                actionButtonRefs.current[nfe.id] = el;
              }
            }}
            onClick={(e) => toggleDropdown(nfe.id, e.currentTarget)}
            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            title="Ações"
            style={{
              transform: iconRotations[nfe.id] ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <CircleChevronDown size={20} />
          </button>
          {dropdownStates[nfe.id] && dropdownPositions[nfe.id] && createPortal(
            <div
              key={`portal-dropdown-${nfe.id}`}
              ref={(el) => {
                if (el) {
                  dropdownRefs.current[nfe.id] = el;
                }
              }}
              className="text-slate-800 bg-white dark:text-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-600"
              style={{
                position: 'absolute',
                top: dropdownPositions[nfe.id]?.top,
                left: dropdownPositions[nfe.id]?.left,
                minWidth: '144px',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
                zIndex: 1000
              }}
            >
              <div className="py-1" role="menu" aria-orientation="vertical">
                <button
                  onClick={() => handleViewAction(nfe)}
                  className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                  role="menuitem"
                >
                  <Eye className="mr-2 text-blue-500 dark:text-blue-400" size={16} />
                  Ver
                </button>
                {canManageEntradas && nfe.status === 'PROCESSADA' && (
                  <button
                    onClick={() => handleConfigureAction(nfe)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Settings className="mr-2 text-orange-500 dark:text-orange-400" size={16} />
                    Configurar
                  </button>
                )}
                {canManageEntradas && isNFeProcessable(nfe.status) && (
                  <button
                    onClick={() => handleProcessAction(nfe)}
                    className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700 focus:text-gray-900 dark:focus:text-gray-100 w-full"
                    role="menuitem"
                  >
                    <Play className="mr-2 text-green-500 dark:text-green-400" size={16} />
                    Processar
                  </button>
                )}
                {canManageEntradas && nfe.status === 'RECEBIDA' && (
                  <button
                    onClick={() => handleDeleteAction(nfe)}
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
      headers={colunasNFe}
      rows={formatTableData()}
      meta={meta}
      carregando={loading}
      onSearch={onSearch}
      onSearchBlur={onSearchBlur}
      onSearchKeyDown={onSearchKeyDown}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      searchInputPlaceholder="Buscar por NFe, chave, emitente..."
      limiteColunas={colunasNFe.length}
      onLimiteColunasChange={() => {}}
    />
  );
};