import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { 
  HistoricoRemessa, 
  Estatisticas, 
  ArquivoDetalhado, 
  TituloDetalhado 
} from '../types/remessa.types';

export function useHistoricoRemessa() {
  // Estados do histórico
  const [historico, setHistorico] = useState<HistoricoRemessa[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [totalPaginasHistorico, setTotalPaginasHistorico] = useState(1);
  const [totalRegistrosHistorico, setTotalRegistrosHistorico] = useState(0);
  const itensPorPagina = 10;

  // Estados para filtros
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroBanco, setFiltroBanco] = useState('TODOS');
  const [filtroTipoRemessa, setFiltroTipoRemessa] = useState('BANCARIA');

  // Estados para estatísticas
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [loadingEstatisticas, setLoadingEstatisticas] = useState(false);

  // Estados para modal de detalhes
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [titulosDetalhados, setTitulosDetalhados] = useState<TituloDetalhado[]>([]);
  const [arquivoDetalhado, setArquivoDetalhado] = useState<ArquivoDetalhado | null>(null);
  const [estatisticasDetalhes, setEstatisticasDetalhes] = useState<any>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Carregar histórico
  const carregarHistorico = async (pagina = 1) => {
    setLoadingHistorico(true);
    try {
      const params = new URLSearchParams({
        page: pagina.toString(),
        limit: itensPorPagina.toString()
      });

      if (filtroDataIni) params.append('dtini', filtroDataIni);
      if (filtroDataFim) params.append('dtfim', filtroDataFim);
      if (filtroBanco !== 'TODOS') {
        const codigoBanco = filtroBanco === 'BRADESCO' ? '237' : filtroBanco === 'SANTANDER' ? '033' : filtroBanco;
        params.append('banco', codigoBanco);
      }
      if (filtroTipoRemessa) params.append('tipo_remessa', filtroTipoRemessa);

      const response = await fetch(`/api/remessa/bancaria/historico?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setHistorico(data.historico);
        setTotalPaginasHistorico(data.paginacao.totalPaginas);
        setTotalRegistrosHistorico(data.paginacao.total);
        setPaginaHistorico(pagina);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico de remessas');
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Carregar estatísticas
  const carregarEstatisticas = async () => {
    setLoadingEstatisticas(true);
    try {
      const response = await fetch('/api/remessa/bancaria/estatisticas');
      if (response.ok) {
        const data = await response.json();
        setEstatisticas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoadingEstatisticas(false);
    }
  };

  // Carregar detalhes de uma remessa
  const carregarDetalhesRemessa = async (codArquivo: number) => {
    setLoadingDetalhes(true);
    try {
      const response = await fetch(`/api/remessa/bancaria/detalhes?id=${codArquivo}`);
      if (response.ok) {
        const data = await response.json();
        setArquivoDetalhado(data.arquivo);
        setTitulosDetalhados(data.titulos);
        setEstatisticasDetalhes(data.estatisticas);
        setModalDetalhesAberto(true);
      } else {
        toast.error('Erro ao carregar detalhes da remessa');
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da remessa:', error);
      toast.error('Erro ao carregar detalhes da remessa');
    } finally {
      setLoadingDetalhes(false);
    }
  };

  // Fechar modal de detalhes
  const fecharModalDetalhes = () => {
    setModalDetalhesAberto(false);
    setTitulosDetalhados([]);
    setArquivoDetalhado(null);
    setEstatisticasDetalhes(null);
  };

  // Rollback de remessa
  const handleRollbackRemessa = async (remessa: HistoricoRemessa) => {
    const confirmacao = window.confirm(
      `⚠️ ATENÇÃO: Reverter a remessa ${remessa.id}?\n\n` +
      `Esta ação irá:\n` +
      `- Reverter as flags dos títulos (bradesco='N', export=0)\n` +
      `- Deletar os registros do banco de dados\n` +
      `- Opcionalmente deletar o arquivo físico\n\n` +
      `Confirmar reversão?`
    );

    if (!confirmacao) return;

    try {
      const response = await fetch('/api/remessa/rollback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codremessa: remessa.id }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Remessa ${remessa.id} revertida com sucesso!`, {
          description: `Títulos afetados: ${data.titulosAtualizados || 0}, Registros deletados: ${data.detalhesRemovidos || 0}`
        });
        carregarHistorico(paginaHistorico);
      } else {
        const error = await response.json();
        toast.error('Erro ao reverter remessa', {
          description: error.error || 'Erro desconhecido'
        });
      }
    } catch (error) {
      console.error('Erro ao reverter remessa:', error);
      toast.error('Erro ao reverter remessa', {
        description: 'Verifique o console para detalhes.'
      });
    }
  };

  // Navegação de paginação
  const mudarPaginaHistorico = (pagina: number) => {
    if (pagina >= 1 && pagina <= totalPaginasHistorico) {
      carregarHistorico(pagina);
    }
  };

  const proximaPaginaHistorico = () => {
    if (paginaHistorico < totalPaginasHistorico) {
      carregarHistorico(paginaHistorico + 1);
    }
  };

  const paginaAnteriorHistorico = () => {
    if (paginaHistorico > 1) {
      carregarHistorico(paginaHistorico - 1);
    }
  };

  return {
    // Estados do histórico
    historico,
    loadingHistorico,
    paginaHistorico,
    totalPaginasHistorico,
    totalRegistrosHistorico,
    itensPorPagina,

    // Estados de filtros
    filtroDataIni,
    filtroDataFim,
    filtroBanco,
    filtroTipoRemessa,
    setFiltroDataIni,
    setFiltroDataFim,
    setFiltroBanco,
    setFiltroTipoRemessa,

    // Estados de estatísticas
    estatisticas,
    loadingEstatisticas,

    // Estados do modal
    modalDetalhesAberto,
    titulosDetalhados,
    arquivoDetalhado,
    estatisticasDetalhes,
    loadingDetalhes,

    // Funções
    carregarHistorico,
    carregarEstatisticas,
    carregarDetalhesRemessa,
    fecharModalDetalhes,
    handleRollbackRemessa,
    mudarPaginaHistorico,
    proximaPaginaHistorico,
    paginaAnteriorHistorico,
  };
}
