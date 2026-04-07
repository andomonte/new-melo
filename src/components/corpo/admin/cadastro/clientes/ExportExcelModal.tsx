import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, FileDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  colunas: string[];
  colunasVisiveis: string[];
  filtros: { campo: string; tipo: string; valor: string }[];
  search: string;
  selectedClients?: Set<string>;
}

export function ExportExcelModal({
  isOpen,
  onClose,
  colunas,
  colunasVisiveis,
  filtros,
  search,
  selectedClients,
}: ExportExcelModalProps) {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    // Inicializa com colunas visíveis, exceto ações e selecionar
    setSelecionadas(
      colunasVisiveis.filter((c) => c !== 'ações' && c !== 'selecionar'),
    );
  }, [colunasVisiveis]);

  const toggleColuna = (coluna: string) => {
    setSelecionadas((prev) =>
      prev.includes(coluna)
        ? prev.filter((c) => c !== coluna)
        : [...prev, coluna],
    );
  };

  const selecionarTodos = () => {
    setSelecionadas(
      colunas.filter((col) => col !== 'ações' && col !== 'selecionar'),
    );
  };

  const desmarcarTodos = () => {
    setSelecionadas([]);
  };

  const handleExportar = async () => {
    if (selecionadas.length === 0) {
      return;
    }

    setExportando(true);
    try {
      const params = new URLSearchParams();
      params.set('colunas', selecionadas.join(','));

      // Se houver clientes selecionados, exportar apenas eles
      if (selectedClients && selectedClients.size > 0) {
        params.set('ids', Array.from(selectedClients).join(','));
      } else {
        // Senão, usar filtros ou busca
        if (search) {
          params.set('search', search);
        } else if (filtros.length > 0) {
          params.set('filtros', JSON.stringify(filtros));
        }
      }

      const res = await fetch(
        `/api/clientes/exportar-excel?${params.toString()}`,
      );

      if (!res.ok) {
        throw new Error('Erro ao exportar');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clientes.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Erro na exportação:', error);
    } finally {
      setExportando(false);
    }
  };

  const handleClose = () => {
    if (!exportando) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <h4 className="text-lg font-bold text-green-600 dark:text-green-300">
                Exportar para Excel
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {selectedClients && selectedClients.size > 0
                  ? `Exportando ${selectedClients.size} cliente${
                      selectedClients.size > 1 ? 's' : ''
                    } selecionado${selectedClients.size > 1 ? 's' : ''}`
                  : 'Selecione as colunas que deseja exportar'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-300 hover:text-red-500"
            disabled={exportando}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-grow overflow-y-auto p-6 bg-gray-50 dark:bg-zinc-900">
          {exportando ? (
            <div className="flex flex-col justify-center items-center h-full">
              <Loader2 className="h-12 w-12 animate-spin text-green-600 dark:text-green-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Exportando... aguarde
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-md max-w-6xl mx-auto">
              {/* Botões de Seleção */}
              <div className="flex gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={selecionarTodos}
                  className="flex-1"
                >
                  Selecionar Todos
                </Button>
                <Button
                  variant="outline"
                  onClick={desmarcarTodos}
                  className="flex-1"
                >
                  Desmarcar Todos
                </Button>
              </div>

              {/* Contador */}
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {selecionadas.length} de{' '}
                {
                  colunas.filter((c) => c !== 'ações' && c !== 'selecionar')
                    .length
                }{' '}
                colunas selecionadas
              </div>

              {/* Grid de Colunas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {colunas
                  .filter((col) => col !== 'ações' && col !== 'selecionar')
                  .map((coluna) => (
                    <label
                      key={coluna}
                      className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 p-2 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selecionadas.includes(coluna)}
                        onCheckedChange={() => toggleColuna(coluna)}
                      />
                      <span className="capitalize">{coluna}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
          <Button variant="outline" onClick={handleClose} disabled={exportando}>
            Cancelar
          </Button>
          <Button
            onClick={handleExportar}
            disabled={exportando || selecionadas.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {exportando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar {selecionadas.length} colunas
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
