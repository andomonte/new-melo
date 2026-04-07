/**
 * Conteudo da tabela de Entradas (thead + tbody)
 */

import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Filter, Check } from 'lucide-react';
import Carregamento from '@/utils/carregamento';
import { EntradaOperacoesMenu } from './EntradaOperacoesMenu';
import { EntradaDTO } from '../types';
import { colunasDbEntrada, statusEntradaConfig, tipoEntradaConfig } from '../colunasDbEntrada';
import { getHeaderLabel, formatDate, formatCurrency, isColumnFixed } from '../helpers';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// Tipos de filtro disponiveis
const tiposDeFiltro = [
  { label: 'Começa com', value: 'começa' },
  { label: 'Contém', value: 'contém' },
  { label: 'Diferente', value: 'diferente' },
  { label: 'É nulo', value: 'nulo' },
  { label: 'Igual', value: 'igual' },
  { label: 'Maior ou igual', value: 'maior_igual' },
  { label: 'Maior que', value: 'maior' },
  { label: 'Menor ou igual', value: 'menor_igual' },
  { label: 'Menor que', value: 'menor' },
  { label: 'Não é nulo', value: 'nao_nulo' },
  { label: 'Termina com', value: 'termina' },
];

interface EntradasTableContentProps {
  headers: string[];
  data: EntradaDTO[];
  loading: boolean;
  mostrarFiltrosRapidos: boolean;
  filtrosColuna: Record<string, { tipo: string; valor: string }>;
  onView: (item: EntradaDTO) => void;
  onViewItems: (item: EntradaDTO) => void;
  onRefresh: () => void;
  onColunaSubstituida: (colunaA: string, colunaB: string, tipo: 'swap' | 'replace') => void;
  onFiltroRapidoChange: (header: string, valor: string) => void;
  onAplicarFiltrosRapidos: () => void;
  onTipoFiltroRapidoChange: (header: string, tipo: string) => void;
}

export const EntradasTableContent: React.FC<EntradasTableContentProps> = ({
  headers,
  data,
  loading,
  mostrarFiltrosRapidos,
  filtrosColuna,
  onView,
  onViewItems,
  onRefresh,
  onColunaSubstituida,
  onFiltroRapidoChange,
  onAplicarFiltrosRapidos,
  onTipoFiltroRapidoChange,
}) => {
  const [colunaEmEdicao, setColunaEmEdicao] = useState<string | null>(null);
  const [termoBuscaDropdown, setTermoBuscaDropdown] = useState('');
  const [posicaoCliqueX, setPosicaoCliqueX] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Colunas disponiveis para troca
  const colunasDisponiveis = colunasDbEntrada
    .map(col => col.campo)
    .filter(col => !isColumnFixed(col) && col !== colunaEmEdicao);

  // Renderizar valor da celula
  const renderCellValue = (entrada: EntradaDTO, campo: string): React.ReactNode => {
    switch (campo) {
      case 'acoes':
        return (
          <EntradaOperacoesMenu
            entrada={{
              id: entrada.id,
              numeroNF: entrada.numeroNF,
              numeroEntrada: entrada.numeroEntrada,
              status: entrada.status,
              temRomaneio: entrada.temRomaneio,
              precoConfirmado: entrada.precoConfirmado,
            }}
            onView={() => onView(entrada)}
            onRefresh={onRefresh}
            onViewItems={() => onViewItems(entrada)}
          />
        );

      case 'status':
        const statusConfig = statusEntradaConfig[entrada.status] || {
          label: entrada.status || 'N/A',
          color: 'text-gray-600 bg-gray-50',
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full font-semibold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        );

      case 'tipoEntrada':
        const tipoConfig = tipoEntradaConfig[entrada.tipoEntrada] || {
          label: entrada.tipoEntrada,
          color: 'bg-gray-100 text-gray-800',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${tipoConfig.color}`}>
            {tipoConfig.label}
          </span>
        );

      case 'valorTotal':
      case 'valorProdutos':
        return formatCurrency(entrada[campo] as number);

      case 'dataEmissao':
      case 'dataEntrada':
        return formatDate(entrada[campo] as string);

      case 'temRomaneio':
        return entrada.temRomaneio ? (
          <span className="px-2 py-1 text-xs rounded-full font-semibold text-blue-700 bg-blue-100">
            Gerado
          </span>
        ) : (
          <span className="px-2 py-1 text-xs rounded-full font-semibold text-gray-500 bg-gray-100">
            Não gerado
          </span>
        );

      case 'precoConfirmado':
        return entrada.precoConfirmado ? (
          <span className="px-2 py-1 text-xs rounded-full font-semibold text-purple-700 bg-purple-100">
            Confirmado
          </span>
        ) : (
          <span className="px-2 py-1 text-xs rounded-full font-semibold text-gray-500 bg-gray-100">
            Pendente
          </span>
        );

      default:
        return (entrada as any)[campo] || '-';
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-h-0 overflow-auto pb-8">
          <div className="min-w-full max-w-max mx-auto">
            <table className="table-auto w-full border-collapse text-sm text-center">
              <thead className="sticky top-0 z-10 dark:bg-gray-100 border-b border-gray-300 dark:border-zinc-700">
                <tr>
                  {headers.map((header, index) => (
                    <th
                      key={index}
                      className={`relative px-2 py-2 bg-gray-200 dark:bg-zinc-800 whitespace-nowrap text-center ${
                        isColumnFixed(header) ? 'w-[80px]' : 'min-w-[140px]'
                      }`}
                    >
                      {!isColumnFixed(header) ? (
                        <div
                          onClick={e => {
                            const cliqueX = e.clientX;
                            setPosicaoCliqueX(cliqueX);
                            setColunaEmEdicao(colunaEmEdicao === header ? null : header);
                          }}
                          className="flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {getHeaderLabel(header)}
                          {colunaEmEdicao === header ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center">{getHeaderLabel(header)}</div>
                      )}

                      {/* Dropdown de troca de coluna */}
                      {colunaEmEdicao === header && !isColumnFixed(header) && (
                        <div
                          ref={dropdownRef}
                          className={`font-normal absolute z-20 mt-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded shadow max-h-48 overflow-y-auto w-auto text-center ${
                            posicaoCliqueX !== null && posicaoCliqueX > window.innerWidth - 250
                              ? 'right-0'
                              : 'left-0'
                          } max-w-[calc(100vw-2rem)]`}
                        >
                          <input
                            type="text"
                            placeholder="Buscar coluna..."
                            value={termoBuscaDropdown}
                            onChange={e => setTermoBuscaDropdown(e.target.value)}
                            className="w-full px-2 py-1 text-sm border-b border-gray-200 dark:border-zinc-600 focus:outline-none dark:bg-zinc-800"
                            onClick={e => e.stopPropagation()}
                          />
                          {colunasDisponiveis
                            .filter(
                              col =>
                                col.toLowerCase().includes(termoBuscaDropdown.toLowerCase()) ||
                                getHeaderLabel(col)
                                  .toLowerCase()
                                  .includes(termoBuscaDropdown.toLowerCase())
                            )
                            .map(coluna => (
                              <div
                                key={coluna}
                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                                onClick={() => {
                                  onColunaSubstituida(header, coluna, 'replace');
                                  setColunaEmEdicao(null);
                                  setTermoBuscaDropdown('');
                                }}
                              >
                                {getHeaderLabel(coluna)}
                              </div>
                            ))}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>

                {/* Linha de filtros rapidos */}
                {mostrarFiltrosRapidos && (
                  <tr className="bg-gray-200 dark:bg-zinc-800">
                    {headers.map((header, index) =>
                      !isColumnFixed(header) ? (
                        <th key={index} className="px-2 py-1 font-normal">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder={`Filtrar ${getHeaderLabel(header)}`}
                              value={filtrosColuna[header]?.valor || ''}
                              onChange={e => onFiltroRapidoChange(header, e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && onAplicarFiltrosRapidos()}
                              onBlur={() => onAplicarFiltrosRapidos()}
                              className="w-full font-normal px-2 py-1 border rounded-md text-[12px] pr-8 dark:bg-zinc-700 dark:border-zinc-600"
                            />

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  className="absolute right-1 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                >
                                  <Filter size={14} />
                                </button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-white rounded-md shadow-lg w-40 max-h-48 overflow-y-auto">
                                {tiposDeFiltro.map(tipo => (
                                  <DropdownMenuItem
                                    key={tipo.value}
                                    onClick={() => {
                                      onTipoFiltroRapidoChange(header, tipo.value);
                                      onAplicarFiltrosRapidos();
                                    }}
                                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm p-2 flex justify-between items-center"
                                  >
                                    <span>{tipo.label}</span>
                                    {(filtrosColuna[header]?.tipo ?? 'contém') === tipo.value && (
                                      <Check size={14} className="text-green-600 dark:text-green-400" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </th>
                      ) : (
                        <th key={index} />
                      )
                    )}
                  </tr>
                )}
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={headers.length} className="py-8">
                      <Carregamento texto="Carregando..." />
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={headers.length}
                      className="py-8 text-gray-500 dark:text-gray-400"
                    >
                      Nenhuma entrada encontrada
                    </td>
                  </tr>
                ) : (
                  data.map((entrada, rowIndex) => (
                    <tr
                      key={entrada.id || rowIndex}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700"
                    >
                      {headers.map((header, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-2 py-2 text-center border-b border-gray-200 dark:border-zinc-700"
                          style={isColumnFixed(header) ? { width: '80px' } : {}}
                        >
                          {renderCellValue(entrada, header)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
