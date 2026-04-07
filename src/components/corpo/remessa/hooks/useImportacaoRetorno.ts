import { useState } from 'react';
import { toast } from 'sonner';
import type { DadosDDA, CedenteInfo } from '../types/remessa.types';

export function useImportacaoRetorno() {
  // Estados de arquivo e dados
  const [arquivoDDA, setArquivoDDA] = useState<File | null>(null);
  const [dadosDDA, setDadosDDA] = useState<DadosDDA | null>(null);
  const [loadingProcessamento, setLoadingProcessamento] = useState(false);
  const [cedentesSelecionados, setCedentesSelecionados] = useState<Set<string>>(new Set());

  // Estados para baixa automática
  const [loadingBaixa, setLoadingBaixa] = useState(false);
  const [resultadoBaixa, setResultadoBaixa] = useState<any>(null);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Processar arquivo de retorno
  const handleProcessarArquivoDDA = async () => {
    if (!arquivoDDA) {
      toast.error('Selecione um arquivo DDA para processar');
      return;
    }

    setLoadingProcessamento(true);
    setDadosDDA(null);

    try {
      const formData = new FormData();
      formData.append('file', arquivoDDA);
      formData.append('usuario', 'SYSTEM');

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

      const dadosProcessados: DadosDDA = {
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
      
      setDadosDDA(dadosProcessados);

      toast.success('Arquivo de retorno processado!', {
        description: `Processados: ${result.data.totalTitulos} títulos. Baixa automática: ${result.data.titulosParaBaixaAutomatica.length}, Manual: ${result.data.titulosParaBaixaManual.length}`
      });

    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao processar', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setLoadingProcessamento(false);
    }
  };

  // Processar baixa automática
  const handleProcessarBaixaAutomatica = async () => {
    if (!dadosDDA) {
      toast.error('Erro', {
        description: 'Nenhum arquivo de retorno processado.'
      });
      return;
    }
    
    if (!dadosDDA.codretorno) {
      toast.error('Erro', {
        description: 'Código do retorno não encontrado.'
      });
      return;
    }

    if (!dadosDDA.titulosAutomaticos || dadosDDA.titulosAutomaticos.length === 0) {
      toast.warning('Atenção', {
        description: 'Não há títulos para baixa automática neste arquivo.'
      });
      return;
    }

    setLoadingBaixa(true);
    setResultadoBaixa(null);

    try {
      const response = await fetch('/api/remessa/retorno/processar-baixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codretorno: dadosDDA.codretorno }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || 'Erro ao processar baixa automática');
      }

      const result = await response.json();
      setResultadoBaixa(result);

      if (result.resumo.processadosComSucesso > 0) {
        toast.success('Baixa automática processada!', {
          description: `${result.resumo.processadosComSucesso} títulos baixados. Erros: ${result.resumo.erros}`
        });
      } else {
        toast.warning('Atenção', {
          description: `Nenhum título foi baixado. Erros: ${result.resumo.erros}`
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

  // Importar títulos (modo DDA antigo)
  const handleImportarTitulos = async () => {
    if (!dadosDDA || cedentesSelecionados.size === 0) {
      toast.error('Selecione pelo menos um cedente para importar');
      return;
    }

    if (!dadosDDA.registros || dadosDDA.registros.length === 0) {
      toast.error('Nenhum registro disponível para importação');
      return;
    }

    try {
      const titulosParaImportar = dadosDDA.registros.filter(registro =>
        cedentesSelecionados.has(registro.cnpj)
      );

      if (titulosParaImportar.length === 0) {
        throw new Error('Nenhum título encontrado para os cedentes selecionados');
      }

      const response = await fetch('/api/remessa/importar-titulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulos: titulosParaImportar,
          codComprador: '1',
          codConta: '1',
          codCentroCusto: '1',
          username: 'SYSTEM_DDA',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar títulos');
      }

      const result = await response.json();

      if (result.data.titulosErro > 0) {
        toast.warning('Importação concluída com erros', {
          description: `Importados: ${result.data.titulosImportados}, Erros: ${result.data.titulosErro}`
        });
      } else {
        toast.success('Importação concluída!', {
          description: `Títulos importados: ${result.data.titulosImportados}`
        });
      }

      limparDados();

    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao importar títulos', {
        description: error.message
      });
    }
  };

  // Exportar títulos manuais para CSV
  const exportarTitulosManuais = () => {
    if (!dadosDDA?.titulosManuais?.length) {
      toast.error('Não há títulos manuais para exportar');
      return;
    }

    try {
      const headers = [
        'Nosso Número', 'Documento', 'Cliente', 'Valor Título', 'Valor Pago',
        'Diferença', 'Juros/Multa', 'Desconto', 'Data Vencimento', 'Data Ocorrência',
        'Código Ocorrência', 'Ocorrência', 'Motivo Processamento Manual', 'Motivo Ocorrência'
      ].join(';');

      const linhas = dadosDDA.titulosManuais.map(titulo => {
        const diferenca = (titulo.valorPago || 0) - (titulo.valorTitulo || 0);
        return [
          titulo.nossoNumero || '',
          titulo.numeroDocumento || '',
          (titulo.nomeSacado || '').replace(/;/g, ','),
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

      const csv = [headers, ...linhas].join('\n');
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

  // Toggle seleção de cedente
  const toggleCedenteSelecao = (cnpj: string) => {
    const novoSelecionados = new Set(cedentesSelecionados);
    if (novoSelecionados.has(cnpj)) {
      novoSelecionados.delete(cnpj);
    } else {
      novoSelecionados.add(cnpj);
    }
    setCedentesSelecionados(novoSelecionados);
  };

  // Limpar dados
  const limparDados = () => {
    setDadosDDA(null);
    setArquivoDDA(null);
    setCedentesSelecionados(new Set());
    setResultadoBaixa(null);
    setPaginaAtual(1);
  };

  return {
    // Estados
    arquivoDDA,
    dadosDDA,
    loadingProcessamento,
    cedentesSelecionados,
    loadingBaixa,
    resultadoBaixa,
    paginaAtual,
    itensPorPagina,

    // Setters
    setArquivoDDA,
    setPaginaAtual,

    // Funções
    handleProcessarArquivoDDA,
    handleProcessarBaixaAutomatica,
    handleImportarTitulos,
    exportarTitulosManuais,
    toggleCedenteSelecao,
    limparDados,
  };
}
