import React from 'react';
import { X, Download, Calendar, Filter } from 'lucide-react';

interface FiltrosExportacao {
  dataInicio: string;
  dataFim: string;
  status: string;
}

interface ModalFiltrosExportacaoProps {
  aberto: boolean;
  onFechar: () => void;
  filtros: FiltrosExportacao;
  onFiltrosChange: (filtros: FiltrosExportacao) => void;
  onConfirmar: () => void;
}

const ModalFiltrosExportacao: React.FC<ModalFiltrosExportacaoProps> = ({
  aberto,
  onFechar,
  filtros,
  onFiltrosChange,
  onConfirmar,
}) => {
  if (!aberto) return null;

  const handleStatusChange = (status: string) => {
    onFiltrosChange({ ...filtros, status });
  };

  const handleDataInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltrosChange({ ...filtros, dataInicio: e.target.value });
  };

  const handleDataFimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltrosChange({ ...filtros, dataFim: e.target.value });
  };

  const statusOptions = [
    { value: 'todos', label: 'Todos', color: 'bg-gray-500' },
    { value: 'N', label: 'Pendente', color: 'bg-yellow-500' },
    { value: 'S', label: 'Pago', color: 'bg-green-500' },
    { value: 'parcial', label: 'Parcial', color: 'bg-blue-500' },
    { value: 'C', label: 'Cancelado', color: 'bg-red-500' },
  ];

  const isDataInvalida = !!(filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Filtros de Exportação
              </h2>
              <p className="text-sm text-gray-500">
                Configure os filtros para exportar os dados
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Filtro de Data */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Calendar className="w-5 h-5" />
              <span>Período</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={handleDataInicioChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={handleDataFimChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            {isDataInvalida && (
              <p className="text-sm text-red-600">
                A data início não pode ser maior que a data fim
              </p>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Filter className="w-5 h-5" />
              <span>Status</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${
                      filtros.status === option.value
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }
                    cursor-pointer
                  `}
                >
                  <div className={`w-3 h-3 rounded-full ${option.color}`} />
                  <span
                    className={`font-medium ${
                      filtros.status === option.value ? 'text-green-700' : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Informação adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Dica:</strong> Deixe os campos de data vazios para exportar todas as contas,
              independente da data de vencimento.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={isDataInvalida}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalFiltrosExportacao;
