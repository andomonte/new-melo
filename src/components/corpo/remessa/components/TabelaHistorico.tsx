import React from 'react';
import { ChevronLeft, Search, FileText, History, DollarSign, Download } from 'lucide-react';
import type { HistoricoRemessa, Estatisticas } from '../types/remessa.types';

interface TabelaHistoricoProps {
  // Dados
  historico: HistoricoRemessa[];
  estatisticas: Estatisticas | null;
  
  // Loading states
  loadingHistorico: boolean;
  loadingEstatisticas: boolean;
  
  // Paginação
  paginaHistorico: number;
  totalPaginasHistorico: number;
  totalRegistrosHistorico: number;
  itensPorPagina: number;
  
  // Filtros
  filtroDataIni: string;
  filtroDataFim: string;
  filtroBanco: string;
  
  // Callbacks
  onFiltroDataIniChange: (value: string) => void;
  onFiltroDataFimChange: (value: string) => void;
  onFiltroBancoChange: (value: string) => void;
  onBuscar: () => void;
  onVoltar: () => void;
  onVerDetalhes: (id: number) => void;
  onPaginaAnterior: () => void;
  onProximaPagina: () => void;
  onMudarPagina: (pagina: number) => void;
}

export function TabelaHistorico({
  historico,
  estatisticas,
  loadingHistorico,
  loadingEstatisticas,
  paginaHistorico,
  totalPaginasHistorico,
  totalRegistrosHistorico,
  itensPorPagina,
  filtroDataIni,
  filtroDataFim,
  filtroBanco,
  onFiltroDataIniChange,
  onFiltroDataFimChange,
  onFiltroBancoChange,
  onBuscar,
  onVoltar,
  onVerDetalhes,
  onPaginaAnterior,
  onProximaPagina,
  onMudarPagina,
}: TabelaHistoricoProps) {
  return (
    <div className="mb-6">
      {/* Estatísticas */}
      {loadingEstatisticas ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando estatísticas...</span>
        </div>
      ) : estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card: Hoje */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Hoje</h4>
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {estatisticas.periodo.hoje.remessas}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {estatisticas.periodo.hoje.titulos} títulos
              </div>
              <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                R$ {estatisticas.periodo.hoje.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Card: Semana */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Últimos 7 dias</h4>
              <History className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {estatisticas.periodo.semana.remessas}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                {estatisticas.periodo.semana.titulos} títulos
              </div>
              <div className="text-sm font-semibold text-green-800 dark:text-green-200">
                R$ {estatisticas.periodo.semana.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Card: Mês */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100">Este Mês</h4>
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {estatisticas.periodo.mes.remessas}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">
                {estatisticas.periodo.mes.titulos} títulos
              </div>
              <div className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                R$ {estatisticas.periodo.mes.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filtroDataIni}
              onChange={(e) => onFiltroDataIniChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => onFiltroDataFimChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Banco
            </label>
            <select
              value={filtroBanco}
              onChange={(e) => onFiltroBancoChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
            >
              <option value="TODOS">Todos</option>
              <option value="BRADESCO">Bradesco (237)</option>
              <option value="SANTANDER">Santander (033)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={onBuscar}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Histórico de Remessas</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalRegistrosHistorico > 0 ? `${totalRegistrosHistorico} remessa(s) encontrada(s)` : 'Nenhuma remessa encontrada'}
          </p>
        </div>
        <button
          onClick={onVoltar}
          className="px-3 py-1 text-sm bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-600"
        >
          Voltar
        </button>
      </div>

      {loadingHistorico ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando histórico...</span>
        </div>
      ) : (
        <>
          {/* Tabela */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-zinc-600 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-600">
              <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Banco</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Borderô</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Títulos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-600">
                {historico && historico.length > 0 ? (
                  historico.map((h: any) => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {h.id}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {h.banco === '237' ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Bradesco
                          </span>
                        ) : h.banco === '033' ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            Santander
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {h.cod_bodero ? (
                          <span className="font-mono text-xs bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded">
                            {h.cod_bodero}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {h.data_envio ? (
                          <>
                            <div>{new Date(h.data_envio).toLocaleDateString('pt-BR')}</div>
                            <div className="text-xs text-gray-400">{new Date(h.data_envio).toLocaleTimeString('pt-BR')}</div>
                          </>
                        ) : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col">
                          <span className="font-semibold">{h.registros_enviados || 0}</span>
                          {(h.titulos_liquidados > 0 || h.titulos_pendentes > 0) && (
                            <div className="text-xs flex gap-2 mt-1">
                              {h.titulos_liquidados > 0 && (
                                <span className="text-green-600 dark:text-green-400">✓ {h.titulos_liquidados}</span>
                              )}
                              {h.titulos_pendentes > 0 && (
                                <span className="text-yellow-600 dark:text-yellow-400">⏳ {h.titulos_pendentes}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                        {h.valor_total ? `R$ ${parseFloat(h.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {h.status || 'Sucesso'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => onVerDetalhes(h.id)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Ver Detalhes
                          </button>
                          {h.nome_arquivo && (
                            <a
                              href={`/remessas/bancaria/${h.nome_arquivo}`}
                              download
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:underline inline-flex items-center gap-1"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum registro encontrado no histórico.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginasHistorico > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-600 sm:px-6 rounded-b-lg">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Mostrando <span className="font-medium">{((paginaHistorico - 1) * itensPorPagina) + 1}</span> a{' '}
                    <span className="font-medium">{Math.min(paginaHistorico * itensPorPagina, totalRegistrosHistorico)}</span> de{' '}
                    <span className="font-medium">{totalRegistrosHistorico}</span> resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={onPaginaAnterior}
                      disabled={paginaHistorico === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {Array.from({ length: Math.min(5, totalPaginasHistorico) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPaginasHistorico - 4, paginaHistorico - 2)) + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => onMudarPagina(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            paginaHistorico === pageNum
                              ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-200'
                              : 'bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={onProximaPagina}
                      disabled={paginaHistorico === totalPaginasHistorico}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5 rotate-180" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
