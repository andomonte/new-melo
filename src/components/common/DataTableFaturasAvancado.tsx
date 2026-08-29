// Handler para emissão de nota fiscal

import React, { useEffect, useMemo, useState, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import DataTable from '@/components/common/DataTablePadrao';
import { Meta } from '@/data/common/meta';
import axios from 'axios';
import { toast } from 'sonner';
import DropdownFatura from './DropdownFatura';
import { gerarCartaCorrecaoHtml } from '@/lib/danfe/gerarCartaCorrecaoHtml';
import { gerarTermoBateriasHtml } from '@/lib/danfe/gerarTermoBateriasHtml';
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
import ModalEventosNota from '../corpo/faturamento/ModalEventosNota';
import { time } from 'console';
import ModalBoletos from './ModalBoletos';
import ModalEnviarEmail from '../corpo/faturamento/ConsultaFatura/ModalEnviarEmail';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';

// Formata valor em Real no padrão BR: R$ 3.664,05 (ponto de milhar, vírgula decimal).
const formatarBRL = (v: any) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
  // Navegação por teclado (setas) — repassados ao DataTablePadrao pela página.
  rowClassName?: (row: any, index: number) => string;
  onRowClick?: (row: any) => void;
  onOrderedRowsChange?: (rows: any[]) => void;
  // Dispara a busca (Enter ou ao sair do campo), no padrão de produtos/requisição.
  onBuscar?: () => void;
  // Legenda-filtro renderizada no rodapé (montada pela página, com estado/clique).
  legendaSlot?: React.ReactNode;
  // Toolbar (Tipo + Período) injetada no header do DataTablePadrao + busca compacta.
  headerLeftSlot?: React.ReactNode;
  searchCompacto?: boolean;
  // Filtro por Status NFe (dropdown na coluna "Status NFe" — controlado pela página).
  statusFilterValue?: string;
  onStatusFilterChange?: (value: string) => void;
  statusFilterOptions?: { value: string; label: string }[];
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
  rowClassName,
  onRowClick,
  onOrderedRowsChange,
  onBuscar,
  legendaSlot,
  headerLeftSlot,
  searchCompacto,
  statusFilterValue,
  onStatusFilterChange,
  statusFilterOptions,
}: Props) {
  const [faturasDesabilitadas, setFaturasDesabilitadas] = useState<Set<string>>(new Set());
  const [gpSelecionado, setGpSelecionado] = useState<string | null>(null);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<string[]>([]);
  // Modal de confirmação padrão (substitui window.confirm) — usado no cancelar cobrança.
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();
  // Alerta/erro no MODAL CENTRAL padrão (nunca toast no canto). Aceita o 2º arg do toast
  // (ex.: { id } do loading) só para descartar o toast de loading antes de abrir o modal.
  const avisoErro = (msg: any, opts?: { id?: string; title?: string } | any) => {
    if (opts?.id) toast.dismiss(opts.id);
    pedirConfirmacao(() => {}, {
      somenteOk: true,
      type: 'warning',
      title: opts?.title || 'Atenção',
      message: String(msg ?? 'Ocorreu um erro.'),
    });
  };
  // Usuário logado — para registrar QUEM cancelou a cobrança (histórico dbacao).
  const { user } = useContext(AuthContext) as any;
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
  
  // Validação ANTECIPADA (fiel ao NAVEGA_GP do Delphi, que nem lista GP não-operável):
  // antes de abrir a tela/confirm de qualquer operação de GP, checa VALIDA_COBRANCA_GP e,
  // se bloqueado, mostra o motivo específico (recebido/registrado/vencido) e não prossegue.
  const checarGpOperavel = async (codgp: any): Promise<boolean> => {
    try {
      const { data } = await axios.get(
        `/api/faturamento/validar-gp?codgp=${encodeURIComponent(String(codgp))}`,
      );
      if (!data?.operavel) {
        avisoErro(
          data?.motivo ||
            'Este grupo não pode ser alterado (cobrança recebida/registrada/vencida).',
        );
        return false;
      }
      return true;
    } catch (e: any) {
      avisoErro(e?.response?.data?.erro || 'Erro ao validar o grupo.');
      return false;
    }
  };

  // Desagrupar uma GP (regras do Delphi AGRUPAMENTO.GP_DESAGRUPAR): libera as faturas
  // (codgp=NULL, agp='N'), cancela a cobrança agrupada e remove a fatura-GP sintética.
  const handleDesagrupar = async (codgp: any) => {
    if (!(await checarGpOperavel(codgp))) return;
    pedirConfirmacao(
      async () => {
        const tId = toast.loading('Desagrupando GP...');
        try {
          const { data } = await axios.post('/api/faturamento/desagrupar-grupo', {
            codgp,
            usuario: user?.usuario || user?.codusr || '',
          });
          toast.success(
            `GP ${codgp} desagrupada — ${data.faturasDesagrupadas} fatura(s) liberada(s).`,
            { id: tId },
          );
          setFaturasSelecionadas([]);
          onAtualizarLista?.();
        } catch (err: any) {
          toast.dismiss(tId);
          avisoErro(err?.response?.data?.erro || 'Erro ao desagrupar a GP.');
        }
      },
      {
        title: 'Desagrupar GP',
        message: `Deseja realmente DESAGRUPAR a GP ${codgp}? As faturas serão liberadas e a cobrança agrupada, cancelada.`,
        type: 'warning',
        confirmText: 'Sim, desagrupar',
        cancelText: 'Cancelar',
      },
    );
  };

  // Remover Fatura do GP (fiel ao GP_REMOVER_FATURA): tira as faturas SELECIONADAS do grupo
  // e recalcula a cobrança das restantes. Trava (servidor): precisa sobrar >=2 faturas.
  const handleRemoverFaturaGp = async (codgp: any, codfatsSel: string[]) => {
    if (!(await checarGpOperavel(codgp))) return;
    pedirConfirmacao(
      async () => {
        const tId = toast.loading('Removendo do grupo...');
        try {
          const { data } = await axios.post(
            '/api/faturamento/remover-fatura-grupo',
            { codgp, codfats: codfatsSel, usuario: user?.usuario || '' },
          );
          toast.success(
            `${data.removidas?.length ?? 0} fatura(s) removida(s). Cobrança recalculada (${data.parcelasRecriadas ?? 0} parcela(s)).`,
            { id: tId },
          );
          setFaturasSelecionadas([]);
          onAtualizarLista?.();
        } catch (err: any) {
          toast.dismiss(tId);
          avisoErro(err?.response?.data?.erro || 'Erro ao remover fatura do grupo.');
        }
      },
      {
        type: 'warning',
        title: 'Remover Fatura do Grupo',
        message:
          `Remover ${codfatsSel.length} fatura(s) do grupo GP ${codgp}?\n\n` +
          'As faturas voltam a ser individuais e a cobrança das restantes é recalculada. (Precisa sobrar ao menos 2 no grupo — senão use Desagrupar.)',
        confirmText: 'Sim, remover',
        cancelText: 'Cancelar',
      },
    );
  };

  // Alterar Prazo do GP (fiel ao GP_ALTERAR): reabre o editor de cobrança pré-carregado
  // com a config atual; ao salvar, cancela e recria a cobrança do grupo com os novos prazos.
  const handleAlterarPrazoGp = async (codgp: any) => {
    if (!(await checarGpOperavel(codgp))) return; // valida antes de abrir a tela
    const tId = toast.loading('Carregando cobrança do grupo...');
    try {
      const { data } = await axios.get(
        `/api/faturamento/alterar-prazo-gp?codgp=${encodeURIComponent(String(codgp))}`,
      );
      toast.dismiss(tId);
      const fatura = faturas.find((f) => String(f.codgp) === String(codgp));
      // Popula a lista de bancos exibida (senão o select fica vazio) com o banco do GP.
      const bancoGp =
        bancosTodos.find((b) => String(b.banco) === String(data.banco)) ??
        bancosTodos.find((b) => (b.nome || '').toUpperCase() === 'MELO');
      setBancos(bancoGp ? [bancoGp] : []);
      const tipoMap: Record<string, string> = {
        '1': 'RECIBO',
        '2': 'BOLETO',
        '3': 'PROMISSÓRIA',
        '4': 'CARTEIRA',
        '6': 'CARTÃO',
      };
      const tipoLabel = tipoMap[String(data.tipofat)] || 'CARTEIRA';
      setFormCobranca((prev) => ({
        ...prev,
        banco: bancoGp?.banco ?? String(data.banco || ''),
        tipoFatura: tipoLabel,
      }));
      setParcelas(
        (data.parcelas || []).map((p: any) => ({
          dias: Number(p.dias) || 0, // prazo original vindo do GET (dt_venc − dt_emissao)
          vencimento: p.vencimento,
          valor: Number(p.valor) || 0,
        })),
      );
      setCobrancaModalAberto({
        __alterarGpCodgp: codgp,
        cliente_nome: fatura?.cliente_nome || fatura?.nome,
        codcli: fatura?.codcli,
        nroform: `GP ${codgp}`,
        totalnf: (data.parcelas || []).reduce(
          (s: number, p: any) => s + (Number(p.valor) || 0),
          0,
        ),
      });
    } catch (err: any) {
      toast.dismiss(tId);
      avisoErro(err?.response?.data?.erro || 'Erro ao carregar a cobrança do grupo.');
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
        pedirConfirmacao(() => {}, {
          somenteOk: true,
          type: 'warning',
          title: 'Faturas com pagamentos',
          message: `As seguintes faturas já possuem pagamentos realizados e não podem ser agrupadas: ${codigosFaturas}`,
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

      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Clientes diferentes',
        message: `Só é possível agrupar faturas do mesmo cliente.\nClientes selecionados: ${nomesClientes.join(', ')}`,
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
      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Cliente não identificado',
        message: 'Não foi possível identificar o cliente das faturas selecionadas.',
      });
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
      avisoErro(error?.response?.data?.error || 'Erro ao criar grupo de pagamento.');
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
  // bancosTodos = lista completa (dbbanco_cobranca); bancos = opções exibidas no
  // modal (filtradas para: banco do cliente + MELO).
  const [bancosTodos, setBancosTodos] = useState<{ banco: string; nome: string }[]>([]);
  const [bancos, setBancos] = useState<{ banco: string; nome: string }[]>([]);
  const [formCobranca, setFormCobranca] = useState({
    banco: '',
    tipoFatura: '',
    prazoSelecionado: '',
    valorVista: '',
    habilitarValor: false,
    impostoNa1Parcela: false,
    freteNa1Parcela: false,
  });
  const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string; valor: number }[]>([]);
  const [tiposDocumentoOriginais, setTiposDocumentoOriginais] = useState<
    { codigo: string; descricao: string }[]
  >([]);
  // Opções de "Tipo de Fatura/Documento" na COBRANÇA (posterior/agrupada) — FIEL AO FRONT
  // do Delphi (UnitFrmGerarTitulosPosteriores: RbBanco_FormaFat):
  //   - banco MELO  → só CARTEIRA (padrão), PROMISSÓRIA e RECIBO;
  //   - banco real  → forma travada em BOLETO.
  const opcoesTipoFatura = useMemo(() => {
    if (!formCobranca.banco) return [];
    const bancoSel = bancos.find((b) => b.banco === formCobranca.banco);
    if ((bancoSel?.nome || '').toUpperCase() === 'MELO') {
      return [
        { value: 'CARTEIRA', label: 'CARTEIRA' }, // ItemIndex 0 (default) → forma_fat 4
        { value: 'PROMISSÓRIA', label: 'PROMISSÓRIA' }, // ItemIndex 1 → forma_fat 3
        { value: 'RECIBO', label: 'RECIBO' }, // ItemIndex 2 → forma_fat 1
      ];
    }
    return [{ value: 'BOLETO', label: 'BOLETO' }];
  }, [formCobranca.banco, bancos]);

  // Se o tipo atual sair das opções (ex.: trocou p/ MELO e 'BOLETO' saiu da lista),
  // reajusta para a 1ª opção válida — evita ficar com forma inválida selecionada.
  useEffect(() => {
    if (opcoesTipoFatura.length === 0) return;
    const valido = opcoesTipoFatura.some((o) => o.value === formCobranca.tipoFatura);
    if (!valido) {
      setFormCobranca((prev) => ({ ...prev, tipoFatura: opcoesTipoFatura[0].value }));
    }
  }, [opcoesTipoFatura, formCobranca.tipoFatura]);

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

  // Carrega a lista completa de bancos de cobrança (mesma fonte do faturar).
  useEffect(() => {
    axios
      .get('/api/faturamento/opcoes-cobranca')
      .then((res) => {
        setBancosTodos(res.data?.bancos || []);
        setTiposDocumentoOriginais(res.data?.tiposDocumento || []);
      })
      .catch(() => setBancosTodos([]));
  }, []);

  // Abre o modal de cobrança para a fatura, filtrando os bancos para: o banco
  // do cliente (dbclien.banco) + MELO (carteira própria). Default = banco do
  // cliente quando existir na lista; caso contrário, MELO.
  // Modo "Alterar Cobrança" (cancela títulos atuais e gera novos ao salvar).
  const [alterandoCobranca, setAlterandoCobranca] = useState(false);

  const abrirModalCobranca = async (f: any, alterar: boolean = false) => {
    setAlterandoCobranca(alterar);
    const melo = bancosTodos.find((b) => (b.nome || '').toUpperCase() === 'MELO');
    // Offset -1 do cadastro: dbbanco_cobranca.banco = dbclien.banco + 1 (mesmo do fluxo
    // agrupado). f.cliente_banco vem da dbclien → soma 1 para casar o banco de cobrança.
    const bancoCliente =
      f.cliente_banco != null && String(f.cliente_banco).trim() !== ''
        ? bancosTodos.find(
            (b) => String(b.banco).trim() === String(Number(f.cliente_banco) + 1),
          )
        : undefined;
    const opcoes = [bancoCliente, melo].filter(
      (b, i, arr): b is { banco: string; nome: string } =>
        !!b && arr.findIndex((x) => x && x.banco === b!.banco) === i,
    );
    setBancos(opcoes);
    const bancoDefault = bancoCliente?.banco ?? melo?.banco ?? '';
    setFormCobranca({
      banco: bancoDefault,
      tipoFatura: '',
      prazoSelecionado: '',
      valorVista: '',
      habilitarValor: false,
      impostoNa1Parcela: false,
      freteNa1Parcela: false,
    });
    setParcelas([]);
    // Busca impostos + frete reais da fatura (para os flags "cobrar imposto/frete na 1ª
    // parcela"), igual ao fluxo de cobrança agrupada. Frete tem fallback pro totalfrete
    // da própria linha; impostos = ICMS + IPI do resumo (ZFM normalmente 0).
    let impostos = 0;
    let frete = Number(f.totalfrete) || 0;
    try {
      const { data } = await axios.get(
        `/api/faturamento/dados-fatura-completos?codfat=${f.codfat}`,
      );
      const rf = data?.resumoFinanceiro;
      if (rf) {
        impostos = (Number(rf.totalICMS) || 0) + (Number(rf.totalIPI) || 0);
        frete = Number(rf.frete) || frete;
      }
    } catch {
      /* segue com frete da linha e impostos 0 */
    }
    setCobrancaModalAberto({ ...f, _impostos: impostos, _frete: frete });
  };

  // Alterar Cobrança (fiel ao Delphi + salvaguardas): reabre a tela de cobrança;
  // ao salvar, cancela os títulos atuais e gera os novos.
  const handleAlterarCobranca = async (f: any) => {
    if (f.codgp || f.agp === 'S') {
      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Fatura agrupada',
        message:
          'Esta fatura está em um grupo de pagamento. Desagrupe o grupo antes de alterar a cobrança.',
      });
      return;
    }
    if (f.tem_pagamento === true) {
      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Cobrança paga',
        message: 'Cobrança com parcela paga não pode ser alterada.',
      });
      return;
    }
    // Aviso "só à vista" (fiel ao Delphi VERIFICA_VENDAAVISTA + claspgto): se a fatura é à
    // vista, avisa; ao clicar OK, abre o editor mesmo assim (igual ao Delphi).
    let avista = false;
    try {
      const { data } = await axios.get(
        `/api/faturamento/verifica-avista?codfat=${f.codfat}`,
      );
      avista = !!data?.avista;
    } catch {
      /* sem o dado, segue sem o aviso */
    }
    if (avista) {
      pedirConfirmacao(() => abrirModalCobranca(f, true), {
        somenteOk: true,
        type: 'warning',
        title: 'Fatura à vista',
        message:
          'Esta fatura é à vista — a cobrança deve ser à vista (parcela única).',
      });
      return;
    }
    abrirModalCobranca(f, true);
  };

  // Função para gerar preview do boleto
  const handleGerarPreviewBoleto = async () => {
    try {
      if (!cobrancaModalAberto?.faturaId) {
        avisoErro('Fatura não selecionada.');
        return;
      }

      if (parcelas.length === 0) {
        avisoErro('Adicione parcelas para gerar o boleto.');
        return;
      }

      if (!formCobranca.banco || !formCobranca.tipoFatura) {
        avisoErro('Selecione o banco e o tipo de fatura para gerar o boleto.');
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
      avisoErro('Erro ao gerar preview do boleto.');
    }
  };

  // const abrirModalEspelho = async (fatura: any) => {
  //   try {
  //     const { data } = await axios.get('/api/faturamento/espelho-fatura', {
  //       params: { codfat: fatura.codfat },
  //     });
  //     setDadosEspelho(data);
  //   } catch (error: any) {
  //     avisoErro(error?.response?.data?.error || 'Erro ao buscar espelho.');
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
      avisoErro(
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
        avisoErro('PDF da nota não encontrado.', { id: toastId });
      }
    } catch (error: any) {
      avisoErro(
        error?.response?.data?.error || 'Erro ao buscar PDF da nota.',
        { id: toastId }
      );
    }
  };

  // Função que decide se abre preview ou PDF da nota emitida
  const handleVisualizarNota = async (fatura: any) => {
    // Visualização SEMPRE no layout HTML (renderizado no cliente, sem puppeteer). Para
    // notas autorizadas, o endpoint de dados completos anexa chave/protocolo, e a DANFE
    // sai com código de barras/protocolo. Aposenta o PDF antigo (jsPDF) guardado na
    // emissão — que era o que aparecia "com layout antigo" ao visualizar.
    await abrirModalPreview(fatura);
  };

  const handleVisualizarBoletos = async (fatura: any) => {
    const ehGrupo = fatura?.agp === 'S' && !!fatura?.codgp;
    // Faturas individuais: roteia pela forma (frmfat). GP não usa frmfat do membro —
    // os títulos do grupo (dbreceb.codgp) sempre vão pelo modal, buscando por codgp.
    if (!ehGrupo) {
      const frm = String(fatura?.frmfat ?? '');
      // CARTEIRA (frmfat='4') → "Título em Carteira".
      if (frm === '4') {
        window.open(
          `/api/faturamento/titulo-carteira?cod_fat=${fatura.codfat}`,
          '_blank',
        );
        return;
      }
      // BOLETO (frmfat='2') → boleto bancário (Bradesco/Santander), FEBRABAN.
      if (frm === '2') {
        window.open(
          `/api/faturamento/boleto?cod_fat=${fatura.codfat}`,
          '_blank',
        );
        return;
      }
    }
    // GP ou demais formas → PRÉ-CHECA antes de abrir/rotear: se não houver boletos,
    // apenas avisa (NÃO abre o modal) — abrir e fechar em seguida deixava o <body> com
    // pointer-events:none do Radix e travava a tela até dar refresh.
    const tId = toast.loading('Buscando boletos...');
    try {
      const { data } = await axios.get(
        '/api/faturamento/buscar_boletos_fatura',
        { params: ehGrupo ? { codgp: fatura.codgp } : { codfat: fatura.codfat } },
      );
      if (!data?.boletos?.length) {
        toast.warning('Nenhum boleto encontrado para esta fatura.', { id: tId });
        return;
      }
      // GP: usa os MESMOS renderizadores fiéis do individual, por codgp, conforme a
      // forma/banco do grupo (dbreceb): '4' carteira MELO; '2' + banco real (0=Bradesco,
      // 5=Santander) boleto FEBRABAN. Combo legado inválido (MELO+boleto) cai no fallback.
      if (ehGrupo) {
        const forma = String(data.boletos[0]?.forma_fat ?? '');
        const banco = String(data.boletos[0]?.banco ?? '');
        if (forma === '4') {
          toast.dismiss(tId);
          window.open(`/api/faturamento/titulo-carteira?codgp=${fatura.codgp}`, '_blank');
          return;
        }
        if (forma === '2' && (banco === '0' || banco === '5')) {
          toast.dismiss(tId);
          window.open(`/api/faturamento/boleto?codgp=${fatura.codgp}`, '_blank');
          return;
        }
      }
      // Demais formas (cartão/recibo/promissória) → modal jsPDF (fallback).
      toast.dismiss(tId);
      setFaturaParaBoletos(fatura);
    } catch (e: any) {
      toast.dismiss(tId);
      avisoErro(e?.response?.data?.error || 'Falha ao buscar boletos.');
    }
  };

  // RECIBO (frmfat='1') — comprovante de recebimento à vista. Ação própria,
  // habilitada só para fatura de recibo (regra fiel ao "Imprimir → Recibo" do Delphi).
  const handleRecibo = (fatura: any) => {
    window.open(`/api/faturamento/recibo?cod_fat=${fatura.codfat}`, '_blank');
  };

  // Resumo GP (relatório do grupo, fiel ao Delphi RESUMO_GP) — abre o PDF numa aba.
  const handleResumoGp = async (fatura: any) => {
    if (fatura.agp !== 'S' || !fatura.codgp) {
      avisoErro('Esta fatura não pertence a um grupo de pagamento (GP).');
      return;
    }
    const tId = toast.loading('Gerando Resumo GP...');
    try {
      const { data } = await axios.get(
        `/api/faturamento/resumo-gp-pdf?codgp=${encodeURIComponent(String(fatura.codgp))}`,
      );
      if (!data?.pdf) throw new Error(data?.erro || 'Falha ao gerar o Resumo GP.');
      toast.dismiss(tId);
      const bytes = Uint8Array.from(atob(data.pdf), (ch) => ch.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err: any) {
      avisoErro(err?.response?.data?.erro || err?.message || 'Erro ao gerar o Resumo GP.', {
        id: tId,
      });
    }
  };

  const handleEmitirNota = async (fatura: any) => {
    const toastId = toast.loading('Emitindo nota fiscal...');
    try {
      const { data } = await axios.post('/api/faturamento/emitir-faturado', {
        codfat: fatura.codfat,
      });

      // SEFAZ fora do ar → confirma no modal central e re-emite em contingência.
      if (data?.contingenciaDisponivel) {
        toast.dismiss(toastId);
        const confirmou = await new Promise<boolean>((resolve) => {
          pedirConfirmacao(() => resolve(true), {
            title: 'SEFAZ indisponível',
            message: data.mensagem || 'SEFAZ indisponível. Emitir esta nota em CONTINGÊNCIA (offline)?',
            type: 'warning',
            confirmText: 'Emitir em contingência',
            cancelText: 'Cancelar',
            onCancel: () => resolve(false),
          });
        });
        if (!confirmou) return;
        const tId2 = toast.loading('Emitindo em contingência...');
        const { data: dataC } = await axios.post('/api/faturamento/emitir-faturado', {
          codfat: fatura.codfat,
          contingencia: true,
        });
        if (dataC?.sucesso) {
          toast.success('Nota emitida em CONTINGÊNCIA!', { id: tId2 });
          onAtualizarLista?.();
        } else {
          toast.dismiss(tId2);
          pedirConfirmacao(() => {}, {
            somenteOk: true,
            type: 'warning',
            title: 'Não foi possível emitir a nota',
            message: dataC?.motivo || dataC?.detalhe || 'Falha ao emitir em contingência.',
          });
        }
        return;
      }

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
      // Rejeição SEFAZ (ex.: CFOP/UF) no modal central padrão, não em toast no canto.
      toast.dismiss(toastId);
      pedirConfirmacao(() => {}, {
        somenteOk: true,
        type: 'warning',
        title: 'Não foi possível emitir a nota',
        message: msg,
      });
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
      avisoErro('Erro ao buscar produtos da fatura.');
    }
  };

  // Modal de EVENTOS (histórico da nota) — aberto pela ação "Evento" do dropdown.
  const [eventoFatura, setEventoFatura] = useState<any | null>(null);
  // Modal de CANCELAR FATURA (Delphi Canc_Fatura: NF-e SEFAZ + fatura + títulos + venda).
  const [modalCancelFaturaAberto, setModalCancelFaturaAberto] = useState(false);
  const [faturaCancelFatura, setFaturaCancelFatura] = useState<any | null>(null);
  const [motivoCancelFatura, setMotivoCancelFatura] = useState('');
  const [cancelarVendasFatura, setCancelarVendasFatura] = useState(false);
  const [isCancelandoFatura, setIsCancelandoFatura] = useState(false);
  // NF-e fora do prazo de cancelamento → cancela só o faturamento (NF-e fica válida).
  const [notaForaPrazo, setNotaForaPrazo] = useState(false);
  // Modal de cancelamento de COBRANÇA (com motivo obrigatório p/ histórico dbacao).
  const [modalCancelCobrancaAberto, setModalCancelCobrancaAberto] = useState(false);
  const [faturaCancelCobranca, setFaturaCancelCobranca] = useState<any | null>(null);
  const [motivoCancelCobranca, setMotivoCancelCobranca] = useState('');
  const [isCancelandoCobranca, setIsCancelandoCobranca] = useState(false);

  // Abre o modal do motivo (não cancela direto — registra QUEM/QUANDO/MOTIVO).
  const handleCancelarCobranca = (fatura: any) => {
    setFaturaCancelCobranca(fatura);
    setMotivoCancelCobranca('');
    setModalCancelCobrancaAberto(true);
  };

  // Executa de fato o cancelamento (após o motivo ser informado no modal).
  const executarCancelarCobranca = async () => {
    if (!faturaCancelCobranca) return;
    if (motivoCancelCobranca.trim().length < 5) {
      avisoErro('Informe o motivo do cancelamento (mínimo 5 caracteres).');
      return;
    }
    setIsCancelandoCobranca(true);
    try {
      // Cobrança agrupada (GP): cancela por codgp (COBRANCA_CANCELAR_GP do Delphi) —
      // os títulos do grupo estão em dbreceb.codgp, não no cod_fat do membro.
      const ehGrupo =
        faturaCancelCobranca.agp === 'S' && !!faturaCancelCobranca.codgp;
      const { data } = await axios.post('/api/faturamento/cancelar-cobranca', {
        codfat: faturaCancelCobranca.codfat,
        codgp: ehGrupo ? faturaCancelCobranca.codgp : undefined,
        usuario: user?.usuario || user?.codusr || '',
        motivo: motivoCancelCobranca.trim(),
      });
      toast.success(data?.message || 'Cobrança cancelada com sucesso.');
      setModalCancelCobrancaAberto(false);
      onAtualizarLista?.();
    } catch (err: any) {
      // Surfacar o motivo real (ex.: 409 "já possui parcela(s) paga(s)").
      const msg = err?.response?.data?.error || 'Erro ao cancelar cobrança.';
      avisoErro(msg);
      console.error(err);
    } finally {
      setIsCancelandoCobranca(false);
    }
  };

  // Fechar Fatura — espelha o Fechar_Venda do Delphi (venda → status 'F').
  // Abre alerta de confirmação estilizado; se confirmar, chama o endpoint.
  const executarFecharFatura = async (fatura: any) => {
    try {
      const { data } = await axios.post('/api/faturamento/fechar-fatura', {
        codfat: fatura.codfat,
        usuario: user?.usuario || user?.codusr || '',
      });
      toast.success(
        `Fatura fechada com sucesso. Venda(s) marcada(s) como faturada (status 'F').`,
      );
      onAtualizarLista?.();
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.erro || 'Erro ao fechar a fatura.';
      avisoErro(msg);
      console.error(err);
    }
  };

  const handleFecharFatura = (fatura: any) => {
    pedirConfirmacao(() => executarFecharFatura(fatura), {
      title: 'Fechar fatura',
      message:
        `Deseja realmente fechar a fatura ${fatura.codfat}? ` +
        `A(s) venda(s) vinculada(s) será(ão) marcada(s) como faturada (status 'F').`,
      type: 'warning',
      confirmText: 'Sim, fechar',
      cancelText: 'Não',
    });
  };

  // Cancelar Fatura (idêntico ao Delphi Canc_Fatura): abre o modal com justificativa
  // + opção "cancelar vendas". Ao confirmar: cancela a NF-e na SEFAZ (se autorizada)
  // e depois fatura + contas a receber + venda.
  const handleCancelarFatura = (fatura: any) => {
    // Prazo SEFAZ (só se a nota FOI autorizada): NF-e 24h | NFC-e 30 min.
    // Fiel ao Delphi (Canc_Fatura é DESACOPLADO da NF-e): se o prazo expirou, NÃO
    // bloqueia — marca `notaForaPrazo` para avisar no modal e cancelar SÓ o
    // faturamento (a NF-e continua válida na SEFAZ; regularizar com devolução).
    let foraPrazo = false;
    const autorizacao = fatura?.nfe_dthrprotocolo;
    if (autorizacao && fatura?.nfe_status === '100') {
      const ehNfce = String(fatura?.nfe_modelo || '55') === '65';
      const limiteMin = ehNfce ? 30 : 24 * 60;
      const decorridoMin =
        (Date.now() - new Date(autorizacao).getTime()) / 60000;
      foraPrazo = Number.isFinite(decorridoMin) && decorridoMin > limiteMin;
    }
    setNotaForaPrazo(foraPrazo);
    setFaturaCancelFatura(fatura);
    setMotivoCancelFatura('');
    setCancelarVendasFatura(false);
    setModalCancelFaturaAberto(true);
  };

  const executarCancelarFatura = async () => {
    const fatura = faturaCancelFatura;
    if (!fatura) return;
    if (motivoCancelFatura.trim().length < 15) {
      avisoErro('A justificativa deve ter no mínimo 15 caracteres.');
      return;
    }
    setIsCancelandoFatura(true);
    try {
      // 1. NF-e autorizada e DENTRO do prazo → cancela na SEFAZ primeiro.
      //    Fora do prazo (notaForaPrazo): pula a SEFAZ e cancela só o faturamento.
      const autorizada =
        fatura.nfe_status === '100' && !fatura.dthrcancelamento;
      if (autorizada && !notaForaPrazo) {
        await axios.post('/api/faturamento/cancelar-nfe', {
          codfat: fatura.codfat,
          motivo: motivoCancelFatura.trim(),
        });
      }
      // 2. Cancela fatura + contas a receber + venda (banco).
      //    ignorarNfe=true quando fora do prazo (NF-e permanece válida na SEFAZ).
      await axios.post('/api/faturamento/cancelar-fatura', {
        codfat: fatura.codfat,
        motivo: motivoCancelFatura.trim(),
        cancelarVendas: cancelarVendasFatura,
        ignorarNfe: notaForaPrazo,
        usuario: user?.usuario || user?.codusr || '',
      });
      toast.success(
        notaForaPrazo
          ? 'Faturamento cancelado (NF-e permanece válida na SEFAZ — regularize com devolução).'
          : 'Faturamento cancelado com sucesso.',
      );
      setModalCancelFaturaAberto(false);
      onAtualizarLista?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.error ||
        'Erro ao cancelar o faturamento.';
      avisoErro(msg);
      console.error(err);
    } finally {
      setIsCancelandoFatura(false);
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
      avisoErro('Erro ao atualizar fatura!');
    }
  };

  // Estado para modal de cancelamento
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [faturaParaCancelar, setFaturaParaCancelar] = useState<any | null>(
    null,
  );
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const handleAbrirModalCancelar = (fatura: any) => {
    // Regra de prazo da SEFAZ, validada ANTES de abrir o modal do motivo:
    //   NF-e (mod.55): 24h após autorização | NFC-e (mod.65): 30 minutos.
    // Se já expirou, nem pede o motivo — informa direto (não chega a chamar a SEFAZ).
    const autorizacao = fatura?.nfe_dthrprotocolo;
    if (autorizacao) {
      const ehNfce = String(fatura?.nfe_modelo || '55') === '65';
      const limiteMin = ehNfce ? 30 : 24 * 60;
      const decorridoMin = (Date.now() - new Date(autorizacao).getTime()) / 60000;
      if (Number.isFinite(decorridoMin) && decorridoMin > limiteMin) {
        pedirConfirmacao(() => {}, {
          somenteOk: true,
          type: 'warning',
          title: 'Cancelamento não permitido',
          message:
            `Esta ${ehNfce ? 'NFC-e' : 'NF-e'} não pode mais ser cancelada. ` +
            `O prazo de cancelamento é de ${ehNfce ? '30 minutos' : '24 horas'} após a autorização e já expirou ` +
            `(autorizada há ${Math.round(decorridoMin)} min).`,
        });
        return;
      }
    }
    setFaturaParaCancelar(fatura);
    setMotivoCancelamento('');
    setModalCancelarAberto(true);
  };

const handleCancelarNota = async () => {
  // Validações iniciais
  if (!faturaParaCancelar) return;

  if (motivoCancelamento.trim().length < 15) {
    avisoErro('O motivo do cancelamento deve ter no mínimo 15 caracteres.');
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
    avisoErro(msg);

  } finally {
    // 5. Desativa o estado de loading, independentemente do resultado (sucesso ou erro)
    setIsCanceling(false);
  }
};

  // ===== CARTA DE CORREÇÃO ELETRÔNICA (CC-e) =====
  const [modalCartaCorrecaoAberto, setModalCartaCorrecaoAberto] = useState(false);
  const [faturaParaCC, setFaturaParaCC] = useState<any | null>(null);
  const [textoCartaCorrecao, setTextoCartaCorrecao] = useState('');
  const [enviandoCC, setEnviandoCC] = useState(false);

  const handleAbrirModalCartaCorrecao = (fatura: any) => {
    // Só NF-e autorizada, não NFC-e, dentro de 30 dias (valida antes de abrir).
    if (fatura?.nfe_status !== '100') {
      pedirConfirmacao(() => {}, {
        somenteOk: true, type: 'warning', title: 'Carta de Correção',
        message: 'Só é possível gerar Carta de Correção para NF-e autorizada.',
      });
      return;
    }
    if (String(fatura?.nfe_modelo || '55') === '65') {
      pedirConfirmacao(() => {}, {
        somenteOk: true, type: 'warning', title: 'Carta de Correção',
        message: 'Carta de Correção não é permitida para NFC-e.',
      });
      return;
    }
    const autorizacao = fatura?.nfe_dthrprotocolo;
    if (autorizacao) {
      const dias = (Date.now() - new Date(autorizacao).getTime()) / 86400000;
      if (Number.isFinite(dias) && dias > 30) {
        pedirConfirmacao(() => {}, {
          somenteOk: true, type: 'warning', title: 'Carta de Correção',
          message: `Prazo expirado: a Carta de Correção só pode ser enviada até 30 dias após a autorização (autorizada há ${Math.round(dias)} dias).`,
        });
        return;
      }
    }
    setFaturaParaCC(fatura);
    setTextoCartaCorrecao('');
    setModalCartaCorrecaoAberto(true);
  };

  const handleEnviarCartaCorrecao = async () => {
    if (!faturaParaCC) return;
    if (textoCartaCorrecao.trim().length < 15) {
      avisoErro('O texto da correção deve ter no mínimo 15 caracteres.');
      return;
    }
    setEnviandoCC(true);
    try {
      const { data } = await axios.post('/api/faturamento/carta-correcao', {
        codfat: faturaParaCC.codfat,
        correcao: textoCartaCorrecao,
      });
      toast.success(`Carta de Correção registrada (protocolo ${data.protocolo || '—'}).`);

      // Gera o comprovante (HTML retrato) e baixa o PDF, como na NF-e.
      try {
        const html = gerarCartaCorrecaoHtml({
          numeroNota: data.numeroNota || faturaParaCC.numero_nfe || faturaParaCC.nroform,
          serie: data.serie || faturaParaCC.serie,
          chave: data.chave,
          protocolo: data.protocolo,
          nSeqEvento: data.nSeqEvento,
          dhEvento: data.dhEvento,
          correcao: data.correcao,
          homologacao: true,
          logoSrc: typeof window !== 'undefined' ? window.location.origin + '/images/logoPdf.png' : undefined,
          // Emitente REAL da nota (vindo do XML, via endpoint).
          emitente: data.emitente,
          // Destinatário: nome real do cliente (em homolog o XML traz o texto fixo
          // "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO"), doc/endereço do XML da nota.
          destinatario: {
            nome:
              faturaParaCC.cliente_nome ||
              faturaParaCC.dbclien?.nome ||
              data.destinatario?.nome,
            documento: data.destinatario?.documento,
            endereco: data.destinatario?.endereco,
          },
        });
        const resp = await axios.post(
          '/api/faturamento/danfe-html-pdf',
          { html, filename: `cce-${faturaParaCC.codfat}`, orientacao: 'portrait' },
          { responseType: 'blob' },
        );
        const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `cce-${faturaParaCC.codfat}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (pdfErr) {
        avisoErro('CC-e registrada, mas houve falha ao gerar o PDF do comprovante.');
      }

      setModalCartaCorrecaoAberto(false);
      setFaturaParaCC(null);
      setTextoCartaCorrecao('');
      onAtualizarLista?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.motivo || err?.response?.data?.erro || 'Erro ao enviar a Carta de Correção.';
      avisoErro(msg);
    } finally {
      setEnviandoCC(false);
    }
  };

  // ===== TERMO DE COMPROMISSO DE BATERIAS =====
  const [modalTermoAberto, setModalTermoAberto] = useState(false);
  const [termoFatura, setTermoFatura] = useState<any | null>(null);
  const [termoCliente, setTermoCliente] = useState<any | null>(null);
  const [termoProdutos, setTermoProdutos] = useState<any[]>([]);
  const [gerandoTermo, setGerandoTermo] = useState(false);

  const handleAbrirModalTermoBaterias = async (fatura: any) => {
    try {
      const { data } = await axios.get('/api/faturamento/termo-baterias', {
        params: { codfat: fatura.codfat },
      });
      setTermoFatura(data.fatura);
      setTermoCliente(data.cliente);
      // Marca todos os itens por padrão; o usuário desmarca os que não são baterias.
      setTermoProdutos((data.produtos || []).map((p: any) => ({ ...p, check: true })));
      setModalTermoAberto(true);
    } catch (err: any) {
      avisoErro(err?.response?.data?.error || 'Erro ao carregar os produtos da fatura.');
    }
  };

  const handleGerarTermoBaterias = async () => {
    const selecionados = termoProdutos.filter((p) => p.check);
    if (selecionados.length === 0) {
      avisoErro('Marque ao menos um item (bateria) para gerar o termo.');
      return;
    }
    setGerandoTermo(true);
    try {
      const html = gerarTermoBateriasHtml({
        nroform: termoFatura?.nroform,
        serie: termoFatura?.serie,
        cliente: termoCliente,
        produtos: selecionados,
        logoSrc: typeof window !== 'undefined' ? window.location.origin + '/images/logoPdf.png' : undefined,
      });
      const resp = await axios.post(
        '/api/faturamento/danfe-html-pdf',
        { html, filename: `termo-baterias-${termoFatura?.codfat}`, orientacao: 'portrait' },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo-baterias-${termoFatura?.codfat}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setModalTermoAberto(false);
    } catch (err) {
      avisoErro('Erro ao gerar o PDF do termo.');
    } finally {
      setGerandoTermo(false);
    }
  };

  // ===== ESTORNO DE NF-e (fase 1: gerar a DI de devolução) =====
  const [modalEstornoAberto, setModalEstornoAberto] = useState(false);
  const [estornoFatura, setEstornoFatura] = useState<any | null>(null);
  const [estornoJustificativa, setEstornoJustificativa] = useState('');
  const [estornoCfop, setEstornoCfop] = useState('');
  const [estornandoDI, setEstornandoDI] = useState(false);
  const [estornoResultado, setEstornoResultado] = useState<any | null>(null);

  const handleAbrirModalEstorno = (fatura: any) => {
    if (fatura?.nfe_status !== '100') {
      pedirConfirmacao(() => {}, {
        somenteOk: true, type: 'warning', title: 'Estorno de NF-e',
        message: 'Só é possível estornar NF-e autorizada.',
      });
      return;
    }
    // Estorno é para DEPOIS das 24h — antes disso o caminho é o Cancelamento.
    const autorizacao = fatura?.nfe_dthrprotocolo;
    if (autorizacao) {
      const horas = (Date.now() - new Date(autorizacao).getTime()) / 3600000;
      if (Number.isFinite(horas) && horas < 24) {
        pedirConfirmacao(() => {}, {
          somenteOk: true, type: 'warning', title: 'Estorno de NF-e',
          message: `O Estorno é para DEPOIS de 24h da autorização (faltam ${Math.ceil(24 - horas)}h). Dentro de 24h, use Cancelar Nota Fiscal.`,
        });
        return;
      }
    }
    setEstornoFatura(fatura);
    setEstornoJustificativa('');
    setEstornoCfop('');
    setEstornoResultado(null);
    setModalEstornoAberto(true);
  };

  const handleGerarEstornoDI = async () => {
    if (!estornoFatura) return;
    if (estornoJustificativa.trim().length < 15) {
      avisoErro('A justificativa deve ter no mínimo 15 caracteres.');
      return;
    }
    if (!/^\d{4}$/.test(estornoCfop.trim())) {
      avisoErro('Informe um CFOP de devolução válido (4 dígitos).');
      return;
    }
    setEstornandoDI(true);
    try {
      const { data } = await axios.post('/api/faturamento/estornar-nfe', {
        codfat: estornoFatura.codfat,
        cfop: estornoCfop.trim(),
        justificativa: estornoJustificativa.trim(),
      });
      setEstornoResultado(data);
      toast.success(`DI de devolução gerada: fatura ${data.codfatDI} (form ${data.nroformDI}).`);
      onAtualizarLista?.();
    } catch (err: any) {
      avisoErro(err?.response?.data?.erro || 'Erro ao gerar o estorno.');
    } finally {
      setEstornandoDI(false);
    }
  };

  // Fase 2: emite a NF-e de devolução de uma DI (pelo resultado do estorno ou pela Consulta).
  const [emitindoDevolucao, setEmitindoDevolucao] = useState<string | null>(null);
  const handleEmitirDevolucao = async (codfatDI: string) => {
    if (!codfatDI) return;
    setEmitindoDevolucao(codfatDI);
    try {
      const { data } = await axios.post('/api/faturamento/emitir-devolucao', { codfat: codfatDI });
      toast.success(`Devolução autorizada! Protocolo ${data.protocolo || '—'}.`);
      onAtualizarLista?.();
      return true;
    } catch (err: any) {
      avisoErro(err?.response?.data?.motivo || err?.response?.data?.erro || 'Erro ao emitir a devolução.');
      return false;
    } finally {
      setEmitindoDevolucao(null);
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
      avisoErro('Erro ao carregar grupos de pagamento.');
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
      avisoErro('Erro ao carregar detalhes do grupo.');
    }
  };

  // Fechar detalhes do grupo
  const fecharDetalhesGrupo = () => {
    setMostrarDetalhesGrupo(false);
    setGrupoSelecionado(null);
    setFaturasDoGrupo([]);
  };

  // Categoria de COR DA LINHA (prioridade estilo Delphi):
  // Cancelado > Denegada > Agrupado > Faturamento na Semana > Com cobrança > Sem cobrança.
  const statusCorLinha = (f: any): string => {
    if (f.cancel === 'S' || f.nfe_status === 'C') return 'cancel';
    if (f.denegada === 'S') return 'denegada';
    if (f.agp === 'S') return 'agrupado';
    // Fechamento da semana: fatura que fica aguardando a cobrança do fechamento (roxa).
    if (String(f.tipo_fechamento || '').toUpperCase() === 'SEMANAL') return 'fechamento_semana';
    if (f.cobranca === 'S') return 'cobranca';
    return 'sem';
  };

  // Pill da coluna STATUS NFe (Autorizada / Rejeitada / Cancelada / Denegada / Pendente).
  const statusNfePill = (f: any) => {
    let cls = 'pen';
    let txt = 'Pendente';
    if (f.nfe_status === '100') { cls = 'aut'; txt = 'Autorizada'; }
    else if (f.cancel === 'S' || f.nfe_status === 'C') { cls = 'can'; txt = 'Cancelada'; }
    else if (f.denegada === 'S') { cls = 'rej'; txt = 'Denegada'; }
    else if (f.mensagem_rejeicao || f.nfe_motivo) { cls = 'rej'; txt = 'Rejeitada'; }
    const box: Record<string, string> = {
      aut: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
      rej: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/40',
      can: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/40',
      pen: 'text-slate-600 dark:text-slate-300 bg-slate-500/10 border-slate-500/40',
    };
    const dot: Record<string, string> = {
      aut: 'bg-emerald-400', rej: 'bg-amber-400', can: 'bg-rose-400', pen: 'bg-slate-400',
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${box[cls]}`}
        title={f.mensagem_rejeicao || f.nfe_motivo || f.motivocancelamento || txt}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot[cls]}`} />
        {txt}
      </span>
    );
  };

  const rows = faturas.map((f) => ({
    selecionar: (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          className="disabled:opacity-40 disabled:cursor-not-allowed"
          checked={faturasSelecionadas.includes(f.codfat)}
          // REGRA: exige NF-e EMITIDA (autorizada, 100). Bloqueia AGRUPAR quando a fatura já
          // tem cobrança individual — MAS permite selecionar faturas JÁ AGRUPADAS (agp='S')
          // para DESAGRUPAR (elas têm cobranca='S', mas o objetivo aqui é soltar o grupo).
          disabled={f.nfe_status !== '100' || (f.cobranca === 'S' && f.agp !== 'S')}
          title={
            f.nfe_status !== '100'
              ? 'Só é possível agrupar/desagrupar faturas com NF-e emitida (autorizada)'
              : f.cobranca === 'S' && f.agp !== 'S'
                ? 'Fatura já possui cobrança gerada'
                : f.agp === 'S'
                  ? 'Selecione para desagrupar este grupo'
                  : undefined
          }
          onClick={e => e.stopPropagation()} // Evita propagar o clique para a linha
          onChange={async (e) => {
            console.log('🔄 onChange executado - checked:', e.target.checked, 'fatura:', f.codfat, 'cliente:', f.codcli);
            e.stopPropagation(); // Evita propagar o clique para a linha
            if (e.target.checked) {
              // Safety net: cobrança agrupada só para NF-e emitida (autorizada).
              if (f.nfe_status !== '100') {
                pedirConfirmacao(() => {}, {
                  somenteOk: true,
                  type: 'warning',
                  title: 'NF-e não emitida',
                  message: `A fatura ${f.codfat} ainda não tem NF-e emitida (autorizada) e não pode ser agrupada.`,
                });
                return;
              }
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
                pedirConfirmacao(() => {}, {
                  somenteOk: true,
                  type: 'warning',
                  title: 'Clientes diferentes',
                  message: `Só é possível selecionar faturas do mesmo cliente.\nCliente atual: ${nomeClienteAtual}\nCliente selecionado: ${nomeClienteNovo}`,
                });
                return;
              }

              // Validação de pagamentos só se aplica ao AGRUPAR. Para faturas já agrupadas
              // (agp='S'), a seleção é para DESAGRUPAR — a trava de recebido/registrado/vencido
              // é feita no servidor (desagrupar-grupo, fiel ao VALIDA_COBRANCA_GP).
              if (f.cobranca === 'S' && f.agp !== 'S') {
                console.log('🔍 Verificando pagamentos para fatura:', f.codfat);
                const temPagamentos = await verificarFaturaTemPagamentos(f.codfat);
                if (temPagamentos) {
                  console.log('🚫 Tentou selecionar fatura que já possui pagamentos:', f.codfat);
                  console.log('📢 Mostrando aviso para fatura com pagamentos');
                  pedirConfirmacao(() => {}, {
                    somenteOk: true,
                    type: 'warning',
                    title: 'Fatura com pagamentos',
                    message: `A fatura ${f.codfat} já possui pagamentos realizados e não pode ser agrupada.`,
                  });
                  return;
                }
                console.log('✅ Fatura tem cobrança mas sem pagamentos, pode ser agrupada');
              }
              console.log('✅ Adicionando fatura à seleção');
              setFaturasSelecionadas(prev => {
                // Fatura de um grupo (codgp) → seleciona TODAS as faturas do mesmo grupo.
                const doGrupo = f.codgp
                  ? faturas.filter((x: any) => x.codgp && String(x.codgp) === String(f.codgp)).map((x: any) => x.codfat)
                  : [f.codfat];
                return Array.from(new Set([...prev, ...doGrupo]));
              });
            } else {
              console.log('❌ Removendo fatura da seleção');
              setFaturasSelecionadas(prev => {
                // Desmarcar uma do grupo remove todas do mesmo grupo.
                if (f.codgp) {
                  const doGrupo = new Set(
                    faturas.filter((x: any) => x.codgp && String(x.codgp) === String(f.codgp)).map((x: any) => x.codfat),
                  );
                  return prev.filter((cod) => !doGrupo.has(cod));
                }
                return prev.filter((cod) => cod !== f.codfat);
              });
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
            avisoErro('Esta fatura já possui cobrança gerada.');
            return;
          }
          // Abre o modal com bancos filtrados (cliente + MELO) e banco default.
          abrirModalCobranca(f);
        }}
        onEditarClick={() => setFaturaParaEdicao(f)}
        onCancelarCobranca={() => handleCancelarCobranca(f)}
        onAlterarCobranca={() => handleAlterarCobranca(f)}
        onFecharFatura={() => handleFecharFatura(f)}
        onCancelarFaturaClick={() => handleCancelarFatura(f)}
        onEventoClick={() => setEventoFatura(f)}
        onEmailDanfeClick={() => setEmaildanfeModalAberto(f)}
        onenviarCobrancaClick={() => setCobrancaEnviada(f)}
        onVisualizarBoletosClick={() => handleVisualizarBoletos(f)}
        onReciboClick={() => handleRecibo(f)}
        onResumoGpClick={() => handleResumoGp(f)}
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
            avisoErro(
              `Não foi encontrada informação adicional para a fatura ${f.codfat}`
            );
          }
        }}
        onCancelarNotaClick={() => handleAbrirModalCancelar(f)}
        onEmitirNotaClick={() => handleEmitirNota(f)}
        onCartaCorrecaoClick={() => handleAbrirModalCartaCorrecao(f)}
        onTermoBateriasClick={() => handleAbrirModalTermoBaterias(f)}
        onEstornoClick={() => handleAbrirModalEstorno(f)}
        onEmitirDevolucaoClick={() => handleEmitirDevolucao(f.codfat)}
      />
    ),
    status: statusNfePill(f),
    // Categoria de cor da LINHA (estilo Delphi) — lida no rowClassName da página.
    __statusCor: statusCorLinha(f),
    codfat: f.codfat,
    nroform: f.nroform ?? '-',
    cliente_nome: ` ${f.codcli}-${f.cliente_nome ?? f.dbclien?.nome ?? '-'}`,
    totalnf: formatarBRL(f.totalnf),
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
        if (col === 'totalnf') return formatarBRL(f[col]);
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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden text-black dark:text-white  ">
        {/* Botão para criar grupo de pagamento */}
        {faturasSelecionadas.length > 0 && (
          <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-between">
            {(() => {
              // GP das faturas selecionadas (se alguma vier de um grupo).
              const selGp = faturas.find(
                (x: any) => faturasSelecionadas.includes(x.codfat) && x.codgp,
              )?.codgp;
              return (
                <>
                  <span className="text-blue-800 dark:text-blue-200">
                    {selGp
                      ? `${faturasSelecionadas.length} fatura(s) do grupo GP ${selGp} selecionada(s)`
                      : `${faturasSelecionadas.length} fatura(s) selecionada(s) para agrupamento`}
                  </span>
                  {selGp ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAlterarPrazoGp(selGp)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                        title="Cancela e recria a cobrança do grupo com novos prazos"
                      >
                        Alterar Prazo GP
                      </button>
                      <button
                        onClick={() =>
                          handleRemoverFaturaGp(
                            selGp,
                            faturas
                              .filter(
                                (x: any) =>
                                  faturasSelecionadas.includes(x.codfat) &&
                                  String(x.codgp) === String(selGp),
                              )
                              .map((x: any) => x.codfat),
                          )
                        }
                        className="px-3 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                        title="Remove a(s) fatura(s) selecionada(s) do grupo e recalcula a cobrança"
                      >
                        Remover Fatura GP
                      </button>
                      <button
                        onClick={() => handleDesagrupar(selGp)}
                        className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                      >
                        Desagrupar GP {selGp}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleCriarGrupoPagamento}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Gerar Cobrança
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
  
        
        <DataTable
          headers={headers}
          rows={rows}
          meta={meta}
          carregando={carregando}
          semColunaDeAcaoPadrao
          persistPerPage={false}
          searchValue={termoBusca}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          onSearch={(e) => setTermoBusca(e.target.value)}
          onSearchBlur={() => onBuscar?.()}
          onSearchKeyDown={(e) => {
            if (e.key === 'Enter') onBuscar?.();
          }}
          searchInputPlaceholder="Buscar por código, cliente, vendedor..."
          onFiltroChange={onFiltroChange}
          colunasFiltro={colunasFiltro}
          rowClassName={rowClassName}
          onRowClick={onRowClick}
          onOrderedRowsChange={onOrderedRowsChange}
          headerLeftSlot={headerLeftSlot}
          searchCompacto={searchCompacto}
          // Dropdown de Status NFe na linha de filtros da coluna "status".
          statusFilterColumn="status"
          statusFilterValue={statusFilterValue}
          onStatusFilterChange={onStatusFilterChange}
          statusFilterOptions={statusFilterOptions}
          footerLeftSlot={legendaSlot}
          footerRightSlot={
            <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
              Total faturado:{' '}
              <b className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </b>
              {' · '}
              {(meta?.total ?? 0).toLocaleString('pt-BR')} registros
            </span>
          }
          colunasSemFiltro={['selecionar', 'ações', 'status']}
          nonsortableColumns={['selecionar', 'ações', 'status', '☑️', 'Ações']}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={onLimiteColunasChange}
          onExportarExcel={() => setMostrarModalExportar(true)}
          columnLabels={{
            selecionar: '',
            ações: 'Ações',
            status: 'Status NFe',
            codfat: 'Código da Fatura',
            nroform: 'Número NF',
            cliente_nome: 'Cliente',
            totalnf: 'Valor Total',
            data: 'Data',
            codvend: 'Vendedor',
            codtransp: 'Transportadora',
            codgp: 'Cód. GP',
            grupo_pagamento: 'Grupo de Pagamento',
          }}
        />

        {/* Modal de confirmação padrão (cancelar cobrança etc.) */}
        {ConfirmacaoSalvarModal}

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

        {/* Modal de Cancelamento de COBRANÇA (motivo obrigatório → histórico dbacao) */}
        <Dialog
          open={modalCancelCobrancaAberto}
          onOpenChange={setModalCancelCobrancaAberto}
        >
          <DialogContent className="max-w-md w-full bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Cancelar Cobrança</DialogTitle>
              <DialogDescription>
                Informe o motivo do cancelamento da cobrança da fatura{' '}
                {faturaCancelCobranca?.codfat}. Será registrado quem cancelou,
                data/hora e o motivo.
              </DialogDescription>
            </DialogHeader>

            <div className="w-full">
              <textarea
                className="w-full min-h-[80px] border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800 disabled:opacity-70"
                value={motivoCancelCobranca}
                onChange={(e) => setMotivoCancelCobranca(e.target.value)}
                placeholder="Ex.: Cliente desistiu da compra / erro na venda..."
                autoFocus
                disabled={isCancelandoCobranca}
                maxLength={200}
              />
              <p
                className={`mt-1 text-xs text-right ${
                  motivoCancelCobranca.trim().length < 5
                    ? 'text-red-500 font-semibold'
                    : 'text-green-600'
                }`}
              >
                {motivoCancelCobranca.trim().length} / 5 caracteres mínimos
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setModalCancelCobrancaAberto(false)}
                disabled={isCancelandoCobranca}
              >
                Fechar
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 flex items-center justify-center min-w-[160px] disabled:cursor-not-allowed disabled:bg-red-800"
                onClick={executarCancelarCobranca}
                disabled={
                  isCancelandoCobranca || motivoCancelCobranca.trim().length < 5
                }
              >
                {isCancelandoCobranca ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Cancelar Cobrança'
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Carta de Correção Eletrônica (CC-e) */}
        <Dialog open={modalCartaCorrecaoAberto} onOpenChange={setModalCartaCorrecaoAberto}>
          <DialogContent className="max-w-lg w-full bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Carta de Correção Eletrônica</DialogTitle>
              <DialogDescription>
                Descreva a correção da NF-e {faturaParaCC?.numero_nfe || faturaParaCC?.nroform}.
                Não vale para valores/impostos, remetente/destinatário ou data de emissão.
              </DialogDescription>
            </DialogHeader>

            <div className="w-full">
              <textarea
                className="w-full min-h-[120px] border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800 disabled:opacity-70"
                value={textoCartaCorrecao}
                onChange={(e) => setTextoCartaCorrecao(e.target.value.slice(0, 1000))}
                placeholder="Ex.: No campo Transportadora, onde se lê CLIENTE RETIRA, leia-se..."
                autoFocus
                disabled={enviandoCC}
                maxLength={1000}
              />
              <p className={`mt-1 text-xs text-right ${
                textoCartaCorrecao.trim().length < 15 ? 'text-red-500 font-semibold' : 'text-green-600'
              }`}>
                {textoCartaCorrecao.length} / 1000 (mín. 15)
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:opacity-50"
                onClick={() => setModalCartaCorrecaoAberto(false)}
                disabled={enviandoCC}
              >
                Fechar
              </button>
              <button
                className="px-4 py-2 rounded bg-teal-600 text-white hover:bg-teal-700 flex items-center justify-center min-w-[180px] disabled:cursor-not-allowed disabled:bg-teal-800"
                onClick={handleEnviarCartaCorrecao}
                disabled={enviandoCC || textoCartaCorrecao.trim().length < 15}
              >
                {enviandoCC ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando à SEFAZ...
                  </>
                ) : (
                  'Enviar Carta de Correção'
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal do Termo de Compromisso de Baterias */}
        <Dialog open={modalTermoAberto} onOpenChange={setModalTermoAberto}>
          <DialogContent className="max-w-2xl w-full bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Termo de Compromisso de Baterias</DialogTitle>
              <DialogDescription>
                Marque os itens que são baterias — o termo (logística reversa) será gerado só com eles.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-72 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left w-10">
                      <input
                        type="checkbox"
                        checked={termoProdutos.length > 0 && termoProdutos.every((p) => p.check)}
                        onChange={(e) =>
                          setTermoProdutos((prev) => prev.map((p) => ({ ...p, check: e.target.checked })))
                        }
                      />
                    </th>
                    <th className="px-2 py-1 text-left">Referência</th>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Marca</th>
                    <th className="px-2 py-1 text-center">Qtde</th>
                  </tr>
                </thead>
                <tbody>
                  {termoProdutos.map((p, i) => (
                    <tr key={`${p.ref}-${p.codprod}`} className="odd:bg-muted/20">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!p.check}
                          onChange={(e) =>
                            setTermoProdutos((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, check: e.target.checked } : x)),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{p.ref}</td>
                      <td className="px-2 py-1">{p.descr}</td>
                      <td className="px-2 py-1">{p.marca}</td>
                      <td className="px-2 py-1 text-center">{p.qtde}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:opacity-50"
                onClick={() => setModalTermoAberto(false)}
                disabled={gerandoTermo}
              >
                Fechar
              </button>
              <button
                className="px-4 py-2 rounded bg-lime-600 text-white hover:bg-lime-700 flex items-center justify-center min-w-[150px] disabled:cursor-not-allowed disabled:bg-lime-800"
                onClick={handleGerarTermoBaterias}
                disabled={gerandoTermo || termoProdutos.filter((p) => p.check).length === 0}
              >
                {gerandoTermo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Termo (PDF)'
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Estorno de NF-e (fase 1: gerar a DI de devolução) */}
        <Dialog open={modalEstornoAberto} onOpenChange={setModalEstornoAberto}>
          <DialogContent className="max-w-lg w-full bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Estorno de NF-e</DialogTitle>
              <DialogDescription>
                Gera um documento de DEVOLUÇÃO (DI) que reverte a NF-e {estornoFatura?.numero_nfe || estornoFatura?.nroform} e estorna o estoque. A emissão da devolução à SEFAZ é o próximo passo.
              </DialogDescription>
            </DialogHeader>

            {!estornoResultado ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs block mb-1">Justificativa (mín. 15 caracteres)</label>
                  <textarea
                    className="w-full min-h-[80px] border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800 disabled:opacity-70"
                    value={estornoJustificativa}
                    onChange={(e) => setEstornoJustificativa(e.target.value)}
                    placeholder="Motivo do estorno da NF-e..."
                    disabled={estornandoDI}
                    maxLength={255}
                  />
                  <p className={`mt-1 text-xs text-right ${estornoJustificativa.trim().length < 15 ? 'text-red-500 font-semibold' : 'text-green-600'}`}>
                    {estornoJustificativa.length} / 255 (mín. 15)
                  </p>
                </div>
                <div>
                  <label className="text-xs block mb-1">CFOP de devolução (4 dígitos)</label>
                  <input
                    className="w-40 border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800"
                    value={estornoCfop}
                    onChange={(e) => setEstornoCfop(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="ex.: 1202"
                    inputMode="numeric"
                    disabled={estornandoDI}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded border border-green-300 bg-green-50 dark:bg-green-950/30 p-3 text-sm">
                <div className="font-semibold text-green-700 dark:text-green-400 mb-1">Documento de devolução (DI) gerado ✅</div>
                <div>Fatura DI: <b>{estornoResultado.codfatDI}</b> · Formulário: <b>{estornoResultado.nroformDI}</b> · Itens: {estornoResultado.itens}</div>
                <div>NF-e original: {estornoResultado.codfatOriginal} (marcada como estornada) · Estoque devolvido.</div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">Próximo passo: emitir a NF-e de devolução à SEFAZ.</div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:opacity-50"
                onClick={() => setModalEstornoAberto(false)}
                disabled={estornandoDI || !!emitindoDevolucao}
              >
                {estornoResultado ? 'Fechar' : 'Cancelar'}
              </button>
              {estornoResultado && (
                <button
                  className="px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center min-w-[180px] disabled:cursor-not-allowed disabled:bg-orange-800"
                  onClick={async () => {
                    const ok = await handleEmitirDevolucao(estornoResultado.codfatDI);
                    if (ok) setModalEstornoAberto(false);
                  }}
                  disabled={!!emitindoDevolucao}
                >
                  {emitindoDevolucao ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Emitindo à SEFAZ...
                    </>
                  ) : (
                    'Emitir Devolução (SEFAZ)'
                  )}
                </button>
              )}
              {!estornoResultado && (
                <button
                  className="px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center min-w-[150px] disabled:cursor-not-allowed disabled:bg-orange-800"
                  onClick={handleGerarEstornoDI}
                  disabled={estornandoDI || estornoJustificativa.trim().length < 15 || estornoCfop.trim().length !== 4}
                >
                  {estornandoDI ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando DI...
                    </>
                  ) : (
                    'Gerar DI de Devolução'
                  )}
                </button>
              )}
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
                          {formatarBRL(p.prunit)}
                        </td>
                        <td className="p-2 border  text-gray-800 dark:text-white ">
                          {formatarBRL(p.total_item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-right font-bold  text-gray-800 dark:text-white">
                  Total: {formatarBRL(faturaSelecionada?.totalnf)}
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

        {/* Modal de EVENTOS (histórico da nota) — ação "Evento" do dropdown */}
        <ModalEventosNota
          open={!!eventoFatura}
          onClose={() => setEventoFatura(null)}
          codfat={eventoFatura?.codfat}
        />

        {/* Modal CANCELAR FATURA (Delphi Canc_Fatura) */}
        <Dialog
          open={modalCancelFaturaAberto}
          onOpenChange={setModalCancelFaturaAberto}
        >
          <DialogContent className="max-w-md w-full bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-red-700 dark:text-red-400">
                Cancelar Faturamento — {faturaCancelFatura?.codfat}
              </DialogTitle>
              <DialogDescription>
                Isto cancela a <strong>NF-e na SEFAZ</strong> (se autorizada e dentro
                do prazo), a <strong>fatura</strong> e as{' '}
                <strong>contas a receber</strong>. Informe a justificativa:
              </DialogDescription>
            </DialogHeader>

            {notaForaPrazo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                ⚠️ O prazo de cancelamento da NF-e na SEFAZ já expirou. Ao
                confirmar, será cancelado <strong>apenas o faturamento</strong>{' '}
                (fatura + contas a receber + venda); a{' '}
                <strong>NF-e continuará VÁLIDA na SEFAZ</strong> — regularize a
                operação com uma <strong>devolução</strong>.
              </div>
            )}

            <div className="w-full">
              <textarea
                className="w-full min-h-[80px] border rounded p-2 text-black dark:text-white bg-gray-100 dark:bg-zinc-800 disabled:opacity-70"
                value={motivoCancelFatura}
                onChange={(e) => setMotivoCancelFatura(e.target.value)}
                placeholder="Justificativa (mínimo 15 caracteres, exigido pela SEFAZ)…"
                autoFocus
                disabled={isCancelandoFatura}
                maxLength={255}
              />
              <p
                className={`mt-1 text-xs text-right ${
                  motivoCancelFatura.trim().length < 15
                    ? 'text-red-500 font-semibold'
                    : 'text-green-600'
                }`}
              >
                {motivoCancelFatura.trim().length} / 15 caracteres mínimos
              </p>
            </div>

            <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelarVendasFatura}
                onChange={(e) => setCancelarVendasFatura(e.target.checked)}
                disabled={isCancelandoFatura}
                className="size-4"
              />
              Cancelar as vendas referentes a este faturamento?
              <span className="text-xs text-gray-500">
                (devolve o estoque; senão a venda volta para “Liberada”)
              </span>
            </label>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-300 dark:bg-zinc-700 text-black dark:text-white hover:bg-gray-400 dark:hover:bg-zinc-600 disabled:opacity-50"
                onClick={() => setModalCancelFaturaAberto(false)}
                disabled={isCancelandoFatura}
              >
                Fechar
              </button>
              <button
                className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800 flex items-center justify-center min-w-[170px] disabled:cursor-not-allowed disabled:bg-red-900"
                onClick={executarCancelarFatura}
                disabled={
                  isCancelandoFatura || motivoCancelFatura.trim().length < 15
                }
              >
                {isCancelandoFatura ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando…
                  </>
                ) : (
                  'Confirmar cancelamento'
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>

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
                  {cobrancaModalAberto.__alterarGpCodgp
                    ? `Alterar Prazo — GP ${cobrancaModalAberto.__alterarGpCodgp}`
                    : alterandoCobranca
                      ? 'Alterar Cobrança'
                      : 'Gerar Cobrança'}
                </DialogTitle>
              </DialogHeader>
              {/* Cabeçalho igual ao da cobrança agrupada: cliente destacado + documentos (NF). */}
              <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-4 py-3 mb-1">
                <div className="text-base font-bold text-red-600">
                  {cobrancaModalAberto.cliente_nome || cobrancaModalAberto.nome || 'Cliente'}
                  {cobrancaModalAberto.codcli ? ` (${cobrancaModalAberto.codcli})` : ''}
                </div>
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Documentos:</span>{' '}
                  <span className="font-bold text-red-600">
                    {cobrancaModalAberto.nroform || cobrancaModalAberto.numero_nf || cobrancaModalAberto.codfat}
                  </span>
                  {' · '}
                  <span className="font-semibold text-blue-600">
                    {(Number(cobrancaModalAberto.totalnf) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <DadosCobranca
                  statusVenda={{ cobranca: 'S' }}
                  bancos={bancos}
                  formCobranca={formCobranca}
                  setFormCobranca={setFormCobranca}
                  parcelas={parcelas}
                  setParcelas={setParcelas}
                  opcoesTipoFatura={opcoesTipoFatura}
                  totalNota={Number(cobrancaModalAberto.totalnf || 0)}
                  impostosTotal={Number(cobrancaModalAberto._impostos) || 0}
                  freteTotal={Number(cobrancaModalAberto._frete) || 0}
                  padraoAberto={true}
                  // Botão "Gerar Cobrança" no rodapé do card (onde ficava o preview do
                  // boleto). O fechamento é pelo X do modal — sem botão Cancelar.
                  botaoRodape={
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!parcelas.length) {
                            avisoErro('Gere ao menos uma parcela antes de salvar.');
                            return;
                          }
                          // ALTERAR PRAZO GP: cancela e recria a cobrança do grupo inteiro.
                          if (cobrancaModalAberto.__alterarGpCodgp) {
                            const resp = await axios.post('/api/faturamento/alterar-prazo-gp', {
                              codgp: cobrancaModalAberto.__alterarGpCodgp,
                              usuario: user?.usuario || '',
                              cobranca_dados: {
                                banco: formCobranca.banco,
                                tipofat: formCobranca.tipoFatura,
                                parcelas: parcelas.map((p) => ({
                                  vencimento: p.vencimento,
                                  valor: p.valor,
                                  dias: Number((p as any).dias) || 0,
                                })),
                              },
                            });
                            if (resp.status === 200) {
                              toast.success('Prazo do GP alterado com sucesso!');
                              setCobrancaModalAberto(null);
                              setParcelas([]);
                              setFaturasSelecionadas([]);
                              if (onAtualizarLista) onAtualizarLista();
                            }
                            return;
                          }
                          // Payload no formato que /salvar-cobranca espera:
                          // codcli + tipofat + parcelas com { vencimento, valor }.
                          const dadosCobranca = {
                            codfat: cobrancaModalAberto.codfat,
                            codcli: cobrancaModalAberto.codcli,
                            banco: formCobranca.banco,
                            tipofat: formCobranca.tipoFatura,
                            // Alterar = cancela os títulos atuais e gera os novos.
                            alterar: alterandoCobranca,
                            parcelas: parcelas.map((p) => ({
                              vencimento: p.vencimento,
                              valor: p.valor,
                              documento: null,
                            })),
                          };

                          const response = await axios.post('/api/faturamento/salvar-cobranca', dadosCobranca);

                          if (response.status === 200) {
                            toast.success(alterandoCobranca ? 'Cobrança alterada com sucesso!' : 'Cobrança gerada com sucesso!');
                            setCobrancaModalAberto(null);
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
                            if (onAtualizarLista) onAtualizarLista();
                          }
                        } catch (error: any) {
                          console.error('Erro ao salvar cobrança:', error);
                          avisoErro(
                            error.response?.data?.erro ||
                              error.response?.data?.error ||
                              error.response?.data?.message ||
                              'Erro ao gerar cobrança',
                          );
                        }
                      }}
                      disabled={!formCobranca.banco || !formCobranca.tipoFatura || !parcelas.length}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      Gerar Cobrança
                    </button>
                  }
                />
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

        {/* Enviar DANFE por email (compor email estilo Gmail) */}
        <ModalEnviarEmail
          open={!!emaildanfeModalAberto}
          onClose={() => setEmaildanfeModalAberto(null)}
          codfat={emaildanfeModalAberto?.codfat}
          codcli={emaildanfeModalAberto?.codcli}
          nomeCliente={emaildanfeModalAberto?.cliente_nome}
          numeroNota={emaildanfeModalAberto?.numero_nfe || emaildanfeModalAberto?.nroform}
          tipo="danfe"
        />

        {/* Enviar Cobrança por email */}
        <ModalEnviarEmail
          open={!!cobrancaEnviada}
          onClose={() => setCobrancaEnviada(null)}
          codfat={cobrancaEnviada?.codfat}
          codcli={cobrancaEnviada?.codcli}
          nomeCliente={cobrancaEnviada?.cliente_nome}
          numeroNota={cobrancaEnviada?.numero_nfe || cobrancaEnviada?.nroform}
          tipo="cobranca"
          // GP: anexa o Resumo GP quando a fatura pertence a um grupo de pagamento.
          codgp={cobrancaEnviada?.agp === 'S' ? cobrancaEnviada?.codgp : undefined}
        />
        
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
                          {formatarBRL(fatura.totalnf)}
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
                  Total: {formatarBRL(faturasDoGrupo.reduce((acc: number, f: any) => acc + Number(f.totalnf || 0), 0))}
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
