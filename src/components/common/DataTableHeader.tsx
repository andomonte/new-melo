import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface DataTableHeaderProps {
  headers: string[];
  colunasFiltro?: string[];
  onColunaSubstituida?: (
    colunaA: string,
    colunaB: string,
    tipo?: 'swap' | 'replace',
  ) => void;
  onActionClick?: (action: string, rowData: any) => void;
  rowData?: any;
  isHeaderRow?: boolean;
  selectedAll?: boolean;
  onSelectAll?: (selected: boolean) => void;
  onRowSelect?: (selected: boolean, rowData: any) => void;
  isSelected?: boolean;
}

export default function DataTableHeader({
  headers,
  colunasFiltro = [],
  onColunaSubstituida,
  onActionClick,
  rowData,
  isHeaderRow = false,
  selectedAll = false,
  onSelectAll,
  onRowSelect,
  isSelected = false,
}: DataTableHeaderProps) {
  const [colunaEmEdicao, setColunaEmEdicao] = useState<string | null>(null);
  const [posicaoCliqueX, setPosicaoCliqueX] = useState<number | null>(null);
  const [termoBuscaDropdown, setTermoBuscaDropdown] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setColunaEmEdicao(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderActionCell = () => {
    if (isHeaderRow) {
      return (
        <th className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center w-[100px]">
          <div className="flex justify-center">AÇÕES</div>
        </th>
      );
    }

    return (
      <td className="px-2 py-2 text-center w-[100px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" type="button">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onActionClick?.('ver', rowData)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onActionClick?.('editar', rowData)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onActionClick?.('excluir', rowData)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    );
  };

  const renderSelectionCell = () => {
    if (isHeaderRow) {
      return (
        <th className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center w-[60px]">
          <div className="flex justify-center">
            <Checkbox
              checked={selectedAll}
              onCheckedChange={onSelectAll}
              aria-label="Selecionar todos"
            />
          </div>
        </th>
      );
    }

    return (
      <td className="px-2 py-2 text-center w-[60px]">
        <div className="flex justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onRowSelect?.(checked as boolean, rowData)
            }
            aria-label="Selecionar linha"
          />
        </div>
      </td>
    );
  };

  const renderDataCell = (header: string, index: number) => {
    if (isHeaderRow) {
      // Verificar se a coluna é substituível (não fixa)
      const isSubstituivel = true; // Simplificado por agora

      return (
        <th
          key={index}
          className="relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center min-w-[140px]"
        >
          {isSubstituivel ? (
            <div
              onClick={(e) => {
                const cliqueX = e.clientX;
                setPosicaoCliqueX(cliqueX);
                setColunaEmEdicao(colunaEmEdicao === header ? null : header);
              }}
              className="flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-zinc-700 rounded p-1"
            >
              {header.toUpperCase()}
              {colunaEmEdicao === header ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </div>
          ) : (
            <div className="flex justify-center font-medium">
              {header.toUpperCase()}
            </div>
          )}

          {/* Dropdown de troca de coluna */}
          {colunaEmEdicao === header && isSubstituivel && (
            <div
              ref={dropdownRef}
              className={`font-normal absolute z-20 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow-lg max-h-48 overflow-y-auto w-64 ${
                posicaoCliqueX !== null &&
                posicaoCliqueX > window.innerWidth - 250
                  ? 'right-0'
                  : 'left-0'
              }`}
            >
              {/* Campo de busca */}
              <div className="p-2 border-b border-gray-200 dark:border-zinc-600">
                <input
                  type="text"
                  placeholder="Buscar coluna..."
                  value={termoBuscaDropdown}
                  onChange={(e) => setTermoBuscaDropdown(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>

              {/* Lista de colunas */}
              <div className="max-h-32 overflow-y-auto">
                {colunasFiltro
                  .filter(
                    (col) =>
                      col !== header &&
                      col
                        .toLowerCase()
                        .includes(termoBuscaDropdown.toLowerCase()),
                  )
                  .map((coluna) => (
                    <div
                      key={coluna}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                      onClick={() => {
                        onColunaSubstituida?.(header, coluna, 'replace');
                        setColunaEmEdicao(null);
                        setTermoBuscaDropdown('');
                      }}
                    >
                      {coluna}
                    </div>
                  ))}
              </div>

              {/* Mensagem se não encontrar colunas */}
              {colunasFiltro.filter(
                (col) =>
                  col !== header &&
                  col.toLowerCase().includes(termoBuscaDropdown.toLowerCase()),
              ).length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma coluna encontrada
                </div>
              )}
            </div>
          )}
        </th>
      );
    }

    // Célula de dados
    return (
      <td
        key={index}
        className="px-2 py-2 text-center min-w-[140px] border-b border-gray-200 dark:border-zinc-700"
      >
        {rowData?.[header] || '-'}
      </td>
    );
  };

  return (
    <>
      {headers.map((header, index) => {
        // Renderizar coluna de ações
        if (header === 'ações' || header === 'ações') {
          return renderActionCell();
        }

        // Renderizar coluna de seleção
        if (header === 'selecionar' || header === 'selecionar') {
          return renderSelectionCell();
        }

        // Renderizar células de dados
        return renderDataCell(header, index);
      })}
    </>
  );
}
