/**
 * Componente de filtros e busca da tela de Entradas
 */

import React, { useState } from 'react';
import { ChevronDown, Filter, FilterX } from 'lucide-react';
import { RiFileExcel2Line } from 'react-icons/ri';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SearchInput from '@/components/common/SearchInput2';
import ModalExportarExcel from '@/components/common/modalExportarExcel';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { useToast } from '@/hooks/use-toast';
import { colunasDbEntrada } from '../colunasDbEntrada';
import { isColumnFixed } from '../helpers';

interface EntradasFiltersProps {
  search: string;
  headers: string[];
  filtros: { campo: string; tipo: string; valor: string }[];
  mostrarFiltrosRapidos: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur: () => void;
  onFiltroChange: (filtros: { campo: string; tipo: string; valor: string }[]) => void;
  onToggleFiltrosRapidos: () => void;
}

export const EntradasFilters: React.FC<EntradasFiltersProps> = ({
  search,
  headers,
  filtros,
  mostrarFiltrosRapidos,
  onSearchChange,
  onSearchKeyDown,
  onSearchBlur,
  onFiltroChange,
  onToggleFiltrosRapidos,
}) => {
  const { toast } = useToast();
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);
  const [mostrarModalFiltro, setMostrarModalFiltro] = useState(false);
  const [exportando, setExportando] = useState(false);

  const handleExportar = async (selecionadas: string[]) => {
    setExportando(true);
    try {
      const res = await fetch('/api/entradas/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colunas: selecionadas,
          filtros,
          busca: search,
        }),
      });

      if (!res.ok) throw new Error('Erro na exportacao');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'entradas.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

      setMostrarModalExportar(false);
      toast({ title: 'Exportacao concluida!' });
    } catch (error) {
      console.error('Erro na exportacao:', error);
      toast({ title: 'Erro na exportacao', variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-zinc-700 p-2">
      <div className="flex justify-between items-center gap-2">
        <SearchInput
          placeholder="Buscar por NF, entrada, fornecedor..."
          value={search}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          onBlur={onSearchBlur}
        />

        <div className="flex items-center gap-2">
          {/* Modal de Filtros Avancados */}
          <Dialog open={mostrarModalFiltro} onOpenChange={setMostrarModalFiltro}>
            <DialogContent className="max-w-[90vw] w-[90vw] max-h-full p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
              <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                <DialogTitle className="text-lg text-gray-800 dark:text-white uppercase">
                  Filtros Avancados por Coluna
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                  Selecione os campos e aplique os filtros desejados.
                </DialogDescription>
              </DialogHeader>
              <FiltroDinamicoDeClientes
                colunas={colunasDbEntrada.map(c => c.campo).filter(c => c !== 'acoes')}
                onChange={filtros => {
                  onFiltroChange(filtros);
                  setMostrarModalFiltro(false);
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Botao Opcoes */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm text-gray-700 dark:text-white">
                Opções
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-white"
            >
              {/* Toggle Filtros rapidos */}
              <DropdownMenuItem
                onClick={onToggleFiltrosRapidos}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                {mostrarFiltrosRapidos ? (
                  <FilterX size={16} className="mr-2 text-amber-500 dark:text-amber-300" />
                ) : (
                  <Filter size={16} className="mr-2 text-amber-500 dark:text-amber-300" />
                )}
                {mostrarFiltrosRapidos ? 'Ocultar filtros rápidos' : 'Mostrar filtros rápidos'}
              </DropdownMenuItem>

              {/* Modal de Filtros avancados */}
              <DropdownMenuItem
                onClick={() => setMostrarModalFiltro(true)}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <Filter size={16} className="mr-2 text-blue-500 dark:text-blue-300" />
                Filtros Avançados
              </DropdownMenuItem>

              {/* Exportar Excel */}
              <DropdownMenuItem
                onClick={() => setMostrarModalExportar(true)}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <RiFileExcel2Line size={16} className="mr-2 text-green-500 dark:text-green-300" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dialog de exportar */}
          <Dialog open={mostrarModalExportar} onOpenChange={setMostrarModalExportar}>
            <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] p-6 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
              <DialogHeader className="p-4 border-b border-zinc-300 dark:border-zinc-700">
                <DialogTitle className="text-lg text-gray-800 dark:text-white uppercase">
                  Escolha as colunas a serem exportadas
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                  Selecione os campos a serem incluidos na exportacao.
                </DialogDescription>
              </DialogHeader>

              <ModalExportarExcel
                exportando={exportando}
                colunas={colunasDbEntrada.map(c => c.campo).filter(c => c !== 'acoes')}
                colunasVisiveis={headers.filter(h => !isColumnFixed(h))}
                onExportar={handleExportar}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export { EntradasFilters as default };
