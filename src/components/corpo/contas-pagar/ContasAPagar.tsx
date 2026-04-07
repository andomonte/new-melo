import React, { useState, useEffect, ChangeEvent } from 'react';
import { useContasPagar, ContaPagar, FiltrosContasPagar } from '@/hooks/useContasPagar';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { Badge } from '@/components/ui/badge';
import Modal from '@/components/common/Modal';
import ModalNotasAssociadas from '@/components/common/ModalNotasAssociadas';
import ModalFiltrosExportacao from '@/components/common/ModalFiltrosExportacao';
import ModalExportarExcel from '@/components/common/modalExportarExcel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Autocomplete } from '@/components/common/Autocomplete';
import { toast } from 'sonner';
import { CheckCircle, Edit, XCircle, Eye, FileText, Plus, Filter, CalculatorIcon, DollarSign, History, ShoppingCart, Edit3, AlertTriangle } from 'lucide-react';
import DataTableContasPagar from '@/components/common/DataTableContasPagar';
import DropdownContasPagar from '@/components/common/DropdownContasPagar';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { Meta } from '@/data/common/meta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ModalSelecionarParcelas from '@/components/common/ModalSelecionarParcelas';
import { useModaisContasPagar } from './useModaisContasPagar';
import ModaisDashboard from './ModaisDashboard';
import BotoesAcaoHeader from './BotoesAcaoHeader';
import { formatarMoeda, formatarData, formatarDataHora, calcularDiasAtraso, obterCorStatus, obterTextoStatus } from './utils';

export function ContasAPagar() {
  
  const { contasPagar: contasPagarOriginal, paginacao, carregando, erro, consultarContasPagar: consultarOriginal, marcarComoPago, editarConta, cancelarConta } = useContasPagar();
  
  // Estado local para armazenar contas consolidadas (pendentes + pagos parcialmente)
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [todasContasConsolidadas, setTodasContasConsolidadas] = useState<ContaPagar[]>([]);
  const [paginacaoLocal, setPaginacaoLocal] = useState<{ total: number; totalPaginas: number } | null>(null);
  const [carregandoConsolidado, setCarregandoConsolidado] = useState(false);

  // Função para buscar contas com múltiplos status
  const consultarContasPagar = async (pagina: number, limite: number, filtrosBase: FiltrosContasPagar) => {
    setCarregandoConsolidado(true);
    try {
      // Se o usuário especificou um status específico no filtro, usar apenas ele
      if (filtrosBase.status) {
        setPaginacaoLocal(null); // Usar paginação da API
        const params = new URLSearchParams({
          page: pagina.toString(),
          limit: limite.toString(),
          ...filtrosBase as any
        });

        const response = await fetch(`/api/contas-pagar?${params}`);
        if (response.ok) {
          const data = await response.json();
          setContasPagar(data.contas_pagar || []);
          setTodasContasConsolidadas([]);
        } else {
          setContasPagar([]);
          setTodasContasConsolidadas([]);
        }
      } else {
        // Se não tem status específico, buscar pendentes, pago_parcial e pendente_parcial
        const statusParaBuscar = ['pendente', 'pago_parcial', 'pendente_parcial'];

        const promises = statusParaBuscar.map(status => {
          const filtrosComStatus = { ...filtrosBase, status };
          const params = new URLSearchParams({
            page: '1',
            limit: '10000',
            ...filtrosComStatus as any
          });

          return fetch(`/api/contas-pagar?${params}`)
            .then(res => res.ok ? res.json() : { contas_pagar: [] })
            .catch(() => ({ contas_pagar: [] }));
        });

        const results = await Promise.all(promises);
        const todasContas = results.flatMap(data => data.contas_pagar || []);

        // Remover duplicados pelo ID
        const contasUnicas = Array.from(
          new Map(todasContas.map((conta: ContaPagar) => [conta.id, conta])).values()
        ) as ContaPagar[];

        // Guardar todas as contas e calcular paginação local
        setTodasContasConsolidadas(contasUnicas);
        const total = contasUnicas.length;
        const totalPaginas = Math.ceil(total / limite);
        setPaginacaoLocal({ total, totalPaginas });

        // Aplicar paginação local
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite;
        setContasPagar(contasUnicas.slice(inicio, fim));
      }
    } catch (error) {
      console.error('Erro ao consultar contas:', error);
      setContasPagar([]);
      setTodasContasConsolidadas([]);
      setPaginacaoLocal(null);
    } finally {
      setCarregandoConsolidado(false);
    }
  };

  // Função para calcular início e fim da semana atual
  const calcularSemanaAtual = () => {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda, etc.
    
    // Início da semana (domingo)
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemana);
    inicioSemana.setHours(0, 0, 0, 0);
    
    // Fim da semana (sábado)
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    
    return {
      dataInicio: inicioSemana.toISOString().split('T')[0],
      dataFim: fimSemana.toISOString().split('T')[0]
    };
  };

  // Estados para paginação e filtros
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [limite, setLimite] = useState(20);
  const semanaAtual = calcularSemanaAtual();
  const [filtros, setFiltros] = useState<FiltrosContasPagar>({
    data_inicio: semanaAtual.dataInicio,
    data_fim: semanaAtual.dataFim
    // Não definir status inicial para mostrar pendentes e pagos parcialmente
  });

  // Colunas disponíveis para filtro dinâmico
  const colunasDisponiveis = [
    'cod_pgto',
    'tipo',
    'cod_credor',
    'cod_transp',
    'cod_conta',
    'cod_ccusto',
    'dt_venc',
    'dt_pgto',
    'dt_emissao',
    'valor_pgto',
    'valor_pago',
    'valor_juros',
    'nro_nf',
    'nro_dup',
    'obs',
    'banco',
    'codcomprador',
    'paga',
    'cancel',
    'eh_internacional',
    'moeda',
    'taxa_conversao',
    'valor_moeda',
    'nro_invoice',
    'nro_contrato',
    // 'possui_entrada'
  ];

  // Estados para modais (usando hook customizado)
  const modais = useModaisContasPagar();

  // Estados para notas associadas
  const [notasAssociadas, setNotasAssociadas] = useState<{
    titulo: any;
    notas: any[];
    resumo: any;
  } | null>(null);
  const [carregandoNotas, setCarregandoNotas] = useState(false);

  // Estados para exportação
  const [filtrosExportacao, setFiltrosExportacao] = useState({
    dataInicio: '',
    dataFim: '',
    status: 'todos',
  });
  const [exportando, setExportando] = useState(false);
  const [dadosParaExportar, setDadosParaExportar] = useState<ContaPagar[]>([]);
  const [colunasParaExportar, setColunasParaExportar] = useState<string[]>([]);

  // Estados para dados dinâmicos da API
  const [bancosDisponiveis, setBancosDisponiveis] = useState<{ value: string; label: string }[]>([]);
  const [contasDbconta, setContasDbconta] = useState<{ value: string; label: string }[]>([]);
  const [contaSelecionadaPgto, setContaSelecionadaPgto] = useState('');
  const [historicoPagamentos, setHistoricoPagamentos] = useState<{
    historico: any[];
    total_pago: number;
    qtd_pagamentos: number;
  } | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [detalhesParcela, setDetalhesParcela] = useState<any>(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);
  const [pagamentoParaCancelar, setPagamentoParaCancelar] = useState<any>(null);

  // Estados para formulários
  const [dataPagamento, setDataPagamento] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [valorJuros, setValorJuros] = useState('');
  const [bancoSelecionado, setBancoSelecionado] = useState('');
  const [formaPgto, setFormaPgto] = useState('');
  const [nroCheque, setNroCheque] = useState(''); // Número do cheque
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState('');
  const [contaBancariaSelecionada, setContaBancariaSelecionada] = useState('');
  const [obsPagamento, setObsPagamento] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [descricaoTitulo, setDescricaoTitulo] = useState('');
  const [dadosEdicao, setDadosEdicao] = useState({
    dt_venc: '',
    dt_emissao: '',
    valor_pgto: '',
    obs: '',
    nro_nf: '',
    nro_dup: '',
    cod_credor: '',
    cod_conta: '',
    cod_ccusto: ''
  });
  const [dadosValidacaoValor, setDadosValidacaoValor] = useState<{
    valorEsperado: number;
    valorDigitado: number;
    valorFaltara: number;
    diferenca: number;
    percentual: number;
  } | null>(null);

  // Estados para dados do resumo (cards informativos)
  const [resumoContas, setResumoContas] = useState<{
    cod_pgto: string;
    status: 'pendente' | 'pago' | 'pago_parcial' | 'cancelado';
    valor_pgto: number;
    valor_pago: number;
  }[]>([]);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  // Estados para filtros rápidos
  const [filtroCredor, setFiltroCredor] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'pago_parcial' | 'pago' | 'cancelado' | 'pendente_parcial' | ''>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  // Estados para filtro de range de data
  const [rangeDataAtivo, setRangeDataAtivo] = useState<'semana' | 'mes' | 'personalizado' | 'todos'>('semana');
  const [contasDaSemana, setContasDaSemana] = useState({ pendentes: 0, valorTotal: 0 });
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('');

  // Estados para modal de resultado do pagamento em lote
  const [modalResultadoPagamentoAberto, setModalResultadoPagamentoAberto] = useState(false);
  const [resultadoPagamento, setResultadoPagamento] = useState<{
    pagos: Array<{ id: string; nome_credor: string; valor: number }>;
    erros: Array<{ id: string; nome_credor: string; erro: string }>;
  }>({ pagos: [], erros: [] });

  // Estados para seleção múltipla e pagamento em lote
  // TODO: trocar o state para um autcomplete
  const [titulosSelecionados, setTitulosSelecionados] = useState<Set<string>>(new Set());
  const [modalPagamentoLoteAberto, setModalPagamentoLoteAberto] = useState(false);
  const [bancoLote, setBancoLote] = useState('');
  const [dataPagamentoLote, setDataPagamentoLote] = useState('');
  const [obsPagamentoLote, setObsPagamentoLote] = useState('');
  const [taxaConversaoInput, setTaxaConversaoInput] = useState('');
  const [valorPgtoInput, setValorPgtoInput] = useState('');
  const [modalKey, setModalKey] = useState(0);

  // Estados para nova conta
  const dataHoje = new Date().toISOString().split('T')[0];
  const [novaContaDados, setNovaContaDados] = useState({
    tipo: 'F' as 'F' | 'T',
    cod_credor: null as string | null,
    cod_transp: null as string | null,
    cod_conta: null as string | null,
    pag_cof_id: null as string | null,
    cod_ccusto: null as string | null,
    cod_comprador: null as string | null,
    dt_emissao: dataHoje,
    dt_venc: dataHoje,
    valor_pgto: 0,
    nro_nf: '',
    tem_nota: false,
    obs: '',
    tem_cobr: false,
    nro_dup: '',
    parcelado: false,
    num_parcelas: 1,
    intervalo_dias: 30,
    banco: null as string | null,
    // Campos para pagamento internacional
    eh_internacional: false,
    moeda: '',
    taxa_conversao: 0,
    valor_moeda: 0,
    nro_invoice: '',
    nro_contrato: '',
    // possui_entrada: false,
  });

  const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string }[]>([]);
  const [prazoSelecionado, setPrazoSelecionado] = useState('');

  // Função para limpar dados do modal de nova conta
  const limparDadosNovaConta = () => {
    const dataHojeReset = new Date().toISOString().split('T')[0];
    const novosDados: typeof novaContaDados = {
      tipo: 'F' as 'F' | 'T',
      cod_credor: null,
      cod_transp: null,
      cod_conta: null,
      pag_cof_id: null,
      cod_ccusto: null,
      cod_comprador: null,
      dt_emissao: dataHojeReset,
      dt_venc: dataHojeReset,
      valor_pgto: 0,
      nro_nf: '',
      tem_nota: false,
      obs: '',
      tem_cobr: false,
      nro_dup: '',
      parcelado: false,
      num_parcelas: 1,
      intervalo_dias: 30,
      banco: null,
      eh_internacional: false,
      moeda: '',
      taxa_conversao: 0,
      valor_moeda: 0,
      nro_invoice: '',
      nro_contrato: '',
      // possui_entrada: false,
    };
    setNovaContaDados(novosDados);
    setTaxaConversaoInput('');
    setValorPgtoInput('');
    setParcelas([]);
    setPrazoSelecionado('');
    // Forçar re-renderização dos componentes Autocomplete
    const novoModalKey = Math.random(); // Usar Math.random para garantir unicidade
    setModalKey(novoModalKey);
  };

  // Headers da tabela (adicionar mais colunas conforme dbpgto)
  const headers = [
    'Ações',
    'Status',
    '☑️',  // Checkbox
    'ID',
    'Tipo',
    'Fornecedor',
    'Emissão',
    'Vencimento', 
    'Pagamento',
    'Valor Total',
    'Valor Pago',
    'Juros',
    'Nº NF',
    'Nº Duplicata',
    'Banco',
    'Ordem Compra',
    'Centro Custo',
    'Conta',
    'Comprador',
    'Internacional',
    'Moeda',
    'Taxa Conversão',
    'Valor Moeda',
    'Nº Invoice',
    'Nº Contrato',
    'Obs',
    // 'Possui Entrada',
  ];

  // Converter paginação para formato Meta (usa paginação local quando busca múltiplos status)
  const paginacaoAtual = paginacaoLocal || paginacao;
  const meta: Meta = {
    total: paginacaoAtual?.total || 0,
    lastPage: paginacaoAtual?.totalPaginas || 1,
    currentPage: paginaAtual,
    perPage: limite,
    to: Math.min(paginaAtual * limite, paginacaoAtual?.total || 0),
    from: ((paginaAtual - 1) * limite) + 1
  };

  // Função para buscar resumo (dados para os cards)
  const buscarResumo = async (filtrosAplicados: FiltrosContasPagar) => {
    setCarregandoResumo(true);
    try {
      const params = new URLSearchParams();
      
      Object.entries(filtrosAplicados).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') {
          params.append(chave, String(valor));
        }
      });

      const response = await fetch(`/api/contas-pagar/resumo?${params.toString()}`);
      const data = await response.json();
      
      if (data.sucesso) {
        // Converter valores para número
        const dadosProcessados = data.dados.map((conta: any) => ({
          ...conta,
          valor_pgto: parseFloat(conta.valor_pgto) || 0,
          valor_pago: parseFloat(conta.valor_pago) || 0,
          valor_juros: parseFloat(conta.valor_juros) || 0,
        }));
        console.log('📊 Resumo carregado:', dadosProcessados.length, 'contas');
        setResumoContas(dadosProcessados);
      }
    } catch (error) {
      console.error('Erro ao buscar resumo:', error);
    } finally {
      setCarregandoResumo(false);
    }
  };

  // Efeito para buscar dados quando filtros mudam
  useEffect(() => {
    consultarContasPagar(paginaAtual, limite, filtros);
    buscarResumo(filtros);
  }, [filtros]);

  // Efeito para aplicar paginação local quando página ou limite mudam (sem refazer busca)
  useEffect(() => {
    if (todasContasConsolidadas.length > 0 && !filtros.status) {
      // Temos dados consolidados, aplicar paginação local
      const total = todasContasConsolidadas.length;
      const totalPaginas = Math.ceil(total / limite);
      setPaginacaoLocal({ total, totalPaginas });

      const inicio = (paginaAtual - 1) * limite;
      const fim = inicio + limite;
      setContasPagar(todasContasConsolidadas.slice(inicio, fim));
    } else if (filtros.status) {
      // Status específico, buscar via API
      consultarContasPagar(paginaAtual, limite, filtros);
    }
  }, [paginaAtual, limite]);

  // Calcular contas do período ativo (semana/mês/personalizado)
  useEffect(() => {
    const calcularContasDoPeriodo = async () => {
      try {
        const hoje = new Date();
        let dataInicio: string;
        let dataFim: string;

        if (rangeDataAtivo === 'semana') {
          const inicioSemana = new Date(hoje);
          inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
          const fimSemana = new Date(inicioSemana);
          fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado
          dataInicio = inicioSemana.toISOString().split('T')[0];
          dataFim = fimSemana.toISOString().split('T')[0];
        } else if (rangeDataAtivo === 'mes') {
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          dataInicio = inicioMes.toISOString().split('T')[0];
          dataFim = fimMes.toISOString().split('T')[0];
        } else if (rangeDataAtivo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
          dataInicio = dataInicioPersonalizada;
          dataFim = dataFimPersonalizada;
        } else if (rangeDataAtivo === 'todos') {
          // Para 'todos', buscar sem filtro de data, apenas com status
          const statusPendentes = ['pendente', 'pago_parcial', 'pendente_parcial'];
          const promises = statusPendentes.map(status =>
            fetch(`/api/contas-pagar?status=${status}&limite=1000`)
              .then(res => res.ok ? res.json() : { contas_pagar: [] })
          );

          const results = await Promise.all(promises);
          const todasContas = results.flatMap(data => data.contas_pagar || []);
          
          // Remover duplicados pelo ID
          const contasUnicas = Array.from(
            new Map(todasContas.map(conta => [conta.id, conta])).values()
          );
          
          const valorTotal = contasUnicas.reduce((acc: number, conta: any) => {
            const valorPendente = Number(conta.valor_pgto) - Number(conta.valor_pago || 0);
            return acc + valorPendente;
          }, 0);

          setContasDaSemana({
            pendentes: contasUnicas.length,
            valorTotal
          });
          return;
        } else {
          // Se não tiver configuração válida, não calcular
          setContasDaSemana({ pendentes: 0, valorTotal: 0 });
          return;
        }

        // Se há filtro de status específico, usar apenas ele
        // Senão, buscar contas pendentes e pagas parcialmente
        let contasUnicas: any[];
        
        if (filtros.status) {
          // Usar o status específico do filtro
          const response = await fetch(
            `/api/contas-pagar?data_inicio=${dataInicio}&data_fim=${dataFim}&status=${filtros.status}&limite=1000`
          );
          
          if (response.ok) {
            const data = await response.json();
            contasUnicas = data.contas_pagar || [];
          } else {
            contasUnicas = [];
          }
        } else {
          // Buscar múltiplos status (pendentes e pagos parcialmente)
          const statusPendentes = ['pendente', 'pago_parcial', 'pendente_parcial'];
          const promises = statusPendentes.map(status =>
            fetch(`/api/contas-pagar?data_inicio=${dataInicio}&data_fim=${dataFim}&status=${status}&limite=1000`)
              .then(res => res.ok ? res.json() : { contas_pagar: [] })
          );

          const results = await Promise.all(promises);
          const todasContas = results.flatMap(data => data.contas_pagar || []);
          
          // Remover duplicados pelo ID
          contasUnicas = Array.from(
            new Map(todasContas.map(conta => [conta.id, conta])).values()
          );
        }
        
        const valorTotal = contasUnicas.reduce((acc: number, conta: any) => {
          const valorPendente = Number(conta.valor_pgto) - Number(conta.valor_pago || 0);
          return acc + valorPendente;
        }, 0);

        setContasDaSemana({
          pendentes: contasUnicas.length,
          valorTotal
        });
      } catch (error) {
        console.error('Erro ao calcular contas do período:', error);
      }
    };

    calcularContasDoPeriodo();
  }, [rangeDataAtivo, dataInicioPersonalizada, dataFimPersonalizada, filtros.status, contasPagar]); // Recalcular quando mudar o período, status ou a lista

  // Aplicar filtro de range de data automaticamente
  useEffect(() => {
    const hoje = new Date();
    let novosFiltros = { ...filtros };

    if (rangeDataAtivo === 'semana') {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado

      novosFiltros.data_inicio = inicioSemana.toISOString().split('T')[0];
      novosFiltros.data_fim = fimSemana.toISOString().split('T')[0];
    } else if (rangeDataAtivo === 'mes') {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      novosFiltros.data_inicio = inicioMes.toISOString().split('T')[0];
      novosFiltros.data_fim = fimMes.toISOString().split('T')[0];
    } else if (rangeDataAtivo === 'personalizado') {
      // Usar datas personalizadas se ambas estiverem preenchidas
      if (dataInicioPersonalizada && dataFimPersonalizada) {
        novosFiltros.data_inicio = dataInicioPersonalizada;
        novosFiltros.data_fim = dataFimPersonalizada;
      } else {
        // Se não tiver datas, remover filtros
        delete novosFiltros.data_inicio;
        delete novosFiltros.data_fim;
      }
    } else {
      // Remover filtros de data
      delete novosFiltros.data_inicio;
      delete novosFiltros.data_fim;
    }

    setFiltros(novosFiltros);
    setPaginaAtual(1);
  }, [rangeDataAtivo, dataInicioPersonalizada, dataFimPersonalizada]);

  // Buscar bancos disponíveis da API
  useEffect(() => {
    async function carregarBancos() {
      try {
        const response = await fetch('/api/contas-pagar/bancos');
        if (response.ok) {
          const bancos = await response.json();
          setBancosDisponiveis(bancos);
        } else {
          console.error('Erro ao buscar bancos:', await response.text());
          toast.error('Erro ao carregar lista de bancos');
        }
      } catch (error) {
        console.error('Erro ao buscar bancos:', error);
        toast.error('Erro ao carregar lista de bancos');
      }
    }
    carregarBancos();
  }, []);

  // Buscar contas do dbconta para o modal de pagamento
  useEffect(() => {
    async function carregarContasDbconta() {
      try {
        const response = await fetch('/api/contas-pagar/contas-dbconta');
        if (response.ok) {
          const data = await response.json();
          const contas = (data.contas || []).map((conta: any) => ({
            value: conta.value || conta.cod_conta,
            label: conta.label || `${conta.cod_conta} - ${conta.descricao || conta.nome || ''}`
          }));
          setContasDbconta(contas);
        } else {
          console.error('Erro ao buscar contas:', await response.text());
        }
      } catch (error) {
        console.error('Erro ao buscar contas:', error);
      }
    }
    carregarContasDbconta();
  }, []);

  // ✅ OTIMIZAÇÃO 8: Atalhos de Teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl + N = Nova Conta
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        modais.setModalNovaContaAberto(true);
      }

      // Esc = Fechar modais
      if (e.key === 'Escape') {
        if (modais.modalNovaContaAberto) {
          // Para o modal de nova conta, limpar dados antes de fechar
          limparDadosNovaConta();
        }
        modais.fecharTodosModais();
      }

      // Ctrl + S = Salvar (dentro dos modais)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (modais.modalPagoAberto) {
          handleMarcarPago();
        } else if (modais.modalNovaContaAberto) {
          handleCriarNovaConta();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    modais.modalPagoAberto,
    modais.modalCancelarAberto,
    modais.modalEditarAberto,
    modais.modalDetalhesAberto,
    modais.modalGerarTituloAberto,
    modais.modalNovaContaAberto
  ]);

  const aplicarFiltros = () => {
    const novosFiltros: FiltrosContasPagar = {};
    
    if (filtroCredor) novosFiltros.credor = filtroCredor;
    if (filtroStatus) novosFiltros.status = filtroStatus;
    if (filtroDataInicio) novosFiltros.data_inicio = filtroDataInicio;
    if (filtroDataFim) novosFiltros.data_fim = filtroDataFim;
    
    setFiltros(novosFiltros);
    setPaginaAtual(1);
    
    toast.success('Filtros aplicados com sucesso!', {
      position: 'top-right',
    });
  };

  const limparFiltros = () => {
    setFiltroCredor('');
    setFiltroStatus('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltros({});
    setPaginaAtual(1);
    
    toast.info('Filtros limpos', {
      position: 'top-right',
    });
  };

  // Funções de seleção múltipla
  const toggleSelecionarTitulo = (idTitulo: string) => {
    setTitulosSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(idTitulo)) {
        novo.delete(idTitulo);
      } else {
        novo.add(idTitulo);
      }
      return novo;
    });
  };

  const toggleSelecionarTodos = () => {
    // Filtrar apenas títulos pendentes (incluindo vencidos)
    const titulosPendentes = contasPagar.filter(c => {
      return c.status !== 'pago' && c.status !== 'cancelado';
    });
    
    if (titulosSelecionados.size === titulosPendentes.length) {
      setTitulosSelecionados(new Set());
    } else {
      setTitulosSelecionados(new Set(titulosPendentes.map(c => c.id.toString())));
    }
  };

  const limparSelecao = () => {
    setTitulosSelecionados(new Set());
  };

  const abrirModalPagamentoLote = () => {
    if (titulosSelecionados.size === 0) {
      toast.error('Selecione pelo menos um título para pagamento');
      return;
    }
    setModalPagamentoLoteAberto(true);
  };

  const getTitulosSelecionadosDetalhes = () => {
    return contasPagar.filter(c => titulosSelecionados.has(c.id.toString()));
  };

  const calcularTotalSelecionado = () => {
    const titulos = getTitulosSelecionadosDetalhes();
    return titulos.reduce((acc, t) => {
      const valorPago = Number(t.valor_pago || 0);
      const valorTotal = Number(t.valor_pgto);
      const saldoRestante = valorTotal - valorPago;
      return acc + saldoRestante;
    }, 0);
  };

  const handlePagamentoLote = async () => {
    if (!bancoLote || !dataPagamentoLote) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const titulos = getTitulosSelecionadosDetalhes();
    
    const pagos: Array<{ id: string; nome_credor: string; valor: number }> = [];
    const errosLista: Array<{ id: string; nome_credor: string; erro: string }> = [];

    toast.loading(`Processando pagamento de ${titulos.length} título(s)...`, { id: 'pagamento-lote' });

    for (const conta of titulos) {
      try {
        // Calcular saldo restante: valor original - valor já pago
        const valorPago = Number(conta.valor_pago || 0);
        const valorTotal = Number(conta.valor_pgto);
        const saldoRestante = valorTotal - valorPago;

        // Se já está totalmente pago, pular
        if (saldoRestante <= 0.01) {
          errosLista.push({
            id: conta.id.toString(),
            nome_credor: conta.nome_credor || conta.nome_exibicao || 'Credor não informado',
            erro: 'Título já está totalmente pago'
          });
          continue;
        }

        // Pagar apenas o saldo restante (permite títulos vencidos)
        const response = await fetch(`/api/contas-pagar/${conta.id}/marcar-pago`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dt_pgto: dataPagamentoLote,
            valor_pago: saldoRestante,
            valor_juros: 0,
            banco: bancoLote,
            cod_conta: bancoLote, // Usar conta ao invés de banco
            obs: obsPagamentoLote || 'Pagamento em lote',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          errosLista.push({
            id: conta.id.toString(),
            nome_credor: conta.nome_credor || conta.nome_exibicao || 'Credor não informado',
            erro: errorData.erro || 'Erro desconhecido'
          });
        } else {
          pagos.push({
            id: conta.id.toString(),
            nome_credor: conta.nome_credor || conta.nome_exibicao || 'Credor não informado',
            valor: saldoRestante
          });
        }
      } catch (error: any) {
        errosLista.push({
          id: conta.id.toString(),
          nome_credor: conta.nome_credor || conta.nome_exibicao || 'Credor não informado',
          erro: error.message
        });
      }
    }

    toast.dismiss('pagamento-lote');

    // Atualizar lista de contas
    consultarContasPagar(paginaAtual, limite, filtros);

    // Fechar modal de pagamento e abrir modal de resultado
    setModalPagamentoLoteAberto(false);
    limparSelecao();
    setBancoLote('');
    setDataPagamentoLote('');
    setObsPagamentoLote('');

    // Mostrar modal com resultado
    setResultadoPagamento({ pagos, erros: errosLista });
    setModalResultadoPagamentoAberto(true);
  };

  const handleFiltroAvancado = (filtrosDinamicos: { campo: string; tipo: string; valor: string }[]) => {
    console.log('🔍 Filtros dinâmicos recebidos:', filtrosDinamicos);
    
    // Converter filtros dinâmicos para o formato da API
    const novosFiltros: FiltrosContasPagar = {};
    
    // Lista de campos que estão sendo atualizados nesta chamada
    const camposAtualizados = new Set<string>();
    
    filtrosDinamicos.forEach(filtro => {
      const { campo, tipo, valor } = filtro;
      console.log(`  📋 Processando: campo="${campo}", tipo="${tipo}", valor="${valor}"`);
      
      // Mapeamento de campos (considerando headers lowercase)
      switch (campo) {
        case 'id':
        case 'cod_pgto':
          novosFiltros.cod_pgto = valor;
          camposAtualizados.add('cod_pgto');
          break;
          
        case 'credor':
        case 'cod_credor':
        case 'nome_credor':
          novosFiltros.credor = valor;
          camposAtualizados.add('credor');
          break;
          break;
          
        case 'tipo':
          novosFiltros.tipo = valor as 'F' | 'T';
          break;
          
        case 'nº nf':
        case 'nro_nf':
          novosFiltros.nro_nf = valor;
          break;
          
        case 'nº duplicata':
        case 'nro_dup':
          novosFiltros.nro_dup = valor;
          break;
          
        case 'banco':
          novosFiltros.banco = valor;
          break;
          
        case 'ordem compra':
        case 'ordem_compra':
          novosFiltros.ordem_compra = valor;
          break;
          
        case 'centro custo':
        case 'cod_ccusto':
          novosFiltros.cod_ccusto = valor;
          break;
          
        case 'comprador':
        case 'codcomprador':
          novosFiltros.codcomprador = valor;
          break;
          
        case 'conta':
        case 'cod_conta':
          novosFiltros.conta = valor;
          break;
        
        case 'status':
          novosFiltros.status = valor as 'pendente' | 'pago_parcial' | 'pago' | 'cancelado' | 'pendente_parcial';
          camposAtualizados.add('status');
          break;
          
        case 'paga':
          if (valor === 'S') novosFiltros.status = 'pago';
          else if (valor === 'N') novosFiltros.status = 'pendente';
          break;
          
        case 'cancel':
          if (valor === 'S') novosFiltros.status = 'cancelado';
          break;
          
        case 'vencimento':
        case 'dt_venc':
          if (tipo === 'maior' || tipo === 'maior_igual' || tipo === 'igual') {
            novosFiltros.data_inicio = valor;
          }
          if (tipo === 'menor' || tipo === 'menor_igual' || tipo === 'igual') {
            novosFiltros.data_fim = valor;
          }
          break;
          
        case 'emissão':
        case 'emissao':
        case 'dt_emissao':
          // Pode adicionar filtro de data de emissão se necessário na API
          break;
          
        case 'valor total':
        case 'valor_pgto':
          const valorNum = parseFloat(valor);
          if (!isNaN(valorNum)) {
            if (tipo === 'maior' || tipo === 'maior_igual') {
              novosFiltros.valor_min = valorNum;
            }
            if (tipo === 'menor' || tipo === 'menor_igual') {
              novosFiltros.valor_max = valorNum;
            }
            if (tipo === 'igual') {
              novosFiltros.valor_min = valorNum;
              novosFiltros.valor_max = valorNum;
            }
          }
          break;
      }
    });
    
    console.log('🔍 Filtros convertidos para API:', novosFiltros);
    console.log('📋 Filtros existentes antes de mesclar:', filtros);
    
    // Mesclar novos filtros com os existentes
    const filtrosMesclados = { ...filtros };
    
    // Para campos atualizados, se o valor está vazio, remover do objeto
    // Se não está vazio, adicionar/atualizar
    Object.keys(novosFiltros).forEach(key => {
      const valor = novosFiltros[key as keyof FiltrosContasPagar];
      if (valor === '' || valor === undefined || valor === null) {
        delete filtrosMesclados[key as keyof FiltrosContasPagar];
      } else {
        (filtrosMesclados as any)[key] = valor;
      }
    });
    
    console.log('✅ Filtros mesclados final:', filtrosMesclados);
    
    setFiltros(filtrosMesclados);
    setPaginaAtual(1);
    
    toast.success('Filtros aplicados!', {
      position: 'top-right',
    });
  };

  // Formatar taxa de conversão: 626 -> "6,26" (display)
  const formatarTaxaConversao = (valor: string): string => {
    // Remove tudo exceto números
    const numeros = valor.replace(/[^0-9]/g, '');
    if (!numeros) return '';
    
    // Converte para número e divide por 100
    const numero = parseInt(numeros);
    const resultado = (numero / 100).toFixed(4);
    return resultado.replace('.', ',');
  };

  // Converter taxa formatada para número do banco: "6,26" -> 6.2600
  const taxaParaBanco = (valorFormatado: string): number => {
    const numero = parseFloat(valorFormatado.replace(',', '.'));
    return isNaN(numero) ? 0 : parseFloat(numero.toFixed(4));
  };

  // Obter ícone da moeda
  const obterIconeMoeda = (moeda: string): string => {
    const icones: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CHF': 'CHF',
      'CAD': 'C$',
      'AUD': 'A$',
      'BRL': 'R$'
    };
    return icones[moeda] || moeda;
  };

  // Formatar valor monetário para exibição: 1234.56 -> "1.234,56"
  const formatarValorParaInput = (valor: number | string): string => {
    if (!valor || valor === '0' || valor === 0) return '';
    const num = typeof valor === 'string' ? parseFloat(valor) : valor;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Converter valor formatado para número: "1.234,56" -> 1234.56
  const valorFormatadoParaNumero = (valorFormatado: string): number => {
    if (!valorFormatado) return 0;
    const valorSemPontos = valorFormatado.replace(/\./g, '');
    const valorComPonto = valorSemPontos.replace(',', '.');
    return parseFloat(valorComPonto) || 0;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
      case 'pago_parcial':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Pago Parcialmente</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-500 hover:bg-red-600">Cancelado</Badge>;
      default:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
    }
  };

  // Preparar dados no formato que o DataTable espera
  const prepararDadosTabela = () => {
    return contasPagar.map(conta => {
      const vencido = conta.dt_venc && new Date(conta.dt_venc) < new Date() && conta.status === 'pendente';
      const idStr = conta.id.toString();
      const isSelecionado = titulosSelecionados.has(idStr);
      const podeSelecionar = conta.status !== 'pago' && conta.status !== 'cancelado';
      
      const getTipoTexto = (tipo: string) => {
        switch (tipo) {
          case 'F': return 'Fornecedor';
          case 'T': return 'Transporte';
          default: return tipo;
        }
      };
      
      // Retornar array na mesma ordem dos headers
      return [
        // Ações
        (
          <DropdownContasPagar
            conta={conta}
            onVisualizarClick={() => abrirModalDetalhes(conta)}
            onMarcarPagoClick={() => abrirModalPago(conta)}
            onEditarClick={() => abrirModalEditar(conta)}
            onCancelarClick={() => abrirModalCancelar(conta)}
            onGerarTituloClick={() => abrirModalGerarTitulo(conta)}
            onHistoricoClick={() => abrirModalHistorico(conta)}
            onVerParcelasClick={() => abrirModalParcelas(conta)}
            onExportarIndividualClick={() => exportarContaIndividual(conta)}
            onVerNotasAssociadasClick={() => abrirModalNotasAssociadas(conta)}
            onVerObservacoesClick={() => abrirModalObservacoes(conta)}
          />
        ),
        // Status
        getStatusBadge(conta.status),
        // ☑️ - Checkbox
        podeSelecionar ? (
          <input
            type="checkbox"
            checked={isSelecionado}
            onChange={() => toggleSelecionarTitulo(idStr)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
          />
        ) : (
          <span className="text-gray-300 dark:text-gray-600">-</span>
        ),
        // ID
        <span className="font-mono text-sm">{conta.id}</span>,
        // Tipo
        (
          <Badge variant="outline" className="text-xs">
            {getTipoTexto(conta.tipo || '')}
          </Badge>
        ),
        // Credor
        (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {conta.tipo === 'T' ? conta.cod_transp : conta.cod_credor}
                </span>
                {" - "}
                {conta.nome_exibicao || conta.nome_credor}
              </span>
              {conta.parcela_atual && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Parcela {conta.parcela_atual}
                </Badge>
              )}
            </div>
          </div>
        ),
        // Emissão
        (
          <span className="text-sm">
            {formatarData(conta.dt_emissao)}
          </span>
        ),
        // Vencimento
        (
          <span className={vencido ? 'text-red-600 font-semibold' : 'text-sm'}>
            {formatarData(conta.dt_venc)}
            {vencido && <div className="text-xs text-red-500">Vencido</div>}
          </span>
        ),
        // Pagamento
        (
          <span className="text-sm">
            {conta.dt_pgto ? formatarData(conta.dt_pgto) : '-'}
          </span>
        ),
        // Valor Total
        <span className="font-mono font-medium">{formatarMoeda(conta.valor_pgto)}</span>,
        // Valor Pago
        (
          <span className="font-mono text-sm text-green-600">
            {conta.total_pago_historico ? formatarMoeda(conta.total_pago_historico) : '-'}
          </span>
        ),
        // Juros
        (
          <span className="font-mono text-sm text-orange-600">
            {conta.valor_juros ? formatarMoeda(conta.valor_juros) : '-'}
          </span>
        ),
        // Nº NF
        <span className="text-sm">{conta.nro_nf || '-'}</span>,
        // Nº Duplicata
        (
          <span className="text-sm font-mono">{conta.nro_dup || '-'}</span>
        ),
        // Banco
        (
          <span className="text-sm">
            {conta.banco ? (
              <>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{conta.banco}</span>
                {conta.nome_banco && (
                  <>
                    {" - "}
                    <span className="text-gray-900 dark:text-white">{conta.nome_banco}</span>
                  </>
                )}
              </>
            ) : '-'}
          </span>
        ),
        // Ordem Compra
        (
          <span className="text-sm font-mono text-blue-600">
            {conta.ordem_compra ? `#${conta.ordem_compra}` : '-'}
          </span>
        ),
        // Centro Custo
        (
          <span className="text-sm">
            {conta.cod_ccusto ? (
              <>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{conta.cod_ccusto}</span>
                {conta.descricao_ccusto && (
                  <>
                    {" - "}
                    <span className="text-gray-900 dark:text-white">{conta.descricao_ccusto}</span>
                  </>
                )}
              </>
            ) : '-'}
          </span>
        ),
        // Conta
        <span className="text-sm">{conta.descricao_conta}</span>,
        // Comprador
        (
          <span className="text-sm">
            {conta.codcomprador ? (
              <>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{conta.codcomprador}</span>
                {conta.nome_comprador && (
                  <>
                    {" - "}
                    <span className="text-gray-900 dark:text-white">{conta.nome_comprador}</span>
                  </>
                )}
              </>
            ) : '-'}
          </span>
        ),
        // Internacional
        (
          <Badge variant={conta.eh_internacional === 'S' ? 'default' : 'secondary'} className="text-xs">
            {conta.eh_internacional === 'S' ? 'Sim' : 'Não'}
          </Badge>
        ),
        // Moeda
        <span className="text-sm font-mono">{conta.moeda || '-'}</span>,
        // Taxa Conversão
        (
          <span className="text-sm font-mono">
            {conta.taxa_conversao ? conta.taxa_conversao.toFixed(4) : '-'}
          </span>
        ),
        // Valor Moeda
        (
          <span className="text-sm font-mono">
            {conta.valor_moeda ? formatarMoeda(conta.valor_moeda) : '-'}
          </span>
        ),
        // Nº Invoice
        <span className="text-sm font-mono">{conta.nro_invoice || '-'}</span>,
        // Nº Contrato
        <span className="text-sm font-mono">{conta.nro_contrato || '-'}</span>,
        // Obs
        (
          <div className="max-w-[200px]" title={conta.obs || undefined}>
            <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 break-words">
              {conta.obs || '-'}
            </span>
          </div>
        ),
        // Possui Entrada
        // (
        //   <Badge variant={conta.possui_entrada ? 'default' : 'secondary'} className="text-xs">
        //     {conta.possui_entrada ? 'Sim' : 'Não'}
        //   </Badge>
        // ),
      ];
    });
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setTermoBusca(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Aplicar busca geral
      const novosFiltros = { ...filtros };
      if (termoBusca) {
        novosFiltros.search = termoBusca;
      } else {
        delete novosFiltros.search;
      }
      setFiltros(novosFiltros);
      setPaginaAtual(1);
    }
  };

  const abrirModalPago = async (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    
    // Se não for parcelada, seguir fluxo normal
    abrirFormularioPagamento(conta);
  };

  // Nova função para abrir o formulário de pagamento (separada para ser reutilizada)
  const abrirFormularioPagamento = async (conta: ContaPagar) => {
    // ✅ OTIMIZAÇÃO 1: Auto-preencher data atual
    setDataPagamento(new Date().toISOString().split('T')[0]);
    
    // ✅ OTIMIZAÇÃO 2: Auto-preencher com saldo restante (valor total - já pago)
    const valorOriginal = parseFloat(conta.valor_pgto.toString());
    const totalJaPago = parseFloat(conta.total_pago_historico?.toString() || '0');
    const saldoRestante = valorOriginal - totalJaPago;
    setValorPago(formatarValorParaInput(saldoRestante));
    
    // ✅ OTIMIZAÇÃO 4: Lembrar última forma de pagamento usada
    const ultimaForma = localStorage.getItem('ultimaFormaPgto') || '001'; // Dinheiro como padrão
    setFormaPgto(ultimaForma);
    
    setCentroCustoSelecionado(conta.cod_ccusto?.toString() || '');
    setObsPagamento(conta.obs || '');
    setNroCheque('');
    
    // ✅ OTIMIZAÇÃO 5: Buscar conta bancária e banco preferencial do credor
    const codCredor = conta.cod_credor || (conta as any).cod_transp;
    if (codCredor) {
      try {
        const response = await fetch(`/api/contas-pagar/conta-preferencial?cod_credor=${codCredor}`);
        if (response.ok) {
          const data = await response.json();
          
          // Preencher conta bancária preferencial
          if (data.cod_conta) {
            setContaBancariaSelecionada(data.cod_conta);
            console.log(`✅ Conta preferencial: ${data.cod_conta} (${data.cod_conta_uso} usos)`);
          } else {
            setContaBancariaSelecionada(conta.cod_conta?.toString() || '');
          }
          
          // Preencher banco preferencial
          if (data.banco) {
            setBancoSelecionado(data.banco);
            console.log(`✅ Banco preferencial: ${data.banco} (${data.banco_uso} usos)`);
            
            // Mostrar toast informativo
            toast.info(
              `Banco "${data.banco}" auto-selecionado (usado ${data.banco_uso}x por este credor)`,
              { position: 'top-right', duration: 3000 }
            );
          } else {
            setBancoSelecionado(conta.banco || '');
          }
        } else {
          setContaBancariaSelecionada(conta.cod_conta?.toString() || '');
          setBancoSelecionado(conta.banco || '');
        }
      } catch (error) {
        console.error('Erro ao buscar preferências do credor:', error);
        setContaBancariaSelecionada(conta.cod_conta?.toString() || '');
        setBancoSelecionado(conta.banco || '');
      }
    } else {
      setContaBancariaSelecionada(conta.cod_conta?.toString() || '');
      setBancoSelecionado(conta.banco || '');
    }
    
    // ✅ OTIMIZAÇÃO 3: Calcular juros automaticamente ao abrir modal
    if (conta.dt_venc) {
      try {
        const valorOriginal = parseFloat(conta.valor_pgto.toString());
        const totalJaPago = parseFloat(conta.total_pago_historico?.toString() || '0');
        const saldoRestante = valorOriginal - totalJaPago;
        
        const response = await fetch('/api/contas-pagar/calcular-juros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valor_pgto: saldoRestante,
            dt_venc: conta.dt_venc,
            taxa_juros: 8
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setValorJuros(formatarValorParaInput(data.valor_juros));
          
          // Se houver juros, somar ao saldo restante
          if (data.valor_juros > 0) {
            const valorTotal = saldoRestante + parseFloat(data.valor_juros.toString());
            setValorPago(formatarValorParaInput(valorTotal));
          }
          
          if (data.dias_atraso > 0) {
            toast.info(
              `Título com ${data.dias_atraso} dias de atraso. Juros: R$ ${data.valor_juros.toFixed(2)}`,
              { position: 'top-right', duration: 5000 }
            );
          }
        } else {
          setValorJuros('0');
        }
      } catch (error) {
        console.error('Erro ao calcular juros:', error);
        setValorJuros('0');
      }
    } else {
      setValorJuros('0');
    }
    
    modais.setContaSelecionada(conta);
    modais.setModalPagoAberto(true);
  };

  const abrirModalEditar = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    setDadosEdicao({
      dt_venc: conta.dt_venc || '',
      dt_emissao: conta.dt_emissao || '',
      valor_pgto: conta.valor_pgto.toString(),
      obs: conta.obs || '',
      nro_nf: conta.nro_nf || '',
      nro_dup: conta.nro_dup || '',
      cod_credor: conta.cod_credor?.toString() || '',
      cod_conta: conta.cod_conta?.toString() || '',
      cod_ccusto: conta.cod_ccusto?.toString() || ''
    });
    modais.setModalEditarAberto(true);
  };

  const abrirModalCancelar = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    setMotivoCancelamento('');
    modais.setModalCancelarAberto(true);
  };

  const abrirModalDetalhes = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    modais.setModalDetalhesAberto(true);
  };

  const abrirModalDashboard = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    modais.setModalDashboardAberto(true);
  };

  const abrirModalDashboardGeral = () => {
    modais.setModalDashboardGeralAberto(true);
  };

  const abrirModalHistorico = async (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    setCarregandoHistorico(true);
    modais.setModalHistoricoAberto(true);
    
    try {
      // Buscar histórico da parcela específica usando o cod_pgto (id) da conta
      const response = await fetch(`/api/contas-pagar/${conta.id}/historico`);
      if (!response.ok) throw new Error('Erro ao carregar histórico');
      
      const data = await response.json();
      setHistoricoPagamentos(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast.error('Erro ao carregar histórico de pagamentos desta parcela');
      modais.setModalHistoricoAberto(false);
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const abrirModalObservacoes = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    modais.setModalObservacoesAberto(true);
  };

  const abrirModalParcelas = async (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    setCarregandoDetalhes(true);
    modais.setModalParcelasAberto(true);
    
    try {
      // Buscar detalhes completos da parcela específica
      const response = await fetch(`/api/contas-pagar/${conta.id}`);
      if (!response.ok) throw new Error('Erro ao carregar detalhes');
      
      const data = await response.json();
      setDetalhesParcela(data.conta);
    } catch (error) {
      console.error('Erro ao buscar detalhes da parcela:', error);
      toast.error('Erro ao carregar detalhes desta parcela');
      modais.setModalParcelasAberto(false);
    } finally {
      setCarregandoDetalhes(false);
    }
  };

  // Nova função: Ao selecionar uma parcela, abrir o modal de pagamento
  const handleParcelaSelecionada = async (parcela: any) => {
    if (!modais.contaSelecionada) {
      console.error('Conta selecionada não encontrada');
      toast.error('Erro ao selecionar parcela');
      return;
    }

    // Criar objeto ContaPagar temporário com os dados da parcela
    const contaParcela: ContaPagar = {
      ...modais.contaSelecionada,
      id: parcela.cod_pgto,
      valor_pgto: Number(parcela.valor_pgto) || 0,
      valor_pago: Number(parcela.valor_pago) || 0,
      dt_venc: parcela.dt_venc || '',
      nro_dup: parcela.nro_dup || '',
    };

    modais.setContaSelecionada(contaParcela);
    await abrirFormularioPagamento(contaParcela);
  };

  // Nova função: Exportar Excel individual da conta com histórico e parcelas
  const exportarContaIndividual = async (conta: ContaPagar) => {
    try {
      setExportando(true);
      
      // Buscar histórico de pagamentos
      const historicoResponse = await fetch(`/api/contas-pagar/${conta.id}/historico`);
      const historicoData = historicoResponse.ok ? await historicoResponse.json() : { historico: [], total_pago: 0 };
      
      // Buscar parcelas
      const parcelasResponse = await fetch(`/api/contas-pagar/${conta.id}/parcelas`);
      const parcelasData = parcelasResponse.ok ? await parcelasResponse.json() : { parcelas: [], total_parcelas: 0 };
      
      // Importar ExcelJS dinamicamente
      const ExcelJS = await import('exceljs');
      
      // Criar workbook
      const workbook = new ExcelJS.Workbook();
      
      // ===== ABA 1: Dados da Conta Principal =====
      const wsDados = workbook.addWorksheet('Dados da Conta');
      
      // Definir larguras das colunas
      wsDados.columns = [
        { width: 25 },
        { width: 35 },
      ];
      
      // Título principal
      wsDados.mergeCells('A1:B1');
      const tituloCell = wsDados.getCell('A1');
      tituloCell.value = `CONTA A PAGAR - ${conta.id}`;
      tituloCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
      wsDados.getRow(1).height = 30;
      
      // Dados principais
      const dadosPrincipais = [
        ['Código', conta.id],
        ['Tipo', conta.tipo === 'F' ? 'Fornecedor' : conta.tipo === 'T' ? 'Transporte' : '-'],
        ['Fornecedor', conta.nome_exibicao || conta.nome_credor || '-'],
        ['Parcela', conta.parcela_atual ? `Parcela ${conta.parcela_atual}` : '-'],
        ['', ''],
        ['Valor Total', `R$ ${Number(conta.valor_pgto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Valor Pago', `R$ ${Number(conta.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Saldo Restante', `R$ ${(Number(conta.valor_pgto || 0) - Number(conta.valor_pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Status', conta.status === 'pago' ? 'Pago' : conta.status === 'pendente' ? 'Pendente' : conta.status === 'pago_parcial' ? 'Parcial' : 'Cancelado'],
        ['', ''],
        ['Data Emissão', conta.dt_emissao ? formatarData(conta.dt_emissao) : '-'],
        ['Data Vencimento', conta.dt_venc ? formatarData(conta.dt_venc) : '-'],
        ['Data Pagamento', conta.dt_pgto ? formatarData(conta.dt_pgto) : '-'],
        ['', ''],
        ['Nº NF', conta.nro_nf || '-'],
        ['Nº Duplicata', conta.nro_dup || '-'],
        ['Banco/Conta', conta.banco || '-'],
        ['Centro de Custo', conta.descricao_ccusto || '-'],
        ['Conta Contábil', conta.descricao_conta || '-'],
        ['', ''],
        ['Internacional', conta.eh_internacional === 'S' ? 'Sim' : 'Não'],
        ...(conta.eh_internacional === 'S' ? [
          ['Moeda', conta.moeda || '-'],
          ['Taxa Conversão', conta.taxa_conversao || '-'],
          ['Nº Invoice', conta.nro_invoice || '-'],
          ['Nº Contrato', conta.nro_contrato || '-'],
        ] : []),
        ['', ''],
        ['Observações', conta.obs || '-'],
      ];
      
      dadosPrincipais.forEach((linha, index) => {
        const rowNum = index + 2;
        wsDados.getCell(`A${rowNum}`).value = linha[0];
        wsDados.getCell(`B${rowNum}`).value = linha[1];
        
        // Estilizar labels
        if (linha[0]) {
          wsDados.getCell(`A${rowNum}`).font = { bold: true };
          wsDados.getCell(`A${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
        
        // Bordas
        ['A', 'B'].forEach(col => {
          const cell = wsDados.getCell(`${col}${rowNum}`);
          if (linha[0]) {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          }
        });
      });
      
      // ===== ABA 2: Histórico de Pagamentos =====
      const wsHistorico = workbook.addWorksheet('Histórico Pagamentos');
      
      wsHistorico.columns = [
        { header: 'Data Pagamento', key: 'dt_pgto', width: 15 },
        { header: 'Valor Pago', key: 'valor_pgto', width: 15 },
        { header: 'Forma Pagamento', key: 'forma_pgto', width: 18 },
        { header: 'Juros', key: 'juros', width: 12 },
        { header: 'Multa', key: 'multa', width: 12 },
        { header: 'Desconto', key: 'desconto', width: 12 },
        { header: 'Conta', key: 'conta', width: 15 },
        { header: 'Cancelado', key: 'cancelado', width: 10 },
      ];
      
      // Estilizar cabeçalho
      wsHistorico.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      wsHistorico.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      wsHistorico.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      wsHistorico.getRow(1).height = 20;
      
      if (historicoData.historico && historicoData.historico.length > 0) {
        historicoData.historico.forEach((h: any) => {
          wsHistorico.addRow({
            dt_pgto: h.dt_pgto ? formatarData(h.dt_pgto) : '-',
            valor_pgto: `R$ ${Number(h.valor_pgto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            forma_pgto: h.cod_fpgto || '-',
            juros: `R$ ${Number(h.juros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            multa: `R$ ${Number(h.multa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            desconto: `R$ ${Number(h.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            conta: h.cod_conta || '-',
            cancelado: h.cancel === 'S' ? 'Sim' : 'Não',
          });
        });
        
        // Aplicar zebra e bordas
        wsHistorico.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            if (rowNumber % 2 === 0) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            }
            row.eachCell((cell) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
          }
        });
      } else {
        wsHistorico.addRow({ dt_pgto: 'Nenhum histórico de pagamento encontrado' });
      }
      
      // ===== ABA 3: Parcelas =====
      const wsParcelas = workbook.addWorksheet('Parcelas');
      
      wsParcelas.columns = [
        { header: 'Código', key: 'cod_pgto', width: 12 },
        { header: 'Parcela', key: 'parcela', width: 15 },
        { header: 'Valor Parcela', key: 'valor_pgto', width: 15 },
        { header: 'Valor Pago', key: 'valor_pago', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Data Vencimento', key: 'dt_venc', width: 15 },
        { header: 'Data Pagamento', key: 'dt_pgto', width: 15 },
        { header: 'Nº Duplicata', key: 'nro_dup', width: 15 },
      ];
      
      // Estilizar cabeçalho
      wsParcelas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      wsParcelas.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      wsParcelas.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      wsParcelas.getRow(1).height = 20;
      
      if (parcelasData.parcelas && parcelasData.parcelas.length > 0) {
        parcelasData.parcelas.forEach((p: any) => {
          wsParcelas.addRow({
            cod_pgto: p.cod_pgto || '-',
            parcela: p.nro_parcela || '-',
            valor_pgto: `R$ ${Number(p.valor_pgto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            valor_pago: `R$ ${Number(p.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            status: p.paga === 'S' ? 'Pago' : (p.cancel === 'S' ? 'Cancelado' : 'Pendente'),
            dt_venc: p.dt_venc ? formatarData(p.dt_venc) : '-',
            dt_pgto: p.dt_pgto ? formatarData(p.dt_pgto) : '-',
            nro_dup: p.nro_dup || '-',
          });
        });
        
        // Aplicar zebra e bordas
        wsParcelas.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            if (rowNumber % 2 === 0) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            }
            row.eachCell((cell) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
          }
        });
      } else {
        wsParcelas.addRow({ cod_pgto: 'Esta conta não possui parcelas' });
      }
      
      // Gerar e baixar o arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const nomeArquivo = `Conta_${conta.id}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Excel exportado com sucesso! ${historicoData.historico?.length || 0} pagamento(s) e ${parcelasData.parcelas?.length || 0} parcela(s)`);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    } finally {
      setExportando(false);
    }
  };

  const abrirModalGerarTitulo = (conta: ContaPagar) => {
    modais.setContaSelecionada(conta);
    setBancoSelecionado('');
    setDescricaoTitulo('');
    modais.setModalGerarTituloAberto(true);
  };

  const abrirModalNotasAssociadas = async (conta: ContaPagar) => {
    try {
      setCarregandoNotas(true);
      modais.setModalNotasAssociadasAberto(true);

      console.log('🔍 Buscando notas associadas ao título:', conta.id);

      const response = await fetch(`/api/contas-pagar/notas-associadas?cod_pgto=${conta.id}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar notas associadas');
      }

      const data = await response.json();
      setNotasAssociadas(data);

    } catch (error) {
      console.error('❌ Erro ao buscar notas associadas:', error);
      toast.error('Erro ao carregar notas associadas');
      modais.setModalNotasAssociadasAberto(false);
    } finally {
      setCarregandoNotas(false);
    }
  };

  const handleCancelarPagamento = async () => {
    if (!pagamentoParaCancelar || !modais.contaSelecionada) return;

    try {
      const response = await fetch('/api/contas-pagar/cancelar-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_pgto: modais.contaSelecionada.id,
          fpg_cof_id: pagamentoParaCancelar.fpg_cof_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.erro || 'Erro ao cancelar pagamento');
      }

      toast.success('Pagamento cancelado com sucesso!', { position: 'top-right' });
      
      // Recarregar histórico
      await abrirModalHistorico(modais.contaSelecionada);
      
      // Recarregar lista de contas
      await consultarContasPagar(paginaAtual, limite, filtros);
      
      modais.setModalCancelarPagamentoAberto(false);
      setPagamentoParaCancelar(null);
    } catch (error: any) {
      console.error('Erro ao cancelar pagamento:', error);
      toast.error(error.message || 'Erro ao cancelar pagamento', { position: 'top-right' });
    }
  };

  const handleMarcarPago = async () => {
    if (!modais.contaSelecionada) return;

    // Validações
    if (!dataPagamento) {
      toast.error('Data de pagamento é obrigatória', { position: 'top-right' });
      return;
    }
    
    const valorPagoNumero = valorFormatadoParaNumero(valorPago);
    if (!valorPago || valorPagoNumero <= 0) {
      toast.error('Valor pago deve ser maior que zero', { position: 'top-right' });
      return;
    }

    if (!formaPgto) {
      toast.error('Selecione a forma de pagamento', { position: 'top-right' });
      return;
    }

    if (formaPgto === '002' && !nroCheque) {
      toast.error('Número do cheque é obrigatório', { position: 'top-right' });
      return;
    }

    // ✅ OTIMIZAÇÃO 7: Validação inteligente de valores
    const valorOriginal = parseFloat(modais.contaSelecionada.valor_pgto.toString());
    const totalJaPago = parseFloat(modais.contaSelecionada.total_pago_historico?.toString() || '0');
    const saldoRestante = valorOriginal - totalJaPago; // Saldo restante atual
    const valorDigitado = valorFormatadoParaNumero(valorPago);
    const valorJurosNum = valorFormatadoParaNumero(valorJuros) || 0;

    // Cálculo correto: quanto faltará após este pagamento
    const totalPagoAposPagamento = totalJaPago + valorDigitado + valorJurosNum;
    const faltaraAposPagamento = Math.max(0, valorOriginal - totalPagoAposPagamento);
    const diferenca = Math.abs(faltaraAposPagamento);

    // Percentual baseado no valor original da conta
    const percentualDiferenca = valorOriginal > 0 ? (diferenca / valorOriginal) * 100 : 0;

    // Se ainda faltará valor significativo após o pagamento, mostrar modal de confirmação
    if (faltaraAposPagamento > 1.00) { // Se faltar mais de R$ 1,00
      setDadosValidacaoValor({
        valorEsperado: saldoRestante, // Saldo atual
        valorDigitado,
        valorFaltara: faltaraAposPagamento, // Quanto faltará após este pagamento
        diferenca: faltaraAposPagamento,
        percentual: percentualDiferenca
      });
      modais.setModalConfirmacaoValor(true);
      return;
    }

    // Continuar com o pagamento
    await processarPagamento();
  };

  // Função separada para processar o pagamento
  const processarPagamento = async () => {
    if (!modais.contaSelecionada) return;

    // Determinar tp_pgto baseado na forma de pagamento
    const tipoPgtoMap: Record<string, string> = {
      '001': 'D', // Dinheiro
      '002': 'C', // Cheque
      '003': 'P', // PIX
      '004': 'T', // Transferência
      '005': 'R', // Cartão Crédito
      '006': 'E', // Cartão Débito
      '007': 'B', // Boleto
    };

    try {
      // Capturar username do sessionStorage
      const perfilUserMelo = sessionStorage.getItem('perfilUserMelo');
      const userInfo = perfilUserMelo ? JSON.parse(perfilUserMelo) : null;
      const username = userInfo?.usuario || 'Sistema';

      await marcarComoPago(modais.contaSelecionada.id, {
        dt_pgto: dataPagamento,
        valor_pago: valorFormatadoParaNumero(valorPago),
        obs: obsPagamento || modais.contaSelecionada.obs,
        banco: bancoSelecionado || null,
        forma_pgto: formaPgto, // cod_fpgto para registrar em DBFPGTO
        tp_pgto: tipoPgtoMap[formaPgto] || 'D', // Tipo de pagamento
        nro_cheque: formaPgto === '002' ? nroCheque : null, // Apenas se for cheque
        cod_ccusto: centroCustoSelecionado || modais.contaSelecionada.cod_ccusto?.toString() || null,
        valor_juros: valorFormatadoParaNumero(valorJuros) || 0,
        cod_conta: contaSelecionadaPgto || contaBancariaSelecionada || modais.contaSelecionada.cod_conta?.toString() || null,
        username: username // Nome do usuário logado
      });

      // ✅ OTIMIZAÇÃO: Salvar última forma de pagamento usada
      localStorage.setItem('ultimaFormaPgto', formaPgto);

      toast.success('Conta marcada como paga e forma de pagamento registrada!', {
        position: 'top-right',
      });

      modais.setModalPagoAberto(false);
      // Limpar formulário
      setDataPagamento('');
      setValorPago('');
      setValorJuros('');
      setBancoSelecionado('');
      setFormaPgto('');
      setNroCheque('');
      setCentroCustoSelecionado('');
      setContaBancariaSelecionada('');
      setContaSelecionadaPgto('');
      setObsPagamento('');
      
      consultarContasPagar(paginaAtual, limite, filtros);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao marcar conta como paga', {
        position: 'top-right',
      });
    }
  };

  const handleEditar = async () => {
    if (!modais.contaSelecionada) return;

    try {
      await editarConta(modais.contaSelecionada.id, {
        dt_venc: dadosEdicao.dt_venc || undefined,
        dt_emissao: dadosEdicao.dt_emissao || undefined,
        valor_pgto: parseFloat(dadosEdicao.valor_pgto) || undefined,
        obs: dadosEdicao.obs || undefined,
        nro_nf: dadosEdicao.nro_nf || undefined,
        nro_dup: dadosEdicao.nro_dup || undefined,
        cod_credor: dadosEdicao.cod_credor ? parseInt(dadosEdicao.cod_credor) : undefined,
        cod_conta: dadosEdicao.cod_conta ? parseInt(dadosEdicao.cod_conta) : undefined,
        cod_ccusto: dadosEdicao.cod_ccusto ? parseInt(dadosEdicao.cod_ccusto) : undefined
      });

      toast.success('Conta atualizada com sucesso!', {
        position: 'top-right',
      });

      modais.setModalEditarAberto(false);
      consultarContasPagar(paginaAtual, limite, filtros);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao editar conta', {
        position: 'top-right',
      });
    }
  };

  const handleCancelar = async () => {
    if (!modais.contaSelecionada) return;

    try {
      await cancelarConta(modais.contaSelecionada.id, motivoCancelamento);

      toast.success('Conta cancelada com sucesso!', {
        position: 'top-right',
      });

      modais.setModalCancelarAberto(false);
      consultarContasPagar(paginaAtual, limite, filtros);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar conta', {
        position: 'top-right',
      });
    }
  };

  const handleGerarTitulo = async () => {
    if (!modais.contaSelecionada || !bancoSelecionado) return;

    try {
      const response = await fetch('/api/contas-pagar/gerar-titulo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_conta: modais.contaSelecionada.id,
          banco: bancoSelecionado,
          descricao: descricaoTitulo || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || `Erro HTTP: ${response.status}`);
      }

      if (data.sucesso && data.boleto) {
        toast.success(`Título gerado com sucesso! Linha digitável: ${data.boleto.linhaDigitavel}`, {
          position: 'top-right',
          duration: 5000,
        });

        // TODO: Abrir visualizador de boleto ou modal com os dados
        console.log('Boleto gerado:', data.boleto);
      }

      modais.setModalGerarTituloAberto(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar título', {
        position: 'top-right',
      });
    }
  };

  const handleCriarNovaConta = async () => {
    try {
      console.log('Estado atual novaContaDados:', novaContaDados);
      
      // Validação básica
      if (!novaContaDados.tipo) {
        toast.error('Selecione o tipo de conta (Fornecedor ou Transportadora)', {
          position: 'top-right',
        });
        return;
      }

      if (novaContaDados.tipo === 'F' && !novaContaDados.cod_credor) {
        console.log('Validação falhou - cod_credor:', novaContaDados.cod_credor);
        toast.error('Informe o código do fornecedor', {
          position: 'top-right',
        });
        return;
      }

      if (novaContaDados.tipo === 'T' && !novaContaDados.cod_transp) {
        toast.error('Informe o código da transportadora', {
          position: 'top-right',
        });
        return;
      }

      if (!novaContaDados.cod_conta) {
        toast.error('Selecione a conta', {
          position: 'top-right',
        });
        return;
      }

      if (!novaContaDados.dt_venc) {
        toast.error('Informe a data de vencimento', {
          position: 'top-right',
        });
        return;
      }

      if (!novaContaDados.valor_pgto || novaContaDados.valor_pgto <= 0) {
        toast.error('Informe um valor válido', {
          position: 'top-right',
        });
        return;
      }

      if (novaContaDados.parcelado && parcelas.length === 0) {
        toast.error('Adicione ao menos uma parcela', {
          position: 'top-right',
        });
        return;
      }

      const response = await fetch('/api/contas-pagar/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...novaContaDados,
          parcelas: novaContaDados.parcelado ? parcelas : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || `Erro HTTP: ${response.status}`);
      }

      if (data.sucesso) {
        toast.success('Conta criada com sucesso!', {
          position: 'top-right',
        });

        // Limpar formulário
        limparDadosNovaConta();

        modais.setModalNovaContaAberto(false);
        consultarContasPagar(paginaAtual, limite, filtros); // Recarregar lista
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta', {
        position: 'top-right',
      });
    }
  };

  // Função para abrir modal de exportação com filtros
  const handleAbrirExportacao = () => {
    modais.setModalExportarAberto(true);
  };

  // Função para confirmar filtros e exportar
  const handleConfirmarExportacao = () => {
    modais.setModalExportarAberto(false);
    
    // Filtrar contas com base nos filtros selecionados
    let contasFiltradas = [...contasPagar];

    // Filtrar por data
    if (filtrosExportacao.dataInicio) {
      contasFiltradas = contasFiltradas.filter(conta => {
        if (!conta.dt_venc) return false;
        const dataVenc = new Date(conta.dt_venc);
        const dataInicio = new Date(filtrosExportacao.dataInicio);
        return dataVenc >= dataInicio;
      });
    }

    if (filtrosExportacao.dataFim) {
      contasFiltradas = contasFiltradas.filter(conta => {
        if (!conta.dt_venc) return false;
        const dataVenc = new Date(conta.dt_venc);
        const dataFim = new Date(filtrosExportacao.dataFim);
        return dataVenc <= dataFim;
      });
    }

    // Filtrar por status
    if (filtrosExportacao.status !== 'todos') {
      if (filtrosExportacao.status === 'parcial') {
        contasFiltradas = contasFiltradas.filter(conta => conta.status === 'pago_parcial');
      } else {
        contasFiltradas = contasFiltradas.filter(conta => conta.paga === filtrosExportacao.status);
      }
    }

    if (contasFiltradas.length === 0) {
      toast.warning('Nenhuma conta encontrada com os filtros selecionados', {
        position: 'top-right',
      });
      return;
    }

    // Preparar colunas para exportação
    const colunasParaExportar = [
      'id',
      'dt_venc',
      'valor_pgto',
      'valor_pago',
      'nro_dup',
      'nro_nf',
      'nome_credor',
      'status',
      'paga',
      'obs',
    ];

    // Abrir modal de seleção de colunas
    setDadosParaExportar(contasFiltradas);
    setColunasParaExportar(colunasParaExportar);
    modais.setModalSelecaoColunas(true);
  };

  // Função para exportar diretamente com filtros aplicados
  const handleExportarDireto = async () => {
    try {
      setExportando(true);

      // Construir filtros incluindo range de data ativo
      let filtrosExport = { ...filtros };

      // Aplicar filtro de range de data se estiver ativo
      const hoje = new Date();
      if (rangeDataAtivo === 'semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);
        filtrosExport.data_inicio = inicioSemana.toISOString().split('T')[0];
        filtrosExport.data_fim = fimSemana.toISOString().split('T')[0];
      } else if (rangeDataAtivo === 'mes') {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        filtrosExport.data_inicio = inicioMes.toISOString().split('T')[0];
        filtrosExport.data_fim = fimMes.toISOString().split('T')[0];
      } else if (rangeDataAtivo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
        filtrosExport.data_inicio = dataInicioPersonalizada;
        filtrosExport.data_fim = dataFimPersonalizada;
      }

      // Buscar TODOS os registros da API com os filtros aplicados (sem paginação)
      const params = new URLSearchParams();
      
      Object.entries(filtrosExport).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') {
          params.append(chave, String(valor));
        }
      });

      // Não aplicar paginação para exportar tudo (usar parâmetros em inglês que a API espera)
      params.append('limit', '999999'); // Buscar todos os registros
      params.append('page', '1');

      const response = await fetch(`/api/contas-pagar?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados para exportação');
      }

      const resultado = await response.json();
      const contasFiltradas = resultado.contas_pagar || resultado.contas || [];

      if (contasFiltradas.length === 0) {
        toast.warning('Nenhuma conta encontrada para exportar', {
          position: 'top-right',
        });
        setExportando(false);
        return;
      }

      // Importar biblioteca ExcelJS dinamicamente
      const ExcelJS = await import('exceljs');

      // Criar workbook e worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contas a Pagar');

      // Definir colunas com cabeçalhos
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Data Vencimento', key: 'dt_venc', width: 15 },
        { header: 'Data Pagamento', key: 'dt_pgto', width: 15 },
        { header: 'Parcela', key: 'parcela', width: 15 },
        { header: 'Valor', key: 'valor_pgto', width: 15 },
        { header: 'Valor Pago', key: 'valor_pago', width: 15 },
        { header: 'Nº Duplicata', key: 'nro_dup', width: 15 },
        { header: 'Nº NF', key: 'nro_nf', width: 15 },
        { header: 'Fornecedor', key: 'nome_exibicao', width: 30 },
        { header: 'Conta', key: 'descricao_conta', width: 25 },
        { header: 'Centro de Custo', key: 'descricao_ccusto', width: 25 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Pago', key: 'paga', width: 8 },
        { header: 'Banco', key: 'banco', width: 15 },
        { header: 'Internacional', key: 'eh_internacional', width: 12 },
        { header: 'Moeda', key: 'moeda', width: 10 },
        { header: 'Observações', key: 'obs', width: 30 },
      ];

      // Estilizar linha de cabeçalho
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }, // Azul
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 20;

      // Adicionar bordas ao cabeçalho
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Adicionar dados
      contasFiltradas.forEach((conta: ContaPagar) => {
        worksheet.addRow({
          id: conta.id,
          dt_venc: conta.dt_venc ? formatarData(conta.dt_venc) : '',
          dt_pgto: conta.dt_pgto ? formatarData(conta.dt_pgto) : '',
          parcela: conta.parcela_atual || '',
          valor_pgto: Number(conta.valor_pgto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          valor_pago: Number(conta.valor_pago || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          nro_dup: conta.nro_dup || '',
          nro_nf: conta.nro_nf || '',
          nome_exibicao: conta.nome_exibicao || conta.nome_credor || '',
          descricao_conta: conta.descricao_conta || '',
          descricao_ccusto: conta.descricao_ccusto || '',
          status: conta.status === 'pago' ? 'Pago' : conta.status === 'pendente' ? 'Pendente' : conta.status === 'pago_parcial' ? 'Parcial' : conta.status === 'cancelado' ? 'Cancelado' : '',
          paga: conta.paga === 'S' ? 'Sim' : 'Não',
          banco: conta.banco || '',
          eh_internacional: conta.eh_internacional === 'S' ? 'Sim' : 'Não',
          moeda: conta.moeda || '',
          obs: conta.obs || '',
        });
      });

      // Aplicar bordas e formatação alternada nas linhas de dados
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          // Aplicar cor de fundo alternada
          if (rowNumber % 2 === 0) {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0F0F0' }, // Cinza claro
            };
          }

          // Aplicar bordas
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
        }
      });

      // Gerar arquivo e download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `contas-pagar-${dataAtual}.xlsx`;

      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Arquivo ${nomeArquivo} exportado com sucesso! (${contasFiltradas.length} registros)`, {
        position: 'top-right',
      });

    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar dados para Excel', {
        position: 'top-right',
      });
    } finally {
      setExportando(false);
    }
  };

  // Função para exportar para Excel
  const handleExportarExcel = async (colunasSelecionadas: string[]) => {
    try {
      setExportando(true);

      // Importar biblioteca XLSX dinamicamente
      const XLSX = await import('xlsx');

      // Preparar dados para exportação
      const dadosFormatados = dadosParaExportar.map(conta => {
        const row: any = {};

        colunasSelecionadas.forEach(coluna => {
          switch (coluna) {
            case 'id':
              row['ID'] = conta.id;
              break;
            case 'dt_venc':
              row['Data Vencimento'] = conta.dt_venc ? new Date(conta.dt_venc).toLocaleDateString('pt-BR') : '';
              break;
            case 'valor_pgto':
              row['Valor'] = Number(conta.valor_pgto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              break;
            case 'valor_pago':
              row['Valor Pago'] = Number(conta.valor_pago || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              break;
            case 'nro_dup':
              row['Nº Duplicata'] = conta.nro_dup || '';
              break;
            case 'nro_nf':
              row['Nº NF'] = conta.nro_nf || '';
              break;
            case 'nome_credor':
              row['Fornecedor'] = conta.nome_credor || '';
              break;
            case 'status':
              row['Status'] = conta.status === 'pago' ? 'Pago' : conta.status === 'pendente' ? 'Pendente' : conta.status === 'pago_parcial' ? 'Parcial' : conta.status === 'cancelado' ? 'Cancelado' : '';
              break;
            case 'paga':
              row['Pago'] = conta.paga === 'S' ? 'Sim' : 'Não';
              break;
            case 'obs':
              row['Observações'] = conta.obs || '';
              break;
            default:
              row[coluna] = (conta as any)[coluna];
          }
        });

        return row;
      });

      // Criar planilha
      const ws = XLSX.utils.json_to_sheet(dadosFormatados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');

      // Gerar arquivo e download
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `contas-pagar-${dataAtual}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      toast.success(`Arquivo ${nomeArquivo} exportado com sucesso!`, {
        position: 'top-right',
      });

      modais.setModalSelecaoColunas(false);
      setDadosParaExportar([]);
      setColunasParaExportar([]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao exportar dados', {
        position: 'top-right',
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header com título e ações */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">
              Contas a Pagar
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {rangeDataAtivo === 'semana' && 'Da semana: '}
              {rangeDataAtivo === 'mes' && 'Do mês: '}
              {rangeDataAtivo === 'personalizado' && 'Do período: '}
              {rangeDataAtivo === 'todos' && 'Total: '}
              <strong>{contasDaSemana.pendentes}</strong> pagar (pendente) - <strong>R$ {contasDaSemana.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </p>
          </div>

          <div className="flex gap-2 items-center">
            {/* Botões de filtro por período */}
            <div className="flex gap-1 border border-gray-300 dark:border-gray-600 rounded-md p-1">
              <button
                onClick={() => setRangeDataAtivo('semana')}
                className={`px-3 py-1 text-xs rounded transition ${
                  rangeDataAtivo === 'semana'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setRangeDataAtivo('mes')}
                className={`px-3 py-1 text-xs rounded transition ${
                  rangeDataAtivo === 'mes'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => setRangeDataAtivo('personalizado')}
                className={`px-3 py-1 text-xs rounded transition ${
                  rangeDataAtivo === 'personalizado'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Personalizado
              </button>
              <button
                onClick={() => setRangeDataAtivo('todos')}
                className={`px-3 py-1 text-xs rounded transition ${
                  rangeDataAtivo === 'todos'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Inputs de data personalizada */}
            {rangeDataAtivo === 'personalizado' && (
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={dataInicioPersonalizada}
                  onChange={(e) => setDataInicioPersonalizada(e.target.value)}
                  className="w-36 h-8 text-xs"
                  placeholder="Data Início"
                />
                <span className="text-gray-500 dark:text-gray-400">até</span>
                <Input
                  type="date"
                  value={dataFimPersonalizada}
                  onChange={(e) => setDataFimPersonalizada(e.target.value)}
                  className="w-36 h-8 text-xs"
                  placeholder="Data Fim"
                />
              </div>
            )}

            {titulosSelecionados.size > 0 && (
              <DefaultButton
                variant="secondary"
                size="default"
                onClick={abrirModalPagamentoLote}
                icon={<ShoppingCart className="w-4 h-4" />}
                text={`Pagar (${titulosSelecionados.size})`}
                className="relative"
              />
            )}
            <DefaultButton
              variant="primary"
              size="default"
              onClick={() => {
                modais.setModalNovaContaAberto(true);
              }}
              icon={<Plus className="w-4 h-4" />}
              text="Novo"
            />
          </div>
        </div>

        {/* Container da tabela com altura calculada */}
        <div className="flex-1 min-h-20 flex flex-col">
          <DataTableContasPagar
            headers={headers}
            rows={prepararDadosTabela()}
            meta={meta}
            onPageChange={setPaginaAtual}
            onPerPageChange={(perPage) => {
              setLimite(perPage);
              setPaginaAtual(1);
            }}
            onSearch={handleSearch}
            onSearchKeyDown={handleSearchKeyDown}
            searchInputPlaceholder="Buscar (ID, credor, NF, duplicata...)"
            loading={carregandoConsolidado}
            noDataMessage="Nenhuma conta a pagar encontrada"
            onFiltroChange={handleFiltroAvancado}
            colunasFiltro={colunasDisponiveis}
            onExportarExcel={handleExportarDireto}
          />
        </div>
      </main>

      {/* Modal Pagamento em Lote */}
      <Modal
        isOpen={modalPagamentoLoteAberto}
        onClose={() => {
          setModalPagamentoLoteAberto(false);
          setBancoLote('');
          setDataPagamentoLote('');
          setObsPagamentoLote('');
        }}
        title="Pagamento em Lote"
        width="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2"
      >
        <div className="space-y-4">
          {/* Resumo dos Títulos Selecionados */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
              📋 Resumo dos Títulos Selecionados
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">Quantidade de títulos:</span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">{titulosSelecionados.size}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">Valor total:</span>
                <span className="font-bold text-lg text-blue-900 dark:text-blue-100">
                  {formatarMoeda(calcularTotalSelecionado())}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Títulos */}
          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Credor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Vencimento</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Valor Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Já Pago</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-green-700 dark:text-green-400">A Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {getTitulosSelecionadosDetalhes().map((titulo) => {
                  const valorPago = Number(titulo.valor_pago || 0);
                  const valorTotal = Number(titulo.valor_pgto);
                  const saldoRestante = valorTotal - valorPago;
                  
                  return (
                    <tr key={titulo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-2 font-mono text-xs">{titulo.id}</td> 
                      <td className="px-3 py-2 text-xs truncate max-w-[150px]">{titulo.nome_credor}</td>
                      <td className="px-3 py-2 text-xs">{formatarData(titulo.dt_venc)}</td>
                      <td className="px-3 py-2 text-xs text-right">{formatarMoeda(valorTotal)}</td>
                      <td className="px-3 py-2 text-xs text-right text-orange-600 dark:text-orange-400">
                        {valorPago > 0 ? formatarMoeda(valorPago) : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-bold text-green-700 dark:text-green-400">
                        {formatarMoeda(saldoRestante)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Formulário de Pagamento */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data-pagamento-lote">Data do Pagamento *</Label>
                <Input
                  id="data-pagamento-lote"
                  type="date"
                  value={dataPagamentoLote}
                  onChange={(e) => setDataPagamentoLote(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="banco-lote">Conta *</Label>
                <Select value={bancoLote} onValueChange={setBancoLote}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bancosDisponiveis.map(banco => (
                      <SelectItem key={banco.value} value={banco.value}>
                        {banco.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="obs-lote">Observações</Label>
              <Textarea
                id="obs-lote"
                name="obs-lote"
                value={obsPagamentoLote}
                onChange={(e) => setObsPagamentoLote(e.target.value)}
                placeholder="Observações sobre o pagamento em lote..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              size="default"
              onClick={() => {
                setModalPagamentoLoteAberto(false);
                limparSelecao();
              }}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              size="default"
              onClick={handlePagamentoLote}
              text={`Confirmar Pagamento (${titulosSelecionados.size})`}
              disabled={!bancoLote || !dataPagamentoLote}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Resultado do Pagamento em Lote */}
      <Modal
        isOpen={modalResultadoPagamentoAberto}
        onClose={() => {
          setModalResultadoPagamentoAberto(false);
          setResultadoPagamento({ pagos: [], erros: [] });
        }}
        title="Resultado do Pagamento em Lote"
        width="w-11/12 md:w-3/4 lg:w-2/3"
      >
        <div className="space-y-6">
          {/* Títulos Pagos com Sucesso */}
          {resultadoPagamento.pagos.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pagos com Sucesso ({resultadoPagamento.pagos.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultadoPagamento.pagos.map((pago, index) => (
                  <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border border-green-300 dark:border-green-700">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        #{pago.id} - {pago.nome_credor}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Valor: R$ {pago.valor.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erros no Pagamento */}
          {resultadoPagamento.erros.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Erros e Falhas ({resultadoPagamento.erros.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultadoPagamento.erros.map((erro, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border border-red-300 dark:border-red-700">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          #{erro.id} - {erro.nome_credor}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {erro.erro}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {resultadoPagamento.pagos.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pagos</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {resultadoPagamento.erros.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Falhas</p>
              </div>
            </div>
          </div>

          {/* Botão Fechar */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="primary"
              size="default"
              onClick={() => {
                setModalResultadoPagamentoAberto(false);
                setResultadoPagamento({ pagos: [], erros: [] });
              }}
              text="Fechar"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Marcar como Pago */}
      <Modal
        isOpen={modais.modalPagoAberto}
        onClose={() => modais.setModalPagoAberto(false)}
        title="Marcar Conta como Paga"
        width="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              Pagamento para: <strong>{modais.contaSelecionada?.nome_credor}</strong>
            </p>
            {modais.contaSelecionada?.parcela_atual && (
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Parcela {modais.contaSelecionada.parcela_atual} - Nº Duplicata: {modais.contaSelecionada.nro_dup}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
              <div className="text-blue-600 dark:text-blue-300 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <strong>Valor Original:</strong> {formatarMoeda(modais.contaSelecionada?.valor_pgto || 0)}
              </div>
              {modais.contaSelecionada && (modais.contaSelecionada.total_pago_historico || 0) > 0 && (
                <div className="text-green-600 dark:text-green-300 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <strong>Já Pago:</strong> {formatarMoeda(modais.contaSelecionada.total_pago_historico || 0)}
                </div>
              )}
              <div className="text-purple-600 dark:text-purple-300 font-bold flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <strong>Restante:</strong> {formatarMoeda((modais.contaSelecionada?.valor_pgto || 0) - (modais.contaSelecionada?.total_pago_historico || 0))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dt_pgto">Data do Pagamento *</Label>
              <Input
                id="dt_pgto"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="valor_pago">Valor a Pagar *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                  R$
                </span>
                <Input
                  id="valor_pago"
                  type="text"
                  value={valorPago}
                  onChange={(e) => {
                    const valor = e.target.value;
                    // Remove tudo exceto números e vírgula
                    const apenasNumerosVirgula = valor.replace(/[^\d,]/g, '');
                    setValorPago(apenasNumerosVirgula);
                  }}
                  onBlur={(e) => {
                    const num = valorFormatadoParaNumero(e.target.value);
                    if (num > 0) {
                      setValorPago(formatarValorParaInput(num));
                    }
                  }}
                  className="mt-1 pl-10"
                  placeholder="0,00"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Saldo restante já preenchido automaticamente
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor_juros">Juros/Multa</Label>
              <Input
                id="valor_juros"
                type="text"
                value={valorJuros}
                onChange={(e) => {
                  const valor = e.target.value;
                  // Permite números, vírgulas e pontos durante a digitação
                  if (valor === '' || /^[\d.,]+$/.test(valor)) {
                    setValorJuros(valor);
                  }
                }}
                onBlur={(e) => {
                  // Ao sair do campo, converte vírgula para ponto
                  let valor = e.target.value.replace(',', '.');
                  const numero = parseFloat(valor);
                  if (!isNaN(numero) && numero > 0) {
                    setValorJuros(numero.toString());
                  } else if (valor === '' || numero === 0) {
                    setValorJuros('0');
                  }
                }}
                placeholder="Ex: 5.8 ou 10.50"
                className="mt-1"
              />
              {modais.contaSelecionada?.dt_venc && (
                <p className="text-xs text-gray-500 mt-1">
                  Venc: {new Date(modais.contaSelecionada.dt_venc).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="forma_pgto">Forma de Pagamento *</Label>
              <Select value={formaPgto} onValueChange={setFormaPgto}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="001">001 - Dinheiro</SelectItem>
                  <SelectItem value="002">002 - Cheque</SelectItem>
                  <SelectItem value="003">003 - PIX</SelectItem>
                  <SelectItem value="004">004 - Transferência Bancária</SelectItem>
                  <SelectItem value="005">005 - Cartão de Crédito</SelectItem>
                  <SelectItem value="006">006 - Cartão de Débito</SelectItem>
                  <SelectItem value="007">007 - Boleto</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Será registrado na tabela DBFPGTO
              </p>
            </div>
          </div>

          {formaPgto === '002' && (
            <div>
              <Label htmlFor="nro_cheque">Número do Cheque</Label>
              <Input
                id="nro_cheque"
                type="text"
                value={nroCheque}
                onChange={(e) => setNroCheque(e.target.value)}
                className="mt-1"
                placeholder="Ex: 000123"
                maxLength={15}
              />
            </div>
          )}

          <div>
            <Label htmlFor="conta_pgto">Conta *</Label>
            <Select value={contaSelecionadaPgto} onValueChange={setContaSelecionadaPgto}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a conta..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {contasDbconta.length > 0 ? (
                  contasDbconta.map((conta) => (
                    <SelectItem key={conta.value} value={conta.value}>
                      {conta.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="carregando" disabled>
                    Carregando contas...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Conta usada no pagamento (dbconta)
            </p>
          </div>

          <div>
            <Label htmlFor="obs_pgto">Observações</Label>
            <Textarea
              id="obs_pgto"
              name="obs_pgto"
              value={obsPagamento}
              onChange={(e) => setObsPagamento(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Observações sobre o pagamento"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <AuxButton
              variant="cancel"
              onClick={() => modais.setModalPagoAberto(false)}
              text="Cancelar"
            />
            <DefaultButton
              variant="confirm"
              onClick={handleMarcarPago}
              text="Confirmar Pagamento"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Confirmação de Valor */}
      <Modal
        isOpen={modais.modalConfirmacaoValor}
        onClose={() => {
          modais.setModalConfirmacaoValor(false);
          setDadosValidacaoValor(null);
        }}
        title="⚠️ Pagamento Parcial"
        width="w-11/12 md:w-4/5 lg:w-3/4 xl:w-1/2"
      >
        <div className="space-y-6">
          {/* Alerta Principal */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-l-4 border-amber-400 rounded-r-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  Pagamento Parcial Detectado
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Este pagamento não quitará totalmente a conta. {dadosValidacaoValor && dadosValidacaoValor.valorFaltara > 0
                    ? `Após o pagamento, ainda faltarão ${formatarMoeda(dadosValidacaoValor.valorFaltara)}.`
                    : 'A conta será totalmente quitada.'
                  }
                </p>
              </div>
            </div>
          </div>

          {dadosValidacaoValor && (
            <div className="space-y-4">
              {/* Resumo da Conta */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Resumo da Conta
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Valor Original */}
                  {modais.contaSelecionada && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Valor Original</span>
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {formatarMoeda(modais.contaSelecionada.valor_pgto)}
                      </div>
                    </div>
                  )}

                  {/* Total Já Pago */}
                  {modais.contaSelecionada && (modais.contaSelecionada.total_pago_historico || 0) > 0 && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Já Pago</span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                        {formatarMoeda(modais.contaSelecionada.total_pago_historico || 0)}
                      </div>
                    </div>
                  )}

                  {/* Saldo Restante */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Saldo Restante</span>
                      <DollarSign className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">
                      {formatarMoeda(dadosValidacaoValor.valorEsperado)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparação de Valores */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <CalculatorIcon className="w-4 h-4" />
                  Resultado Após Este Pagamento
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Valor que será pago */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Valor a Pagar Agora</span>
                      <Edit3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatarMoeda(dadosValidacaoValor.valorDigitado)}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Valor digitado pelo usuário
                    </div>
                  </div>

                  {/* Valor que ainda faltará */}
                  <div className={`${dadosValidacaoValor.valorFaltara > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                    <div className="rounded-lg p-4 border-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${dadosValidacaoValor.valorFaltara > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>
                          {dadosValidacaoValor.valorFaltara > 0 ? 'Ainda Faltará' : 'Conta Quitada'}
                        </span>
                        {dadosValidacaoValor.valorFaltara > 0 ? (
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className={`text-2xl font-bold ${dadosValidacaoValor.valorFaltara > 0 ? 'text-orange-900 dark:text-orange-100' : 'text-green-900 dark:text-green-100'}`}>
                        {formatarMoeda(dadosValidacaoValor.valorFaltara)}
                      </div>
                      <div className={`text-xs mt-1 ${dadosValidacaoValor.valorFaltara > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {dadosValidacaoValor.valorFaltara > 0
                          ? `Após este pagamento`
                          : `Conta será totalmente paga`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  <strong>Importante:</strong> Após este pagamento de {formatarMoeda(dadosValidacaoValor.valorDigitado)}, {dadosValidacaoValor.valorFaltara > 0
                    ? `ainda faltarão ${formatarMoeda(dadosValidacaoValor.valorFaltara)} para quitar a conta.`
                    : 'a conta será totalmente quitada.'
                  }
                  <br />
                  Deseja continuar mesmo assim?
                </p>

                <div className="flex gap-3 justify-end">
                  <AuxButton
                    variant="cancel"
                    onClick={() => {
                      modais.setModalConfirmacaoValor(false);
                      setDadosValidacaoValor(null);
                    }}
                    text="Cancelar e Corrigir"
                  />
                  <DefaultButton
                    variant="confirm"
                    onClick={async () => {
                      modais.setModalConfirmacaoValor(false);
                      setDadosValidacaoValor(null);
                      await processarPagamento();
                    }}
                    text="Continuar Mesmo Assim"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={modais.modalEditarAberto}
        onClose={() => modais.setModalEditarAberto(false)}
        title="Editar Conta a Pagar"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Edite os dados da conta de <strong>{modais.contaSelecionada?.nome_credor}</strong>
          </p>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dt_emissao_edit">Data de Emissão</Label>
              <Input
                id="dt_emissao_edit"
                type="date"
                value={dadosEdicao.dt_emissao}
                onChange={(e) => setDadosEdicao(prev => ({ ...prev, dt_emissao: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dt_venc_edit">Data de Vencimento *</Label>
              <Input
                id="dt_venc_edit"
                type="date"
                value={dadosEdicao.dt_venc}
                onChange={(e) => setDadosEdicao(prev => ({ ...prev, dt_venc: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
          </div>

          {/* Fornecedor/Credor */}
          <div>
            <Label>Fornecedor/Credor</Label>
            <Autocomplete
              placeholder="Buscar fornecedor..."
              apiUrl="/api/contas-pagar/fornecedores"
              value={dadosEdicao.cod_credor}
              onChange={(value) => setDadosEdicao(prev => ({ ...prev, cod_credor: value }))}
              mapResponse={(data) => data.fornecedores || []}
            />
            <p className="text-xs text-gray-500 mt-1">
              Atual: {modais.contaSelecionada?.nome_credor} (Cód: {modais.contaSelecionada?.cod_credor})
            </p>
          </div>

          {/* Conta Bancária e Centro de Custo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Conta Bancária</Label>
              <Autocomplete
                placeholder="Buscar conta..."
                apiUrl="/api/contas-pagar/contas"
                value={dadosEdicao.cod_conta}
                onChange={(value) => setDadosEdicao(prev => ({ ...prev, cod_conta: value }))}
                mapResponse={(data) => data.contas || []}
              />
              <p className="text-xs text-gray-500 mt-1">
                Atual: {modais.contaSelecionada?.descricao_conta}
              </p>
            </div>

            <div>
              <Label>Centro de Custo</Label>
              <Autocomplete
                placeholder="Buscar centro de custo..."
                apiUrl="/api/contas-pagar/centros-custo"
                value={dadosEdicao.cod_ccusto}
                onChange={(value) => setDadosEdicao(prev => ({ ...prev, cod_ccusto: value }))}
                mapResponse={(data) => data.centrosCusto || []}
              />
              <p className="text-xs text-gray-500 mt-1">
                Atual: {modais.contaSelecionada?.descricao_ccusto}
              </p>
            </div>
          </div>

          {/* Valor */}
          <div>
            <Label htmlFor="valor_pgto_edit">Valor *</Label>
            <Input
              id="valor_pgto_edit"
              type="number"
              step="0.01"
              value={dadosEdicao.valor_pgto}
              onChange={(e) => setDadosEdicao(prev => ({ ...prev, valor_pgto: e.target.value }))}
              className="mt-1"
              required
            />
          </div>

          {/* Números da NF e Duplicata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nro_nf_edit">Nº NF</Label>
              <Input
                id="nro_nf_edit"
                value={dadosEdicao.nro_nf}
                onChange={(e) => setDadosEdicao(prev => ({ ...prev, nro_nf: e.target.value }))}
                className="mt-1"
                placeholder="Ex: 12345"
              />
            </div>

            <div>
              <Label htmlFor="nro_dup_edit">Nº Duplicata</Label>
              <Input
                id="nro_dup_edit"
                value={dadosEdicao.nro_dup}
                onChange={(e) => setDadosEdicao(prev => ({ ...prev, nro_dup: e.target.value }))}
                className="mt-1"
                placeholder="Ex: bc223/01"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="obs_edit">Observações</Label>
            <Textarea
              id="obs_edit"
              name="obs_edit"
              value={dadosEdicao.obs}
              onChange={(e) => setDadosEdicao(prev => ({ ...prev, obs: e.target.value }))}
              className="mt-1"
              rows={3}
              placeholder="Observações sobre a conta"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <AuxButton
              variant="secondary"
              onClick={() => modais.setModalEditarAberto(false)}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              onClick={handleEditar}
              text="Salvar Alterações"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Cancelar */}
      <Modal
        isOpen={modais.modalCancelarAberto}
        onClose={() => modais.setModalCancelarAberto(false)}
        title="Cancelar Conta a Pagar"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tem certeza que deseja cancelar a conta de <strong>{modais.contaSelecionada?.nome_credor}</strong>?
            Esta ação não pode ser desfeita.
          </p>

          <div>
            <Label htmlFor="motivo">Motivo do Cancelamento</Label>
            <Textarea
              id="motivo"
              name="motivo"
              placeholder="Opcional: informe o motivo do cancelamento"
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <AuxButton
              variant="secondary"
              onClick={() => modais.setModalCancelarAberto(false)}
              text="Voltar"
            />
            <DefaultButton
              variant="destructive"
              onClick={handleCancelar}
              text="Confirmar Cancelamento"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Cancelar Pagamento Individual */}
      <Modal
        isOpen={modais.modalCancelarPagamentoAberto}
        onClose={() => {
          modais.setModalCancelarPagamentoAberto(false);
          setPagamentoParaCancelar(null);
        }}
        title="Cancelar Pagamento"
        width="w-11/12 md:w-2/3 lg:w-1/2"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Atenção:</strong> Você está prestes a cancelar um pagamento específico do histórico.
            </p>
          </div>

          {pagamentoParaCancelar && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Detalhes do Pagamento:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Data:</span>
                  <p className="font-semibold">{formatarData(pagamentoParaCancelar.dt_pgto)}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Valor:</span>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    {formatarMoeda(pagamentoParaCancelar.valor_pgto)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>O que acontecerá:</strong>
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc space-y-1">
              <li>O pagamento será marcado como cancelado no histórico</li>
              <li>O valor será descontado do total pago</li>
              <li>O saldo restante do título será recalculado</li>
              <li>Você poderá gerar um novo pagamento com o valor correto</li>
            </ul>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300">
            Tem certeza que deseja cancelar este pagamento? Esta ação não pode ser desfeita.
          </p>

          <div className="flex gap-2 justify-end pt-4">
            <AuxButton
              variant="secondary"
              onClick={() => {
                modais.setModalCancelarPagamentoAberto(false);
                setPagamentoParaCancelar(null);
              }}
              text="Voltar"
            />
            <DefaultButton
              variant="destructive"
              onClick={handleCancelarPagamento}
              text="Confirmar Cancelamento"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes */}
      <Modal
        isOpen={modais.modalDetalhesAberto}
        onClose={() => modais.setModalDetalhesAberto(false)}
        title={`Detalhes da Conta #${modais.contaSelecionada?.id}`}
        width="w-11/12 md:w-2/3 lg:w-1/2"
      >
        {modais.contaSelecionada && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Credor</Label>
                <p className="text-sm font-semibold mt-1">{modais.contaSelecionada.nome_credor}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</Label>
                <div className="mt-1">{getStatusBadge(modais.contaSelecionada.status)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Data de Vencimento</Label>
                <p className="text-sm mt-1">{formatarData(modais.contaSelecionada.dt_venc)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Data de Pagamento</Label>
                <p className="text-sm mt-1">{formatarData(modais.contaSelecionada.dt_pgto)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor Original</Label>
                <p className="text-sm font-mono font-semibold mt-1">{formatarMoeda(modais.contaSelecionada.valor_pgto)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor Pago</Label>
                <p className="text-sm font-mono font-semibold mt-1">{formatarMoeda(modais.contaSelecionada.valor_pago)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nº NF</Label>
                <p className="text-sm mt-1">{modais.contaSelecionada.nro_nf || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Conta</Label>
                <p className="text-sm mt-1">{modais.contaSelecionada.descricao_conta}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Centro de Custo</Label>
              <p className="text-sm mt-1">{modais.contaSelecionada.descricao_ccusto || '-'}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Observações</Label>
              <p className="text-sm mt-1">{modais.contaSelecionada.obs || 'Nenhuma observação'}</p>
            </div>

            <div className="flex justify-end pt-4">
              <DefaultButton
                variant="secondary"
                onClick={() => modais.setModalDetalhesAberto(false)}
                text="Fechar"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Gerar Título */}
      <Modal
        isOpen={modais.modalGerarTituloAberto}
        onClose={() => modais.setModalGerarTituloAberto(false)}
        title="Gerar Título Bancário"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure os dados para gerar o título da conta de <strong>{modais.contaSelecionada?.nome_credor}</strong>
          </p>

          <div>
            <Label htmlFor="titulo_vencimento">Vencimento</Label>
            <Input
              id="titulo_vencimento"
              type="date"
              value={modais.contaSelecionada?.dt_venc || ''}
              className="mt-1"
              disabled
            />
          </div>

          <div>
            <Label htmlFor="titulo_valor">Valor</Label>
            <Input
              id="titulo_valor"
              type="text"
              value={modais.contaSelecionada ? formatarMoeda(modais.contaSelecionada.valor_pgto) : ''}
              className="mt-1"
              disabled
            />
          </div>

          <div>
            <Label htmlFor="titulo_banco">Banco</Label>
            <Select value={bancoSelecionado} onValueChange={setBancoSelecionado}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Bradesco</SelectItem>
                <SelectItem value="1">Banco do Brasil</SelectItem>
                <SelectItem value="2">Itaú</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="titulo_descricao">Descrição</Label>
            <Textarea
              id="titulo_descricao"
              name="titulo_descricao"
              value={descricaoTitulo}
              onChange={(e) => setDescricaoTitulo(e.target.value)}
              placeholder="Descrição do título (opcional)"
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <AuxButton
              variant="secondary"
              onClick={() => modais.setModalGerarTituloAberto(false)}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              onClick={handleGerarTitulo}
              disabled={!bancoSelecionado}
              text="Gerar Título"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Histórico de Pagamentos */}
      <Modal
        isOpen={modais.modalHistoricoAberto}
        onClose={() => {
          modais.setModalHistoricoAberto(false);
          setHistoricoPagamentos(null);
        }}
        title={`Histórico de Pagamentos${modais.contaSelecionada?.parcela_atual ? ` - Parcela ${modais.contaSelecionada.parcela_atual}` : ''} - ${modais.contaSelecionada?.nome_credor || ''}`}
        width="w-11/12 md:w-4/5 lg:w-3/4"
      >
        <div className="space-y-4">
          {/* Card com informações da parcela */}
          {modais.contaSelecionada?.parcela_atual && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                📋 Parcela {modais.contaSelecionada.parcela_atual} - Nº Duplicata: {modais.contaSelecionada.nro_dup} | 💰 Valor: {formatarMoeda(modais.contaSelecionada?.valor_pgto || 0)}
              </p>
            </div>
          )}
          
          {carregandoHistorico ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando histórico...</span>
            </div>
          ) : historicoPagamentos && historicoPagamentos.historico.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Data</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Forma/Detalhes</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Banco/Conta</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Juros</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Multa</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Desconto</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Usuário</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoPagamentos.historico.map((pagamento, index) => {
                      // Determinar a forma de pagamento com base em tp_pgto e outros campos
                      let formaPgtoNome = '';
                      let detalhes = '';
                      
                      if (pagamento.tp_pgto === 'C') {
                        // Cheque
                        formaPgtoNome = 'Cheque';
                        detalhes = pagamento.nro_cheque ? `Nº ${pagamento.nro_cheque}` : '';
                      } else if (pagamento.tp_pgto === 'D') {
                        // Dinheiro/Débito
                        if (pagamento.nro_cheque === 'DEB.AUTOM') {
                          formaPgtoNome = 'Débito Automático';
                        } else {
                          formaPgtoNome = 'Dinheiro';
                        }
                      } else if (pagamento.tp_pgto === 'X') {
                        formaPgtoNome = 'PIX';
                      } else if (pagamento.tp_pgto === 'T') {
                        formaPgtoNome = 'Transferência';
                      } else if (pagamento.tp_pgto === 'B') {
                        formaPgtoNome = 'Boleto';
                      } else if (pagamento.tp_pgto === 'CC') {
                        formaPgtoNome = 'Cartão Crédito';
                      } else if (pagamento.tp_pgto === 'CD') {
                        formaPgtoNome = 'Cartão Débito';
                      } else {
                        // Fallback para o código da forma de pagamento
                        const formasPagamento: { [key: string]: string } = {
                          '01': 'Dinheiro',
                          '02': 'Cheque',
                          '03': 'Cartão Crédito',
                          '04': 'Cartão Débito',
                          '05': 'PIX',
                          '06': 'Transferência',
                          '07': 'Boleto',
                          '001': 'Pagamento',
                        };
                        formaPgtoNome = formasPagamento[pagamento.cod_fpgto] || pagamento.cod_fpgto || 'Outro';
                      }
                      
                      const estaCancelado = pagamento.cancel === 'S';
                      
                      return (
                        <tr key={index} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${estaCancelado ? 'opacity-60 bg-red-50 dark:bg-red-900/10' : ''}`}>
                          <td className="py-2 px-3">{formatarData(pagamento.dt_pgto)}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-green-600 dark:text-green-400">
                            {formatarMoeda(pagamento.valor_pgto)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{formaPgtoNome}</span>
                              {detalhes && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {detalhes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-xs">{pagamento.cod_conta || '-'}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {pagamento.juros ? formatarMoeda(pagamento.juros) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {pagamento.multa ? formatarMoeda(pagamento.multa) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {pagamento.desconto ? formatarMoeda(pagamento.desconto) : '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-sm">{pagamento.username || '-'}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {estaCancelado ? (
                              <Badge variant="destructive" className="text-xs">
                                Cancelado
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-green-600">
                                Ativo
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!estaCancelado && (
                              <button
                                onClick={() => {
                                  setPagamentoParaCancelar(pagamento);
                                  modais.setModalCancelarPagamentoAberto(true);
                                }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition"
                                title="Cancelar este pagamento"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumo */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Valor Original</Label>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {formatarMoeda(modais.contaSelecionada?.valor_pgto || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Total Pago</Label>
                    <p className="text-lg font-mono font-bold text-green-600 dark:text-green-400">
                      {formatarMoeda(historicoPagamentos.total_pago)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Saldo Restante</Label>
                    <p className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400">
                      {formatarMoeda((modais.contaSelecionada?.valor_pgto || 0) - historicoPagamentos.total_pago)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Quantidade de Pagamentos</Label>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {historicoPagamentos.qtd_pagamentos} {historicoPagamentos.qtd_pagamentos === 1 ? 'pagamento' : 'pagamentos'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p>Nenhum pagamento registrado para esta conta.</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <DefaultButton
              variant="secondary"
              onClick={() => {
                modais.setModalHistoricoAberto(false);
                setHistoricoPagamentos(null);
              }}
              text="Fechar"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes da Parcela */}
      <Modal
        isOpen={modais.modalParcelasAberto}
        onClose={() => {
          modais.setModalParcelasAberto(false);
          setDetalhesParcela(null);
        }}
        title={`Detalhes da Parcela - ${modais.contaSelecionada?.nome_credor || ''}`}
        width="w-11/12 md:w-2/3"
      >
        <div className="space-y-4">
          {carregandoDetalhes ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando detalhes...</span>
            </div>
          ) : detalhesParcela ? (
            <>
              {/* Card de Informações da Parcela */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Código</Label>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      #{detalhesParcela.id}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Número da Duplicata</Label>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                      {detalhesParcela.nro_dup || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid de Valores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Valor da Parcela</Label>
                  <p className="text-xl font-mono font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {formatarMoeda(detalhesParcela.valor_pgto || 0)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Valor Pago</Label>
                  <p className="text-xl font-mono font-bold text-green-600 dark:text-green-400 mt-1">
                    {formatarMoeda(detalhesParcela.valor_pago || 0)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Juros</Label>
                  <p className="text-xl font-mono font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {formatarMoeda(detalhesParcela.valor_juros || 0)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Saldo</Label>
                  <p className="text-xl font-mono font-bold text-red-600 dark:text-red-400 mt-1">
                    {formatarMoeda((detalhesParcela.valor_pgto || 0) - (detalhesParcela.valor_pago || 0))}
                  </p>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Data Emissão</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {formatarData(detalhesParcela.dt_emissao)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Data Vencimento</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {formatarData(detalhesParcela.dt_venc)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Data Pagamento</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {detalhesParcela.dt_pgto ? formatarData(detalhesParcela.dt_pgto) : '-'}
                  </p>
                </div>
              </div>

              {/* Status e Outras Informações */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(detalhesParcela.status)}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Nº NF</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {detalhesParcela.nro_nf || '-'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Banco</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {detalhesParcela.banco || '-'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Centro Custo</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {detalhesParcela.cod_ccusto || '-'}
                  </p>
                </div>
              </div>

              {/* Observações */}
              {detalhesParcela.obs && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                  <Label className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2 block">Observações</Label>
                  <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
                    {detalhesParcela.obs}
                  </p>
                </div>
              )}

              {/* Ações Rápidas */}
              <div className="flex gap-2 pt-2">
                <DefaultButton
                  variant="primary"
                  onClick={() => {
                    modais.setModalParcelasAberto(false);
                    abrirModalPago(detalhesParcela);
                  }}
                  text="Pagar Esta Parcela"
                  icon={<DollarSign className="w-4 h-4" />}
                  disabled={detalhesParcela.status === 'pago' || detalhesParcela.status === 'cancelado'}
                />
                <DefaultButton
                  variant="secondary"
                  onClick={() => {
                    modais.setModalParcelasAberto(false);
                    abrirModalHistorico(detalhesParcela);
                  }}
                  text="Ver Histórico"
                  icon={<History className="w-4 h-4" />}
                />
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p>Erro ao carregar detalhes da parcela.</p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <DefaultButton
              variant="cancel"
              onClick={() => {
                modais.setModalParcelasAberto(false);
                setDetalhesParcela(null);
              }}
              text="Fechar"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Selecionar Parcela para Pagar */}
      {modais.contaSelecionada && (
        <ModalSelecionarParcelas
          isOpen={modais.modalSelecionarParcelaAberto}
          onClose={() => modais.setModalSelecionarParcelaAberto(false)}
          contaId={modais.contaSelecionada.id}
          nomeCredor={modais.contaSelecionada.nome_credor || 'Credor'}
          onParcelaSelecionada={handleParcelaSelecionada}
        />
      )}

      {/* Modal Nova Conta */}
      <Modal
        isOpen={modais.modalNovaContaAberto}
        onClose={() => {
          limparDadosNovaConta();
          modais.setModalNovaContaAberto(false);
        }}
        title="Nova Conta a Pagar"
        width="w-8/9 md:w-5/6 lg:w-2/3 xl:w-1/2"
      >
        <div className="space-y-6">
          {/* Seção: Tipo de Conta */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Informações Básicas</h3>
            <div>
              <Label>Tipo de Conta *</Label>
              <Select
                value={novaContaDados.tipo}
                onValueChange={(value: 'F' | 'T') => setNovaContaDados({ ...novaContaDados, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Fornecedor</SelectItem>
                  <SelectItem value="T">Transportadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção: Credor e Conta */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Credor e Conta Financeira</h3>
            <div className="grid grid-cols-2 gap-4">
              {novaContaDados.tipo === 'F' ? (
                <div>
                  <Label>Código do Fornecedor *</Label>
                  <Autocomplete
                    resetKey={modalKey}
                    placeholder="Buscar fornecedor..."
                    apiUrl="/api/contas-pagar/fornecedores"
                    value={novaContaDados.cod_credor}
                    onChange={(value, selectedItem: any) => {
                      // Verificar se fornecedor é internacional (codpais != 1058)
                      const ehInternacional = selectedItem?.eh_internacional || false;
                      setNovaContaDados({
                        ...novaContaDados,
                        cod_credor: value,
                        eh_internacional: ehInternacional
                      });
                    }}
                    mapResponse={(data) => data.fornecedores || []}
                  />
                </div>
              ) : (
                <div>
                  <Label>Código da Transportadora *</Label>
                  <Autocomplete
                    resetKey={modalKey}
                    placeholder="Buscar transportadora..."
                    apiUrl="/api/contas-pagar/transportadoras"
                    value={novaContaDados.cod_transp}
                    onChange={(value) => {
                      setNovaContaDados({ ...novaContaDados, cod_transp: value });
                    }}
                    mapResponse={(data) => data.transportadoras || []}
                  />
                </div>
              )}

              <div>
                <Label>Conta Financeira *</Label>
                <Autocomplete
                  resetKey={modalKey}
                  placeholder="Buscar conta financeira..."
                  apiUrl="/api/contas-pagar/contas"
                  value={novaContaDados.pag_cof_id}
                  onChange={(value, selectedItem: any) => {
                    // Verificar se conta financeira é internacional
                    const ehInternacional = selectedItem?.eh_internacional || false;
                    setNovaContaDados({
                      ...novaContaDados,
                      pag_cof_id: value,
                      // Marca/desmarca internacional baseado na conta financeira
                      eh_internacional: ehInternacional
                    });
                  }}
                  mapResponse={(data) => data.contas || []}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Conta com centro de custo vinculado
                </p>
              </div>
            </div>
          </div>

          {/* Seção: Código da Conta e Comprador */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Código da Conta e Comprador</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código da Conta</Label>
                <Autocomplete
                  resetKey={modalKey}
                  placeholder="Buscar conta..."
                  apiUrl="/api/contas-pagar/contas-dbconta"
                  value={novaContaDados.cod_conta}
                  onChange={(value) => setNovaContaDados({ ...novaContaDados, cod_conta: value })}
                  mapResponse={(data) => data.contas || []}
                />
                
              </div>

              <div>
                <Label>Código do Comprador</Label>
                <Autocomplete
                  resetKey={modalKey}
                  placeholder="Buscar comprador..."
                  apiUrl="/api/contas-pagar/compradores"
                  value={novaContaDados.cod_comprador}
                  onChange={(value) => setNovaContaDados({ ...novaContaDados, cod_comprador: value })}
                  mapResponse={(data) => data.compradores || []}
                />
              </div>
            </div>
          </div>

          {/* Seção: Valores e Datas */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Valores e Datas</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input
                  type="date"
                  value={novaContaDados.dt_emissao}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, dt_emissao: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Vencimento {novaContaDados.parcelado ? '(Base)' : '*'}</Label>
                <Input
                  type="date"
                  value={novaContaDados.dt_venc}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, dt_venc: e.target.value })}
                  disabled={novaContaDados.parcelado}
                  className={novaContaDados.parcelado ? 'opacity-50 cursor-not-allowed' : ''}
                />
                {novaContaDados.parcelado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Desabilitado - vencimento definido pelas parcelas
                  </p>
                )}
              </div>
              <div>
                <Label>Valor {novaContaDados.eh_internacional ? '(Calculado)' : '*'}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    type="text"
                    value={novaContaDados.eh_internacional
                      ? (novaContaDados.valor_pgto > 0 ? novaContaDados.valor_pgto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
                      : valorPgtoInput}
                    onChange={(e) => {
                      if (novaContaDados.eh_internacional) return;

                      const valor = e.target.value;
                      // Remove tudo exceto números e vírgula
                      const apenasNumerosVirgula = valor.replace(/[^\d,]/g, '');
                      setValorPgtoInput(apenasNumerosVirgula);

                      // Converter para número e atualizar estado
                      const valorNumero = valorFormatadoParaNumero(apenasNumerosVirgula);
                      if (valorNumero <= 999999999.99) {
                        setNovaContaDados({ ...novaContaDados, valor_pgto: valorNumero });
                      }
                    }}
                    onBlur={(e) => {
                      if (novaContaDados.eh_internacional) return;

                      const num = valorFormatadoParaNumero(e.target.value);
                      if (num > 0) {
                        setValorPgtoInput(formatarValorParaInput(num));
                      }
                    }}
                    disabled={novaContaDados.eh_internacional}
                    className={`pl-10 ${novaContaDados.eh_internacional ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                    placeholder={novaContaDados.eh_internacional ? 'Calculado automaticamente' : 'Ex: 1.500,00'}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {novaContaDados.eh_internacional
                    ? 'Calculado automaticamente pela conversão'
                    : 'Máximo: R$ 999.999.999,99'}
                </p>
              </div>
            </div>
          </div>

          {/* Seção: Documentos Fiscais */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Documentos Fiscais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{novaContaDados.eh_internacional ? 'Número da Invoice' : 'Número da NF'}</Label>
                <Input
                  type="text"
                  value={novaContaDados.eh_internacional ? novaContaDados.nro_invoice : novaContaDados.nro_nf}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const temValor = valor.trim().length > 0;
                    if (novaContaDados.eh_internacional) {
                      setNovaContaDados({ 
                        ...novaContaDados, 
                        nro_invoice: valor,
                        tem_nota: temValor // Marca automaticamente se tiver invoice
                      });
                    } else {
                      setNovaContaDados({ 
                        ...novaContaDados, 
                        nro_nf: valor,
                        tem_nota: temValor // Marca automaticamente se tiver NF
                      });
                    }
                  }}
                  placeholder={novaContaDados.eh_internacional ? 'Ex: INV-2025-001' : 'Ex: 12345'}
                />
              </div>
              <div>
                <Label>{novaContaDados.eh_internacional ? 'Número do Contrato' : 'Número da Duplicata'}</Label>
                <Input
                  type="text"
                  value={novaContaDados.eh_internacional ? novaContaDados.nro_contrato : novaContaDados.nro_dup}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const temValor = valor.trim().length > 0;
                    if (novaContaDados.eh_internacional) {
                      setNovaContaDados({ ...novaContaDados, nro_contrato: valor });
                    } else {
                      setNovaContaDados({ 
                        ...novaContaDados, 
                        nro_dup: valor,
                        tem_cobr: temValor // Marca automaticamente se tiver duplicata
                      });
                    }
                  }}
                  placeholder={novaContaDados.eh_internacional ? 'Ex: CONT-2025-001' : 'Ex: 001'}
                />
              </div>
            </div>
          </div>

          {/* Seção: Opções Adicionais */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Opções Adicionais</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2 opacity-50">
                <input
                  type="checkbox"
                  id="eh_internacional"
                  checked={novaContaDados.eh_internacional}
                  disabled
                  onChange={(e) => {
                    setNovaContaDados({ ...novaContaDados, eh_internacional: e.target.checked });
                    // Se desmarcar, limpar campos internacionais
                    if (!e.target.checked) {
                      setNovaContaDados(prev => ({
                        ...prev,
                        eh_internacional: false,
                        moeda: '',
                        taxa_conversao: 0,
                        valor_moeda: 0,
                        nro_invoice: '',
                        nro_contrato: '',
                      }));
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 cursor-not-allowed"
                />
                <Label htmlFor="eh_internacional" className="cursor-not-allowed">
                  Pagamento Internacional
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tem_nota"
                  checked={novaContaDados.tem_nota}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, tem_nota: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <Label htmlFor="tem_nota" className="font-normal cursor-pointer">
                  Possui Nota Fiscal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tem_cobr"
                  checked={novaContaDados.tem_cobr}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, tem_cobr: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <Label htmlFor="tem_cobr" className="font-normal cursor-pointer">
                  Possui Cobrança
                </Label>
              </div>
            </div>
          </div>

          {/* Campos de Conversão de Moeda (Condicional - apenas se internacional) */}
          {novaContaDados.eh_internacional && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-sm font-semibold mb-3">
                Conversão de Moeda Estrangeira
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Moeda *</Label>
                  <Select
                    value={novaContaDados.moeda}
                    onValueChange={(value) => setNovaContaDados({ ...novaContaDados, moeda: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a moeda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                      <SelectItem value="USD">USD - Dólar Americano ($)</SelectItem>
                      <SelectItem value="GBP">GBP - Libra Esterlina (£)</SelectItem>
                      <SelectItem value="JPY">JPY - Iene Japonês (¥)</SelectItem>
                      <SelectItem value="CNY">CNY - Yuan Chinês (¥)</SelectItem>
                      <SelectItem value="CHF">CHF - Franco Suíço (CHF)</SelectItem>
                      <SelectItem value="CAD">CAD - Dólar Canadense (C$)</SelectItem>
                      <SelectItem value="AUD">AUD - Dólar Australiano (A$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Taxa de Conversão (Convenção) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      {novaContaDados.moeda ? obterIconeMoeda(novaContaDados.moeda) : '💱'}
                    </span>
                    <Input
                      type="text"
                      value={taxaConversaoInput}
                      onChange={(e) => {
                        const valorDigitado = e.target.value;
                        // Apenas aceita números
                        const apenasNumeros = valorDigitado.replace(/[^0-9]/g, '');
                        
                        if (apenasNumeros === '') {
                          setTaxaConversaoInput('');
                          setNovaContaDados({ 
                            ...novaContaDados, 
                            taxa_conversao: 0,
                            valor_pgto: 0
                          });
                          return;
                        }
                        
                        // Atualiza input com apenas números
                        setTaxaConversaoInput(apenasNumeros);
                        
                        // Calcula taxa: 626 -> 6.26
                        const taxa = parseInt(apenasNumeros) / 100;
                        setNovaContaDados({ 
                          ...novaContaDados, 
                          taxa_conversao: taxa,
                          valor_pgto: novaContaDados.valor_moeda * taxa
                        });
                      }}
                      onBlur={() => {
                        // Ao perder foco, formatar com vírgula
                        if (novaContaDados.taxa_conversao > 0) {
                          setTaxaConversaoInput(novaContaDados.taxa_conversao.toFixed(4).replace('.', ','));
                        }
                      }}
                      onFocus={() => {
                        // Ao focar, mostrar apenas números
                        if (novaContaDados.taxa_conversao > 0) {
                          const numerosSemFormato = Math.round(novaContaDados.taxa_conversao * 100).toString();
                          setTaxaConversaoInput(numerosSemFormato);
                        }
                      }}
                      placeholder="Ex: 626 = 6,2600"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {novaContaDados.taxa_conversao > 0 
                      ? `1 ${novaContaDados.moeda || 'Moeda'} = R$ ${novaContaDados.taxa_conversao.toFixed(4).replace('.', ',')}`
                      : 'Digite apenas números (ex: 626 = R$ 6,26)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label>Valor na Moeda Estrangeira *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      {novaContaDados.moeda ? obterIconeMoeda(novaContaDados.moeda) : '💵'}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={novaContaDados.valor_moeda || ''}
                      onChange={(e) => {
                        const valorMoeda = parseFloat(e.target.value) || 0;
                        setNovaContaDados({ 
                          ...novaContaDados, 
                          valor_moeda: valorMoeda,
                          // Recalcular valor em reais automaticamente
                          valor_pgto: valorMoeda * novaContaDados.taxa_conversao
                        });
                      }}
                      placeholder="Ex: 30000.00"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {novaContaDados.moeda && novaContaDados.valor_moeda > 0 
                      ? `${obterIconeMoeda(novaContaDados.moeda)} ${novaContaDados.valor_moeda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Valor original na moeda estrangeira'}
                  </p>
                </div>

                <div>
                  <Label>Valor em Reais (Calculado) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                      R$
                    </span>
                    <Input
                      type="text"
                      value={novaContaDados.valor_pgto > 0 ? novaContaDados.valor_pgto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                      placeholder="Calculado automaticamente"
                      disabled
                      className="pl-10 bg-gray-100 dark:bg-gray-800"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {novaContaDados.valor_pgto > 0 
                      ? `R$ ${novaContaDados.valor_pgto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Será calculado automaticamente'}
                  </p>
                </div>
              </div>

              {novaContaDados.moeda && novaContaDados.taxa_conversao > 0 && novaContaDados.valor_moeda > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                  <strong className="text-blue-900 dark:text-blue-100">💱 Resumo da Conversão:</strong>
                  <p className="mt-1 text-blue-800 dark:text-blue-200">
                    {obterIconeMoeda(novaContaDados.moeda)} {novaContaDados.valor_moeda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} × {novaContaDados.taxa_conversao.toFixed(4).replace('.', ',')} = R$ {novaContaDados.valor_pgto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Parcelamento */}
          <div className="border-b pb-4">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                id="parcelado"
                checked={novaContaDados.parcelado}
                onChange={(e) => {
                  setNovaContaDados({ ...novaContaDados, parcelado: e.target.checked });
                  if (!e.target.checked) {
                    setParcelas([]);
                    setPrazoSelecionado('');
                  }
                }}
                className="w-4 h-4"
              />
              <Label htmlFor="parcelado" className="cursor-pointer font-semibold">
                Parcelar Conta
              </Label>
            </div>

            {novaContaDados.parcelado && (
              <div className="pl-6 border-l-2 border-blue-200 space-y-3">
                <div>
                  <Label htmlFor="qtd_parcelas">Quantidade de Parcelas</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="qtd_parcelas"
                      type="number"
                      min="1"
                      max="48"
                      value={prazoSelecionado}
                      onChange={(e) => setPrazoSelecionado(e.target.value)}
                      placeholder="Ex: 3"
                      className="w-24"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const qtdParcelas = parseInt(prazoSelecionado);
                        if (!qtdParcelas || qtdParcelas <= 0) {
                          toast.error('Insira uma quantidade válida de parcelas.');
                          return;
                        }
                        if (qtdParcelas > 48) {
                          toast.error('Máximo de 48 parcelas permitido.');
                          return;
                        }
                        if (!novaContaDados.dt_emissao) {
                          toast.error('Informe a data de emissão primeiro.');
                          return;
                        }
                        // Gerar parcelas automaticamente (30, 60, 90 dias...)
                        const novasParcelas = [] as { dias: number; vencimento: string }[];
                        const dataBase = new Date(novaContaDados.dt_emissao);
                        for (let i = 1; i <= qtdParcelas; i++) {
                          const diasParcela = i * 30;
                          const vencimento = new Date(dataBase);
                          vencimento.setDate(vencimento.getDate() + diasParcela);
                          novasParcelas.push({
                            dias: diasParcela,
                            vencimento: vencimento.toISOString().split('T')[0],
                          });
                        }
                        setParcelas(novasParcelas);
                        // Atualizar data de vencimento base com a primeira parcela
                        if (novasParcelas.length > 0) {
                          setNovaContaDados(prev => ({
                            ...prev,
                            dt_venc: novasParcelas[0].vencimento
                          }));
                        }
                        toast.success(`${qtdParcelas} parcela(s) gerada(s) automaticamente!`);
                      }}
                      className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 whitespace-nowrap text-sm"
                    >
                      Gerar Parcelas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setParcelas([]);
                        setPrazoSelecionado('');
                      }}
                      className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 whitespace-nowrap text-sm"
                    >
                      Limpar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    As parcelas serão geradas com intervalos de 30 dias a partir da data de emissão (30, 60, 90 dias...)
                  </p>
                </div>

                {/* Lista de Parcelas */}
                {parcelas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Parcelas Geradas ({parcelas.length}):
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      {parcelas.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded text-sm"
                        >
                          <span className="font-medium text-blue-600 dark:text-blue-400 min-w-[80px]">
                            {i + 1}ª Parcela
                          </span>
                          <span className="text-gray-500 min-w-[60px]">
                            {p.dias} dias
                          </span>
                          <Input
                            type="date"
                            value={p.vencimento}
                            onChange={(e) => {
                              const novasParcelas = [...parcelas];
                              novasParcelas[i] = { ...novasParcelas[i], vencimento: e.target.value };
                              setParcelas(novasParcelas);
                            }}
                            className="w-36 text-xs"
                          />
                          {novaContaDados.valor_pgto > 0 && (
                            <span className="text-green-600 dark:text-green-400 font-medium min-w-[100px] text-right">
                              R$ {(novaContaDados.valor_pgto / parcelas.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumo */}
                {parcelas.length > 0 && novaContaDados.valor_pgto > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Resumo do Parcelamento:
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      • {parcelas.length}x de R$ {(novaContaDados.valor_pgto / parcelas.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      • Total: R$ {novaContaDados.valor_pgto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      • Primeira parcela: {parcelas[0]?.vencimento ? new Date(parcelas[0].vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      • Última parcela: {parcelas[parcelas.length - 1]?.vencimento ? new Date(parcelas[parcelas.length - 1].vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea
              name="obs"
              value={novaContaDados.obs}
              onChange={(e) => setNovaContaDados({ ...novaContaDados, obs: e.target.value })}
              placeholder="Digite observações sobre esta conta..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <AuxButton
              variant="secondary"
              onClick={() => {
                limparDadosNovaConta();
                modais.setModalNovaContaAberto(false);
              }}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              onClick={handleCriarNovaConta}
              text="Criar Conta"
            />
          </div>
        </div>
      </Modal>
      
      {/* Modal Filtros de Exportação - Desabilitado (usando exportação direta) */}
      {/* <ModalFiltrosExportacao
        aberto={modalExportarAberto}
        onFechar={() => setModalExportarAberto(false)}
        filtros={filtrosExportacao}
        onFiltrosChange={setFiltrosExportacao}
        onConfirmar={handleConfirmarExportacao}
      /> */}

      {/* Modal Seleção de Colunas para Exportação - Desabilitado (usando exportação direta) */}
      {/* {modalSelecaoColunas && (
        <Modal
          isOpen={modalSelecaoColunas}
          onClose={() => setModalSelecaoColunas(false)}
          title="Selecionar Colunas para Exportar"
        >
          <ModalExportarExcel
            colunas={colunasParaExportar}
            colunasVisiveis={colunasParaExportar}
            onExportar={handleExportarExcel}
            exportando={exportando}
          />
        </Modal>
      )} */}

      {/* Modais de Dashboard */}
      <ModaisDashboard
        modalDashboardAberto={modais.modalDashboardAberto}
        setModalDashboardAberto={modais.setModalDashboardAberto}
        contaSelecionada={modais.contaSelecionada}
        setContaSelecionada={modais.setContaSelecionada}
        modalDashboardGeralAberto={modais.modalDashboardGeralAberto}
        setModalDashboardGeralAberto={modais.setModalDashboardGeralAberto}
        contasPagar={contasPagar}
        resumoContas={resumoContas}
      />

      {/* Modal Observações */}
      <Modal
        isOpen={modais.modalObservacoesAberto}
        onClose={() => {
          modais.setModalObservacoesAberto(false);
          modais.setContaSelecionada(null);
        }}
        title="Observações"
        width="w-11/12 md:w-2/3 lg:w-1/2"
      >
        <div className="space-y-4">
          {modais.contaSelecionada ? (
            <>
              {/* Informações da Conta */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">Credor</Label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                      {modais.contaSelecionada.nome_credor}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">ID do Título</Label>
                    <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white mt-1">
                      #{modais.contaSelecionada.id}
                    </p>
                  </div>
                  {modais.contaSelecionada.nro_dup && (
                    <div>
                      <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">Nº Duplicata</Label>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {modais.contaSelecionada.nro_dup}
                      </p>
                    </div>
                  )}
                  {modais.contaSelecionada.nro_nf && (
                    <div>
                      <Label className="text-xs font-medium text-blue-700 dark:text-blue-300">Nº NF</Label>
                      <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {modais.contaSelecionada.nro_nf}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-5 border border-amber-200 dark:border-amber-800">
                <Label className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Observações do Título
                </Label>
                {modais.contaSelecionada?.obs ? (
                  <div className="bg-white dark:bg-gray-800 rounded-md p-4 border border-amber-100 dark:border-amber-900">
                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
                      {modais.contaSelecionada.obs}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Nenhuma observação registrada para este título.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p>Erro ao carregar informações da conta.</p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              onClick={() => {
                modais.setModalObservacoesAberto(false);
                modais.setContaSelecionada(null);
              }}
              text="Fechar"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Notas Associadas */}
      <ModalNotasAssociadas
        aberto={modais.modalNotasAssociadasAberto}
        onFechar={() => {
          modais.setModalNotasAssociadasAberto(false);
          setNotasAssociadas(null);
        }}
        titulo={notasAssociadas?.titulo || null}
        notas={notasAssociadas?.notas || []}
        resumo={notasAssociadas?.resumo || null}
        carregando={carregandoNotas}
      />
    </div>
  );
}