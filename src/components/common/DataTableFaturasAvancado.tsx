// Handler para emissão de nota fiscal

import React, { useEffect, useMemo, useState } from 'react';
import DataTable from '@/components/common/DataTableFiltroFatura';
import { Meta } from '@/data/common/meta';
import axios from 'axios';
import { toast } from 'sonner';
import DropdownFatura from './DropdownFatura';
import { Loader2, CheckCircle2, Download, X } from 'lucide-react';
import ModalFormulario from '@/components/common/modalform';
import FormInput from '@/components/common/FormInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import DadosCobranca from './DadosCobranca';
import EspelhoFaturaModal from '../corpo/faturamento/ModalEspelhoFatura';
import ModalExportarFaturas from '../corpo/faturamento/ConsultaFatura/modalexportFatura/modalExportaExcelPdfFatura';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { set } from 'zod';
import AutocompletePessoa from './AutoCompletePessoa';
import NotaFiscalPreviewModal from '../corpo/faturamento/NotaFiscalPreviewModal';
import { time } from 'console';
import ModalBoletos from './ModalBoletos';
interface Props {
  faturas: any[];
  meta: Meta;
  carregando: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onFiltroChange: (
    filtros: { campo: string; tipo: string; valor: string }[],
  ) => void;
  termoBusca: string;
  setTermoBusca: (valor: string) => void;
  colunasFiltro: string[];
  limiteColunas: number;
  onLimiteColunasChange: (novoLimite: number) => void;
  onAtualizarLista?: () => void;
  onCriarGrupoPagamento?: (faturas: any[]) => void;
}

export default function DataTableFaturasAvancado({
  faturas,
  meta,
  carregando,
  onPageChange,
  onPerPageChange,
  onFiltroChange,
  termoBusca,
  setTermoBusca,
  colunasFiltro,
  limiteColunas,
  onLimiteColunasChange,
  onAtualizarLista,
  onCriarGrupoPagamento,
}: Props) {
  const [faturasDesabilitadas, setFaturasDesabilitadas] = useState<Set<string>>(new Set());
  const [gpSelecionado, setGpSelecionado] = useState<string | null>(null);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<string[]>([]);
  const getVendedorSelecionado = () => {
    if (faturasSelecionadas.length === 0) return null;
    const fatura = faturas.find(f => f.codfat === faturasSelecionadas[0]);
    return fatura ? fatura.codvend : null;
  };
  
  const getClienteSelecionado = () => {
    if (faturasSelecionadas.length === 0) return null;
    const fatura = faturas.find(f => f.codfat === faturasSelecionadas[0]);
    return fatura ? fatura.codcli : null;
  };

  // Função para verificar se uma fatura teve pagamentos
  const verificarFaturaTemPagamentos = async (codfat: string): Promise<boolean> => {
    try {
      const response = await axios.get(`/api/faturamento/verificar-pagamentos`, {
        params: { codfat }
      });
      return response.data.temPagamentos || false;
    } catch (error) {
      console.error('Erro ao verificar pagamentos da fatura:', error);
      // Em caso de erro, assume que pode ter pagamentos para ser conservador
      return true;
    }
  };
  
  const handleCriarGrupoPagamento = async () => {
    if (faturasSelecionadas.length === 0) {
      toast.info('Selecione pelo menos uma fatura para criar um grupo de pagamento.');
      return;
    }

    // Validação adicional: verificar se alguma fatura já possui pagamentos realizados
    const faturasComCobranca = faturas.filter(f =>
      faturasSelecionadas.includes(f.codfat) && f.cobranca === 'S'
    );

    if (faturasComCobranca.length > 0) {
      console.log('🔍 Verificando pagamentos para faturas com cobrança:', faturasComCobranca.map(f => f.codfat));

      // Verificar pagamentos para cada fatura com cobrança
      const faturasComPagamentos = [];
      for (const fatura of faturasComCobranca) {
        const temPagamentos = await verificarFaturaTemPagamentos(fatura.codfat);
        if (temPagamentos) {
          faturasComPagamentos.push(fatura.codfat);
        }
      }

      if (faturasComPagamentos.length > 0) {
        const codigosFaturas = faturasComPagamentos.join(', ');
        toast.error(`As seguintes faturas já possuem pagamentos realizados e não podem ser agrupadas: ${codigosFaturas}`, {
          duration: 5000,
        });
        return;
      }
    }

    // Validação adicional: verificar se todas as faturas são do mesmo cliente
    const clientesSelecionados = faturas
      .filter(f => faturasSelecionadas.includes(f.codfat))
      .map(f => f.codcli);

    const clientesUnicos = Array.from(new Set(clientesSelecionados));
    if (clientesUnicos.length > 1) {
      const nomesClientes = faturas
        .filter(f => faturasSelecionadas.includes(f.codfat))
        .map(f => f.cliente_nome || f.codcli)
        .filter((value, index, self) => self.indexOf(value) === index);

      toast.error(`Só é possível agrupar faturas do mesmo cliente. Clientes selecionados: ${nomesClientes.join(', ')}`, {
        duration: 4000,
      });
      return;
    }
    
    // Se a prop onCriarGrupoPagamento foi passada, usá-la em vez de chamar a API diretamente
    if (onCriarGrupoPagamento) {
      // Obter as faturas selecionadas completas (não apenas os códigos)
      const faturasSelecionadasCompletas = faturas.filter(f =>
        faturasSelecionadas.includes(f.codfat)
      );
      onCriarGrupoPagamento(faturasSelecionadasCompletas);
      return;
    }
    
    // Comportamento original (manter para compatibilidade)
    const codcli = getClienteSelecionado();
    if (!codcli) {
      toast.error('Não foi possível identificar o cliente das faturas selecionadas.');
      return;
    }
    
    try {
      const response = await axios.post('/api/faturamento/grupo-pagamento', {
        codfats: faturasSelecionadas,
        codcli
      });
      
      toast.success(response.data.message);
      onAtualizarLista?.();
      setFaturasSelecionadas([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erro ao criar grupo de pagamento.');
    }
  };
  const headers = useMemo(
    () => [
      'selecionar',
      'ações',
      'status',
      'codfat',
      'nroform',
      'cliente_nome',
      'totalnf',
      'data',
      'codvend',
      'codtransp',
      'codgp',
      'grupo_pagamento',
    ],
    [/* depende de nada */],
  );

  const [produtosRelacionados, setProdutosRelacionados] = useState<any[]>([]);
  const [faturaSelecionada, setFaturaSelecionada] = useState<any | null>(null);
  const [mostrarProdutos, setMostrarProdutos] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [dadosEspelho, setDadosEspelho] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [faturaParaBoletos, setFaturaParaBoletos] = useState<any | null>(null);
  const [dadosPreview, setDadosPreview] = useState<{
    fatura: any;
    produtos: any[];
    venda: any;
  } | null>(null);
  const [emaildanfeModalAberto, setEmaildanfeModalAberto] = useState<
    any | null
  >(null);
  const [cobrancaEnviada, setCobrancaEnviada] = useState<any | null>(null);
  const [cobrancaModalAberto, setCobrancaModalAberto] = useState<any | null>(
    null,
  );
  const [faturaParaEdicao, setFaturaParaEdicao] = useState<any | null>(null);
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);
  const [gruposPagamento, setGruposPagamento] = useState<any[]>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null);
  const [faturasDoGrupo, setFaturasDoGrupo] = useState<any[]>([]);
  const [mostrarDetalhesGrupo, setMostrarDetalhesGrupo] = useState(false);

  // Estado para modal de PDF da nota emitida
  const [pdfEmitido, setPdfEmitido] = useState<{
    pdfBase64: string;
    pdfBlobUrl: string; // Blob URL para renderização no iframe
    chaveAcesso: string;
    protocolo: string;
    tipoDocumento: string;
    codfat: string;
  } | null>(null);

  // Limpar blob URL quando o modal fechar
  const fecharModalPdf = () => {
    if (pdfEmitido?.pdfBlobUrl) {
      URL.revokeObjectURL(pdfEmitido.pdfBlobUrl);
    }
    setPdfEmitido(null);
  };

  // Estados para o componente DadosCobranca
  const [bancos, setBancos] = useState([]);
  const [formCobranca, setFormCobranca] = useState({
    banco: '',
    tipoFatura: '',
    prazoSelecionado: '',
    valorVista: '',
    habilitarValor: false,
    impostoNa1Parcela: false,
    freteNa1Parcela: false,
  });
  const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string }[]>([]);
  const [opcoesTipoFatura] = useState([
    { value: 'BOLETO', label: 'BOLETO' },
    { value: 'BOLETO BANCARIO', label: 'BOLETO BANCÁRIO' },
    { value: 'DM', label: 'DUPLICATA MERCANTIL' },
  ]);

  // Atualizar faturas desabilitadas quando a lista de faturas ou seleção mudar
  useEffect(() => {
    const atualizarFaturasDesabilitadas = async () => {
      const desabilitadas = new Set<string>();
      
      for (const f of faturas) {
        // Desabilitar se cliente for diferente da seleção atual
        if (faturasSelecionadas.length > 0 && 
            getClienteSelecionado() && 
            f.codcli !== getClienteSelecionado()) {
          desabilitadas.add(f.codfat);
        }
        
        // Desabilitar se fatura com cobrança já tiver pagamentos
        if (f.cobranca === 'S') {
          try {
            const response = await axios.get(`/api/faturamento/verificar-pagamentos`, {
              params: { codfat: f.codfat }
            });
            if (response.data.temPagamentos) {
              desabilitadas.add(f.codfat);
            }
          } catch (error) {
            console.error('Erro ao verificar pagamentos:', error);
            // Em caso de erro, desabilitar para ser conservador
            desabilitadas.add(f.codfat);
          }
        }
      }
      
      setFaturasDesabilitadas(desabilitadas);
    };
    
    atualizarFaturasDesabilitadas();
  }, [faturas, faturasSelecionadas]);

  // Função para gerar preview do boleto
  const handleGerarPreviewBoleto = async () => {
    try {
      if (!cobrancaModalAberto?.faturaId) {
        toast.error('Fatura não selecionada.');
        return;
      }

      if (parcelas.length === 0) {
        toast.error('Adicione parcelas para gerar o boleto.');
        return;
      }

      if (!formCobranca.banco || !formCobranca.tipoFatura) {
        toast.error('Selecione o banco e o tipo de fatura para gerar o boleto.');
        return;
      }

      // Buscar dados da fatura e empresa
      const [faturaRes, empresaRes] = await Promise.all([
        fetch(`/api/faturas/${cobrancaModalAberto.faturaId}`),
        fetch('/api/empresa')
      ]);

      if (!faturaRes.ok || !empresaRes.ok) {
        throw new Error('Erro ao buscar dados necessários');
      }

      const faturaData = await faturaRes.json();
      const empresaData = await empresaRes.json();

      // Importar jsPDF dinamicamente
      const jsPDF = (await import('jspdf')).default;
      const JsBarcode = (await import('jsbarcode')).default;

      // Criar PDF para primeira parcela como exemplo
      const doc = new jsPDF();
      
      // Para preview, não mostrar dados sensíveis
      const isPreview = true;
      const primeiraParcela = parcelas[0];
      
      // Configurar dados do boleto (sem informações sensíveis)
      const dadosBoleto = {
        beneficiario: empresaData.nome || '',
        cnpj: empresaData.cnpj || '',
        valor: formCobranca.valorVista || '0',
        vencimento: primeiraParcela.vencimento,
        pagador: faturaData.cliente?.nome || '',
        cpfCnpj: faturaData.cliente?.cpfCnpj || '',
        endereco: faturaData.cliente?.endereco || '',
        numero: faturaData.cliente?.numero || '',
        bairro: faturaData.cliente?.bairro || '',
        cidade: faturaData.cliente?.cidade || '',
        uf: faturaData.cliente?.uf || '',
        cep: faturaData.cliente?.cep || '',
        // Para preview, ocultar dados sensíveis
        nossoNumero: isPreview ? '***PREVIEW***' : '',
        codigoBarras: isPreview ? '' : '',
        linhaDigitavel: isPreview ? '*****.*****.*****.*****.*****.*****.*.****************' : ''
      };

      // Header
      doc.setFontSize(16);
      doc.text('BOLETO BANCÁRIO', 105, 20, { align: 'center' });
      
      if (isPreview) {
        doc.setFontSize(12);
        doc.setTextColor(255, 0, 0);
        doc.text('*** PREVIEW - DADOS SENSÍVEIS OCULTOS ***', 105, 30, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      // Dados do beneficiário
      doc.setFontSize(10);
      doc.text('Beneficiário:', 20, 50);
      doc.text(dadosBoleto.beneficiario, 20, 55);
      doc.text(`CNPJ: ${dadosBoleto.cnpj}`, 20, 60);

      // Dados do pagador
      doc.text('Pagador:', 20, 80);
      doc.text(dadosBoleto.pagador, 20, 85);
      doc.text(`CPF/CNPJ: ${dadosBoleto.cpfCnpj}`, 20, 90);
      doc.text(`${dadosBoleto.endereco}, ${dadosBoleto.numero}`, 20, 95);
      doc.text(`${dadosBoleto.bairro} - ${dadosBoleto.cidade}/${dadosBoleto.uf}`, 20, 100);
      doc.text(`CEP: ${dadosBoleto.cep}`, 20, 105);

      // Informações do boleto
      doc.text('Valor:', 120, 80);
      doc.text(`R$ ${Number(dadosBoleto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, 85);
      doc.text('Vencimento:', 120, 95);
      doc.text(new Date(dadosBoleto.vencimento).toLocaleDateString('pt-BR'), 120, 100);
      doc.text('Nosso Número:', 120, 110);
      doc.text(dadosBoleto.nossoNumero, 120, 115);

      // Linha digitável
      doc.text('Linha Digitável:', 20, 130);
      doc.text(dadosBoleto.linhaDigitavel, 20, 135);

      // Indicação de código de barras oculto
      doc.text('*** CÓDIGO DE BARRAS OCULTO NO PREVIEW ***', 20, 165);

      // Gerar e mostrar PDF
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      toast.success('Preview do boleto gerado com sucesso.');

    } catch (error) {
      console.error('Erro ao gerar preview do boleto:', error);
      toast.error('Erro ao gerar preview do boleto.');
    }
  };

  // const abrirModalEspelho = async (fatura: any) => {
  //   try {
  //     const { data } = await axios.get('/api/faturamento/espelho-fatura', {
  //       params: { codfat: fatura.codfat },
  //     });
  //     setDadosEspelho(data);
  //   } catch (error: any) {
  //     toast.error(error?.response?.data?.error || 'Erro ao buscar espelho.');
  //   }
  // };

  const abrirModalPreview = async (fatura: any) => {
    try {
      // Buscar dados reais da fatura diretamente
      console.log('🔍 Abrindo preview para fatura:', fatura.codfat);
      
      // Definir dados básicos da fatura para o preview
      const faturaData = {
        ...fatura,
        codfat: fatura.codfat,
        nroform: fatura.nroform || fatura.codfat,
        // Garantir que temos os campos necessários
      };
      
      setDadosPreview({ 
        fatura: faturaData,
        produtos: [], // Será carregado dentro do modal
        venda: {} // Será carregado dentro do modal
      });
      
      setIsPreviewOpen(true); // Abre o modal
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || 'Erro ao abrir preview.',
      );
    }
  };

  // Buscar PDF da nota já emitida (autorizada)
  const buscarPdfNotaEmitida = async (fatura: any) => {
    const toastId = toast.loading('Carregando PDF da nota fiscal...');
    try {
      const { data } = await axios.get('/api/faturamento/pdf-nota', {
        params: { codfat: fatura.codfat },
      });
      
      if (data.pdfBase64) {
        // Converter base64 para Blob URL (funciona melhor para PDFs grandes)
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        toast.dismiss(toastId);
        setPdfEmitido({
          pdfBase64: data.pdfBase64,
          pdfBlobUrl: blobUrl,
          chaveAcesso: data.chaveAcesso || '',
          protocolo: data.protocolo || '',
          tipoDocumento: data.tipoDocumento || 'NF-e',
          codfat: fatura.codfat,
        });
      } else {
        toast.error('PDF da nota não encontrado.', { id: toastId });
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || 'Erro ao buscar PDF da nota.',
        { id: toastId }
      );
    }
  };

  // Função que decide se abre preview ou PDF da nota emitida
  const handleVisualizarNota = async (fatura: any) => {
    // Se a nota foi autorizada (status 100), buscar o PDF da nota emitida
    if (fatura.nfe_status === '100') {
      await buscarPdfNotaEmitida(fatura);
    } else {
      // Caso contrário, mostrar preview
      await abrirModalPreview(fatura);
    }
  };

  const handleVisualizarBoletos = (fatura: any) => {
    setFaturaParaBoletos(fatura);
  };

  const handleEmitirNota = async (fatura: any) => {
    const toastId = toast.loading('Emitindo nota fiscal...');
    try {
      const { data } = await axios.post('/api/faturamento/emitir-faturado', {
        codfat: fatura.codfat,
      });
      
      if (data.sucesso && data.pdfBase64) {
        toast.success(`${data.tipoDocumento || 'Nota'} emitida com sucesso!`, { id: toastId });
        
        // Converter base64 para Blob URL
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Abrir modal com o PDF
        setPdfEmitido({
          pdfBase64: data.pdfBase64,
          pdfBlobUrl: blobUrl,
          chaveAcesso: data.chaveAcesso,
          protocolo: data.protocolo,
          tipoDocumento: data.tipoDocumento || 'NF-e',
          codfat: fatura.codfat,
        });
        
        onAtualizarLista?.();
      } else {
        toast.success('Nota fiscal emitida com sucesso!', { id: toastId });
        onAtualizarLista?.();
      }
    } catch (err: any) {
      let msg = 'Erro ao emitir nota fiscal.';
      if (err?.response?.data) {
        msg =
          err.response.data.detalhe ||
          err.response.data.erro ||
          err.response.data.motivo ||
          msg;
      }
      toast.error(msg, { id: toastId });
    }
  };
  const handleLinhaClick = async (fatura: any) => {
    console.log('🧪 Buscando produtos da fatura:', fatura.codfat);
    try {
      const { data } = await axios.get('/api/faturamento/produtos-fatura', {
        params: { codfat: fatura.codfat },
      });
      setFaturaSelecionada({ ...fatura, ...data.fatura });
      setProdutosRelacionados(data.produtos);
      setMostrarProdutos(true);
    } catch (err) {
      toast.error('Erro ao buscar produtos da fatura.');
    }
  };

  const handleCancelarCobranca = async (fatura: any) => {
    if (
      !window.confirm(
        `Deseja realmente cancelar a cobrança da fatura ${fatura.codfat}?`,
      )
    )
      return;

    try {
      await axios.post('/api/faturamento/cancelar-cobranca', {
        codfat: fatura.codfat,
      });
      toast.success('Cobrança cancelada com sucesso.');
      onAtualizarLista?.();
    } catch (err) {
      toast.error('Erro ao cancelar cobrança.');
      console.error(err);
    }
  };

  const handleUpdateFatura = async (dadosAtualizados: any) => {
    try {
      const { cliente_nome, ...dados } = dadosAtualizados;
      await axios.put(`/api/faturamento/${dados.codfat}`, dados);
      setFaturaParaEdicao(null);
      toast.success('Fatura atualizada com sucesso!');
      onAtualizarLista?.();
    } catch (error) {
      console.error('Erro ao atualizar fatura:', error);
      toast.error('Erro ao atualizar fatura!');
    }
  };

  // Estado para modal de cancelamento
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [faturaParaCancelar, setFaturaParaCancelar] = useState<any | null>(
    null,
  );
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const handleAbrirModalCancelar = (fatura: any) => {
    setFaturaParaCancelar(fatura);
    setMotivoCancelamento('');
    setModalCancelarAberto(true);
  };

const handleCancelarNota = async () => {
  // Validações iniciais
  if (!faturaParaCancelar) return;

  if (motivoCancelamento.trim().length < 15) {
    toast.error('O motivo do cancelamento deve ter no mínimo 15 caracteres.');
    return;
  }
  
  // 1. Ativa o estado de loading
  setIsCanceling(true);

  try {
    // 2. Faz a chamada à API
    await axios.post('/api/faturamento/cancelar-nfe', {
      codfat: faturaParaCancelar.codfat,
      motivo: motivoCancelamento,
    });

    // 3. Em caso de sucesso
    toast.success('Nota fiscal cancelada com sucesso!');
    setModalCancelarAberto(false);
    setFaturaParaCancelar(null);
    setMotivoCancelamento('');
    onAtualizarLista?.(); // Atualiza a lista de faturas

  } catch (err: any) {
    // 4. Em caso de erro
    let msg = 'Erro ao cancelar nota fiscal.';
    if (
      err &&
      err.response &&
      (err.response.data?.motivo || err.response.data?.erro)
    ) {
      msg = err.response.data.motivo || err.response.data.erro;
    }
    toast.error(msg);

  } finally {
    // 5. Desativa o estado de loading, independentemente do resultado (sucesso ou erro)
    setIsCanceling(false);
  }
};

  // Carregar grupos de pagamento
  const carregarGruposPagamento = async (codcli: string | null) => {
    if (!codcli) return;
    
    setCarregandoGrupos(true);
    try {
      const response = await axios.get('/api/faturamento/listar-grupos-pagamento', {
        params: { codcli }
      });
      setGruposPagamento(response.data.grupos);
    } catch (error) {
      console.error('Erro ao carregar grupos de pagamento:', error);
      toast.error('Erro ao carregar grupos de pagamento.');
    } finally {
      setCarregandoGrupos(false);
    }
  };

  // Carregar detalhes de um grupo de pagamento
  const carregarDetalhesGrupo = async (codgp: string) => {
    setGrupoSelecionado(codgp);
    try {
      const response = await axios.get('/api/faturamento/detalhes-grupo-pagamento', {
        params: { codgp }
      });
      setFaturasDoGrupo(response.data.faturas);
      setMostrarDetalhesGrupo(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes do grupo:', error);
      toast.error('Erro ao carregar detalhes do grupo.');
    }
  };

  // Fechar detalhes do grupo
  const fecharDetalhesGrupo = () => {
    setMostrarDetalhesGrupo(false);
    setGrupoSelecionado(null);
    setFaturasDoGrupo([]);
  };

  const rows = faturas.map((f) => ({
    selecionar: (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={faturasSelecionadas.includes(f.codfat)}
          // disabled={faturasDesabilitadas.has(f.codfat)}
          onClick={e => e.stopPropagation()} // Evita propagar o clique para a linha
          onChange={async (e) => {
            console.log('🔄 onChange executado - checked:', e.target.checked, 'fatura:', f.codfat, 'cliente:', f.codcli);
            e.stopPropagation(); // Evita propagar o clique para a linha
            if (e.target.checked) {
              console.log('📝 Tentando adicionar fatura:', f.codcli);
              console.log('📋 Faturas já selecionadas:', faturasSelecionadas.length);
              console.log('👤 Cliente selecionado atual:', getClienteSelecionado());
              
              // Validação: só permite selecionar faturas do mesmo cliente
              const clienteAtual = getClienteSelecionado();
              if (faturasSelecionadas.length > 0 && clienteAtual && f.codcli !== clienteAtual) {
                console.log('🚫 Tentou selecionar cliente diferente:', f.codcli, 'vs', clienteAtual);
                console.log('📢 Mostrando toast de erro para cliente diferente');
                const faturaAtual = faturas.find(f => f.codfat === faturasSelecionadas[0]);
                const nomeClienteAtual = faturaAtual?.cliente_nome || clienteAtual;
                const nomeClienteNovo = f.cliente_nome || f.codcli;
                toast.error(`Só é possível selecionar faturas do mesmo cliente. Cliente atual: ${nomeClienteAtual}, Cliente selecionado: ${nomeClienteNovo}`, {
                  duration: 4000,
                });
                return;
              }

              // Validação removida - permite selecionar qualquer fatura
              // A validação de pagamentos será feita apenas no agrupamento
              if (f.cobranca === 'S') {
                console.log('🔍 Verificando pagamentos para fatura:', f.codfat);
                const temPagamentos = await verificarFaturaTemPagamentos(f.codfat);
                if (temPagamentos) {
                  console.log('🚫 Tentou selecionar fatura que já possui pagamentos:', f.codfat);
                  console.log('📢 Mostrando toast de erro para fatura com pagamentos');
                  toast.error(`A fatura ${f.codfat} já possui pagamentos realizados e não pode ser agrupada.`, {
                    duration: 4000,
                  });
                  return;
                }
                console.log('✅ Fatura tem cobrança mas sem pagamentos, pode ser agrupada');
              }
              console.log('✅ Adicionando fatura à seleção');
              setFaturasSelecionadas(prev => [...prev, f.codfat]);
            } else {
              console.log('❌ Removendo fatura da seleção');
              setFaturasSelecionadas(prev => prev.filter(cod => cod !== f.codfat));
            }
          }}
        />
        {f.cobranca === 'S' && (
          <span className="text-xs text-gray-500" title="Esta fatura possui cobrança (verificar pagamentos)">
            
          </span>
        )}
      </div>
    ),
    ações: (
      <DropdownFatura
        fatura={f}
        onEspelhoClick={() => handleVisualizarNota(f)}
        onCobrancaClick={() => {
          if (f.cobranca === 'S') {
            toast.warning('Esta fatura já possui cobrança gerada.');
            return;
          }
          // Limpar formulário antes de abrir
          setFormCobranca({
            banco: '',
            tipoFatura: '',
            prazoSelecionado: '',
            valorVista: '',
            habilitarValor: false,
            impostoNa1Parcela: false,
            freteNa1Parcela: false,
          });
          setParcelas([]);
          setCobrancaModalAberto(f);
        }}
        onEditarClick={() => setFaturaParaEdicao(f)}
        onCancelarCobranca={() => handleCancelarCobranca(f)}
        onEmailDanfeClick={() => setEmaildanfeModalAberto(f)}
        onenviarCobrancaClick={() => setCobrancaEnviada(f)}
        onVisualizarBoletosClick={() => handleVisualizarBoletos(f)}
        onVerProdutosClick={() => handleLinhaClick(f)}
        isSelecionada={faturasSelecionadas.includes(f.codfat)}
        onVisualizarRejeicaoClick={() => {
          const mensagens = [];
          
          // CORREÇÃO: Só mostra mensagem de rejeição se NFe NÃO foi autorizada
          if (f.mensagem_rejeicao && f.nfe_status !== '100') {
            mensagens.push(`Rejeição SEFAZ: ${f.mensagem_rejeicao}`);
          }
          
          if (f.motivocancelamento) {
            mensagens.push(`Motivo do Cancelamento: ${f.motivocancelamento}`);
          }
          
          if (f.nfe_motivo && f.nfe_status !== '100' && !f.motivocancelamento) {
            mensagens.push(`Status NFe: ${f.nfe_motivo}`);
          }
          
          if (mensagens.length > 0) {
            toast.info(
              <div>
                <div className="font-bold">Mensagens da Fatura {f.codfat}:</div>
                {mensagens.map((msg, idx) => (
                  <div key={idx} className="mt-1">{msg}</div>
                ))}
              </div>,
              { duration: 8000 }
            );
          } else {
            toast.warning(
              `Não foi encontrada informação adicional para a fatura ${f.codfat}`
            );
          }
        }}
        onCancelarNotaClick={() => handleAbrirModalCancelar(f)}
        onEmitirNotaClick={() => handleEmitirNota(f)}
      />
    ),
    status: (
      <div className="flex gap-1 items-center">
        {(f.cancel === 'S' || f.nfe_status === 'C') && (
          <span className="w-3 h-3 rounded-full bg-red-600" title={
            f.nfe_status === 'C' && f.motivocancelamento 
              ? `NFe Cancelada: ${f.motivocancelamento}` 
              : "Cancelado"
          } />
        )}
        {/* CORREÇÃO: Só mostra rejeição se NFe NÃO foi autorizada (status diferente de '100') */}
        {f.mensagem_rejeicao && f.nfe_status !== '100' && (
          <span 
            className="w-3 h-3 rounded-full bg-yellow-500" 
            title={`Rejeição SEFAZ: ${f.mensagem_rejeicao}`} 
          />
        )}
        {f.nfe_motivo && !f.mensagem_rejeicao && f.nfe_status !== '100' && (
          <span 
            className="w-3 h-3 rounded-full bg-yellow-500" 
            title={`SEFAZ: ${f.nfe_motivo}`} 
          />
        )}
        {f.denegada === 'S' && (
          <span
            className="w-3 h-3 rounded-full bg-yellow-400"
            title="Denegada"
          />
        )}
        {f.cobranca === 'S' && (
          <span
            className="w-3 h-3 rounded-full bg-green-700"
            title="Com Cobrança"
          />
        )}
        {f.agp === 'S' && (
          <span className="w-3 h-3 rounded-full bg-blue-600" title="Agrupada" />
        )}
        {/* Se nenhum status especial, mostra "sem cobrança" */}
        {f.cancel !== 'S' &&
          f.nfe_status !== 'C' &&
          f.denegada !== 'S' &&
          f.cobranca !== 'S' &&
          f.agp !== 'S' &&
          !(f.mensagem_rejeicao && f.nfe_status !== '100') &&
          !(f.nfe_motivo && f.nfe_status !== '100') && (
            <span
              className="w-3 h-3 rounded-full bg-pink-500"
              title="Sem Cobrança"
            />
          )}
      </div>
    ),
    codfat: f.codfat,
    nroform: f.nroform ?? '-',
    cliente_nome: ` ${f.codcli}-${f.cliente_nome ?? f.dbclien?.nome ?? '-'}`,
    totalnf: `R$ ${Number(f.totalnf || 0).toFixed(2)}`,
    data: new Date(f.data).toLocaleDateString(),
    codvend: `${f.codvend} - ${f.nome_vendedor ?? '—'}`,
    codtransp: `${f.codtransp} - ${f.nome_transportadora ?? '—'}`,
    codgp: f.codgp ?? '-',
    grupo_pagamento: f.grupo_pagamento ? `GP${f.grupo_pagamento.toString().padStart(3, '0')}` : '-',
  }));

  const totalFaturado = faturas.reduce(
    (acc, f) => acc + Number(f.totalnf ?? 0),
    0,
  );

  function exportarParaPDF(faturas: any[], colunas: string[]) {
    const doc = new jsPDF();

    const tableData = faturas.map((f) =>
      colunas.map((col) => {
        if (col === 'totalnf') return `R$ ${Number(f[col] || 0).toFixed(2)}`;
        if (col === 'data') return new Date(f[col]).toLocaleDateString();
        return f[col] ?? '';
      }),
    );

    autoTable(doc, {
      head: [colunas.map((c) => c.toUpperCase())],
      body: tableData,
      styles: { fontSize: 8 },
      theme: 'grid',
    });

    doc.save('faturas.pdf');
  }

  function exportarParaExcel(faturas: any[], colunas: string[]) {
    const dados = faturas.map((f) =>
      colunas.reduce((acc, col) => {
        acc[col] = f[col];
        return acc;
      }, {} as any),
    );

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Faturas');

    XLSX.writeFile(workbook, 'faturas.xlsx');
  }

  return (
    <div className="flex flex-col w-full min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-hidden text-black dark:text-white  ">
        {/* Botão para criar grupo de pagamento */}
        {faturasSelecionadas.length > 0 && (
          <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              {faturasSelecionadas.length} fatura(s) selecionada(s) para agrupamento
            </span>
            <button
              onClick={handleCriarGrupoPagamento}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
             Gerar Cobrança
            </button>
          </div>
        )}
  
        
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          carregando={carregando}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          onSearch={(e) => setTermoBusca(e.target.value)}
          searchInputPlaceholder="Buscar por código, cliente, vendedor..."
          onFiltroChange={onFiltroChange}
          colunasFiltro={colunasFiltro}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={onLimiteColunasChange}
          onabrirExportar={() => setMostrarModalExportar(true)}
        />

        {/* Modal de Cancelamento de Nota Fiscal */}
        <Dialog
  open={modalCancelarAberto}
  onOpenChange={setModalCancelarAberto}
>
  <DialogContent className="max-w-md w-full bg-white dark:bg-zinc-900">
    <DialogHeader>
      <DialogTitle>Cancelar Nota Fiscal</DialogTitle>
      <DialogDescription>
        Informe o motivo do cancelamento da nota fiscal{' '}
        {faturaParaCancelar?.codfat}:
      </DialogDescription>
    </DialogHeader>
    
    {/* Container para o campo de texto e o contador */}
    <div className="w-full">
      <textarea
        className="w-full min-h-[80px] border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800 disabled:opacity-70"
        value={motivoCancelamento}
        onChange={(e) => setMotivoCancelamento(e.target.value)}
        placeholder="Justificativa para o cancelamento..."
        autoFocus
        disabled={isCanceling}
        maxLength={255} // Boa prática definir um limite máximo
      />
      
      {/* Contador de caracteres dinâmico */}
      <p className={`mt-1 text-xs text-right ${
        motivoCancelamento.length < 15 
          ? 'text-red-500 font-semibold' 
          : 'text-green-600'
      }`}>
        {motivoCancelamento.length} / 15 caracteres mínimos
      </p>
    </div>

    <div className="flex justify-end gap-2 mt-4">
      <button
        className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setModalCancelarAberto(false)}
        disabled={isCanceling}
      >
        Fechar
      </button>
      <button
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 flex items-center justify-center min-w-[160px] disabled:cursor-not-allowed disabled:bg-red-800"
        onClick={handleCancelarNota}
        // Desativa o botão se o motivo for inválido OU se já estiver carregando
        disabled={isCanceling || motivoCancelamento.length < 15}
      >
        {isCanceling ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          'Cancelar Nota Fiscal'
        )}
      </button>
    </div>
  </DialogContent>
</Dialog>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:w-full text-black dark:text-white px-2 py-2 border-t border-zinc-600"></div>
        {/* Modal Produtos */}
        <Dialog open={mostrarProdutos} onOpenChange={setMostrarProdutos}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-900 shadow-lg rounded-md ">
            <DialogHeader>
              <DialogTitle>
                Produtos da Fatura {faturaSelecionada?.codfat} —{' '}
                {faturaSelecionada?.cliente}
              </DialogTitle>
              <DialogDescription>
                Lista de produtos associados a esta fatura
              </DialogDescription>
            </DialogHeader>

            {produtosRelacionados.length > 0 ? (
              <div className="mt-4 bg-white dark:bg-zinc-900 p-2 rounded-md">
                <table className="w-full text-sm text-left border border-zinc-300 dark:border-zinc-600">
                  <thead className="bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white">
                    <tr className="odd:bg-white even:bg-gray-50 dark:odd:bg-zinc-800 dark:even:bg-zinc-900 text-gray-800 dark:text-white">
                      <th className="p-2 border text-gray-800 dark:text-white">
                        Código
                      </th>
                      <th className="p-2 border text-gray-800 dark:text-white">
                        Descrição
                      </th>
                      <th className="p-2 border text-gray-800 dark:text-white">
                        Qtd
                      </th>
                      <th className="p-2 border text-gray-800 dark:text-white">
                        Preço
                      </th>
                      <th className="p-2 border text-gray-800 dark:text-white">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosRelacionados.map((p, i) => (
                      <tr
                        key={i}
                        className="odd:bg-white even:bg-gray-50 dark:odd:bg-zinc-800 dark:even:bg-zinc-900 text-gray-800 dark:text-white"
                      >
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {p.codprod}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {p.descricao}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {p.qtd}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          R$ {Number(p.prunit).toFixed(2)}
                        </td>
                        <td className="p-2 border  text-gray-800 dark:text-white ">
                          R$ {Number(p.total_item).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-right font-bold  text-gray-800 dark:text-white">
                  Total: R$ {Number(faturaSelecionada?.totalnf || 0).toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Nenhum produto encontrado.
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Espelho */}
        {/* {dadosEspelho && (
          <EspelhoFaturaModal
            isOpen={!!dadosEspelho}
            onClose={() => setDadosEspelho(null)}
            fatura={dadosEspelho.fatura}
            venda={dadosEspelho.venda}
            vendas_faturadas={dadosEspelho.vendas_faturadas}
            itens_por_venda={dadosEspelho.itens_por_venda}
            produtos={dadosEspelho.produtos}
          />
        )} */}

        {isPreviewOpen && dadosPreview && (
          <NotaFiscalPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => {
              setIsPreviewOpen(false);
              setDadosPreview(null); // Limpa os dados ao fechar
            }}
            fatura={dadosPreview.fatura}
            produtos={dadosPreview.produtos}
            venda={dadosPreview.venda}
          />
        )}

        {/* Modal Edição */}
        {faturaParaEdicao && (
          <ModalFormulario
            titulo={`Editar Fatura ${faturaParaEdicao.codfat} - ${
              faturaParaEdicao.cliente_nome ??
              faturaParaEdicao.dbclien?.nome ??
              'Cliente não informado'
            }`}
            tabs={[]}
            activeTab="dados"
            setActiveTab={() => {}}
            renderTabContent={() => {
              const isCancelada = faturaParaEdicao.cancel === 'S' || faturaParaEdicao.nfe_status === 'C';

              return (
                <div className="grid grid-cols-2 gap-4">
                  <AutocompletePessoa
                    label="Vendedor"
                    value={faturaParaEdicao.codvend ?? ''}
                    onChange={(cod) =>
                      !isCancelada &&
                      setFaturaParaEdicao({ ...faturaParaEdicao, codvend: cod })
                    }
                    tipo="vendedor"
                    disabled={isCancelada}
                  />

                  <AutocompletePessoa
                    label="Transportadora"
                    value={faturaParaEdicao.codtransp ?? ''}
                    onChange={(cod) =>
                      !isCancelada &&
                      setFaturaParaEdicao({
                        ...faturaParaEdicao,
                        codtransp: cod,
                      })
                    }
                    tipo="transportadora"
                    disabled={isCancelada}
                  />

                  <FormInput
                    label="Comissão Externa"
                    name="comdift"
                    value={faturaParaEdicao.comdift ?? ''}
                    type="number"
                    readOnly={isCancelada}
                    onChange={(e) =>
                      !isCancelada &&
                      setFaturaParaEdicao({
                        ...faturaParaEdicao,
                        comdift: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              );
            }}
            handleSubmit={() =>
              faturaParaEdicao.cancel !== 'S' &&
              handleUpdateFatura(faturaParaEdicao)
            }
            handleClear={() => setFaturaParaEdicao(null)}
            onClose={() => setFaturaParaEdicao(null)}
          />
        )}

        {/* Modal Cobrança */}
        {cobrancaModalAberto && (
          <Dialog open={!!cobrancaModalAberto} onOpenChange={() => setCobrancaModalAberto(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Gerar Cobrança - Fatura Nº {cobrancaModalAberto.codfat}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <DadosCobranca
                  statusVenda={{ cobranca: 'S' }}
                  bancos={bancos}
                  formCobranca={formCobranca}
                  setFormCobranca={setFormCobranca}
                  parcelas={parcelas}
                  setParcelas={setParcelas}
                  opcoesTipoFatura={opcoesTipoFatura}
                  onGerarPreviewBoleto={handleGerarPreviewBoleto}
                  padraoAberto={true}
                />
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    onClick={() => setCobrancaModalAberto(null)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Aqui você pode implementar a lógica de salvar a cobrança
                        const dadosCobranca = {
                          codfat: cobrancaModalAberto.codfat,
                          banco: formCobranca.banco,
                          tipoFatura: formCobranca.tipoFatura,
                          parcelas: parcelas,
                          // adicione outros campos necessários
                        };
                        
                        // Chamar API para salvar cobrançad
                        const response = await axios.post('/api/faturamento/salvar-cobranca', dadosCobranca);
                        
                        if (response.status === 200) {
                          toast.success('Cobrança gerada com sucesso!');
                          setCobrancaModalAberto(null);
                          // Limpar formulário
                          setFormCobranca({
                            banco: '',
                            tipoFatura: '',
                            prazoSelecionado: '',
                            valorVista: '',
                            habilitarValor: false,
                            impostoNa1Parcela: false,
                            freteNa1Parcela: false,
                          });
                          setParcelas([]);
                          
                          // Atualizar lista
                          if (onAtualizarLista) onAtualizarLista();
                        }
                      } catch (error: any) {
                        console.error('Erro ao salvar cobrança:', error);
                        toast.error(error.response?.data?.message || 'Erro ao gerar cobrança');
                      }
                    }}
                    className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                    disabled={!formCobranca.banco || !formCobranca.tipoFatura}
                  >
                    Gerar Cobrança
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog
          open={mostrarModalExportar}
          onOpenChange={setMostrarModalExportar}
        >
          <DialogContent className="max-w-2xl w-full bg-white dark:bg-zinc-900">
            <ModalExportarFaturas
              open={mostrarModalExportar}
              onClose={() => setMostrarModalExportar(false)}
              colunas={colunasFiltro}
              colunasVisiveis={headers.filter((h) => h !== 'editar')}
              filtros={[]} // ou filtrosAtivos se quiser aplicar os filtros atuais
              busca={termoBusca}
              faturas={faturas}
            />
          </DialogContent>
        </Dialog>
        {faturaParaBoletos && (
          <ModalBoletos
            isOpen={!!faturaParaBoletos}
            onClose={() => setFaturaParaBoletos(null)}
            fatura={faturaParaBoletos}
          />
        )}
        
        {/* Modal Detalhes do Grupo */}
        <Dialog open={mostrarDetalhesGrupo} onOpenChange={fecharDetalhesGrupo}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>
                Detalhes do Grupo de Pagamento: {grupoSelecionado ? `GP${grupoSelecionado.toString().padStart(3, '0')}` : grupoSelecionado}
              </DialogTitle>
              <DialogDescription>
                Lista de faturas no grupo de pagamento
              </DialogDescription>
            </DialogHeader>
            
            {faturasDoGrupo.length > 0 ? (
              <div className="mt-4 bg-white dark:bg-zinc-900 p-2 rounded-md">
                <table className="w-full text-sm text-left border border-zinc-300 dark:border-zinc-600">
                  <thead className="bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white">
                    <tr>
                      <th className="p-2 border text-gray-800 dark:text-white">Código</th>
                      <th className="p-2 border text-gray-800 dark:text-white">Cliente</th>
                      <th className="p-2 border text-gray-800 dark:text-white">Valor</th>
                      <th className="p-2 border text-gray-800 dark:text-white">Data</th>
                      <th className="p-2 border text-gray-800 dark:text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturasDoGrupo.map((fatura: any) => (
                      <tr
                        key={fatura.codfat}
                        className="odd:bg-white even:bg-gray-50 dark:odd:bg-zinc-800 dark:even:bg-zinc-900 text-gray-800 dark:text-white"
                      >
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {fatura.codfat}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {fatura.cliente_nome ?? fatura.dbclien?.nome ?? '-'}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          R$ {Number(fatura.totalnf || 0).toFixed(2)}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          {new Date(fatura.data).toLocaleDateString()}
                        </td>
                        <td className="p-2 border text-gray-800 dark:text-white">
                          <div className="flex gap-1 items-center">
                            {fatura.cancel === 'S' && (
                              <span className="w-3 h-3 rounded-full bg-red-600" title="Cancelado" />
                            )}
                            {fatura.denegada === 'S' && (
                              <span
                                className="w-3 h-3 rounded-full bg-yellow-400"
                                title="Denegada"
                              />
                            )}
                            {fatura.cobranca === 'S' && (
                              <span
                                className="w-3 h-3 rounded-full bg-green-700"
                                title="Com Cobrança"
                              />
                            )}
                            {fatura.agp === 'S' && (
                              <span className="w-3 h-3 rounded-full bg-blue-600" title="Agrupada" />
                            )}
                            {fatura.cancel !== 'S' &&
                              fatura.denegada !== 'S' &&
                              fatura.cobranca !== 'S' &&
                              fatura.agp !== 'S' && (
                                <span
                                  className="w-3 h-3 rounded-full bg-pink-500"
                                  title="Sem Cobrança"
                                />
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-right font-bold text-gray-800 dark:text-white">
                  Total: R$ {faturasDoGrupo.reduce((acc: number, f: any) => acc + Number(f.totalnf || 0), 0).toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Nenhuma fatura encontrada neste grupo.
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal para exibir PDF da nota emitida */}
        <Dialog open={!!pdfEmitido} onOpenChange={fecharModalPdf}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 bg-white dark:bg-zinc-900 flex flex-col">
            <DialogHeader className="p-4 pb-2 border-b border-gray-200 dark:border-zinc-700 bg-green-50 dark:bg-green-900/20 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {pdfEmitido?.tipoDocumento} Autorizada
              </DialogTitle>
              <DialogDescription>
                <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                  <span><strong>Chave de Acesso:</strong> {pdfEmitido?.chaveAcesso}</span>
                  <span><strong>Protocolo:</strong> {pdfEmitido?.protocolo}</span>
                  <span><strong>Fatura:</strong> {pdfEmitido?.codfat}</span>
                </div>
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 bg-gray-100 dark:bg-zinc-800 p-2 overflow-hidden">
              {pdfEmitido?.pdfBlobUrl ? (
                <iframe
                  src={pdfEmitido.pdfBlobUrl}
                  className="w-full h-full border-0 rounded bg-white"
                  title="PDF da Nota Fiscal"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Carregando PDF...</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
              <button
                onClick={() => {
                  if (pdfEmitido?.pdfBase64) {
                    const link = document.createElement('a');
                    link.href = `data:application/pdf;base64,${pdfEmitido.pdfBase64}`;
                    link.download = `${pdfEmitido.tipoDocumento}_${pdfEmitido.chaveAcesso}.pdf`;
                    link.click();
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar PDF
              </button>
              <button
                onClick={fecharModalPdf}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Fechar
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
