import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Download, Mail, Eye, RefreshCw, X, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import DataTable from '@/components/common/DataTableFiltroFatura';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface NotaFiscal {
  codfat: string;
  nrodoc_fiscal: string;
  chave: string;
  status: string;
  numprotocolo: string;
  motivo: string;
  modelo: string;
  data: string;
  dthrprotocolo: string;
  dthrcancelamento: string | null;
  motivocancelamento: string | null;
  emailenviado: string;
  nroform: string;
  totalnf: number;
  codcli: string;
  cliente_nome: string;
  cliente_cpfcgc: string;
  cliente_email: string;
  tipo_documento: string;
}

export default function HistoricoNFPage() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [meta, setMeta] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const [carregando, setCarregando] = useState(false);
  const [filtrosAtivos, setFiltrosAtivos] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipoDoc, setFiltroTipoDoc] = useState<'todas' | 'nfe' | 'nfce'>('todas');
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'autorizadas' | 'canceladas'>('todas');
  const [pdfModal, setPdfModal] = useState<{
    open: boolean;
    pdfBase64: string;
    chave: string;
    protocolo: string;
    tipo: string;
  } | null>(null);

  const buscarNotas = useCallback(async (
    page = 1,
    perPage = 10,
    filtros: any[] = [],
    tipoDoc = 'todas' as 'todas' | 'nfe' | 'nfce',
    status = 'todas' as 'todas' | 'autorizadas' | 'canceladas'
  ) => {
    try {
      setCarregando(true);

      const filtrosLimpos = [...filtros];

      // Filtro por tipo de documento
      if (tipoDoc === 'nfe') {
        filtrosLimpos.push({ campo: 'modelo', tipo: 'igual', valor: '55' });
      } else if (tipoDoc === 'nfce') {
        filtrosLimpos.push({ campo: 'modelo', tipo: 'igual', valor: '65' });
      }

      // Filtro por status
      if (status === 'autorizadas') {
        filtrosLimpos.push({ campo: 'status', tipo: 'igual', valor: '100' });
      } else if (status === 'canceladas') {
        filtrosLimpos.push({ campo: 'dthrcancelamento', tipo: 'nao_nulo', valor: '' });
      }

      // Busca global
      if (termoBusca?.trim()) {
        filtrosLimpos.push(
          { campo: 'chave', tipo: 'contém', valor: termoBusca.trim() },
          { campo: 'cliente_nome', tipo: 'contém', valor: termoBusca.trim() },
        );
      }

      const { data } = await axios.get('/api/faturamento/listar-historico-nf', {
        params: {
          page,
          perPage,
          filtros: JSON.stringify(filtrosLimpos),
        },
      });

      setNotas(data.notas || []);
      setMeta(data.meta || { currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
    } catch {
      toast.error('Erro ao buscar histórico de notas');
      setNotas([]);
    } finally {
      setCarregando(false);
    }
  }, [termoBusca]);

  useEffect(() => {
    buscarNotas(1, 10, [], 'todas', 'todas');
  }, [buscarNotas]);

  const handleVisualizarPDF = async (nota: NotaFiscal) => {
    const toastId = toast.loading('Carregando PDF...');
    try {
      const { data } = await axios.get('/api/faturamento/pdf-nota', {
        params: { codfat: nota.codfat },
      });

      if (data.pdfBase64) {
        toast.dismiss(toastId);
        setPdfModal({
          open: true,
          pdfBase64: data.pdfBase64,
          chave: nota.chave,
          protocolo: nota.numprotocolo,
          tipo: nota.tipo_documento,
        });
      } else {
        toast.error('PDF não encontrado', { id: toastId });
      }
    } catch {
      toast.error('Erro ao carregar PDF', { id: toastId });
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfModal?.pdfBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfModal.pdfBase64}`;
    link.download = `${pdfModal.tipo}_${pdfModal.chave?.slice(-10) || 'nota'}.pdf`;
    link.click();
  };

  const handleEnviarEmail = async (nota: NotaFiscal) => {
    if (!nota.cliente_email) {
      toast.error('Cliente não possui e-mail cadastrado');
      return;
    }
    const toastId = toast.loading('Enviando e-mail...');
    try {
      const endpoint = nota.modelo === '65' 
        ? '/api/faturamento/enviar-email-nfce'
        : '/api/faturamento/enviar-email-nfe';
      
      await axios.post(endpoint, { 
        codfat: nota.codfat,
        emailCliente: nota.cliente_email,
        nomeCliente: nota.cliente_nome,
      });
      toast.success('E-mail enviado com sucesso!', { id: toastId });
      buscarNotas(meta.currentPage, meta.perPage, filtrosAtivos, filtroTipoDoc, filtroStatus);
    } catch (error: any) {
      const mensagemErro = error?.response?.data?.error || 'Erro ao enviar e-mail';
      toast.error(mensagemErro, { id: toastId });
    }
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  const formatarValor = (valor: number) => {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const getStatusBadge = (nota: NotaFiscal) => {
    if (nota.dthrcancelamento) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          <XCircle size={12} /> Cancelada
        </span>
      );
    }
    if (nota.status === '100') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          <CheckCircle2 size={12} /> Autorizada
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
        <AlertCircle size={12} /> {nota.motivo?.slice(0, 20) || 'Pendente'}
      </span>
    );
  };

  const headers = [
    'ações',
    'tipo',
    'numero',
    'data',
    'cliente',
    'valor',
    'status',
    'chave',
    'protocolo',
    'email',
  ];

  const rows = notas.map((nota) => ({
    ações: (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
            <FileText size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white dark:bg-zinc-800 border rounded-md shadow text-sm">
          <DropdownMenuItem
            onClick={() => handleVisualizarPDF(nota)}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            <Eye size={14} className="text-blue-500" /> Visualizar PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleEnviarEmail(nota)}
            disabled={nota.emailenviado === 'S'}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            <Mail size={14} className="text-green-500" /> Enviar E-mail
            {nota.emailenviado === 'S' && <span className="text-xs text-gray-400">(Enviado)</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    tipo: (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
        nota.modelo === '65' 
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' 
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      }`}>
        {nota.tipo_documento}
      </span>
    ),
    numero: nota.nrodoc_fiscal || '-',
    data: formatarData(nota.data),
    cliente: nota.cliente_nome || '-',
    valor: formatarValor(nota.totalnf),
    status: getStatusBadge(nota),
    chave: (
      <span className="text-xs font-mono truncate max-w-[120px] block" title={nota.chave}>
        {nota.chave ? `...${nota.chave.slice(-12)}` : '-'}
      </span>
    ),
    protocolo: nota.numprotocolo || '-',
    email: (
      <div className="flex flex-col items-start text-xs">
        <span className="truncate max-w-[150px]" title={nota.cliente_email || 'Sem e-mail'}>
          {nota.cliente_email || <span className="text-gray-400">Sem e-mail</span>}
        </span>
        {nota.emailenviado === 'S' && (
          <span className="text-green-500 text-[10px]">✓ Enviado</span>
        )}
      </div>
    ),
  }));

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            Histórico de Notas Fiscais
          </h1>
          <button
            onClick={() => buscarNotas(meta.currentPage, meta.perPage, filtrosAtivos, filtroTipoDoc, filtroStatus)}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-md transition"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-6 mb-4 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
          {/* Tipo de Documento */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Tipo:</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setFiltroTipoDoc('todas');
                  buscarNotas(1, meta.perPage, filtrosAtivos, 'todas', filtroStatus);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroTipoDoc === 'todas'
                    ? 'bg-gray-700 text-white shadow-md'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  setFiltroTipoDoc('nfe');
                  buscarNotas(1, meta.perPage, filtrosAtivos, 'nfe', filtroStatus);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroTipoDoc === 'nfe'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                }`}
              >
                NF-e
              </button>
              <button
                onClick={() => {
                  setFiltroTipoDoc('nfce');
                  buscarNotas(1, meta.perPage, filtrosAtivos, 'nfce', filtroStatus);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroTipoDoc === 'nfce'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                }`}
              >
                NFC-e
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-300 dark:bg-zinc-600 hidden sm:block"></div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Status:</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setFiltroStatus('todas');
                  buscarNotas(1, meta.perPage, filtrosAtivos, filtroTipoDoc, 'todas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroStatus === 'todas'
                    ? 'bg-gray-700 text-white shadow-md'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  setFiltroStatus('autorizadas');
                  buscarNotas(1, meta.perPage, filtrosAtivos, filtroTipoDoc, 'autorizadas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatus === 'autorizadas'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                <CheckCircle2 size={12} /> Autorizadas
              </button>
              <button
                onClick={() => {
                  setFiltroStatus('canceladas');
                  buscarNotas(1, meta.perPage, filtrosAtivos, filtroTipoDoc, 'canceladas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatus === 'canceladas'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                }`}
              >
                <XCircle size={12} /> Canceladas
              </button>
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">Legenda:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">NF-e</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">NFC-e</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Autorizada</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Cancelada</span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          carregando={carregando}
          onPageChange={(page) => buscarNotas(page, meta.perPage, filtrosAtivos, filtroTipoDoc, filtroStatus)}
          onPerPageChange={(perPage) => buscarNotas(1, perPage, filtrosAtivos, filtroTipoDoc, filtroStatus)}
          onSearch={(e) => setTermoBusca(e.target.value)}
          searchInputPlaceholder="Buscar por chave, cliente..."
          onFiltroChange={(filtros) => {
            setFiltrosAtivos(filtros);
            buscarNotas(1, meta.perPage, filtros, filtroTipoDoc, filtroStatus);
          }}
          colunasFiltro={['numero', 'cliente', 'chave', 'protocolo']}
          limiteColunas={10}
          onLimiteColunasChange={() => {}}
        />

        {/* Modal PDF */}
        <Dialog open={!!pdfModal?.open} onOpenChange={() => setPdfModal(null)}>
          <DialogContent className="max-w-[90vw] h-[90vh] p-0 bg-white dark:bg-zinc-900">
            <div className="flex flex-col h-full">
              <DialogHeader className="p-4 border-b bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-green-600" size={24} />
                    <DialogTitle className="text-lg font-semibold">
                      {pdfModal?.tipo} - Visualização
                    </DialogTitle>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                    >
                      <Download size={14} /> Baixar PDF
                    </button>
                    <button
                      onClick={() => setPdfModal(null)}
                      className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <DialogDescription className="text-xs mt-1">
                  Chave: {pdfModal?.chave} | Protocolo: {pdfModal?.protocolo}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 p-2">
                {pdfModal?.pdfBase64 && (
                  <iframe
                    src={`data:application/pdf;base64,${pdfModal.pdfBase64}`}
                    className="w-full h-full rounded-md border"
                    title="PDF Preview"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
