import React, { useEffect } from 'react';
import { ChevronLeft, Search, Download, Mail, Plus, XCircle, Repeat, DollarSign, AlertTriangle, FileText } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Hooks modularizados
import { useRemessa, useHistoricoRemessa, useImportacaoRetorno } from './hooks';

// Componentes modularizados
import { TelaSelecao, MenuRemessa, TabelaHistorico, ModalDetalhesRemessa } from './components';

export default function RemessaEquifax() {
  // Hook principal de remessa
  const {
    telaAtual,
    telaRenderizada,
    subtelaRemessa,
    dataIni,
    dataFim,
    emailDestino,
    bancoSelecionado,
    modoEnvio,
    loading,
    erro,
    dadosRemessa,
    estatisticasRemessa,
    porBanco,
    loadingConsulta,
    consultaRealizada,
    paginaAtualRemessa,
    registrosPorPagina,
    totalPaginasRemessa,
    totalRegistrosRemessa,
    setDataIni,
    setDataFim,
    setEmailDestino,
    setBancoSelecionado,
    setModoEnvio,
    setErro,
    setPaginaAtualRemessa,
    setRegistrosPorPagina,
    selecionarGerarRemessa,
    selecionarGerarArquivo,
    selecionarConsultarArquivos,
    voltarParaMenuRemessa,
    selecionarImportarRetorno,
    voltarParaSelecao,
    consultarDadosRemessa,
    handleGerarRemessa,
    handleEnviarPorEmail,
  } = useRemessa();

  // Hook de histórico
  const {
    historico,
    loadingHistorico,
    paginaHistorico,
    totalPaginasHistorico,
    totalRegistrosHistorico,
    itensPorPagina,
    filtroDataIni,
    filtroDataFim,
    filtroBanco,
    setFiltroDataIni,
    setFiltroDataFim,
    setFiltroBanco,
    estatisticas,
    loadingEstatisticas,
    modalDetalhesAberto,
    titulosDetalhados,
    arquivoDetalhado,
    estatisticasDetalhes,
    loadingDetalhes,
    carregarHistorico,
    carregarEstatisticas,
    carregarDetalhesRemessa,
    fecharModalDetalhes,
    paginaAnteriorHistorico,
    proximaPaginaHistorico,
    mudarPaginaHistorico,
  } = useHistoricoRemessa();

  // Hook de importação (para tela futura)
  const {
    arquivoDDA,
    dadosDDA,
    loadingProcessamento,
    loadingBaixa,
    resultadoBaixa,
    setArquivoDDA,
    handleProcessarArquivoDDA,
    handleProcessarBaixaAutomatica,
    exportarTitulosManuais,
    limparDados,
  } = useImportacaoRetorno();

  // Carregar dados ao abrir consulta
  useEffect(() => {
    if (subtelaRemessa === 'consultar') {
      carregarHistorico();
      carregarEstatisticas();
    }
  }, [subtelaRemessa]);

  return (
    <div className="h-full flex flex-col border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 overflow-y-auto p-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            Sistema de Remessa
          </h1>
        </div>

        {/* Tela de Seleção Inicial */}
        {telaRenderizada === 'selecao' && (
          <TelaSelecao
            onSelecionarRemessa={selecionarGerarRemessa}
            onSelecionarImportacao={selecionarImportarRetorno}
          />
        )}

        {/* Tela de Remessa */}
        {telaRenderizada === 'remessa' && (
          <div>
            {/* Botão voltar */}
            <div className="mb-6">
              <button
                onClick={voltarParaSelecao}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                <ChevronLeft size={18} className="mr-2" />
                Voltar para seleção
              </button>
            </div>

            {/* Submenu de Remessa */}
            {subtelaRemessa === 'menu' && (
              <MenuRemessa
                onGerarArquivo={selecionarGerarArquivo}
                onConsultarArquivos={selecionarConsultarArquivos}
              />
            )}

            {/* Tela de Consultar Arquivos (Histórico) */}
            {subtelaRemessa === 'consultar' && (
              <>
                <TabelaHistorico
                  historico={historico}
                  estatisticas={estatisticas}
                  loadingHistorico={loadingHistorico}
                  loadingEstatisticas={loadingEstatisticas}
                  paginaHistorico={paginaHistorico}
                  totalPaginasHistorico={totalPaginasHistorico}
                  totalRegistrosHistorico={totalRegistrosHistorico}
                  itensPorPagina={itensPorPagina}
                  filtroDataIni={filtroDataIni}
                  filtroDataFim={filtroDataFim}
                  filtroBanco={filtroBanco}
                  onFiltroDataIniChange={setFiltroDataIni}
                  onFiltroDataFimChange={setFiltroDataFim}
                  onFiltroBancoChange={setFiltroBanco}
                  onBuscar={() => carregarHistorico(1)}
                  onVoltar={voltarParaMenuRemessa}
                  onVerDetalhes={carregarDetalhesRemessa}
                  onPaginaAnterior={paginaAnteriorHistorico}
                  onProximaPagina={proximaPaginaHistorico}
                  onMudarPagina={mudarPaginaHistorico}
                />

                <ModalDetalhesRemessa
                  aberto={modalDetalhesAberto}
                  arquivo={arquivoDetalhado}
                  titulos={titulosDetalhados}
                  estatisticas={estatisticasDetalhes}
                  loading={loadingDetalhes}
                  onFechar={fecharModalDetalhes}
                />
              </>
            )}

            {/* Tela de Gerar Arquivo */}
            {subtelaRemessa === 'gerar' && (
              <div>
                {/* Filtros */}
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-900 dark:text-white">Período:</label>
                    <input
                      type="date"
                      value={dataIni}
                      onChange={(e) => setDataIni(e.target.value)}
                      className="text-black dark:text-white bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 text-sm"
                    />
                    <span className="text-gray-500 dark:text-gray-400">até</span>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="text-black dark:text-white bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-900 dark:text-white">Banco:</label>
                    <select
                      value={bancoSelecionado}
                      onChange={(e) => setBancoSelecionado(e.target.value as 'TODOS' | 'BRADESCO' | 'SANTANDER')}
                      className="text-black dark:text-white bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded px-3 py-1 text-sm min-w-[150px]"
                    >
                      <option value="TODOS">Todos os Bancos</option>
                      <option value="BRADESCO">Bradesco (237)</option>
                      <option value="SANTANDER">Santander (033)</option>
                    </select>
                  </div>

                  <DefaultButton
                    onClick={consultarDadosRemessa}
                    disabled={loadingConsulta}
                    className="flex items-center gap-1 px-3 py-2 text-sm h-8"
                    text={loadingConsulta ? "Consultando..." : "Consultar Dados"}
                    icon={<Search size={16} />}
                    variant="secondary"
                  />

                  {consultaRealizada && bancoSelecionado !== 'TODOS' && (
                    <DefaultButton
                      onClick={modoEnvio === 'download' ? handleGerarRemessa : handleEnviarPorEmail}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-2 text-sm h-8"
                      text={loading ? 'Gerando...' : modoEnvio === 'download' ? 'Gerar Remessa' : 'Enviar por Email'}
                      icon={modoEnvio === 'download' ? <Download size={16} /> : <Mail size={16} />}
                    />
                  )}

                  {consultaRealizada && bancoSelecionado === 'TODOS' && (
                    <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Selecione um banco específico para gerar a remessa
                    </div>
                  )}
                </div>

                {/* Modo de envio */}
                {consultaRealizada && (
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-900 dark:text-white">Modo de envio:</label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="download"
                          checked={modoEnvio === 'download'}
                          onChange={(e) => setModoEnvio(e.target.value as 'download' | 'email')}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Download do arquivo</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="email"
                          checked={modoEnvio === 'email'}
                          onChange={(e) => setModoEnvio(e.target.value as 'download' | 'email')}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Enviar por email</span>
                      </label>
                    </div>

                    {modoEnvio === 'email' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-900 dark:text-white">Email:</label>
                        <input
                          type="email"
                          value={emailDestino}
                          onChange={(e) => setEmailDestino(e.target.value)}
                          placeholder="exemplo@empresa.com"
                          className="text-black dark:text-white bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Erro */}
                {erro && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-6">
                    <div className="text-red-800 dark:text-red-200">{erro}</div>
                  </div>
                )}

                {/* Estatísticas por Situação */}
                {estatisticasRemessa && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-blue-900 dark:text-blue-100 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {(bancoSelecionado !== 'TODOS' && porBanco?.length > 0) 
                            ? (porBanco[0]?.titulos || estatisticasRemessa.total)
                            : (estatisticasRemessa.total || 0)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-green-900 dark:text-green-100 flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Novos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-xl font-bold text-green-900 dark:text-green-100">
                          {(bancoSelecionado !== 'TODOS' && porBanco?.length > 0) 
                            ? (porBanco[0]?.remessa || estatisticasRemessa.remessa)
                            : (estatisticasRemessa.remessa || 0)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-red-900 dark:text-red-100 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Baixa
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-xl font-bold text-red-900 dark:text-red-100">
                          {(bancoSelecionado !== 'TODOS' && porBanco?.length > 0) 
                            ? (porBanco[0]?.baixa || estatisticasRemessa.baixa)
                            : (estatisticasRemessa.baixa || 0)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-yellow-900 dark:text-yellow-100 flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          Prorrogação
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                          {(bancoSelecionado !== 'TODOS' && porBanco?.length > 0) 
                            ? (porBanco[0]?.prorrogacao || estatisticasRemessa.prorrogacao)
                            : (estatisticasRemessa.prorrogacao || 0)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-purple-900 dark:text-purple-100 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Valor Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-lg font-bold text-purple-900 dark:text-purple-100">
                          R$ {((bancoSelecionado !== 'TODOS' && porBanco?.length > 0) 
                            ? (porBanco[0]?.valor_total || estatisticasRemessa.valor_total)
                            : (estatisticasRemessa.valor_total || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Tabela de Títulos */}
                {consultaRealizada && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Mostrando {dadosRemessa.length} de {totalRegistrosRemessa.toLocaleString('pt-BR')} registros
                        {totalPaginasRemessa > 1 && ` • Página ${paginaAtualRemessa} de ${totalPaginasRemessa}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-gray-600 dark:text-gray-400">Itens por página:</label>
                        <select
                          value={registrosPorPagina}
                          onChange={(e) => {
                            setRegistrosPorPagina(parseInt(e.target.value));
                            setPaginaAtualRemessa(1);
                          }}
                          disabled={loadingConsulta}
                          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50"
                        >
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                        </select>
                      </div>
                    </div>

                    <div className="relative border rounded-lg dark:border-gray-700 overflow-hidden">
                      {loadingConsulta && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm z-10 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando...</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Situação</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Cliente</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">CPF/CNPJ</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Cidade/UF</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Nº Documento</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Vencimento</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y dark:divide-gray-700">
                            {dadosRemessa.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                  Nenhum título encontrado para o período selecionado
                                </td>
                              </tr>
                            ) : (
                              dadosRemessa.map((titulo, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                      titulo.situacao === 'REMESSA' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                        : titulo.situacao === 'BAIXAR TITULO'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                      {titulo.situacao === 'REMESSA' ? (
                                        <><Plus className="h-3 w-3" />Novo</>
                                      ) : titulo.situacao === 'BAIXAR TITULO' ? (
                                        <><XCircle className="h-3 w-3" />Baixa</>
                                      ) : (
                                        <><Repeat className="h-3 w-3" />Prorrogação</>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-xs truncate" title={titulo.nome_cliente}>
                                    {titulo.nome_cliente}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                                    {titulo.cpfcgc}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {titulo.cidade}/{titulo.uf}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                                    {titulo.nro_doc}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {titulo.dt_venc ? new Date(titulo.dt_venc).toLocaleDateString('pt-BR') : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                    R$ {parseFloat(titulo.valor_pgto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Paginação */}
                    {totalPaginasRemessa > 1 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 pb-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Mostrando <span className="font-semibold text-gray-900 dark:text-gray-100">{dadosRemessa.length}</span> de{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{totalRegistrosRemessa.toLocaleString('pt-BR')}</span> registros
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Página</span>
                            <input
                              type="number"
                              min={1}
                              max={totalPaginasRemessa}
                              value={paginaAtualRemessa}
                              onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (page >= 1 && page <= totalPaginasRemessa) {
                                  setPaginaAtualRemessa(page);
                                }
                              }}
                              disabled={loadingConsulta}
                              className="w-16 px-2 py-2 text-sm text-center font-medium border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              de {totalPaginasRemessa}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Botão Voltar */}
                <div className="mt-6">
                  <button
                    onClick={voltarParaMenuRemessa}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    ← Voltar ao Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tela de Importação (TODO: Componentizar) */}
        {telaRenderizada === 'importacao' && (
          <div>
            <div className="mb-6">
              <button
                onClick={voltarParaSelecao}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                <ChevronLeft size={18} className="mr-2" />
                Voltar para seleção
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Importar Arquivo de Retorno
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selecione o arquivo de retorno CNAB 400
                  </label>
                  <input
                    type="file"
                    accept=".ret,.txt"
                    onChange={(e) => setArquivoDDA(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>

                {arquivoDDA && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Arquivo selecionado: <span className="font-medium">{arquivoDDA.name}</span>
                  </div>
                )}

                <button
                  onClick={handleProcessarArquivoDDA}
                  disabled={!arquivoDDA || loadingProcessamento}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingProcessamento ? 'Processando...' : 'Processar Arquivo'}
                </button>

                {/* Resultado do processamento */}
                {dadosDDA && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                      Arquivo processado com sucesso!
                    </h3>
                    <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      <p>Banco: {dadosDDA.banco}</p>
                      <p>Total de registros: {dadosDDA.totalRegistros}</p>
                      <p>Baixa automática: {dadosDDA.cedentesCadastrados} títulos</p>
                      <p>Baixa manual: {dadosDDA.cedentesNaoCadastrados} títulos</p>
                    </div>

                    {dadosDDA.titulosAutomaticos && dadosDDA.titulosAutomaticos.length > 0 && (
                      <button
                        onClick={handleProcessarBaixaAutomatica}
                        disabled={loadingBaixa}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {loadingBaixa ? 'Processando baixas...' : `Processar ${dadosDDA.titulosAutomaticos.length} Baixas Automáticas`}
                      </button>
                    )}

                    {dadosDDA.titulosManuais && dadosDDA.titulosManuais.length > 0 && (
                      <button
                        onClick={exportarTitulosManuais}
                        className="mt-4 ml-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                      >
                        Exportar {dadosDDA.titulosManuais.length} Títulos Manuais (CSV)
                      </button>
                    )}

                    {resultadoBaixa && (
                      <div className="mt-4 p-3 bg-white dark:bg-zinc-800 rounded border border-green-300 dark:border-green-600">
                        <p className="text-sm font-medium">Resultado da baixa:</p>
                        <p className="text-sm">✅ Sucesso: {resultadoBaixa.resumo?.processadosComSucesso || 0}</p>
                        <p className="text-sm">❌ Erros: {resultadoBaixa.resumo?.erros || 0}</p>
                        <p className="text-sm">⚠️ Não encontrados: {resultadoBaixa.resumo?.naoEncontrados || 0}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
