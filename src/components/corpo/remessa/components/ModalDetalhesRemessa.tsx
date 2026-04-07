import React from 'react';
import { X, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ArquivoDetalhado, TituloDetalhado } from '../types/remessa.types';

interface ModalDetalhesRemessaProps {
  aberto: boolean;
  arquivo: ArquivoDetalhado | null;
  titulos: TituloDetalhado[];
  estatisticas: any;
  loading: boolean;
  onFechar: () => void;
}

export function ModalDetalhesRemessa({
  aberto,
  arquivo,
  titulos,
  estatisticas,
  loading,
  onFechar,
}: ModalDetalhesRemessaProps) {
  if (!aberto || !arquivo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-600">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detalhes da Remessa #{arquivo.cod_arquivo}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {arquivo.nome_banco} - {arquivo.nome_arquivo}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando detalhes...</span>
            </div>
          ) : (
            <>
              {/* Cards de Informações */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Data de Geração</div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {new Date(arquivo.dt_geracao).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {new Date(arquivo.dt_geracao).toLocaleTimeString('pt-BR')}
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300 mb-1">Total de Títulos</div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {arquivo.qtd_registros}
                  </div>
                  {estatisticas && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex gap-2">
                      <span>✓ {estatisticas.liquidados}</span>
                      <span>⏳ {estatisticas.enviados}</span>
                    </div>
                  )}
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Valor Total</div>
                  <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    R$ {parseFloat(arquivo.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {estatisticas?.valor_liquidado > 0 && (
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Liquidado: R$ {estatisticas.valor_liquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                  <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Borderô Oracle</div>
                  <div className="text-lg font-semibold text-orange-900 dark:text-orange-100 font-mono">
                    {arquivo.cod_bodero || '-'}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Seq: {arquivo.sequencial_arquivo}
                  </div>
                </div>
              </div>

              {/* Botão Download */}
              <div className="flex gap-3 mb-6">
                <a
                  href={`/remessas/bancaria/${arquivo.nome_arquivo}`}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download CNAB 400
                </a>
              </div>

              {/* Tabela de Títulos */}
              <div className="border border-gray-200 dark:border-zinc-600 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-zinc-800 px-4 py-3 border-b border-gray-200 dark:border-zinc-600">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Títulos Incluídos ({titulos.length})
                  </h4>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-600">
                    <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cód. Receb</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nosso Número</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vencimento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Retorno</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-600">
                      {titulos.map((titulo: any) => (
                        <tr key={titulo.cod_remessa_detalhe} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {titulo.cod_receb}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {titulo.nosso_numero}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate" title={titulo.nome_cliente}>
                            <div>{titulo.nome_cliente}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{titulo.cpf_cnpj}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(titulo.dt_vencimento).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                            R$ {parseFloat(titulo.valor_titulo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {titulo.status_titulo === 'B' ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Liquidado
                              </span>
                            ) : titulo.status_titulo === 'S' ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Enviado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Disponível
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {titulo.codigo_ocorrencia_retorno ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                  {titulo.codigo_ocorrencia_retorno} - {titulo.descricao_ocorrencia_retorno}
                                </span>
                                {titulo.valor_pago_retorno && (
                                  <span className="text-xs text-green-600 dark:text-green-400">
                                    Pago: R$ {(parseFloat(titulo.valor_pago_retorno) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Sem retorno</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-zinc-600">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
