'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useContasReceber, ContaReceber, FiltrosContasReceber } from '@/hooks/useContasReceber';
import DataTableContasReceber from '@/components/common/DataTableContasReceber';
import DropdownContasReceber from '@/components/common/DropdownContasReceber';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Meta } from '@/data/common/meta';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle, DollarSign, FileText, AlertTriangle, CreditCard, Upload } from 'lucide-react';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';

export default function ContasAReceber() {
  const {
    contasReceber,
    paginacao,
    carregando,
    erro,
    consultarContasReceber,
    darBaixa,
    retirarBaixa,
    editarConta,
    cancelarConta,
  } = useContasReceber();

  // Estados para paginação e filtros
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [filtros, setFiltros] = useState<FiltrosContasReceber>({});
  const [termoBusca, setTermoBusca] = useState('');

  // Estados para modais
  const [modalRecebidoAberto, setModalRecebidoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalImportacaoCartao, setModalImportacaoCartao] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceber | null>(null);
  const [historicoRecebimentos, setHistoricoRecebimentos] = useState<any[]>([]);

  // Estados para nova conta
  const [novaContaDados, setNovaContaDados] = useState({
    codcli: null as string | null,
    rec_cof_id: null as string | null,
    dt_venc: new Date().toISOString().split('T')[0],
    valor_pgto: 0,
    nro_doc: '',
    tipo: 'R' as string,
    forma_fat: 'B' as string,
    banco: '',
    parcelado: false,
    num_parcelas: 1,
    intervalo_dias: 30,
  });

  // Estados para formulário de recebimento
  const [dataRecebimento, setDataRecebimento] = useState('');
  const [valorRecebido, setValorRecebido] = useState('');
  const [valorJuros, setValorJuros] = useState('0');
  const [observacoes, setObservacoes] = useState('');
  const [bancoSelecionado, setBancoSelecionado] = useState('');
  const [formaPgtoReceb, setFormaPgtoReceb] = useState('');
  const [contaSelecionadaReceb, setContaSelecionadaReceb] = useState('');
  const [nroCheque, setNroCheque] = useState('');
  const [codOperadora, setCodOperadora] = useState('');
  const [txCartao, setTxCartao] = useState('');
  const [dtCartao, setDtCartao] = useState('');
  const [parcelaReceb, setParcelaReceb] = useState('');
  const [codDocumentoReceb, setCodDocumentoReceb] = useState('');
  const [codAutorizacaoReceb, setCodAutorizacaoReceb] = useState('');
  const [cmc7Receb, setCmc7Receb] = useState('');
  const [idAutenticacaoReceb, setIdAutenticacaoReceb] = useState('');
  const [exportando, setExportando] = useState(false);
  const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string }[]>([]);
  const [numParcelasInput, setNumParcelasInput] = useState('');
  const [contasDbconta, setContasDbconta] = useState<{value: string; label: string}[]>([]);

  // Estados para operadoras de cartão
  const [operadoras, setOperadoras] = useState<any[]>([]);
  const [operadoraSelecionada, setOperadoraSelecionada] = useState('');
  const [calculoTarifa, setCalculoTarifa] = useState<any>(null);
  const [numParcela, setNumParcela] = useState('1');
  const [totalParcelas, setTotalParcelas] = useState('1');
  const [modoParcelamento, setModoParcelamento] = useState<'unica' | 'automatico'>('unica');
  const [gerandoParcelas, setGerandoParcelas] = useState(false);

  // Estados para bancos
  const [bancosDisponiveis, setBancosDisponiveis] = useState<{ value: string; label: string; nome: string }[]>([]);

  // Estados para edição de título
  const [dadosEdicao, setDadosEdicao] = useState({
    dt_venc: '',
    dt_emissao: '',
    valor_pgto: '',
    nro_doc: '',
    codcli: '',
    rec_cof_id: ''
  });

  // Estados para modal de importação de cartão
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conteudoArquivo, setConteudoArquivo] = useState<string>('');
  const [filialSelecionada, setFilialSelecionada] = useState<string>('TODAS');
  const [importando, setImportando] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<any>(null);
  const [resultadoConciliacao, setResultadoConciliacao] = useState<any>(null);
  const [previewArquivo, setPreviewArquivo] = useState<string[]>([]);

  // Cabeçalhos da tabela (ordenados seguindo o padrão: Ações, Status, ...)
  const headers = [
    'Ações',                 // ações (dropdown / botões)
    'Status',                // status (badge)
    'Número Título',         // cod_receb
    'Cliente',               // nome_cliente
    'Emissão',               // dt_emissao
    'Vencimento',            // dt_venc
    'Pagamento',             // dt_pgto
    'Valor Original',        // valor_original
    'Valor Recebido',        // valor_recebido
    'Juros',                 // valor_juros (quando aplicável)
    'Nº Documento',          // nro_doc / nro_nf
    'Fatura',                // cod_fat
    'Conta Financeira',      // descricao_conta
    'Banco',                 // banco
    'Observações',           // obs
  ];

  // Carregar contas ao montar componente
  useEffect(() => {
    consultarContasReceber(paginaAtual, itensPorPagina, filtros);
  }, [paginaAtual, itensPorPagina, filtros]);

  // Carregar contas dbconta
  useEffect(() => {
    fetch('/api/contas-pagar/contas-dbconta')
      .then(res => res.json())
      .then(data => {
        const contas = data.contas || data;
        if (Array.isArray(contas)) {
          setContasDbconta(contas.map((c: any) => ({
            value: c.cod_conta || c.value || '',
            label: c.label || `${c.cod_conta} - ${c.nro_conta || c.nome_conta || ''}`
          })));
        }
      })
      .catch(err => console.error('Erro ao carregar contas:', err));
  }, []);

  // Carregar operadoras de cartão
  useEffect(() => {
    fetch('/api/operadoras')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOperadoras(data);
        }
      })
      .catch(err => console.error('Erro ao carregar operadoras:', err));
  }, []);

  // Carregar bancos disponíveis
  useEffect(() => {
    async function carregarBancos() {
      try {
        const response = await fetch('/api/contas-receber/bancos');
        if (response.ok) {
          const data = await response.json();
          setBancosDisponiveis(data.bancos || []);
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

  // Calcular tarifa quando operadora ou valor mudar
  useEffect(() => {
    if (operadoraSelecionada && valorRecebido && totalParcelas && (formaPgtoReceb === '005' || formaPgtoReceb === '006')) {
      const valorNum = valorFormatadoParaNumero(valorRecebido);
      if (valorNum > 0) {
        fetch('/api/operadoras/calcular-tarifa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codopera: operadoraSelecionada,
            valorTotal: valorNum,
            numParcelas: parseInt(totalParcelas)
          })
        })
          .then(res => res.json())
          .then(data => {
            if (!data.error) {
              setCalculoTarifa(data);
              setTxCartao(data.taxaPercentual.toString());
            }
          })
          .catch(err => console.error('Erro ao calcular tarifa:', err));
      }
    } else {
      setCalculoTarifa(null);
    }
  }, [operadoraSelecionada, valorRecebido, totalParcelas, formaPgtoReceb]);

  // Função auxiliar para formatar valor para input
  const formatarValorParaInput = (valor: number): string => {
    return valor.toFixed(2).replace('.', ',');
  };

  // Função auxiliar para converter valor formatado para número
  const valorFormatadoParaNumero = (valorStr: string): number => {
    const valorLimpo = valorStr.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(valorLimpo) || 0;
  };

  // Funções de formatação
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'recebido':
        return <Badge className="bg-green-500 hover:bg-green-600">Recebido</Badge>;
      case 'recebido_parcial':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Recebido Parcial</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-500 hover:bg-red-600">Cancelado</Badge>;
      default:
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
    }
  };

  // Preparar dados da tabela (seguindo estrutura do legado)
  const prepararDadosTabela = () => {
    // Criar mapa de bancos para lookup rápido
    const mapaBancos = new Map(bancosDisponiveis.map(banco => [banco.value, banco.nome]));

    return contasReceber.map((conta) => {
      // Adicionar nome_banco à conta se disponível
      const contaComNomeBanco = {
        ...conta,
        nome_banco: conta.banco ? mapaBancos.get(conta.banco) || null : null
      };

      const vencido = contaComNomeBanco.dt_venc && new Date(contaComNomeBanco.dt_venc) < new Date() && contaComNomeBanco.status !== 'recebido' && contaComNomeBanco.status !== 'cancelado';

      // Retornar array na ordem dos headers (Ações, Status, ...)
      return [
        // Ações
        <DropdownContasReceber
          key={`acoes-${conta.cod_receb}`}
          conta={conta}
          onVisualizarClick={() => abrirModalDetalhes(conta)}
          onDarBaixaClick={() => abrirModalRecebido(conta)}
          onRetirarBaixaClick={() => handleRetirarBaixa(conta)}
          onEditarClick={() => abrirModalEditar(conta)}
          onCancelarClick={() => abrirModalCancelar(conta)}
          onHistoricoClick={() => abrirModalHistorico(conta)}
          onVerCartaoClick={conta.tem_cartao ? () => visualizarDetalhesCartao(conta) : undefined}
        />,

        // Status
        <div key={`status-${conta.cod_receb}`} className="flex items-center">{getStatusBadge(conta.status)}</div>,

        // Número Título
        <span key={`titulo-${conta.cod_receb}`} className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
          {conta.cod_receb}
        </span>,

        // Cliente
        <div key={`cliente-${conta.cod_receb}`} className="min-w-[220px]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {conta.nome_cliente}
            </span>
            {conta.parcela_atual && (
              <Badge variant="secondary" className="text-xs font-normal">
                Parcela {conta.parcela_atual}
              </Badge>
            )}
          </div>
          {conta.eh_parcelada && conta.qtd_parcelas && conta.qtd_parcelas > 1 && (
            <div className="text-xs text-gray-500 mt-1">{conta.qtd_parcelas}x parcelas</div>
          )}
        </div>,

        // Emissão
        <span key={`emissao-${conta.cod_receb}`} className="text-sm text-gray-900 dark:text-white">{formatarData(conta.dt_emissao)}</span>,

        // Vencimento
        <span key={`venc-${conta.cod_receb}`} className={vencido ? 'text-red-600 font-semibold' : 'text-sm text-gray-900 dark:text-white'}>
          {formatarData(conta.dt_venc)}
          {vencido && <div className="text-xs text-red-500">Vencido</div>}
        </span>,

        // Pagamento
        <span key={`pgto-${conta.cod_receb}`} className="text-sm text-gray-900 dark:text-white">{conta.dt_pgto ? formatarData(conta.dt_pgto) : '-'}</span>,

        // Valor Original
        <span key={`valor-original-${conta.cod_receb}`} className="font-mono font-medium text-gray-900 dark:text-white">{formatarMoeda(conta.valor_original)}</span>,

        // Valor Recebido
        <span key={`valor-recebido-${conta.cod_receb}`} className={`font-mono font-medium ${conta.valor_recebido > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{conta.valor_recebido > 0 ? formatarMoeda(conta.valor_recebido) : '-'}</span>,

        // Juros (se houver)
        <span key={`juros-${conta.cod_receb}`} className="text-sm text-gray-900 dark:text-white">{(conta as any).valor_juros ? formatarMoeda((conta as any).valor_juros) : '-'}</span>,

        // Nº Documento
        <span key={`doc-${conta.cod_receb}`} className="text-sm font-mono text-gray-900 dark:text-white">{conta.nro_doc || '-'}</span>,

        // Fatura
        <span key={`fat-${conta.cod_receb}`} className="text-sm font-mono text-gray-900 dark:text-white">{conta.cod_fat || '-'}</span>,

        // Conta Financeira
        <span key={`conta-fin-${conta.cod_receb}`} className="text-sm text-gray-900 dark:text-white">{conta.descricao_conta || '-'}</span>,

        // Banco
        (
          <span className="text-sm">
            {contaComNomeBanco.banco ? (
              <>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{contaComNomeBanco.banco}</span>
                {contaComNomeBanco.nome_banco && (
                  <>
                    {" - "}
                    <span className="text-gray-900 dark:text-white">{contaComNomeBanco.nome_banco}</span>
                  </>
                )}
              </>
            ) : '-'}
          </span>
        ),

        // Observações
        <div key={`obs-${conta.cod_receb}`} className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[220px]">{conta.obs || '-'}</div>,
      ];
    });
  };

  // Funções para abrir modais
  const abrirModalRecebido = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setDataRecebimento(new Date().toISOString().split('T')[0]);
    // Calcular saldo restante (valor original - valor já recebido)
    const saldoRestante = conta.valor_original - (conta.valor_recebido || 0);
    setValorRecebido(formatarValorParaInput(saldoRestante));
    setValorJuros('0');
    setObservacoes('');
    setBancoSelecionado('');
    setFormaPgtoReceb('');
    setContaSelecionadaReceb('');
    setNroCheque('');
    setCodOperadora('');
    setTxCartao('');
    setDtCartao('');
    setParcelaReceb('');
    setCodDocumentoReceb('');
    setCodAutorizacaoReceb('');
    setCmc7Receb('');
    setIdAutenticacaoReceb('');
    // Limpar estados de cartão
    setOperadoraSelecionada('');
    setCalculoTarifa(null);
    setNumParcela('1');
    setTotalParcelas('1');
    setModoParcelamento('unica');
    setGerandoParcelas(false);
    setModalRecebidoAberto(true);
  };

  const abrirModalEditar = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    
    // Popular dados de edição com valores atuais
    setDadosEdicao({
      dt_venc: conta.dt_venc ? new Date(conta.dt_venc).toISOString().split('T')[0] : '',
      dt_emissao: conta.dt_emissao ? new Date(conta.dt_emissao).toISOString().split('T')[0] : '',
      valor_pgto: conta.valor_original?.toString() || '',
      nro_doc: conta.nro_doc || '',
      codcli: conta.codcli?.toString() || '',
      rec_cof_id: conta.rec_cof_id?.toString() || ''
    });
    
    setModalEditarAberto(true);
  };

  const handleEditar = async () => {
    if (!contaSelecionada) return;

    try {
      await editarConta(contaSelecionada.cod_receb, {
        dt_venc: dadosEdicao.dt_venc || undefined,
        dt_emissao: dadosEdicao.dt_emissao || undefined,
        valor_pgto: parseFloat(dadosEdicao.valor_pgto) || undefined,
        nro_doc: dadosEdicao.nro_doc || undefined,
        codcli: dadosEdicao.codcli ? parseInt(dadosEdicao.codcli) : undefined,
        rec_cof_id: dadosEdicao.rec_cof_id ? parseInt(dadosEdicao.rec_cof_id) : undefined
      });

      toast.success('Título atualizado com sucesso!', {
        position: 'top-right',
      });

      setModalEditarAberto(false);
      consultarContasReceber(paginaAtual, itensPorPagina, filtros);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao editar título', {
        position: 'top-right',
      });
    }
  };

  const abrirModalCancelar = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalCancelarAberto(true);
  };

  const abrirModalDetalhes = (conta: ContaReceber) => {
    // Adicionar nome_banco à conta
    const mapaBancos = new Map(bancosDisponiveis.map(banco => [banco.value, banco.nome]));
    const contaComNomeBanco = {
      ...conta,
      nome_banco: conta.banco ? mapaBancos.get(conta.banco) || null : null
    };
    setContaSelecionada(contaComNomeBanco);
    setModalDetalhesAberto(true);
  };

  const abrirModalHistorico = async (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalHistoricoAberto(true);
    setHistoricoRecebimentos([]);
    
    try {
      // Buscar histórico de recebimentos do título
      const response = await fetch(`/api/contas-receber/${conta.cod_receb}/historico`);
      if (!response.ok) throw new Error('Erro ao carregar histórico');
      
      const data = await response.json();
      setHistoricoRecebimentos(data.historico || []);
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      toast.error('Erro ao carregar histórico de recebimentos deste título');
    }
  };

  const visualizarDetalhesCartao = (conta: ContaReceber) => {
    toast.info(`Transação de cartão: ${conta.car_nrodocumento || 'N/A'}`);
  };

  const handleRetirarBaixa = async (conta: ContaReceber) => {
    if (!confirm(`Deseja realmente retirar a baixa do título ${conta.cod_receb}?`)) {
      return;
    }

    try {
      await retirarBaixa(conta.cod_receb, 'Reversão solicitada pelo usuário');
      toast.success('Baixa retirada com sucesso!');
      
      // Recarregar dados
      await consultarContasReceber(paginaAtual, itensPorPagina, filtros);
    } catch (error: any) {
      toast.error(`Erro ao retirar baixa: ${error.message}`);
    }
  };

  const handleDarBaixa = async () => {
    if (!contaSelecionada) return;

    // Validações
    if (!dataRecebimento) {
      toast.error('Informe a data de recebimento');
      return;
    }
    if (!valorRecebido || valorFormatadoParaNumero(valorRecebido) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!formaPgtoReceb) {
      toast.error('Selecione a forma de pagamento');
      return;
    }
    if (!contaSelecionadaReceb) {
      toast.error('Selecione a conta');
      return;
    }
    
    // Validações específicas para cartão
    if (formaPgtoReceb === '005' || formaPgtoReceb === '006') {
      if (!operadoraSelecionada) {
        toast.error('Selecione a operadora do cartão');
        return;
      }
      if (!totalParcelas || parseInt(totalParcelas) < 1) {
        toast.error('Informe o total de parcelas');
        return;
      }
      if (!numParcela || parseInt(numParcela) < 1) {
        toast.error('Informe o número desta parcela');
        return;
      }
      if (parseInt(numParcela) > parseInt(totalParcelas)) {
        toast.error('Número da parcela não pode ser maior que o total');
        return;
      }
    }

    try {
      const valorRecebidoNum = valorFormatadoParaNumero(valorRecebido);
      const valorJurosNum = parseFloat(valorJuros) || 0;

      await darBaixa(contaSelecionada.cod_receb, {
        dt_receb: dataRecebimento,
        dt_venc: contaSelecionada.dt_venc || undefined,
        dt_emissao: contaSelecionada.dt_emissao || undefined,
        valor_recebido: valorRecebidoNum,
        valor_juros: valorJurosNum,
        obs: observacoes,
        banco: bancoSelecionado || null,
        cod_conta: contaSelecionadaReceb || null,
        cof_id: contaSelecionada.rec_cof_id ? String(contaSelecionada.rec_cof_id) : null,
        forma_pgto: formaPgtoReceb || null,
        nro_cheque: nroCheque || undefined,
        nome: observacoes || contaSelecionada.nome_cliente || null,
        cod_operadora: operadoraSelecionada || codOperadora || null,
        tx_cartao: txCartao || null,
        dt_cartao: dtCartao || null,
        parcela: parcelaReceb || null,
        num_parcela: numParcela ? parseInt(numParcela) : undefined,
        total_parcelas: totalParcelas ? parseInt(totalParcelas) : undefined,
        cod_documento: codDocumentoReceb || null,
        cod_autorizacao: codAutorizacaoReceb || null,
        cmc7: cmc7Receb || null,
        id_autenticacao: idAutenticacaoReceb || null,
        caixa: contaSelecionada.grupo_pagamento_id ? String(contaSelecionada.grupo_pagamento_id) : null,
      });

      toast.success('Baixa realizada com sucesso!');
      setModalRecebidoAberto(false);
      
      // Recarregar dados
      await consultarContasReceber(paginaAtual, itensPorPagina, filtros);
    } catch (error: any) {
      toast.error(`Erro ao dar baixa: ${error.message}`);
    }
  };

  const handleGerarParcelasCartao = async () => {
    if (!contaSelecionada) return;

    // Validações
    if (!operadoraSelecionada) {
      toast.error('Selecione a operadora do cartão');
      return;
    }
    if (!totalParcelas || parseInt(totalParcelas) < 2) {
      toast.error('Para parcelamento automático, informe pelo menos 2 parcelas');
      return;
    }
    if (!valorRecebido || valorFormatadoParaNumero(valorRecebido) <= 0) {
      toast.error('Informe o valor total');
      return;
    }

    try {
      setGerandoParcelas(true);
      const valorNum = valorFormatadoParaNumero(valorRecebido);

      const response = await fetch('/api/contas-receber/gerar-parcelas-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_receb: contaSelecionada.cod_receb,
          codopera: operadoraSelecionada,
          valorTotal: valorNum,
          numParcelas: parseInt(totalParcelas),
          dt_base: dataRecebimento || new Date().toISOString().split('T')[0],
          cod_autorizacao: codAutorizacaoReceb || null,
          username: 'SYSTEM'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar parcelas');
      }

      toast.success(`✅ ${data.mensagem}`, {
        description: `Valor líquido: R$ ${data.resumo.valorLiquido.toFixed(2)} | Taxa: ${data.resumo.taxaPercentual}%`
      });

      setModalRecebidoAberto(false);

      // Recarregar dados
      await consultarContasReceber(paginaAtual, itensPorPagina, filtros);
    } catch (error: any) {
      toast.error(`Erro ao gerar parcelas: ${error.message}`);
    } finally {
      setGerandoParcelas(false);
    }
  };

  const handleCancelar = async (motivo: string) => {
    if (!contaSelecionada) return;

    try {
      await cancelarConta(contaSelecionada.cod_receb, motivo);
      toast.success('Título cancelado com sucesso!');
      setModalCancelarAberto(false);
      
      // Recarregar dados
      await consultarContasReceber(paginaAtual, itensPorPagina, filtros);
    } catch (error: any) {
      toast.error(`Erro ao cancelar título: ${error.message}`);
    }
  };

  // Função de exportação para Excel
  const handleExportarDireto = async () => {
    try {
      setExportando(true);

      // Importar biblioteca ExcelJS dinamicamente
      const ExcelJS = await import('exceljs');

      // Usar as contas que já estão filtradas e visíveis na tabela
      let contasFiltradas = [...contasReceber];

      if (contasFiltradas.length === 0) {
        toast.warning('Nenhum título encontrado para exportar');
        setExportando(false);
        return;
      }

      // Criar workbook e worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contas a Receber');

      // Definir colunas com cabeçalhos
      worksheet.columns = [
        { header: 'Número Título', key: 'cod_receb', width: 15 },
        { header: 'Cliente', key: 'nome_cliente', width: 30 },
        { header: 'Conta Financeira', key: 'descricao_conta', width: 25 },
        { header: 'Data Vencimento', key: 'dt_venc', width: 15 },
        { header: 'Data Pagamento', key: 'dt_pgto', width: 15 },
        { header: 'Data Emissão', key: 'dt_emissao', width: 15 },
        { header: 'Valor Original', key: 'valor_original', width: 15 },
        { header: 'Valor Recebido', key: 'valor_recebido', width: 15 },
        { header: 'Nº Documento', key: 'nro_doc', width: 20 },
        { header: 'Fatura', key: 'cod_fat', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Dias Atraso', key: 'dias_atraso', width: 12 },
        { header: 'Banco', key: 'banco', width: 15 },
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
      contasFiltradas.forEach((conta) => {
        const statusTexto = conta.status === 'recebido' ? 'Recebido' : 
                           conta.status === 'recebido_parcial' ? 'Parcial' : 
                           conta.status === 'cancelado' ? 'Cancelado' : 'Pendente';

        worksheet.addRow({
          cod_receb: conta.cod_receb,
          nome_cliente: conta.nome_cliente || '',
          descricao_conta: conta.descricao_conta || '',
          dt_venc: conta.dt_venc ? formatarData(conta.dt_venc) : '',
          dt_pgto: conta.dt_pgto ? formatarData(conta.dt_pgto) : '',
          dt_emissao: conta.dt_emissao ? formatarData(conta.dt_emissao) : '',
          valor_original: Number(conta.valor_original || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          valor_recebido: Number(conta.valor_recebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          nro_doc: conta.nro_doc || '',
          cod_fat: conta.cod_fat || '',
          status: statusTexto,
          dias_atraso: conta.dias_atraso || 0,
          banco: conta.banco || '',
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
      const nomeArquivo = `contas-receber-${dataAtual}.xlsx`;

      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Arquivo ${nomeArquivo} exportado com sucesso!`);

    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast.error(`Erro ao exportar para Excel: ${error.message}`);
    } finally {
      setExportando(false);
    }
  };

  // Handler de busca
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setTermoBusca(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const novosFiltros = { ...filtros };
      if (termoBusca) {
        novosFiltros.cliente = termoBusca;
      } else {
        delete novosFiltros.cliente;
      }
      setFiltros(novosFiltros);
      setPaginaAtual(1);
    }
  };

  // Handlers de paginação
  const handlePageChange = (page: number) => {
    setPaginaAtual(page);
  };

  const handlePerPageChange = (perPage: number) => {
    setItensPorPagina(perPage);
    setPaginaAtual(1);
  };

  // Handler de filtros avançados
  const handleFiltroAvancado = (filtrosDinamicos: { campo: string; tipo: string; valor: string }[]) => {
    const novosFiltros: FiltrosContasReceber = {};

    filtrosDinamicos.forEach((filtro) => {
      if (filtro.campo === 'codcli' || filtro.campo === 'nome_cliente') {
        novosFiltros.cliente = filtro.valor;
      }
      if (filtro.campo === 'rec') {
        if (filtro.valor === 'S') novosFiltros.status = 'recebido';
        else if (filtro.valor === 'N') novosFiltros.status = 'pendente';
      }
      if (filtro.campo === 'cancel' && filtro.valor === 'S') {
        novosFiltros.status = 'cancelado';
      }
    });

    setFiltros(novosFiltros);
    setPaginaAtual(1);
    toast.success('Filtros avançados aplicados!');
  };

  // Função para salvar nova conta
  const handleSalvarNovaConta = async () => {
    try {
      // Validações
      if (!novaContaDados.codcli) {
        toast.error('Selecione um cliente');
        return;
      }
      if (!novaContaDados.rec_cof_id) {
        toast.error('Selecione uma conta financeira');
        return;
      }
      if (!novaContaDados.dt_venc) {
        toast.error('Informe a data de vencimento');
        return;
      }
      if (!novaContaDados.valor_pgto || novaContaDados.valor_pgto <= 0) {
        toast.error('Informe um valor válido');
        return;
      }

      if (novaContaDados.parcelado && parcelas.length === 0) {
        toast.error('Adicione ao menos uma parcela');
        return;
      }

      const response = await fetch('/api/contas-receber/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novaContaDados,
          parcelas: novaContaDados.parcelado ? parcelas : [],
        }),
      });

      const data = await response.json();

      if (data.sucesso) {
        toast.success('Título criado com sucesso!');
        setModalNovaContaAberto(false);
        // Resetar formulário
        setNovaContaDados({
          codcli: null,
          rec_cof_id: null,
          dt_venc: new Date().toISOString().split('T')[0],
          valor_pgto: 0,
          nro_doc: '',
          tipo: 'R',
          forma_fat: 'B',
          banco: '',
          parcelado: false,
          num_parcelas: 1,
          intervalo_dias: 30,
        });
        setParcelas([]);
        setNumParcelasInput('');
        // Recarregar lista
        consultarContasReceber(paginaAtual, itensPorPagina, filtros);
      } else {
        toast.error(data.mensagem || 'Erro ao criar título');
      }
    } catch (error) {
      console.error('Erro ao criar título:', error);
      toast.error('Erro ao criar título');
    }
  };

  // Meta para o DataTable
  const meta: Meta = {
    currentPage: paginacao?.pagina || 1,
    lastPage: paginacao?.totalPaginas || 1,
    perPage: paginacao?.limite || itensPorPagina,
    total: paginacao?.total || 0,
  };

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header com título e ações */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">
               Contas a Receber
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Gerencie seus títulos, duplicatas e recebimentos
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setModalImportacaoCartao(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Importar Cartão
            </Button>
            <Button
              onClick={() => setModalNovaContaAberto(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo
            </Button>
          </div>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex-shrink-0">
            ⚠️ {erro}
          </div>
        )}

        {/* Tabela com scroll automático */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <DataTableContasReceber
            headers={headers}
            rows={prepararDadosTabela()}
            meta={meta}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
            onSearch={handleSearch}
            onSearchKeyDown={handleSearchKeyDown}
            searchInputPlaceholder="Buscar por cliente, nota fiscal, duplicata..."
            loading={carregando}
            noDataMessage="Nenhum título a receber encontrado."
            onFiltroChange={handleFiltroAvancado}
            onExportarExcel={handleExportarDireto}
            colunasFiltro={[
              'cod_receb',
              'nome_cliente',
              'dt_venc',
              'dt_pgto',
              'valor_original',
              'status',
              'nro_doc',
              'cod_fat',
            ]}
          />
        </div>
      </main>

      {/* Modal Dar Baixa */}
      {modalRecebidoAberto && contaSelecionada && (
        <Modal
          isOpen={modalRecebidoAberto}
          onClose={() => { setModalRecebidoAberto(false); setContaSelecionada(null); }}
          title="Dar Baixa - Recebimento"
          width="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2"
        >
          <div className="space-y-4">
            {/* Resumo do Título */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                Recebimento de: <strong>{contaSelecionada.nome_cliente}</strong>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Título: {contaSelecionada.cod_receb} - Nº Doc: {contaSelecionada.nro_doc || 'N/A'}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="text-blue-600 dark:text-blue-300 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <strong>Valor Original:</strong> {formatarMoeda(contaSelecionada.valor_original || 0)}
                </div>
                {(contaSelecionada.valor_recebido || 0) > 0 && (
                  <div className="text-green-600 dark:text-green-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <strong>Já Recebido:</strong> {formatarMoeda(contaSelecionada.valor_recebido || 0)}
                  </div>
                )}
                <div className="text-purple-600 dark:text-purple-300 font-bold flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  <strong>Restante:</strong> {formatarMoeda((contaSelecionada.valor_original || 0) - (contaSelecionada.valor_recebido || 0))}
                </div>
              </div>
            </div>

            {/* Formulário Principal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dt_receb">Data do Recebimento *</Label>
                <Input
                  id="dt_receb"
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="valor_recebido">Valor a Receber *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    id="valor_recebido"
                    type="text"
                    value={valorRecebido}
                    onChange={(e) => {
                      const valor = e.target.value;
                      const apenasNumerosVirgula = valor.replace(/[^\d,]/g, '');
                      setValorRecebido(apenasNumerosVirgula);
                    }}
                    onBlur={(e) => {
                      const num = valorFormatadoParaNumero(e.target.value);
                      if (num > 0) {
                        setValorRecebido(formatarValorParaInput(num));
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
                    if (valor === '' || /^[\d.,]+$/.test(valor)) {
                      setValorJuros(valor);
                    }
                  }}
                  onBlur={(e) => {
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
                {contaSelecionada.dt_venc && (
                  <p className="text-xs text-gray-500 mt-1">
                    Venc: {new Date(contaSelecionada.dt_venc).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="forma_pgto_receb">Forma de Pagamento *</Label>
                <Select value={formaPgtoReceb} onValueChange={setFormaPgtoReceb}>
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
              </div>
            </div>

            {formaPgtoReceb === '002' && (
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

            {/* Seção de Cartão (quando forma = 005 ou 006) */}
            {(formaPgtoReceb === '005' || formaPgtoReceb === '006') && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    💳 Informações do Cartão
                  </h4>
                  
                  {/* Seletor de Modo */}
                  <div className="flex gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-blue-300 dark:border-blue-700">
                    <button
                      type="button"
                      onClick={() => setModoParcelamento('unica')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        modoParcelamento === 'unica'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Parcela Única
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoParcelamento('automatico')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        modoParcelamento === 'automatico'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Gerar Parcelas Auto
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="operadora">Operadora *</Label>
                    <Select value={operadoraSelecionada} onValueChange={setOperadoraSelecionada}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a operadora..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {operadoras.length > 0 ? (
                          operadoras.map((op) => (
                            <SelectItem key={op.codopera} value={op.codopera}>
                              {op.descr} - {op.txopera}% ({op.pzopera} dias)
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="carregando" disabled>
                            Carregando operadoras...
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="total_parcelas">Total de Parcelas</Label>
                    <Input
                      id="total_parcelas"
                      type="number"
                      min="1"
                      value={totalParcelas}
                      onChange={(e) => setTotalParcelas(e.target.value)}
                      className="mt-1"
                      placeholder="Ex: 3"
                    />
                    {modoParcelamento === 'automatico' && (
                      <p className="text-xs text-blue-600 mt-1">
                        🤖 Será gerado {totalParcelas}x automaticamente (30, 60, 90 dias...)
                      </p>
                    )}
                  </div>

                  {modoParcelamento === 'unica' && (
                    <>
                      <div>
                        <Label htmlFor="num_parcela">Número desta Parcela</Label>
                        <Input
                          id="num_parcela"
                          type="number"
                          min="1"
                          max={totalParcelas}
                          value={numParcela}
                          onChange={(e) => setNumParcela(e.target.value)}
                          className="mt-1"
                          placeholder="Ex: 1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Formato gerado: {numParcela.padStart(2, '0')}-{totalParcelas.padStart(2, '0')}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="cod_autorizacao">Nº Autorização</Label>
                        <Input
                          id="cod_autorizacao"
                          value={codAutorizacaoReceb}
                          onChange={(e) => setCodAutorizacaoReceb(e.target.value)}
                          className="mt-1"
                          placeholder="Ex: ABC123"
                        />
                      </div>
                    </>
                  )}

                  {modoParcelamento === 'automatico' && (
                    <div className="col-span-2">
                      <Label htmlFor="cod_autorizacao_auto">Nº Autorização (Opcional)</Label>
                      <Input
                        id="cod_autorizacao_auto"
                        value={codAutorizacaoReceb}
                        onChange={(e) => setCodAutorizacaoReceb(e.target.value)}
                        className="mt-1"
                        placeholder="Ex: ABC123"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ Será aplicado a todas as parcelas geradas
                      </p>
                    </div>
                  )}
                </div>

                {/* Cálculo de Tarifa */}
                {calculoTarifa && modoParcelamento === 'unica' && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-300 dark:border-blue-700">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      💰 Cálculo da Tarifa
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Valor Bruto:</span>
                        <span className="float-right font-semibold">R$ {calculoTarifa.valorBruto.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Taxa ({calculoTarifa.taxaPercentual}%):</span>
                        <span className="float-right font-semibold text-red-600">- R$ {calculoTarifa.valorTaxa.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                        <span className="text-gray-600 dark:text-gray-400">Valor Líquido:</span>
                        <span className="float-right font-bold text-green-600 text-lg">R$ {calculoTarifa.valorLiquido.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">Valor por Parcela:</span>
                        <span className="float-right font-semibold text-blue-600">R$ {calculoTarifa.valorParcela.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-500">
                        Prazo: {calculoTarifa.prazoRecebimento} dias | Operadora: {calculoTarifa.descr_operadora}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="conta_receb">Conta *</Label>
              <Select value={contaSelecionadaReceb} onValueChange={setContaSelecionadaReceb}>
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
                Conta usada no recebimento (dbconta)
              </p>
            </div>

            <div>
              <Label htmlFor="obs_receb">Observações</Label>
              <Textarea
                id="obs_receb"
                name="obs_receb"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Observações sobre o recebimento"
              />
            </div>

            {/* Seção de Informações Opcionais (Cheque/Outros) */}
            {formaPgtoReceb !== '005' && formaPgtoReceb !== '006' && (
              <details className="border rounded-lg">
                <summary className="cursor-pointer p-3 font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                  📋 Informações Adicionais (Opcional)
                </summary>
                <div className="p-4 pt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data do Documento</Label>
                      <Input type="date" value={dtCartao} onChange={(e) => setDtCartao(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Nº Documento</Label>
                      <Input value={codDocumentoReceb} onChange={(e) => setCodDocumentoReceb(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>CMC7 (Cheque)</Label>
                      <Input value={cmc7Receb} onChange={(e) => setCmc7Receb(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>ID Autenticação</Label>
                      <Input value={idAutenticacaoReceb} onChange={(e) => setIdAutenticacaoReceb(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </div>
              </details>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <AuxButton
                variant="cancel"
                onClick={() => { setModalRecebidoAberto(false); setContaSelecionada(null); }}
                text="Cancelar"
              />
              
              {modoParcelamento === 'automatico' && (formaPgtoReceb === '005' || formaPgtoReceb === '006') ? (
                <DefaultButton
                  variant="confirm"
                  onClick={handleGerarParcelasCartao}
                  text={gerandoParcelas ? "Gerando..." : "🤖 Gerar Parcelas Automático"}
                  disabled={gerandoParcelas}
                />
              ) : (
                <DefaultButton
                  variant="confirm"
                  onClick={handleDarBaixa}
                  text="Confirmar Recebimento"
                />
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      <Modal
        isOpen={modalEditarAberto}
        onClose={() => setModalEditarAberto(false)}
        title="Editar Título a Receber"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Edite os dados do título de <strong>{contaSelecionada?.nome_cliente}</strong>
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

          {/* Cliente */}
          <div>
            <Label>Cliente</Label>
            <Autocomplete
              placeholder="Buscar cliente..."
              apiUrl="/api/clientes/buscar"
              value={dadosEdicao.codcli}
              onChange={(value) => setDadosEdicao(prev => ({ ...prev, codcli: value }))}
              mapResponse={(data) => data.clientes || []}
            />
            <p className="text-xs text-gray-500 mt-1">
              Atual: {contaSelecionada?.nome_cliente} (Cód: {contaSelecionada?.codcli})
            </p>
          </div>

          {/* Conta Financeira */}
          <div>
            <Label>Conta Financeira</Label>
            <Autocomplete
              placeholder="Buscar conta..."
              apiUrl="/api/contas-receber/contas"
              value={dadosEdicao.rec_cof_id}
              onChange={(value) => setDadosEdicao(prev => ({ ...prev, rec_cof_id: value }))}
              mapResponse={(data) => data.contas || []}
            />
            <p className="text-xs text-gray-500 mt-1">
              Atual: {contaSelecionada?.descricao_conta}
            </p>
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

          {/* Número do Documento */}
          <div>
            <Label htmlFor="nro_doc_edit">Nº Documento</Label>
            <Input
              id="nro_doc_edit"
              value={dadosEdicao.nro_doc}
              onChange={(e) => setDadosEdicao(prev => ({ ...prev, nro_doc: e.target.value }))}
              className="mt-1"
              placeholder="Ex: 12345"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <AuxButton
              variant="secondary"
              onClick={() => setModalEditarAberto(false)}
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
      {modalCancelarAberto && contaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-red-600 dark:text-red-400">
              ⚠️ Cancelar Título {contaSelecionada.cod_receb}
            </h2>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Tem certeza que deseja cancelar este título? Esta ação não pode ser desfeita.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  id="motivo-cancelamento"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Descreva o motivo do cancelamento..."
                  required
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Informações do título:</strong>
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                  <li>Cliente: {contaSelecionada.nome_cliente}</li>
                  <li>Valor: {formatarMoeda(contaSelecionada.valor_original)}</li>
                  <li>Vencimento: {formatarData(contaSelecionada.dt_venc)}</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModalCancelarAberto(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  const motivo = (document.getElementById('motivo-cancelamento') as HTMLTextAreaElement)?.value;
                  if (!motivo || motivo.trim() === '') {
                    toast.error('Por favor, informe o motivo do cancelamento');
                    return;
                  }
                  handleCancelar(motivo);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {modalDetalhesAberto && contaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Detalhes do Título {contaSelecionada.cod_receb}
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cliente</p>
                <p className="text-gray-900 dark:text-white">{contaSelecionada.nome_cliente}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                <div className="mt-1">{getStatusBadge(contaSelecionada.status)}</div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor Original</p>
                <p className="text-gray-900 dark:text-white font-mono">{formatarMoeda(contaSelecionada.valor_original)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor Recebido</p>
                <p className="text-gray-900 dark:text-white font-mono">{formatarMoeda(contaSelecionada.valor_recebido)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data Vencimento</p>
                <p className="text-gray-900 dark:text-white">{formatarData(contaSelecionada.dt_venc)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data Pagamento</p>
                <p className="text-gray-900 dark:text-white">{contaSelecionada.dt_pgto ? formatarData(contaSelecionada.dt_pgto) : '-'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data Emissão</p>
                <p className="text-gray-900 dark:text-white">{formatarData(contaSelecionada.dt_emissao)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Número Documento</p>
                <p className="text-gray-900 dark:text-white font-mono">{contaSelecionada.nro_doc || '-'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Código Faturamento</p>
                <p className="text-gray-900 dark:text-white font-mono">{contaSelecionada.cod_fat || '-'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Conta Financeira</p>
                <p className="text-gray-900 dark:text-white">{contaSelecionada.descricao_conta || '-'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Banco</p>
                <p className="text-gray-900 dark:text-white">
                  {contaSelecionada.banco ? (
                    <>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{contaSelecionada.banco}</span>
                      {contaSelecionada.nome_banco && (
                        <>
                          {" - "}
                          <span>{contaSelecionada.nome_banco}</span>
                        </>
                      )}
                    </>
                  ) : '-'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Forma Faturamento</p>
                <p className="text-gray-900 dark:text-white">{contaSelecionada.forma_fat || '-'}</p>
              </div>

              {contaSelecionada.obs && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Observações</p>
                  <p className="text-gray-900 dark:text-white">{contaSelecionada.obs}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModalDetalhesAberto(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico de Recebimentos */}
      {modalHistoricoAberto && contaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Histórico de Recebimentos - Título {contaSelecionada.cod_receb}
              </h2>
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Informações do Título */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Cliente</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{contaSelecionada.nome_cliente}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Valor Original</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{formatarMoeda(contaSelecionada.valor_original)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Recebido</p>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400 font-mono">{formatarMoeda(contaSelecionada.valor_recebido)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Vencimento</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatarData(contaSelecionada.dt_venc)}</p>
                </div>
              </div>
            </div>

            {/* Tabela de Histórico */}
            {historicoRecebimentos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum recebimento registrado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data Pgto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        SF
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Observação
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Usuário
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {historicoRecebimentos.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatarData(item.dt_pgto)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {item.tipo === 'D' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Débito
                            </span>
                          ) : item.tipo === 'J' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Juros
                            </span>
                          ) : item.tipo === 'E' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Estorno
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              {item.tipo}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.sf === 'S' ? (
                            <span className="text-green-600 dark:text-green-400 font-semibold">✓ Sim</span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">✗ Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.observacao || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.codusr || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total de registros: <span className="font-semibold">{historicoRecebimentos.length}</span>
              </div>
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Conta a Receber */}
      <Modal
        isOpen={modalNovaContaAberto}
        onClose={() => {
          setModalNovaContaAberto(false);
          // Limpar formulário ao fechar
          setNovaContaDados({
            codcli: null,
            rec_cof_id: null,
            dt_venc: new Date().toISOString().split('T')[0],
            valor_pgto: 0,
            nro_doc: '',
            tipo: 'R',
            forma_fat: 'B',
            banco: '',
            parcelado: false,
            num_parcelas: 1,
            intervalo_dias: 30,
          });
          setParcelas([]);
          setNumParcelasInput('');
        }}
        title="Novo Título a Receber"
        width="w-8/9 md:w-5/6 lg:w-2/3 xl:w-1/2"
      >
        <div className="space-y-6">
          {/* Seção: Informações do Cliente */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Informações do Cliente</h3>
            <div>
              <Label>Cliente *</Label>
              <Autocomplete
                placeholder="Buscar cliente..."
                apiUrl="/api/contas-receber/clientes"
                value={novaContaDados.codcli}
                onChange={(value) => {
                  setNovaContaDados({ ...novaContaDados, codcli: value });
                }}
                mapResponse={(data) => data.clientes || []}
              />
            </div>
          </div>

          {/* Seção: Dados Financeiros */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Dados Financeiros</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Conta Financeira *</Label>
                <Autocomplete
                  placeholder="Buscar conta..."
                  apiUrl="/api/contas-receber/contas"
                  value={novaContaDados.rec_cof_id}
                  onChange={(value) => {
                    setNovaContaDados({ ...novaContaDados, rec_cof_id: value });
                  }}
                  mapResponse={(data) => 
                    (data.contas || []).map((conta: any) => ({
                      value: conta.id,
                      label: conta.label
                    }))
                  }
                />
              </div>

              <div>
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={novaContaDados.dt_venc}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, dt_venc: e.target.value })}
                />
              </div>

              <div>
                <Label>Valor do Título *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={novaContaDados.valor_pgto || ''}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, valor_pgto: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Número do Documento</Label>
                <Input
                  type="text"
                  placeholder="Ex: 001/2024"
                  value={novaContaDados.nro_doc}
                  onChange={(e) => setNovaContaDados({ ...novaContaDados, nro_doc: e.target.value })}
                />
              </div>

              <div>
                <Label>Tipo</Label>
                <Select
                  value={novaContaDados.tipo}
                  onValueChange={(value) => setNovaContaDados({ ...novaContaDados, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Recebimento</SelectItem>
                    <SelectItem value="D">Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Forma de Faturamento</Label>
                <Select
                  value={novaContaDados.forma_fat}
                  onValueChange={(value) => setNovaContaDados({ ...novaContaDados, forma_fat: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B">Boleto</SelectItem>
                    <SelectItem value="C">Carteira</SelectItem>
                    <SelectItem value="D">Depósito</SelectItem>
                    <SelectItem value="P">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Banco</Label>
                <Autocomplete
                  placeholder="Buscar banco..."
                  apiUrl="/api/contas-receber/bancos"
                  value={novaContaDados.banco}
                  onChange={(value) => {
                    setNovaContaDados({ ...novaContaDados, banco: value });
                  }}
                  mapResponse={(data) => data.bancos || []}
                />
              </div>
            </div>
          </div>

          {/* Seção: Parcelamento */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Parcelamento</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="parcelado"
                  checked={novaContaDados.parcelado}
                  onChange={(e) => {
                    setNovaContaDados({ ...novaContaDados, parcelado: e.target.checked });
                    if (!e.target.checked) {
                      setParcelas([]);
                      setNumParcelasInput('');
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="parcelado" className="cursor-pointer">Parcelar título</Label>
              </div>

              {novaContaDados.parcelado && (
                <div className="pl-6 space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Número de Parcelas</Label>
                      <Input
                        type="number"
                        min="2"
                        max="60"
                        value={numParcelasInput}
                        onChange={(e) => setNumParcelasInput(e.target.value)}
                        placeholder="Ex: 3"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const num = parseInt(numParcelasInput);
                        if (!num || num < 2 || num > 60) {
                          toast.error('Informe um número entre 2 e 60');
                          return;
                        }
                        if (!novaContaDados.dt_venc) {
                          toast.error('Informe a data de vencimento primeiro');
                          return;
                        }

                        // Gerar parcelas automaticamente (30, 60, 90 dias...)
                        const novasParcelas: { dias: number; vencimento: string }[] = [];
                        const baseDate = new Date(novaContaDados.dt_venc + 'T00:00:00');

                        for (let i = 0; i < num; i++) {
                          const parcelaDate = new Date(baseDate);
                          parcelaDate.setDate(parcelaDate.getDate() + (i * 30));
                          novasParcelas.push({
                            dias: i * 30,
                            vencimento: parcelaDate.toISOString().split('T')[0]
                          });
                        }

                        setParcelas(novasParcelas);
                        setNovaContaDados({ ...novaContaDados, num_parcelas: num });
                        toast.success(`${num} parcelas geradas!`);
                      }}
                    >
                      Gerar Parcelas
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500">
                    As parcelas serão geradas com intervalos de 30 dias a partir da data de vencimento (30, 60, 90 dias...)
                  </p>

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
                                {formatarMoeda(novaContaDados.valor_pgto / parcelas.length)}
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
                        • {parcelas.length}x de {formatarMoeda(novaContaDados.valor_pgto / parcelas.length)}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • Total: {formatarMoeda(novaContaDados.valor_pgto)}
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
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalNovaContaAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvarNovaConta}
            >
              Salvar Título
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Importação de Cartão */}
      <Modal
        isOpen={modalImportacaoCartao}
        onClose={() => {
          setModalImportacaoCartao(false);
          setArquivo(null);
          setConteudoArquivo('');
          setPreviewArquivo([]);
          setResultadoImportacao(null);
          setResultadoConciliacao(null);
          setFilialSelecionada('TODAS');
        }}
        title="Importação e Conciliação de Cartão"
        width="w-11/12 md:w-5/6 lg:w-3/4 xl:w-2/3"
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Upload de Arquivo */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="filial">Filial (Opcional)</Label>
              <Select value={filialSelecionada} onValueChange={setFilialSelecionada}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="Manaus">Manaus</SelectItem>
                  <SelectItem value="Porto Velho">Porto Velho</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Filtrar registros por filial (identificação automática por código da loja)
              </p>
            </div>

            <div>
              <Label htmlFor="arquivo_cartao">Arquivo CSV/TXT</Label>
              <div className="mt-2 flex items-center gap-4">
                <input
                  id="arquivo_cartao"
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
                      toast.error('Por favor, selecione um arquivo CSV ou TXT');
                      return;
                    }

                    setArquivo(file);
                    setResultadoImportacao(null);
                    setResultadoConciliacao(null);

                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const texto = evt.target?.result as string;
                      setConteudoArquivo(texto);
                      const linhas = texto.split('\n').slice(0, 5);
                      setPreviewArquivo(linhas);
                    };
                    reader.readAsText(file);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="arquivo_cartao"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Selecionar Arquivo
                </label>
                {arquivo && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {arquivo.name} ({(arquivo.size / 1024).toFixed(2)} KB)
                  </span>
                )}
              </div>
            </div>

            {previewArquivo.length > 0 && (
              <div>
                <Label>Preview (primeiras 5 linhas)</Label>
                <div className="mt-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  {previewArquivo.map((linha, index) => (
                    <div key={index} className="whitespace-nowrap">
                      {linha}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setArquivo(null);
                  setConteudoArquivo('');
                  setPreviewArquivo([]);
                  setResultadoImportacao(null);
                  setResultadoConciliacao(null);
                }}
                disabled={!arquivo || importando}
              >
                Limpar
              </Button>
              <Button
                onClick={async () => {
                  if (!arquivo || !conteudoArquivo) {
                    toast.error('Selecione um arquivo primeiro');
                    return;
                  }

                  try {
                    setImportando(true);

                    const response = await fetch('/api/conciliacao-cartao/importar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        arquivo: conteudoArquivo,
                        nomeArquivo: arquivo.name,
                        filtroFilial: filialSelecionada === 'TODAS' ? null : filialSelecionada
                      })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Erro ao importar arquivo');
                    }

                    setResultadoImportacao(data);
                    toast.success('✅ Importação concluída!', {
                      description: `${data.resumo.inseridos} registros inseridos`
                    });

                  } catch (error: any) {
                    toast.error(`Erro ao importar: ${error.message}`);
                  } finally {
                    setImportando(false);
                  }
                }}
                disabled={!arquivo || importando}
                className="bg-green-600 hover:bg-green-700"
              >
                {importando ? 'Importando...' : 'Importar Arquivo'}
              </Button>
            </div>
          </div>

          {/* Resultado da Importação */}
          {resultadoImportacao && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Resultado da Importação
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total de Linhas</p>
                  <p className="text-2xl font-bold text-blue-600">{resultadoImportacao.resumo.totalLinhas}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Processados</p>
                  <p className="text-2xl font-bold text-purple-600">{resultadoImportacao.resumo.registrosProcessados}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Inseridos</p>
                  <p className="text-2xl font-bold text-green-600">{resultadoImportacao.resumo.inseridos}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Duplicados</p>
                  <p className="text-2xl font-bold text-yellow-600">{resultadoImportacao.resumo.duplicados}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Erros</p>
                  <p className="text-2xl font-bold text-red-600">{resultadoImportacao.resumo.erros}</p>
                </div>
              </div>

              {resultadoImportacao.detalhesErros && resultadoImportacao.detalhesErros.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Erros Encontrados
                  </h4>
                  <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                    {resultadoImportacao.detalhesErros.map((erro: string, index: number) => (
                      <li key={index}>• {erro}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Filial: <strong>{resultadoImportacao.resumo.filial}</strong>
              </p>

              {resultadoImportacao.resumo.inseridos > 0 && (
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      try {
                        setConciliando(true);

                        const response = await fetch('/api/conciliacao-cartao/conciliar', {
                          method: 'POST'
                        });

                        const data = await response.json();

                        if (!response.ok) {
                          throw new Error(data.error || 'Erro ao processar conciliação');
                        }

                        setResultadoConciliacao(data.resultado);
                        toast.success('✅ Conciliação concluída!', {
                          description: `${data.resultado.conciliados} registros conciliados`
                        });

                      } catch (error: any) {
                        toast.error(`Erro na conciliação: ${error.message}`);
                      } finally {
                        setConciliando(false);
                      }
                    }}
                    disabled={conciliando}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {conciliando ? 'Conciliando...' : '🔄 Processar Conciliação'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Resultado da Conciliação */}
          {resultadoConciliacao && (
            <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Resultado da Conciliação
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Processados</p>
                  <p className="text-2xl font-bold text-blue-600">{resultadoConciliacao.totalProcessados}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">✅ Conciliados</p>
                  <p className="text-2xl font-bold text-green-600">{resultadoConciliacao.conciliados}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">⚠️ Não Localizados</p>
                  <p className="text-2xl font-bold text-yellow-600">{resultadoConciliacao.naoLocalizados}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">❌ Erros</p>
                  <p className="text-2xl font-bold text-red-600">{resultadoConciliacao.erros}</p>
                </div>
              </div>

              {resultadoConciliacao.detalhes && resultadoConciliacao.detalhes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Detalhes:</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {resultadoConciliacao.detalhes.slice(0, 20).map((detalhe: any, index: number) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border text-sm ${
                          detalhe.status === 'CONCILIADO'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : detalhe.status === 'NAO_LOCALIZADO'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">
                              NSU: {detalhe.nsu} | Auth: {detalhe.autorizacao}
                              {detalhe.parcela && ` | Parcela: ${detalhe.parcela}`}
                            </p>
                            <p className="text-xs mt-1 opacity-80">
                              {detalhe.mensagem}
                              {detalhe.cod_receb && ` • Cod. Receb: ${detalhe.cod_receb}`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            detalhe.status === 'CONCILIADO'
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                              : detalhe.status === 'NAO_LOCALIZADO'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                              : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          }`}>
                            {detalhe.status === 'CONCILIADO' ? '✅' : detalhe.status === 'NAO_LOCALIZADO' ? '⚠️' : '❌'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {resultadoConciliacao.detalhes.length > 20 && (
                    <p className="text-sm text-gray-500 text-center mt-2">
                      Mostrando primeiros 20 de {resultadoConciliacao.detalhes.length} registros
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
