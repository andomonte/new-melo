import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings2Icon } from 'lucide-react';
//teste
interface ColunasDinamicasComFiltroProps {
  colunas: string[];
  colunasVisiveis: string[];
  onChangeColunas: (colunas: string[]) => void;
  filtros: Record<string, string>;
  onChangeFiltros: (filtros: Record<string, string>) => void;
}

const ColunasDinamicasComFiltro: React.FC<ColunasDinamicasComFiltroProps> = ({
  colunas,
  colunasVisiveis,
  onChangeColunas,
  filtros,
  onChangeFiltros,
}) => {
  const [colunasTemp, setColunasTemp] = useState<string[]>(colunasVisiveis);
  const [filtrosTemp, setFiltrosTemp] =
    useState<Record<string, string>>(filtros);

  const toggleColuna = (coluna: string) => {
    if (colunasTemp.includes(coluna)) {
      setColunasTemp(colunasTemp.filter((c) => c !== coluna));
    } else {
      setColunasTemp([...colunasTemp, coluna]);
    }
  };

  const handleFiltroChange = (coluna: string, valor: string) => {
    setFiltrosTemp((prev) => ({
      ...prev,
      [coluna]: valor,
    }));
  };
//colunas
  const aplicar = () => {
    onChangeColunas(colunasTemp);
    onChangeFiltros(filtrosTemp);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm">
          <Settings2Icon size={16} /> Colunas / Filtros
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto dark:bg-zinc-900">
        <DialogTitle className="mb-4 text-gray-800 dark:text-gray-100">
          Selecionar Colunas e Filtrar
        </DialogTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {colunas.map((coluna) => (
            <div key={coluna} className="flex flex-col w-full">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={colunasTemp.includes(coluna)}
                  onChange={() => toggleColuna(coluna)}
                  className="accent-blue-600"
                />
                <span>{coluna}</span>
              </label>
              {colunasTemp.includes(coluna) && (
                <input
                  type="text"
                  value={filtrosTemp[coluna] || ''}
                  onChange={(e) => handleFiltroChange(coluna, e.target.value)}
                  placeholder={`Filtrar ${coluna}...`}
                  className="mt-1 p-1 border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm text-gray-800 dark:text-white"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={aplicar}
            className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 text-sm"
          >
            Aplicar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColunasDinamicasComFiltro;
