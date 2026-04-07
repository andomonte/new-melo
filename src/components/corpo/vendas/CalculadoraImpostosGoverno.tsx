// src/components/corpo/vendas/CalculadoraImpostosGoverno.tsx
/**
 * Componente para calcular impostos usando a API da Calculadora Tributária do Governo
 * Pode ser usado durante o processo de venda para mostrar os impostos em tempo real
 */

import React, { useState, useEffect } from 'react';
import { useCalculadoraTributaria } from '@/hooks/useCalculadoraTributaria';
import { Calculator, AlertCircle, CheckCircle } from 'lucide-react';

interface CalculadoraImpostosGovernoProps {
  codProd: string;
  descricaoProduto?: string;
  quantidade: number;
  valorUnitario: number;
  codCliente?: string;
  ufDestino?: string;
  // Callback quando os impostos forem calculados
  onImpostosCalculados?: (impostos: {
    totalImpostos: number;
    impostos: Array<{ tipo: string; valor: number; aliquota: number }>;
  }) => void;
  // Se true, calcula automaticamente quando os valores mudarem
  autoCalcular?: boolean;
}

export default function CalculadoraImpostosGoverno({
  codProd,
  descricaoProduto,
  quantidade,
  valorUnitario,
  codCliente,
  ufDestino,
  onImpostosCalculados,
  autoCalcular = false,
}: CalculadoraImpostosGovernoProps) {
  const {
    calcularImpostos,
    isCalculando,
    erro,
    resultado,
    limpar,
    calcularPercentualImpostos,
  } = useCalculadoraTributaria();

  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Calcular automaticamente quando os valores mudarem
  useEffect(() => {
    if (autoCalcular && codProd && quantidade > 0 && valorUnitario > 0) {
      handleCalcular();
    }
  }, [codProd, quantidade, valorUnitario, codCliente, ufDestino, autoCalcular]);

  // Notificar o componente pai quando os impostos forem calculados
  useEffect(() => {
    if (resultado && onImpostosCalculados) {
      onImpostosCalculados({
        totalImpostos: resultado.totalImpostos,
        impostos: resultado.impostos.map((imp) => ({
          tipo: imp.tipo,
          valor: imp.valor,
          aliquota: imp.aliquota,
        })),
      });
    }
  }, [resultado, onImpostosCalculados]);

  const handleCalcular = async () => {
    if (!codProd || quantidade <= 0 || valorUnitario <= 0) {
      return;
    }

    await calcularImpostos(
      {
        codProd,
        descricao: descricaoProduto,
        quantidade,
        valorUnitario,
      },
      {
        codCli: codCliente,
        ufDestino,
        tipoOperacao: 'venda',
        finalidade: 'consumo',
      }
    );
  };

  const valorTotal = quantidade * valorUnitario;
  const percentualImpostos = resultado
    ? calcularPercentualImpostos(resultado)
    : 0;

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">
            Calculadora Tributária
          </h3>
        </div>
        {!autoCalcular && (
          <button
            onClick={handleCalcular}
            disabled={
              isCalculando || !codProd || quantidade <= 0 || valorUnitario <= 0
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isCalculando ? 'Calculando...' : 'Calcular Impostos'}
          </button>
        )}
      </div>

      {/* Informações do produto */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Produto:</span>
            <p className="font-medium">
              {descricaoProduto || codProd}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Valor Total:</span>
            <p className="font-medium text-lg">
              R$ {valorTotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isCalculando && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Calculando impostos...</span>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-md mb-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Erro ao calcular impostos</p>
            <p className="text-red-600 text-sm mt-1">{erro}</p>
            <button
              onClick={limpar}
              className="text-red-700 underline text-sm mt-2"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && !isCalculando && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 font-medium mb-2">
                Impostos calculados com sucesso!
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Total de Impostos:</span>
                  <p className="text-xl font-bold text-green-700">
                    R$ {resultado.totalImpostos.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">
                    ({percentualImpostos.toFixed(2)}% do valor)
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Valor Final:</span>
                  <p className="text-xl font-bold text-gray-800">
                    R$ {resultado.valorTotalComImpostos.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detalhamento dos impostos */}
          {resultado.impostos.length > 0 && (
            <div>
              <button
                onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2"
              >
                {mostrarDetalhes ? '▼' : '▶'} Ver detalhamento dos impostos
              </button>

              {mostrarDetalhes && (
                <div className="space-y-2">
                  {resultado.impostos.map((imposto, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div>
                        <p className="font-medium text-gray-800">
                          {imposto.tipo}
                        </p>
                        <p className="text-sm text-gray-600">
                          Alíquota: {imposto.aliquota.toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">
                          R$ {imposto.valor.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Base: R$ {imposto.base.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Informações da operação */}
          <div className="text-xs text-gray-500 border-t pt-2">
            <p>
              Origem: {resultado.operacao.ufOrigem} → Destino:{' '}
              {resultado.operacao.ufDestino}
            </p>
            <p>NCM: {resultado.produto.ncm}</p>
          </div>
        </div>
      )}
    </div>
  );
}
