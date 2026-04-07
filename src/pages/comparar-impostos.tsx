// src/pages/comparar-impostos.tsx

import React, { useState } from 'react';

type ResultadoComparacao = {
  produto: string;
  cliente: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  oracle: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    mva: number;
    cfop: string;
    totalImpostos: number;
    erro?: string;
  };
  postgresql: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    mva: number;
    cfop: string;
    totalImpostos: number;
    ibs: number;
    cbs: number;
    erro?: string;
  };
  diferencas: {
    icms: number;
    st: number;
    ipi: number;
    pis: number;
    cofins: number;
    totalImpostos: number;
  };
  igualOuAceitavel: boolean;
};

export default function CompararImpostos() {
  const [codProd, setCodProd] = useState('414068');
  const [codCli, setCodCli] = useState('18786');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('7.64');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoComparacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatPercent = (valor: number) => {
    return `${valor.toFixed(2)}%`;
  };

  const comparar = async () => {
    setLoading(true);
    setErro(null);
    setResultado(null);

    try {
      const response = await fetch('/api/impostos/comparar-oracle-pg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codProd,
          codCli,
          quantidade: parseFloat(quantidade),
          valorUnitario: parseFloat(valorUnitario),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao comparar');
      }

      setResultado(data);
    } catch (e: any) {
      setErro(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Comparador de Impostos: Oracle vs PostgreSQL
        </h1>

        {/* Formulário */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Dados para Comparação</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Código Produto
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={codProd}
                onChange={(e) => setCodProd(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Código Cliente
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={codCli}
                onChange={(e) => setCodCli(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantidade
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Valor Unitário
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                value={valorUnitario}
                onChange={(e) => setValorUnitario(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={comparar}
            disabled={loading}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Comparando...' : 'Comparar'}
          </button>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-8">
            <strong>Erro:</strong> {erro}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="space-y-6">
            {/* Status */}
            <div
              className={`rounded-lg p-4 ${
                resultado.igualOuAceitavel
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {resultado.igualOuAceitavel ? (
                  <>
                    <span className="text-2xl">✅</span>
                    <strong className="text-green-800">
                      Cálculos IGUAIS ou diferença aceitável (≤ R$ 0,05)
                    </strong>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">⚠️</span>
                    <strong className="text-yellow-800">
                      Diferenças encontradas acima da tolerância
                    </strong>
                  </>
                )}
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Resumo da Operação</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Produto:</span>
                  <div className="font-semibold">{resultado.produto}</div>
                </div>
                <div>
                  <span className="text-gray-600">Cliente:</span>
                  <div className="font-semibold">{resultado.cliente}</div>
                </div>
                <div>
                  <span className="text-gray-600">Quantidade:</span>
                  <div className="font-semibold">{resultado.quantidade}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <div className="font-semibold">
                    {formatMoeda(resultado.total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Comparação */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      Imposto
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Oracle (Delphi)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      PostgreSQL (Next.js)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Diferença
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-3 font-medium">ICMS</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.icms)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.icms)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.icms > 0.05
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.icms)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">ST</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.st)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.st)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.st > 0.05
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.st)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">IPI</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.ipi)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.ipi)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.ipi > 0.05
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.ipi)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">PIS</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.pis)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.pis)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.pis > 0.05
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.pis)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">COFINS</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.cofins)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.cofins)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.cofins > 0.05
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.cofins)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-3">TOTAL IMPOSTOS</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.oracle.totalImpostos)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.totalImpostos)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        resultado.diferencas.totalImpostos > 0.05
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {formatMoeda(resultado.diferencas.totalImpostos)}
                    </td>
                  </tr>
                  {/* IBS/CBS - Só no PostgreSQL */}
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 font-medium" colSpan={2}>
                      IBS (Informativo 2026)
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.ibs)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      Novo tributo
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 font-medium" colSpan={2}>
                      CBS (Informativo 2026)
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoeda(resultado.postgresql.cbs)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      Novo tributo
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dados adicionais */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Dados Adicionais</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Oracle</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">MVA:</span>{' '}
                      {formatPercent(resultado.oracle.mva)}
                    </div>
                    <div>
                      <span className="text-gray-600">CFOP:</span>{' '}
                      {resultado.oracle.cfop}
                    </div>
                    {resultado.oracle.erro && (
                      <div className="text-red-600">
                        Erro: {resultado.oracle.erro}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">PostgreSQL</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">MVA:</span>{' '}
                      {formatPercent(resultado.postgresql.mva)}
                    </div>
                    <div>
                      <span className="text-gray-600">CFOP:</span>{' '}
                      {resultado.postgresql.cfop}
                    </div>
                    {resultado.postgresql.erro && (
                      <div className="text-red-600">
                        Erro: {resultado.postgresql.erro}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
