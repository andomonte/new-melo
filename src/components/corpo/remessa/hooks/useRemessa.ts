import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { 
  TipoTela, 
  SubtelaRemessa, 
  BancoSelecionado, 
  ModoEnvio 
} from '../types/remessa.types';

// Helper function
function padLeft(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export function useRemessa() {
  // Estados de navegação
  const [telaAtual, setTelaAtual] = useState<TipoTela>('selecao');
  const [subtelaRemessa, setSubtelaRemessa] = useState<SubtelaRemessa>('menu');
  const [telaRenderizada, setTelaRenderizada] = useState<TipoTela>('selecao');

  // Estados de formulário
  const [dataIni, setDataIni] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [emailDestino, setEmailDestino] = useState('');
  const [bancoSelecionado, setBancoSelecionado] = useState<BancoSelecionado>('TODOS');
  const [modoEnvio, setModoEnvio] = useState<ModoEnvio>('download');

  // Estados de loading e erro
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Estados para consulta de dados
  const [dadosRemessa, setDadosRemessa] = useState<any[]>([]);
  const [estatisticasRemessa, setEstatisticasRemessa] = useState<any>(null);
  const [porBanco, setPorBanco] = useState<any[]>([]);
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [consultaRealizada, setConsultaRealizada] = useState(false);

  // Estados para paginação da remessa
  const [paginaAtualRemessa, setPaginaAtualRemessa] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(100);
  const [totalPaginasRemessa, setTotalPaginasRemessa] = useState(0);
  const [totalRegistrosRemessa, setTotalRegistrosRemessa] = useState(0);

  // Sincronizar telaRenderizada com telaAtual
  useEffect(() => {
    if (telaAtual === 'remessa') {
      setTelaRenderizada('remessa');
    } else if (telaAtual === 'importacao') {
      setTelaRenderizada('importacao');
    } else {
      setTelaRenderizada('selecao');
    }
  }, [telaAtual]);

  // Recarregar dados quando mudar paginação
  useEffect(() => {
    if (consultaRealizada && dataIni && dataFim) {
      consultarDadosRemessa();
    }
  }, [paginaAtualRemessa, registrosPorPagina]);

  // Funções de navegação
  const selecionarGerarRemessa = () => {
    setTelaAtual('remessa');
    setSubtelaRemessa('menu');
  };

  const selecionarGerarArquivo = () => {
    setSubtelaRemessa('gerar');
  };

  const selecionarConsultarArquivos = () => {
    setSubtelaRemessa('consultar');
  };

  const voltarParaMenuRemessa = () => {
    setSubtelaRemessa('menu');
    limparEstados();
  };

  const selecionarImportarRetorno = () => {
    setTelaAtual('importacao');
  };

  const voltarParaSelecao = () => {
    setTelaAtual('selecao');
    setSubtelaRemessa('menu');
    limparEstados();
  };

  const limparEstados = () => {
    setErro('');
    setDadosRemessa([]);
    setEstatisticasRemessa(null);
    setPorBanco([]);
    setConsultaRealizada(false);
    resetarPaginacao();
  };

  const resetarPaginacao = () => {
    setPaginaAtualRemessa(1);
    setTotalPaginasRemessa(0);
    setTotalRegistrosRemessa(0);
  };

  // Consultar dados de remessa
  const consultarDadosRemessa = async () => {
    if (!dataIni || !dataFim) {
      setErro('Datas inicial e final são obrigatórias');
      return;
    }

    const dtIni = new Date(dataIni);
    const dtFim = new Date(dataFim);

    if (dtIni > dtFim) {
      setErro('Data inicial não pode ser maior que data final');
      return;
    }

    setLoadingConsulta(true);
    setErro('');

    try {
      let url = `/api/remessa/titulos?dtini=${dataIni}&dtfim=${dataFim}&page=${paginaAtualRemessa}&pageSize=${registrosPorPagina}`;
      
      if (bancoSelecionado !== 'TODOS') {
        const banco = bancoSelecionado === 'BRADESCO' ? '237' : '033';
        url += `&banco=${banco}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || 'Erro ao consultar dados');
      }

      const result = await response.json();
      
      setDadosRemessa(result.titulos || []);
      setEstatisticasRemessa(result.estatisticas || {});
      setPorBanco(result.por_banco || []);
      setConsultaRealizada(true);
      
      if (result.paginacao) {
        setTotalPaginasRemessa(result.paginacao.total_paginas);
        setTotalRegistrosRemessa(result.paginacao.total_registros);
      }

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao consultar dados de remessa');
    } finally {
      setLoadingConsulta(false);
    }
  };

  // Gerar remessa
  const handleGerarRemessa = async () => {
    if (!dataIni || !dataFim) {
      setErro('Datas inicial e final são obrigatórias');
      return;
    }

    const dtIni = new Date(dataIni);
    const dtFim = new Date(dataFim);

    if (dtIni > dtFim) {
      setErro('Data inicial não pode ser maior que data final');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const isRemessaBancaria = bancoSelecionado !== 'TODOS';

      if (isRemessaBancaria) {
        const banco = bancoSelecionado === 'BRADESCO' ? '237' : '033';
        const response = await fetch('/api/remessa/bancaria/gerar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dtini: dataIni, dtfim: dataFim, banco }),
        });

        const data = await response.json();
        
        if (!data.sucesso) {
          throw new Error(data.erro || 'Erro desconhecido ao gerar remessa');
        }

        const conteudoCNAB = data.arquivo.conteudo;
        const nomeArquivo = data.arquivo.nome;
        
        const blob = new Blob([conteudoCNAB], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success(data.mensagem || 'Remessa gerada com sucesso!', {
          description: `Arquivo: ${nomeArquivo}. Verifique a pasta de downloads.`
        });
        
        setConsultaRealizada(false);
        setDadosRemessa([]);
        setEstatisticasRemessa(null);
        setPorBanco([]);
      } else {
        const response = await fetch('/api/remessa/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dtini: dataIni, dtfim: dataFim }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.erro || 'Erro ao gerar remessa');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RM${format(new Date(), 'ddMMyyyy')}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Remessa de cobrança gerada com sucesso!');
      }

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao gerar remessa');
    } finally {
      setLoading(false);
    }
  };

  // Enviar por email
  const handleEnviarPorEmail = async () => {
    if (!dataIni || !dataFim) {
      setErro('Datas inicial e final são obrigatórias');
      return;
    }

    if (!emailDestino) {
      setErro('Email de destino é obrigatório');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailDestino)) {
      setErro('Email de destino inválido');
      return;
    }

    const dtIni = new Date(dataIni);
    const dtFim = new Date(dataFim);

    if (dtIni > dtFim) {
      setErro('Data inicial não pode ser maior que data final');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const response = await fetch('/api/remessa/remessa-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dtini: dataIni, dtfim: dataFim, emailDestino }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || 'Erro ao enviar remessa por email');
      }

      const result = await response.json();
      toast.success('Remessa enviada com sucesso!', {
        description: `Enviada para: ${emailDestino}. Registros: ${result.dados.registros}. Período: ${result.dados.periodo}`
      });

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao enviar remessa por email');
    } finally {
      setLoading(false);
    }
  };

  return {
    // Estados
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

    // Setters
    setDataIni,
    setDataFim,
    setEmailDestino,
    setBancoSelecionado,
    setModoEnvio,
    setErro,
    setPaginaAtualRemessa,
    setRegistrosPorPagina,

    // Funções de navegação
    selecionarGerarRemessa,
    selecionarGerarArquivo,
    selecionarConsultarArquivos,
    voltarParaMenuRemessa,
    selecionarImportarRetorno,
    voltarParaSelecao,
    resetarPaginacao,

    // Funções de ação
    consultarDadosRemessa,
    handleGerarRemessa,
    handleEnviarPorEmail,
  };
}
