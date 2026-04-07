import React from 'react';

interface CalculoFreteProps {
  transportadora: any;
  handleTransportadoraChange: (field: string, value: any) => void;
  error: { [key: string]: string };
}

export default function CalculoFrete({
  transportadora,
  handleTransportadoraChange,
  error,
}: CalculoFreteProps) {
  return (
    <div className="space-y-6  overflow-y-auto">
      {/* Dados de Frete - Coluna Esquerda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="frete_minimo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Frete Mínimo
            </label>
            <input
              type="number"
              step="0.01"
              id="frete_minimo"
              value={transportadora.frete_minimo || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'frete_minimo',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.frete_minimo && (
              <p className="text-red-500 text-xs mt-1">{error.frete_minimo}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="seguro_advalor"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Seguro Ad Valor
            </label>
            <input
              type="number"
              step="0.01"
              id="seguro_advalor"
              value={transportadora.seguro_advalor || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'seguro_advalor',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.seguro_advalor && (
              <p className="text-red-500 text-xs mt-1">
                {error.seguro_advalor}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="pedagio"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Pedágio
            </label>
            <input
              type="number"
              step="0.01"
              id="pedagio"
              value={transportadora.pedagio || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'pedagio',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.pedagio && (
              <p className="text-red-500 text-xs mt-1">{error.pedagio}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="gris"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              GRIS
            </label>
            <input
              type="number"
              step="0.01"
              id="gris"
              value={transportadora.gris || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'gris',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.gris && (
              <p className="text-red-500 text-xs mt-1">{error.gris}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="ademe"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              ADEME
            </label>
            <input
              type="number"
              step="0.01"
              id="ademe"
              value={transportadora.ademe || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'ademe',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.ademe && (
              <p className="text-red-500 text-xs mt-1">{error.ademe}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="despacho"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Despacho
            </label>
            <input
              type="number"
              step="0.01"
              id="despacho"
              value={transportadora.despacho || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'despacho',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.despacho && (
              <p className="text-red-500 text-xs mt-1">{error.despacho}</p>
            )}
          </div>
        </div>

        {/* Dados de Frete - Coluna Direita */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="taxa_portuario"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Taxa Portuário
            </label>
            <input
              type="number"
              step="0.01"
              id="taxa_portuario"
              value={transportadora.taxa_portuario || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'taxa_portuario',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.taxa_portuario && (
              <p className="text-red-500 text-xs mt-1">
                {error.taxa_portuario}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="aliquota_icms"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Alíquota ICMS
            </label>
            <input
              type="number"
              step="0.01"
              id="aliquota_icms"
              value={transportadora.aliquota_icms || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'aliquota_icms',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.aliquota_icms && (
              <p className="text-red-500 text-xs mt-1">{error.aliquota_icms}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="peso_minimo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Peso Mínimo
            </label>
            <input
              type="number"
              step="0.01"
              id="peso_minimo"
              value={transportadora.peso_minimo || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'peso_minimo',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.peso_minimo && (
              <p className="text-red-500 text-xs mt-1">{error.peso_minimo}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="taxa_coleta_sp"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Taxa Coleta SP
            </label>
            <input
              type="number"
              step="0.01"
              id="taxa_coleta_sp"
              value={transportadora.taxa_coleta_sp || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'taxa_coleta_sp',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.taxa_coleta_sp && (
              <p className="text-red-500 text-xs mt-1">
                {error.taxa_coleta_sp}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="taxa_entrega"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Taxa Entrega
            </label>
            <input
              type="number"
              step="0.01"
              id="taxa_entrega"
              value={transportadora.taxa_entrega || ''}
              onChange={(e) =>
                handleTransportadoraChange(
                  'taxa_entrega',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            {error.taxa_entrega && (
              <p className="text-red-500 text-xs mt-1">{error.taxa_entrega}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
