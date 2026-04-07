import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DefaultButton } from '@/components/common/Buttons';
import { ChevronLeft, ChevronRight, FileText, Upload, History, Search, Download, Mail, Users, UserCheck, ShoppingCart, DollarSign, Plus, X, ArrowDown, AlertTriangle, Sparkles, CheckCircle2, XCircle, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Helper function
function padLeft(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

interface DDARecord {
  seq: number;
  cedente: string;
  cnpj: string;
  dtEmissao: string;
  dtVenc: string;
  dtLimite: string;
  valorPgto: number;
  valorJuros: number;
  nroDoc: string;
  codEspecie: string;
  especie: string;
  codProtesto: string;
  tipoProtesto: string;
  diasJuros: string;
  cadastrado: string;
  tipoCedente: string;
}

interface CedenteInfo {
  cedente: string;
  cnpj: string;
  cadastrado: string;
  tipo: string;
  titulos: DDARecord[];
}

 export default function RemessaEquifax() {
  const [dataIni, setDataIni] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [emailDestino, setEmailDestino] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [modoEnvio, setModoEnvio] = useState<'download' | 'email'>('download');
  const [bancoSelecionado, setBancoSelecionado] = useState<'TODOS' | 'BRADESCO' | 'SANTANDER'>('TODOS');
  const [abaAtiva, setAbaAtiva] = useState<'gerar' | 'importar' | 'historico'>('gerar');
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [totalPaginasHistorico, setTotalPaginasHistorico] = useState(1);
  const [totalRegistrosHistorico, setTotalRegistrosHistorico] = useState(0);
  const [detalhesRemessa, setDetalhesRemessa] = useState<any[]>([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [remessaSelecionada, setRemessaSelecionada] = useState<number | null>(null);

  // Estados para filtros do histórico
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroBanco, setFiltroBanco] = useState('TODOS');
  const [filtroTipoRemessa, setFiltroTipoRemessa] = useState('BANCARIA');

  // Estados para estatísticas
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [loadingEstatisticas, setLoadingEstatisticas] = useState(false);

  // Estados para detalhes expandidos (modal)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [titulosDetalhados, setTitulosDetalhados] = useState<any[]>([]);
  const [arquivoDetalhado, setArquivoDetalhado] = useState<any>(null);
  const [estatisticasDetalhes, setEstatisticasDetalhes] = useState<any>(null);

  // Estados para controle de navegação
  const [telaAtual, setTelaAtual] = useState<'selecao' | 'remessa' | 'importacao'>('selecao');
  const [subtelaRemessa, setSubtelaRemessa] = useState<'menu' | 'gerar' | 'consultar'>('menu');

  // Controle de renderização
  const [telaRenderizada, setTelaRenderizada] = useState<'selecao' | 'remessa' | 'importacao'>('selecao');

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

  // Estados para importação DDA/Retorno
  const [arquivoDDA, setArquivoDDA] = useState<File | null>(null);
  const [dadosDDA, setDadosDDA] = useState<{
    totalRegistros: number;
    cedentesCadastrados: number;
    cedentesNaoCadastrados: number;
    cedentes?: CedenteInfo[];
    registros?: DDARecord[];
    // Campos específicos do retorno CNAB
    codretorno?: number;
    banco?: string;
    nomeArquivo?: string;
    estatisticas?: {
      totalProcessados: number;
      liquidados: number;
      baixados: number;
      rejeitados: number;
      outros: number;
      porFilial: {
        mao: number;
        pvh: number;
        rec: number;
        flz: number;
        bmo: number;
        csac: number;
        jps: number;
      };
    };
    titulosAutomaticos?: Array<{
      nossoNumero: string;
      numeroDocumento: string;
      nomeSacado: string;
      valorPago: number;
      dataOcorrencia: string;
      codigoOcorrencia?: string;
      ocorrencia: string;
    }>;
    titulosManuais?: Array<{
      nossoNumero: string;
      numeroDocumento: string;
      nomeSacado: string;
      valorTitulo?: number;
      valorPago: number;
      jurosMulta?: number;
      desconto?: number;
      dataVencimento?: string;
      dataOcorrencia: string;
      codigoOcorrencia?: string;
      ocorrencia: string;
      motivo: string;
      motivoOcorrencia?: string;
    }>;
  } | null>(null);
  const [loadingProcessamento, setLoadingProcessamento] = useState(false);
  const [cedentesSelecionados, setCedentesSelecionados] = useState<Set<string>>(new Set());
  
  // Estados para baixa automática
  const [loadingBaixa, setLoadingBaixa] = useState(false);
  const [resultadoBaixa, setResultadoBaixa] = useState<any>(null);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Estados para consulta de dados de remessa
  const [dadosRemessa, setDadosRemessa] = useState<any[]>([]);
  const [estatisticasRemessa, setEstatisticasRemessa] = useState<any>(null);
  const [porBanco, setPorBanco] = useState<any[]>([]);
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [consultaRealizada, setConsultaRealizada] = useState(false);

  // Função para exportar títulos manuais para CSV
  const exportarTitulosManuais = () => {
    if (!dadosDDA || !dadosDDA.titulosManuais || dadosDDA.titulosManuais.length === 0) {
      toast.error('Não há títulos manuais para exportar');
      return;
    }

    try {
      // Cabeçalho do CSV
      const headers = [
        'Nosso Número',
        'Documento',
        'Cliente',
        'Valor Título',
        'Valor Pago',
        'Diferença',
        'Juros/Multa',
        'Desconto',
        'Data Vencimento',
        'Data Ocorrência',
        'Código Ocorrência',
        'Ocorrência',
        'Motivo Processamento Manual',
        'Motivo Ocorrência'
      ].join(';');

      // Linhas de dados
      const linhas = dadosDDA.titulosManuais.map(titulo => {
        const diferenca = (titulo.valorPago || 0) - (titulo.valorTitulo || 0);
        return [
          titulo.nossoNumero || '',
          titulo.numeroDocumento || '',
          (titulo.nomeSacado || '').replace(/;/g, ','), // Remover ponto e vírgula do nome
          (titulo.valorTitulo || 0).toFixed(2).replace('.', ','),
          (titulo.valorPago || 0).toFixed(2).replace('.', ','),
          diferenca.toFixed(2).replace('.', ','),
          (titulo.jurosMulta || 0).toFixed(2).replace('.', ','),
          (titulo.desconto || 0).toFixed(2).replace('.', ','),
          titulo.dataVencimento || '',
          titulo.dataOcorrencia || '',
          titulo.codigoOcorrencia || '',
          (titulo.ocorrencia || '').replace(/;/g, ','),
          (titulo.motivo || '').replace(/;/g, ','),
          (titulo.motivoOcorrencia || '').replace(/;/g, ',')
        ].join(';');
      });

      // Montar CSV completo
      const csv = [headers, ...linhas].join('\n');

      // Adicionar BOM para suporte UTF-8 no Excel
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const nomeArquivo = `titulos_manuais_${dadosDDA.banco || 'banco'}_${dataHora}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', nomeArquivo);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${dadosDDA.titulosManuais.length} título(s) exportado(s) com sucesso`);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar lista de títulos');
    }
  };
  
  // Estados para paginação da remessa
  const [paginaAtualRemessa, setPaginaAtualRemessa] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(100);
  const [totalPaginasRemessa, setTotalPaginasRemessa] = useState(0);
  const [totalRegistrosRemessa, setTotalRegistrosRemessa] = useState(0);

  // Funções de navegação
  const selecionarGerarRemessa = () => {
    setTelaAtual('remessa');
    setSubtelaRemessa('menu');
  }

  const selecionarGerarArquivo = () => {
    setSubtelaRemessa('gerar');
  };

  const selecionarConsultarArquivos = async () => {
    setSubtelaRemessa('consultar');
    // Carregar histórico e estatísticas ao abrir a tela de consulta
    try {
      await Promise.all([
        carregarHistorico(),
        carregarEstatisticas()
      ]);
    } catch (e) {
      console.warn('Erro ao carregar dados na navegação:', e);
    }
  };

  const voltarParaMenuRemessa = () => {
    setSubtelaRemessa('menu');
    // Limpar estados quando voltar
    setErro('');
    setDadosRemessa([]);
    setEstatisticasRemessa(null);
    setPorBanco([]);
    setConsultaRealizada(false);
    setPaginaAtual(1);
    resetarPaginacao();
  };

  const selecionarImportarRetorno = () => {
    setTelaAtual('importacao');
  };

  const voltarParaSelecao = () => {
    setTelaAtual('selecao');
    setSubtelaRemessa('menu');
    // Limpar estados quando voltar
    setErro('');
    setDadosDDA(null);
    setArquivoDDA(null);
    setCedentesSelecionados(new Set());
    setDadosRemessa([]);
    setEstatisticasRemessa(null);
    setPorBanco([]);
    setConsultaRealizada(false);
    setPaginaAtual(1);
    resetarPaginacao();
  };

  // const selecionarImportarRetorno = () => {
  //   setTelaAtual('importacao');
  //   setAbaAtiva('importar');
  // };

  // const voltarParaSelecao = () => {
  //   setTelaAtual('selecao');
  //   // Limpar estados quando voltar
  //   setErro('');
  //   setDadosDDA(null);
  //   setArquivoDDA(null);
  //   setCedentesSelecionados(new Set());
  // };

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
      // Determinar qual API usar baseado no banco selecionado
      const isRemessaBancaria = bancoSelecionado !== 'TODOS';
      const endpoint = isRemessaBancaria ? '/api/remessa/bancaria/gerar-v2' : '/api/remessa/';

      if (isRemessaBancaria) {
        // Remessa bancária CNAB 400 - NOVA API v2
        const banco = bancoSelecionado === 'BRADESCO' ? '237' : '033';
        const response = await fetch('/api/remessa/bancaria/gerar-v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dtini: dataIni,
            dtfim: dataFim,
            banco: banco
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error('Erro ao gerar remessa bancária');
          }
          throw new Error(errorData.erro || 'Erro ao gerar remessa bancária');
        }

        // Receber o arquivo como texto
        const conteudoCNAB = await response.text();
        
        // Gerar nome do arquivo no padrão bancário: RM + DDMMAAAA
        const hoje = new Date();
        const dataStr = `${padLeft(hoje.getDate(), 2)}${padLeft(hoje.getMonth() + 1, 2)}${hoje.getFullYear()}`;
        const nomeArquivo = `RM${dataStr}.txt`;
        
        // Criar blob e fazer download
        const blob = new Blob([conteudoCNAB], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Mensagem de sucesso
        toast.success('Remessa gerada com sucesso!', {
          description: `Arquivo: ${nomeArquivo}. Verifique a pasta de downloads.`
        });
        
        // Limpar consulta após gerar
        setConsultaRealizada(false);
        setDadosRemessa([]);
        setEstatisticasRemessa(null);
        setPorBanco([]);
      } else {
        // Remessa Equifax (padrão)
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dtini: dataIni,
            dtfim: dataFim,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.erro || 'Erro ao gerar remessa');
        }

        // Criar blob e download
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

  const handleEnviarPorEmail = async () => {
    if (!dataIni || !dataFim) {
      setErro('Datas inicial e final são obrigatórias');
      return;
    }

    if (!emailDestino) {
      setErro('Email de destino é obrigatório');
      return;
    }

    // Validar email
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dtini: dataIni,
          dtfim: dataFim,
          emailDestino,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || 'Erro ao enviar remessa por email');
      }

      const result = await response.json();
      toast.success('Remessa enviada com sucesso!', {
        description: `Enviada para: ${emailDestino}. Registros: ${result.dados.registros}. Período: ${result.dados.periodo}`
      });

      // Recarregar histórico após envio
      carregarHistorico();

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao enviar remessa por email');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessarArquivoDDA = async () => {
    if (!arquivoDDA) {
      setErro('Selecione um arquivo DDA para processar');
      return;
    }

    setLoadingProcessamento(true);
    setErro('');
    setDadosDDA(null);

    try {
      // Enviar arquivo diretamente para o endpoint de processamento (evita problemas com arquivos temporários entre instâncias)
      const formData = new FormData();
      formData.append('file', arquivoDDA);
      formData.append('usuario', 'SYSTEM'); // pode trocar pelo usuário logado

      const response = await fetch('/api/remessa/retorno/processar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Erro ao processar arquivo de retorno');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Erro ao processar arquivo');
      }

      // Armazenar resultado do processamento com estrutura adaptada
      const dadosProcessados = {
        codretorno: result.data.codretorno,
        banco: result.data.banco,
        nomeArquivo: result.data.nomeArquivo,
        totalRegistros: result.data.totalTitulos,
        cedentesCadastrados: result.data.titulosParaBaixaAutomatica.length,
        cedentesNaoCadastrados: result.data.titulosParaBaixaManual.length,
        estatisticas: result.data.estatisticas,
        titulosAutomaticos: result.data.titulosParaBaixaAutomatica,
        titulosManuais: result.data.titulosParaBaixaManual,
      };
      
      console.log('📦 Dados processados:', dadosProcessados);
      console.log('🔑 Código do retorno:', dadosProcessados.codretorno);
      
      setDadosDDA(dadosProcessados);

      // Mostrar toast com resumo
      toast.success('Arquivo de retorno processado!', {
        description: `Processados: ${result.data.totalTitulos} títulos. Baixa automática: ${result.data.titulosParaBaixaAutomatica.length}, Manual: ${result.data.titulosParaBaixaManual.length}`
      });

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao processar arquivo de retorno');
      toast.error('Erro ao processar', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setLoadingProcessamento(false);
    }
  };

  const handleProcessarBaixaAutomatica = async () => {
    console.log('🎯 Iniciando processamento de baixa automática');
    console.log('📋 dadosDDA:', dadosDDA);
    
    if (!dadosDDA) {
      toast.error('Erro', {
        description: 'Nenhum arquivo de retorno processado. Faça o upload e processe um arquivo primeiro.'
      });
      return;
    }
    
    if (!dadosDDA.codretorno) {
      console.error('❌ codretorno não encontrado:', dadosDDA);
      toast.error('Erro', {
        description: 'Código do retorno não encontrado. Processe o arquivo novamente.'
      });
      return;
    }

    if (!dadosDDA.titulosAutomaticos || dadosDDA.titulosAutomaticos.length === 0) {
      toast.warning('Atenção', {
        description: 'Não há títulos para baixa automática neste arquivo.'
      });
      return;
    }

    console.log('✅ Validações OK. Código do retorno:', dadosDDA.codretorno);
    setLoadingBaixa(true);
    setResultadoBaixa(null);

    try {
      const response = await fetch('/api/remessa/retorno/processar-baixa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codretorno: dadosDDA.codretorno
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || 'Erro ao processar baixa automática');
      }

      const result = await response.json();
      setResultadoBaixa(result);

      // Mostrar toast com resumo
      if (result.resumo.processadosComSucesso > 0) {
        toast.success('Baixa automática processada!', {
          description: `${result.resumo.processadosComSucesso} títulos baixados com sucesso. Erros: ${result.resumo.erros}. Não encontrados: ${result.resumo.naoEncontrados}`
        });
      } else {
        toast.warning('Atenção', {
          description: `Nenhum título foi baixado. Erros: ${result.resumo.erros}. Não encontrados: ${result.resumo.naoEncontrados}`
        });
      }

    } catch (error: any) {
      console.error('Erro ao processar baixa:', error);
      toast.error('Erro ao processar baixa', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setLoadingBaixa(false);
    }
  };

  const handleImportarTitulos = async () => {
    if (!dadosDDA || cedentesSelecionados.size === 0) {
      setErro('Selecione pelo menos um cedente para importar');
      return;
    }

    // Verificar se tem registros (modo DDA antigo)
    if (!dadosDDA.registros || dadosDDA.registros.length === 0) {
      setErro('Nenhum registro disponível para importação');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      // Filtrar apenas os títulos dos cedentes selecionados
      const titulosParaImportar = dadosDDA.registros.filter(registro =>
        cedentesSelecionados.has(registro.cnpj)
      );

      if (titulosParaImportar.length === 0) {
        throw new Error('Nenhum título encontrado para os cedentes selecionados');
      }

      // Por enquanto, usar valores padrão para os códigos
      // Em uma implementação completa, esses valores deveriam vir de um formulário
      const codComprador = '1'; // Código do comprador padrão
      const codConta = '1'; // Código da conta padrão
      const codCentroCusto = '1'; // Código do centro de custo padrão
      const username = 'SYSTEM_DDA'; // Usuário do sistema

      // Chamar API de importação
      const response = await fetch('/api/remessa/importar-titulos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulos: titulosParaImportar,
          codComprador,
          codConta,
          codCentroCusto,
          username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar títulos');
      }

      const result = await response.json();

      // Mostrar resultado detalhado
      const sucessoMsg = `✅ Importação concluída!\n\n� Títulos importados: ${result.data.titulosImportados}\n❌ Erros: ${result.data.titulosErro}\n📄 Total processado: ${result.data.totalProcessados}`;

      if (result.data.titulosErro > 0) {
        // Mostrar detalhes dos erros
        const erros = result.data.resultados.filter((r: any) => r.status === 'erro');
        const erroDetalhes = erros.map((e: any) => `${e.titulo}: ${e.mensagem}`).join(', ');
        toast.warning('Importação concluída com erros', {
          description: `Importados: ${result.data.titulosImportados}, Erros: ${result.data.titulosErro}. Detalhes: ${erroDetalhes}`
        });
      } else {
        toast.success('Importação concluída!', {
          description: `Títulos importados: ${result.data.titulosImportados}. Total processado: ${result.data.totalProcessados}`
        });
      }

      // Limpar dados após importação
      setDadosDDA(null);
      setArquivoDDA(null);
      setCedentesSelecionados(new Set());

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao importar títulos');
    } finally {
      setLoading(false);
    }
  };

  const toggleCedenteSelecao = (cnpj: string) => {
    const novoSelecionados = new Set(cedentesSelecionados);
    if (novoSelecionados.has(cnpj)) {
      novoSelecionados.delete(cnpj);
    } else {
      novoSelecionados.add(cnpj);
    }
    setCedentesSelecionados(novoSelecionados);
  };

  const carregarHistorico = async (pagina = 1) => {
    setLoadingHistorico(true);
    try {
      // Construir query params com filtros
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

  const fecharModalDetalhes = () => {
    setModalDetalhesAberto(false);
    setTitulosDetalhados([]);
    setArquivoDetalhado(null);
    setEstatisticasDetalhes(null);
  };

  const handleRollbackRemessa = async (remessa: any) => {
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          codremessa: remessa.id 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Remessa ${remessa.id} revertida com sucesso!`, {
          description: `Títulos afetados: ${data.titulosAtualizados || 0}, Registros deletados: ${data.detalhesRemovidos || 0}`
        });
        
        // Recarregar histórico para refletir as mudanças
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

  React.useEffect(() => {
    if (abaAtiva === 'historico') {
      carregarHistorico();
    }
  }, [abaAtiva]);

  // Função para consultar dados de remessa
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
      // NOVA API: /api/remessa/titulos com suporte a 3 tipos (REMESSA, BAIXA, PRORROGAÇÃO)
      let url = `/api/remessa/titulos?dtini=${dataIni}&dtfim=${dataFim}&page=${paginaAtualRemessa}&pageSize=${registrosPorPagina}`;
      
      // Adicionar parâmetro banco se selecionado
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
      
      // Novo formato de resposta com paginação
      setDadosRemessa(result.titulos || []);
      setEstatisticasRemessa(result.estatisticas || {});
      setPorBanco(result.por_banco || []);
      setConsultaRealizada(true);
      
      // Atualizar informações de paginação
      if (result.paginacao) {
        setTotalPaginasRemessa(result.paginacao.total_paginas);
        setTotalRegistrosRemessa(result.paginacao.total_registros);
      }

      console.log('✅ Títulos consultados:', {
        total: result.titulos?.length,
        remessa: result.estatisticas?.remessa,
        baixa: result.estatisticas?.baixa,
        prorrogacao: result.estatisticas?.prorrogacao,
        por_banco: result.por_banco,
        paginacao: result.paginacao
      });

    } catch (error: any) {
      console.error('Erro:', error);
      setErro(error.message || 'Erro ao consultar dados de remessa');
    } finally {
      setLoadingConsulta(false);
    }
  };

  // Recarregar dados quando mudar de página ou itens por página
  useEffect(() => {
    if (consultaRealizada && dataIni && dataFim) {
      consultarDadosRemessa();
    }
  }, [paginaAtualRemessa, registrosPorPagina]);

  // Resetar paginação ao mudar filtros
  const resetarPaginacao = () => {
    setPaginaAtualRemessa(1);
    setTotalPaginasRemessa(0);
    setTotalRegistrosRemessa(0);
  };

  // Calcular dados da página atual (para DDA)
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const dadosPaginaAtual = dadosRemessa.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.ceil(dadosRemessa.length / itensPorPagina);

  // Funções de paginação
  const irParaPagina = (pagina: number) => {
    setPaginaAtual(pagina);
  };

  const paginaAnterior = () => {
    if (paginaAtual > 1) {
      setPaginaAtual(paginaAtual - 1);
    }
  };

  const proximaPagina = () => {
    if (paginaAtual < totalPaginas) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  return (
    <div className="h-full flex flex-col border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 overflow-y-auto p-4 w-full">
        {/* Header com título */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            Sistema de Remessa
          </h1>
        </div>

        {/* Renderização condicional das telas */}
        {telaRenderizada === 'selecao' && (
          <div className="text-center py-12">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                O que você deseja fazer?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Escolha entre gerar uma nova remessa ou importar um arquivo de retorno DDA
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Opção Gerar Remessa */}
              <div
                onClick={selecionarGerarRemessa}
                className="cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-8 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Gerar Remessa de Cobrança
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm text-center">
                    Criar e enviar arquivo de remessa para análise de crédito  
                  </p>
                </div>
              </div>

              {/* Opção Importar Retorno DDA */}
              <div
                onClick={selecionarImportarRetorno}
                className="cursor-pointer bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-8 hover:border-green-300 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    Importar Retorno Cobrança
                  </h3>
                  <p className="text-green-700 dark:text-green-300 text-sm text-center">
                    Processar arquivo de retorno bancário e importar títulos para contas a pagar
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Selecione uma das opções acima para continuar
              </p>
            </div>
          </div>
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

            {/* Submenu: menu / gerar / consultar */}
            {subtelaRemessa === 'menu' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div
                  onClick={selecionarGerarArquivo}
                  className="cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow transition-all duration-150"
                >
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Gerar Arquivo de Remessa</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Consultar os dados e gerar o arquivo de remessa(download ou envio por email).</p>
                </div>

                <div
                  onClick={selecionarConsultarArquivos}
                  className="cursor-pointer bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900/20 dark:to-zinc-800/20 border-2 border-gray-200 dark:border-zinc-600 rounded-lg p-6 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow transition-all duration-150"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Consultar Arquivos Gerados</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ver histórico de arquivos de remessa já gerados e baixá-los novamente.</p>
                </div>
              </div>
            )}

            {subtelaRemessa === 'consultar' && (
              <div className="mb-6">
                {/* Estatísticas no topo */}
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
                    {/* Filtro: Data Inicial */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data Inicial
                      </label>
                      <input
                        type="date"
                        value={filtroDataIni}
                        onChange={(e) => setFiltroDataIni(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Filtro: Data Final */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data Final
                      </label>
                      <input
                        type="date"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Filtro: Banco */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Banco
                      </label>
                      <select
                        value={filtroBanco}
                        onChange={(e) => setFiltroBanco(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                      >
                        <option value="TODOS">Todos</option>
                        <option value="BRADESCO">Bradesco (237)</option>
                        <option value="SANTANDER">Santander (033)</option>
                      </select>
                    </div>

                    {/* Botão Aplicar Filtros */}
                    <div className="flex items-end">
                      <button
                        onClick={() => carregarHistorico(1)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Buscar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Histórico de Remessas</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {totalRegistrosHistorico > 0 ? `${totalRegistrosHistorico} remessa(s) encontrada(s)` : 'Nenhuma remessa encontrada'}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={voltarParaMenuRemessa}
                      className="px-3 py-1 text-sm bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-600"
                    >
                      Voltar
                    </button>
                  </div>
                </div>

                {loadingHistorico ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando histórico...</span>
                  </div>
                ) : (
                  <>
                    {/* Tabela de histórico */}
                    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-zinc-600 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-600">
                        <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Banco
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Borderô
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Data/Hora
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Títulos
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Valor Total
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Ações
                            </th>
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
                                  <div className="flex items-center gap-2">
                                    {h.banco === '237' ? (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                        <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
                                        </svg>
                                        Bradesco
                                      </span>
                                    ) : h.banco === '033' ? (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                        <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/>
                                        </svg>
                                        Santander
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 dark:text-gray-400">-</span>
                                    )}
                                  </div>
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
                                          <span className="text-green-600 dark:text-green-400">
                                            ✓ {h.titulos_liquidados}
                                          </span>
                                        )}
                                        {h.titulos_pendentes > 0 && (
                                          <span className="text-yellow-600 dark:text-yellow-400">
                                            ⏳ {h.titulos_pendentes}
                                          </span>
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
                                      onClick={() => carregarDetalhesRemessa(h.id)}
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
                        <div className="flex justify-between flex-1 sm:hidden">
                          <button
                            onClick={paginaAnteriorHistorico}
                            disabled={paginaHistorico === 1}
                            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Anterior
                          </button>
                          <button
                            onClick={proximaPaginaHistorico}
                            disabled={paginaHistorico === totalPaginasHistorico}
                            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Próximo
                          </button>
                        </div>
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
                                onClick={paginaAnteriorHistorico}
                                disabled={paginaHistorico === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="sr-only">Anterior</span>
                                <ChevronLeft className="h-5 w-5" />
                              </button>

                              {Array.from({ length: Math.min(5, totalPaginasHistorico) }, (_, i) => {
                                const pageNum = Math.max(1, Math.min(totalPaginasHistorico - 4, paginaHistorico - 2)) + i;
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => mudarPaginaHistorico(pageNum)}
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
                                onClick={proximaPaginaHistorico}
                                disabled={paginaHistorico === totalPaginasHistorico}
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="sr-only">Próximo</span>
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
            )}

            {/* Modal de Detalhes da Remessa */}
            {modalDetalhesAberto && arquivoDetalhado && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-600">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Detalhes da Remessa #{arquivoDetalhado.cod_arquivo}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {arquivoDetalhado.nome_banco} - {arquivoDetalhado.nome_arquivo}
                      </p>
                    </div>
                    <button
                      onClick={fecharModalDetalhes}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {loadingDetalhes ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando detalhes...</span>
                      </div>
                    ) : (
                      <>
                        {/* Informações do Arquivo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                            <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Data de Geração</div>
                            <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                              {new Date(arquivoDetalhado.dt_geracao).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {new Date(arquivoDetalhado.dt_geracao).toLocaleTimeString('pt-BR')}
                            </div>
                          </div>

                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                            <div className="text-sm text-green-700 dark:text-green-300 mb-1">Total de Títulos</div>
                            <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                              {arquivoDetalhado.qtd_registros}
                            </div>
                            {estatisticasDetalhes && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex gap-2">
                                <span>✓ {estatisticasDetalhes.liquidados}</span>
                                <span>⏳ {estatisticasDetalhes.enviados}</span>
                              </div>
                            )}
                          </div>

                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                            <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Valor Total</div>
                            <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                              R$ {parseFloat(arquivoDetalhado.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            {estatisticasDetalhes && estatisticasDetalhes.valor_liquidado > 0 && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                Liquidado: R$ {estatisticasDetalhes.valor_liquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                            <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Borderô Oracle</div>
                            <div className="text-lg font-semibold text-orange-900 dark:text-orange-100 font-mono">
                              {arquivoDetalhado.cod_bodero || '-'}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              Seq: {arquivoDetalhado.sequencial_arquivo}
                            </div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-3 mb-6">
                          <a
                            href={`/remessas/bancaria/${arquivoDetalhado.nome_arquivo}`}
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download CNAB 400
                          </a>
                        </div>

                        {/* Lista de Títulos */}
                        <div className="border border-gray-200 dark:border-zinc-600 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 dark:bg-zinc-800 px-4 py-3 border-b border-gray-200 dark:border-zinc-600">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              Títulos Incluídos ({titulosDetalhados.length})
                            </h4>
                          </div>
                          <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-600">
                              <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Cód. Receb
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Nosso Número
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Cliente
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Vencimento
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Valor
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Status
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Retorno
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-600">
                                {titulosDetalhados.map((titulo: any) => (
                                  <tr key={titulo.cod_remessa_detalhe} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                      {titulo.cod_receb}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                      {titulo.nosso_numero}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate" title={titulo.nome_cliente}>
                                      <div>{titulo.nome_cliente}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {titulo.cpf_cnpj}
                                      </div>
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

                  <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-zinc-600">
                    <button
                      onClick={fecharModalDetalhes}
                      className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {subtelaRemessa === 'gerar' && (
              <div>
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-900 dark:text-white">
                      Período:
                    </label>
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
                    <label className="text-sm text-gray-900 dark:text-white">
                      Banco:
                    </label>
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
                  <label className="text-sm text-gray-900 dark:text-white">
                    Modo de envio:
                  </label>
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

                {/* Campo de email quando modo email */}
                {modoEnvio === 'email' && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-900 dark:text-white">
                      Email:
                    </label>
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

            {erro && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-6">
                <div className="text-red-800 dark:text-red-200">{erro}</div>
              </div>
            )}

            {/* Estatísticas por Situação - Atualiza conforme banco selecionado */}
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
                      {(bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0) 
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
                      {(bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0) 
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
                      {(bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0) 
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
                      {(bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0) 
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
                      R$ {((bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0) 
                        ? (porBanco[0]?.valor_total || estatisticasRemessa.valor_total)
                        : (estatisticasRemessa.valor_total || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Card compacto de Banco - Mostra quando um banco específico está selecionado */}
            {bancoSelecionado !== 'TODOS' && porBanco && porBanco.length > 0 && (
              <div className="mb-4">
             
              </div>
            )}

            {/* Tabela de Títulos com Paginação */}
            {consultaRealizada && (
              <div className="space-y-4">
                {/* Info e controles de paginação */}
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

                {/* Tabela com container de altura limitada e scroll */}
                <div className="relative border rounded-lg dark:border-gray-700 overflow-hidden">
                  {loadingConsulta && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm z-10 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Carregando...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Container com scroll vertical e horizontal */}
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
                                    <>
                                      <Plus className="h-3 w-3" />
                                      Novo
                                    </>
                                  ) : titulo.situacao === 'BAIXAR TITULO' ? (
                                    <>
                                      <XCircle className="h-3 w-3" />
                                      Baixa
                                    </>
                                  ) : (
                                    <>
                                      <Repeat className="h-3 w-3" />
                                      Prorrogação
                                    </>
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

                {/* Controles de paginação profissionais */}
                {totalPaginasRemessa > 1 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 pb-1">
                    {/* Indicador de registros - Esquerda */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Mostrando <span className="font-semibold text-gray-900 dark:text-gray-100">{dadosRemessa.length}</span> de{' '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{totalRegistrosRemessa.toLocaleString('pt-BR')}</span> registros
                    </div>

                    {/* Controles de navegação - Direita */}
                    <div className="flex items-center gap-4">
                      {/* Indicador de página */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          Página
                        </span>
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
                          de <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPaginasRemessa.toLocaleString('pt-BR')}</span>
                        </span>
                      </div>

                      {/* Botões de navegação */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPaginaAtualRemessa(1)}
                          disabled={paginaAtualRemessa === 1 || loadingConsulta}
                          className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-gray-900"
                          title="Primeira página"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPaginaAtualRemessa(prev => prev - 1)}
                          disabled={paginaAtualRemessa === 1 || loadingConsulta}
                          className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-gray-900"
                          title="Página anterior"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPaginaAtualRemessa(prev => prev + 1)}
                          disabled={paginaAtualRemessa === totalPaginasRemessa || loadingConsulta}
                          className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-gray-900"
                          title="Próxima página"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setPaginaAtualRemessa(totalPaginasRemessa)}
                          disabled={paginaAtualRemessa === totalPaginasRemessa || loadingConsulta}
                          className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white dark:bg-gray-900"
                          title="Última página"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!consultaRealizada && (
              <div className="text-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  <Search size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Selecione o período e clique em "Consultar Dados" para visualizar os registros que serão incluídos na remessa.</p>
                </div>
              </div>
            )}
              </div>
            )}
          </div>
        )}

        {/* Tela de Importação DDA */}
        {telaRenderizada === 'importacao' && (
          <div>
            {/* Botão voltar */}
            <div className="mb-6">
              <button
                onClick={voltarParaSelecao}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <ChevronLeft size={20} className="mr-1" />
                Voltar para seleção
              </button>
            </div>

            <div className="space-y-6 pb-6">
              {/* Header com informações */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-600 rounded-lg">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                      Processar Arquivo de Retorno Bancário
                    </h2>
                    <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                      Importe o arquivo de retorno CNAB 400 do banco para processar os títulos. 
                      O sistema irá classificar automaticamente entre:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <div className="flex items-center gap-2 bg-white dark:bg-blue-900/30 rounded-lg p-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-green-900 dark:text-green-100 text-sm">Baixa Automática</div>
                          <div className="text-xs text-green-700 dark:text-green-300">Liquidação normal sem divergências</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white dark:bg-blue-900/30 rounded-lg p-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-orange-900 dark:text-orange-100 text-sm">Análise Manual</div>
                          <div className="text-xs text-orange-700 dark:text-orange-300">Divergências de valor, juros ou descontos</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload de arquivo */}
              <div className="bg-white dark:bg-zinc-800 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-gray-100 dark:bg-zinc-700 rounded-full">
                    <FileText className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">
                        Selecione o arquivo de retorno
                      </span>
                      <input
                        type="file"
                        accept=".txt,.ret"
                        onChange={(e) => setArquivoDDA(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Arquivos aceitos: .txt, .ret (CNAB 400)
                    </p>
                  </div>
                  {arquivoDDA && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {arquivoDDA.name}
                      </span>
                      <button
                        onClick={() => setArquivoDDA(null)}
                        className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleProcessarArquivoDDA}
                    disabled={loadingProcessamento || !arquivoDDA}
                    className={`px-6 py-3 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${
                      loadingProcessamento || !arquivoDDA
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                    }`}
                  >
                    {loadingProcessamento ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processando arquivo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Processar Arquivo
                      </>
                    )}
                  </button>
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 dark:text-red-100">Erro ao processar arquivo</h3>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">{erro}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado do processamento */}
              {dadosDDA && (
                <div className="space-y-6">
                  {/* Resumo do Arquivo */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {dadosDDA.banco}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{dadosDDA.nomeArquivo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {dadosDDA.totalRegistros}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">títulos processados</div>
                      </div>
                    </div>

                    {/* Cards de estatísticas por tipo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white dark:bg-zinc-800 border-2 border-green-200 dark:border-green-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-semibold text-green-900 dark:text-green-100">Liquidados</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {dadosDDA.estatisticas?.liquidados || 0}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDown className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Baixados</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {dadosDDA.estatisticas?.baixados || 0}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 border-2 border-red-200 dark:border-red-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="text-sm font-semibold text-red-900 dark:text-red-100">Rejeitados</span>
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                          {dadosDDA.estatisticas?.rejeitados || 0}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-gray-600" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Outros</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-600">
                          {dadosDDA.estatisticas?.outros || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ETAPA 1: Baixa Automática */}
                  {dadosDDA.titulosAutomaticos && dadosDDA.titulosAutomaticos.length > 0 && (
                    <div className="bg-white dark:bg-zinc-800 border-2 border-green-200 dark:border-green-700 rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 px-6 py-4 border-b-2 border-green-200 dark:border-green-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full font-bold">
                              1
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5" />
                                Baixa Automática
                              </h3>
                              <p className="text-sm text-green-700 dark:text-green-300">
                                {dadosDDA.titulosAutomaticos.length} título(s) podem ser baixados automaticamente
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleProcessarBaixaAutomatica}
                            disabled={loadingBaixa || (resultadoBaixa && resultadoBaixa.resumo.processadosComSucesso > 0)}
                            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${
                              loadingBaixa || (resultadoBaixa && resultadoBaixa.resumo.processadosComSucesso > 0)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
                            }`}
                          >
                            {loadingBaixa ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Processando...
                              </>
                            ) : (resultadoBaixa && resultadoBaixa.resumo.processadosComSucesso > 0) ? (
                              <>
                                <CheckCircle2 className="h-5 w-5" />
                                Processado
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-5 w-5" />
                                Processar Automaticamente
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Tabela de títulos */}
                      <div className="max-h-80 overflow-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-zinc-900 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Nosso Número
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Documento
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Cliente
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Valor Pago
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Data Ocorrência
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Ocorrência (Código + Descrição)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                            {dadosDDA.titulosAutomaticos.map((titulo: any, idx: number) => (
                              <tr key={idx} className="hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                                <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900 dark:text-white">
                                  {titulo.nossoNumero}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                                  {titulo.numeroDocumento}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                                  {titulo.nomeSacado}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                                  R$ {titulo.valorPago.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                                  {titulo.dataOcorrencia}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md">
                                    <span className="font-mono font-semibold text-xs">{titulo.codigoOcorrencia || titulo.ocorrencia?.split(' ')[0]}</span>
                                    <span className="text-green-400">•</span>
                                    <span className="font-medium text-xs">{titulo.ocorrencia}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Resultado da Baixa Automática */}
                  {resultadoBaixa && (
                    <div className="bg-white dark:bg-zinc-800 border-2 border-blue-200 dark:border-blue-700 rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 px-6 py-4 border-b-2 border-blue-200 dark:border-blue-700">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                            ✓
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                              Resultado do Processamento Automático
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Processamento concluído - veja o resumo abaixo
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        {/* Cards de resumo */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                            <div className="flex items-center gap-3 mb-2">
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                              <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                                Sucesso
                              </span>
                            </div>
                            <div className="text-3xl font-bold text-green-600">
                              {resultadoBaixa.resumo.processadosComSucesso}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 p-4 rounded-lg border-2 border-red-300 dark:border-red-700">
                            <div className="flex items-center gap-3 mb-2">
                              <XCircle className="h-6 w-6 text-red-600" />
                              <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                                Erros
                              </span>
                            </div>
                            <div className="text-3xl font-bold text-red-600">
                              {resultadoBaixa.resumo.erros}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20 p-4 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                            <div className="flex items-center gap-3 mb-2">
                              <AlertTriangle className="h-6 w-6 text-yellow-600" />
                              <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                                Não Encontrados
                              </span>
                            </div>
                            <div className="text-3xl font-bold text-yellow-600">
                              {resultadoBaixa.resumo.naoEncontrados}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                            <div className="flex items-center gap-3 mb-2">
                              <FileText className="h-6 w-6 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                Total
                              </span>
                            </div>
                            <div className="text-3xl font-bold text-blue-600">
                              {resultadoBaixa.resumo.totalTitulos}
                            </div>
                          </div>
                        </div>

                        {/* Detalhes - Títulos processados com sucesso */}
                        {resultadoBaixa.detalhes.sucesso.length > 0 && (
                          <details className="group mb-4" open>
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors">
                                <ChevronRight className="h-5 w-5 text-green-600 group-open:rotate-90 transition-transform" />
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-semibold text-green-800 dark:text-green-200">
                                  Ver títulos processados com sucesso ({resultadoBaixa.detalhes.sucesso.length})
                                </span>
                              </div>
                            </summary>
                            <div className="mt-3 bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-700 rounded-lg overflow-hidden">
                              <div className="max-h-64 overflow-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-green-50 dark:bg-green-900/20 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-green-900 dark:text-green-100">Cód. Pgto</th>
                                      <th className="px-3 py-2 text-left font-semibold text-green-900 dark:text-green-100">Nº Dup</th>
                                      <th className="px-3 py-2 text-left font-semibold text-green-900 dark:text-green-100">Nosso Nº</th>
                                      <th className="px-3 py-2 text-right font-semibold text-green-900 dark:text-green-100">Valor Pago</th>
                                      <th className="px-3 py-2 text-right font-semibold text-green-900 dark:text-green-100">Total Pago</th>
                                      <th className="px-3 py-2 text-left font-semibold text-green-900 dark:text-green-100">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                                    {resultadoBaixa.detalhes.sucesso.map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-green-50/50 dark:hover:bg-green-900/10">
                                        <td className="px-3 py-2 text-gray-900 dark:text-white font-mono">{item.codPgto}</td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">{item.nroDup}</td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">{item.nossoNumero}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-green-600">
                                          R$ {item.valorPago.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                          R$ {item.totalPago.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                            item.statusFinal === 'Pago' 
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                          }`}>
                                            {item.statusFinal}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        )}

                        {/* Detalhes - Títulos não encontrados */}
                        {resultadoBaixa.detalhes.naoEncontrados.length > 0 && (
                          <details className="group mb-4">
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors">
                                <ChevronRight className="h-5 w-5 text-yellow-600 group-open:rotate-90 transition-transform" />
                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                                  Ver títulos não encontrados ({resultadoBaixa.detalhes.naoEncontrados.length})
                                </span>
                              </div>
                            </summary>
                            <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                              <ul className="space-y-2">
                                {resultadoBaixa.detalhes.naoEncontrados.map((item: any, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-yellow-800 dark:text-yellow-300">
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <div>
                                      <span className="font-mono font-semibold">{item.nossoNumero}</span>
                                      <span className="mx-2">•</span>
                                      <span className="font-mono">{item.numeroDocumento}</span>
                                      <span className="mx-2">•</span>
                                      <span className="font-semibold">R$ {item.valorPago.toFixed(2)}</span>
                                      <span className="mx-2">-</span>
                                      <span className="text-yellow-700 dark:text-yellow-400">{item.motivo}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        )}

                        {/* Detalhes - Erros */}
                        {resultadoBaixa.detalhes.erros.length > 0 && (
                          <details className="group">
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                                <ChevronRight className="h-5 w-5 text-red-600 group-open:rotate-90 transition-transform" />
                                <XCircle className="h-5 w-5 text-red-600" />
                                <span className="text-sm font-semibold text-red-800 dark:text-red-200">
                                  Ver erros de processamento ({resultadoBaixa.detalhes.erros.length})
                                </span>
                              </div>
                            </summary>
                            <div className="mt-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                              <ul className="space-y-2">
                                {resultadoBaixa.detalhes.erros.map((item: any, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                    <div>
                                      {item.codPgto && (
                                        <>
                                          <span className="font-mono font-semibold">Cód {item.codPgto}</span>
                                          <span className="mx-2">-</span>
                                        </>
                                      )}
                                      <span className="font-mono font-semibold">{item.nossoNumero}</span>
                                      <span className="mx-2">•</span>
                                      <span className="text-red-700 dark:text-red-400">{item.motivo}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ETAPA 2: Processamento Manual */}
                  {dadosDDA.titulosManuais && dadosDDA.titulosManuais.length > 0 && (
                    <div className="bg-white dark:bg-zinc-800 border-2 border-orange-200 dark:border-orange-700 rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 px-6 py-4 border-b-2 border-orange-200 dark:border-orange-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full font-bold">
                              2
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Processamento Manual Necessário
                              </h3>
                              <p className="text-sm text-orange-700 dark:text-orange-300">
                                {dadosDDA.titulosManuais.length} título(s) requerem análise individual devido a divergências
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={exportarTitulosManuais}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-lg"
                          >
                            <Download className="h-4 w-4" />
                            Exportar Lista
                          </button>
                        </div>
                      </div>

                      {/* Tabela de títulos */}
                      <div className="max-h-[500px] overflow-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-zinc-900 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Nosso Número
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Cliente
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Valores
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Datas
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Ocorrência
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-zinc-700">
                                Motivo
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                            {dadosDDA.titulosManuais.map((titulo: any, idx: number) => {
                              const diferenca = titulo.valorPago - titulo.valorTitulo;
                              
                              return (
                                <tr key={idx} className="hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors">
                                  <td className="px-4 py-3 text-sm">
                                    <div className="space-y-1">
                                      <div className="font-mono font-semibold text-gray-900 dark:text-white">
                                        {titulo.nossoNumero}
                                      </div>
                                      <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                        {titulo.numeroDocumento}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="max-w-xs truncate text-gray-700 dark:text-gray-300">
                                      {titulo.nomeSacado}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="space-y-1 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Título:</span>
                                        <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                          R$ {titulo.valorTitulo.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Pago:</span>
                                        <span className={`font-mono font-bold ${
                                          Math.abs(diferenca) > 0.01 
                                            ? diferenca > 0 
                                              ? 'text-orange-600 dark:text-orange-400' 
                                              : 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                        }`}>
                                          R$ {titulo.valorPago.toFixed(2)}
                                        </span>
                                      </div>
                                      {titulo.jurosMulta > 0 && (
                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-200 dark:border-zinc-700">
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Juros:</span>
                                          <span className="font-mono text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                            +R$ {titulo.jurosMulta.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                      {titulo.desconto > 0 && (
                                        <div className="flex items-center justify-end gap-2">
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Desconto:</span>
                                          <span className="font-mono text-xs text-green-600 dark:text-green-400 font-semibold">
                                            -R$ {titulo.desconto.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                      {Math.abs(diferenca) > 0.01 && (
                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-200 dark:border-zinc-700">
                                          <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                            {diferenca > 0 ? 'Excedente:' : 'Faltando:'}
                                          </span>
                                          <span className={`font-mono font-bold ${
                                            diferenca > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
                                          }`}>
                                            {diferenca > 0 ? '+' : ''}R$ {diferenca.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Venc:</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                                          {titulo.dataVencimento}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Ocorr:</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                                          {titulo.dataOcorrencia}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md">
                                      <span className="font-mono font-semibold text-xs">{titulo.codigoOcorrencia}</span>
                                      <span className="text-blue-400">•</span>
                                      <span className="font-medium text-xs">{titulo.ocorrencia}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="inline-flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md max-w-xs">
                                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs text-red-800 dark:text-red-200 font-semibold leading-tight">
                                          {titulo.motivo}
                                        </p>
                                        {titulo.motivoOcorrencia && titulo.motivoOcorrencia.trim() !== '' && (
                                          <p className="text-[10px] text-red-700 dark:text-red-300 mt-1 leading-tight">
                                            {titulo.motivoOcorrencia}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer com instruções */}
                      <div className="bg-orange-50/50 dark:bg-orange-900/10 px-6 py-4 border-t-2 border-orange-200 dark:border-orange-700">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-600 rounded-lg flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 text-sm text-orange-800 dark:text-orange-300">
                            <p className="font-bold mb-2 text-orange-900 dark:text-orange-200">
                              📋 Instruções para Processamento Manual:
                            </p>
                            <ul className="space-y-1.5 text-xs">
                              <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold mt-0.5">•</span>
                                <span><strong>Valor maior:</strong> Pode conter juros, multas ou correções - verifique os valores adicionais</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold mt-0.5">•</span>
                                <span><strong>Valor menor:</strong> Pagamento parcial - requer aprovação ou negociação com o cliente</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold mt-0.5">•</span>
                                <span><strong>Divergências:</strong> Analise o código de ocorrência e o motivo detalhado antes de processar</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold mt-0.5">•</span>
                                <span><strong>Dúvidas:</strong> Entre em contato com o cliente para esclarecimentos antes de baixar o título</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
