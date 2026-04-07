import React, { useState, useEffect } from 'react';
import Carregamento from '@/utils/carregamento';
interface ModalExportarProps {
  colunas: string[];
  colunasVisiveis: string[];
  onExportar: (colunasSelecionadas: string[]) => void;
  exportando?: boolean; // ✅ novo
}

const ModalExportarExcel: React.FC<ModalExportarProps> = ({
  colunas,
  colunasVisiveis,
  onExportar,
  exportando,
}) => {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  useEffect(() => {
    setSelecionadas(colunasVisiveis.filter((c) => c !== 'editar'));
  }, [colunasVisiveis]);

  const toggleColuna = (coluna: string) => {
    setSelecionadas((prev) =>
      prev.includes(coluna)
        ? prev.filter((c) => c !== coluna)
        : [...prev, coluna],
    );
  };

  const selecionarTodos = () => {
    setSelecionadas(colunas.filter((col) => col !== 'editar'));
  };

  const desmarcarTodos = () => {
    setSelecionadas([]);
  };

  const finalizarExportacao = () => {
    onExportar(selecionadas);
  };

  return (
    <div className="w-full h-[70vh] flex flex-col bg-white dark:bg-zinc-900 dark:text-white rounded-md shadow-md overflow-hidden">
      {exportando ? (
        <div className="flex flex-col justify-center items-center h-full">
          <div className="w-48">
            <Carregamento texto="Exportando... aguarde" />
          </div>
        </div>
      ) : (
        <>
          {/* Botões fixos no topo */}
          <div className="flex justify-between items-center p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
            <div className="flex gap-2">
              <button
                onClick={selecionarTodos}
                className="bg-gray-200 dark:bg-zinc-700 dark:text-white px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
              >
                Selecionar Todos
              </button>
              <button
                onClick={desmarcarTodos}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
              >
                Desmarcar Todos
              </button>
            </div>
            <button
              onClick={finalizarExportacao}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
            >
              Finalizar Exportação
            </button>
          </div>

          {/* Conteúdo com rolagem */}
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {colunas.map((coluna) => (
                <label
                  key={coluna}
                  className="flex items-center gap-2 text-sm text-gray-800 dark:text-white"
                >
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={selecionadas.includes(coluna)}
                    onChange={() => toggleColuna(coluna)}
                  />
                  {coluna}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModalExportarExcel;
