import React from 'react';

interface DadosFinanceirosProps {
  transportadora: any;
  handleTransportadoraChange: (field: string, value: any) => void;
  error: { [key: string]: string };
}

export default function DadosFinanceiros({
  transportadora,
  handleTransportadoraChange,
  error,
}: DadosFinanceirosProps) {
  return (
    <div className="space-y-6 overflow-y-auto">
      {/* Dados Bancários */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cc"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            C.C.
          </label>
          <input
            type="text"
            id="cc"
            value={transportadora.cc || ''}
            onChange={(e) => handleTransportadoraChange('cc', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={10}
          />
          {error.cc && <p className="text-red-500 text-xs mt-1">{error.cc}</p>}
        </div>

        <div>
          <label
            htmlFor="banco"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Banco
          </label>
          <input
            type="text"
            id="banco"
            value={transportadora.banco || ''}
            onChange={(e) =>
              handleTransportadoraChange('banco', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
          />
          {error.banco && (
            <p className="text-red-500 text-xs mt-1">{error.banco}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="n_agencia"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Agência
          </label>
          <input
            type="text"
            id="n_agencia"
            value={transportadora.n_agencia || ''}
            onChange={(e) =>
              handleTransportadoraChange('n_agencia', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={6}
          />
          {error.n_agencia && (
            <p className="text-red-500 text-xs mt-1">{error.n_agencia}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="cod_ident"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Código Identificação
          </label>
          <input
            type="text"
            id="cod_ident"
            value={transportadora.cod_ident || ''}
            onChange={(e) =>
              handleTransportadoraChange('cod_ident', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            maxLength={20}
          />
          {error.cod_ident && (
            <p className="text-red-500 text-xs mt-1">{error.cod_ident}</p>
          )}
        </div>
      </div>
    </div>
  );
}
