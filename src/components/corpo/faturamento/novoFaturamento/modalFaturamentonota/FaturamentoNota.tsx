import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import ModalFormFatura from '@/components/common/ModalFormFaturamento';
import FormInput from '@/components/common/FormInput';
import SelectInput from '@/components/common/SelectInput2';
import AutocompletePessoa from '@/components/common/AutoCompletePessoa';
import SecaoCollapse from '@/components/common/SecaoCollapse';
import { Textarea } from '@/components/ui/textarea';
import DetalhesClienteModal from '../modalDetlahesCliente';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Calculator,
  Truck,
  Percent,
  Settings,
  List,
  FileSearch,
  MailCheck,
  FileSymlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { FaMoneyBill, FaNoteSticky, FaUser } from 'react-icons/fa6';
import NotaFiscalPreviewModal from '../../NotaFiscalPreviewModal';
import DetalhesProdutoModal from '../modalProdutos/DetalhesProdutoModal';
import { TrashIcon } from '@radix-ui/react-icons';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { useRouter } from 'next/router';
import nodemailer from 'nodemailer';
import { enviarEmailComAnexos } from '@/lib/emailService';
import { useParcelasPagamento } from '@/hooks/useParcelasPagamento';
import { gerarNotaFiscalValida } from '@/utils/gerarPreviewNF';
import { selecionarTipoEmissao } from '@/services/fiscal/selecionarTipoEmissao';

// --- INTERFACES ------
type StatusVendaType = {
  tipodoc: string;
  cobranca: string;
  insc07: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vendasSelecionadas?: any[];
  faturasAgrupadas?: any[];
  statusVenda: StatusVendaType;
  setStatusVenda: React.Dispatch<React.SetStateAction<StatusVendaType>>;
}

export default function FaturamentoNota({
  isOpen,
  onClose,
  vendasSelecionadas = [],
  faturasAgrupadas = [],
  statusVenda,
  setStatusVenda,
}: Props) {
  // Determina modo agrupamento ou individual
  const agrupandoFaturas = faturasAgrupadas && faturasAgrupadas.length > 0;

  // Hook para gerenciar parcelas de pagamento
  const codvendaAtual =
    vendasSelecionadas.length > 0 ? vendasSelecionadas[0].codvenda : undefined;
  const {
    parcelas: parcelasPagamento,
    loading: loadingParcelas,
    error: errorParcelas,
    atualizarParcela,
    salvarParcelas,
    buscarParcelas: refetchParcelas,
    removerParcela,
  } = useParcelasPagamento(codvendaAtual);

  // LOGS PARA DEBUG
  console.log('🚀 FaturamentoNota renderizado:', {
    faturasAgrupadas,
    agrupandoFaturas,
    vendasSelecionadas,
    isOpen,
  });

  // Estados necessários para ambos os fluxos
  const [modalidadeTransporte, setModalidadeTransporte] = useState('');
  const [percDesconto, setPercDesconto] = useState('');
  const [percAcrescimo, setPercAcrescimo] = useState('');

  // Estados para agrupamento
  const [faturasParaExibir, setFaturasParaExibir] = useState<any[]>([]);
  const [codigosFaturas, setCodigosFaturas] = useState('');
  const [totalImpostos, setTotalImpostos] = useState(0);

  // Estados para faturamento individual
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalICMS, setTotalICMS] = useState(0);
  const [totalIPI, setTotalIPI] = useState(0);
  const [totalBaseICMS, setTotalBaseICMS] = useState(0);
  const [totalBaseIPI, setTotalBaseIPI] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [acrescimo, setAcrescimo] = useState(0);
  const [nroformulario, setNroformulario] = useState('');
  const [frete, setFrete] = useState('0');
  const [vendedor, setVendedor] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [data, setData] = useState('');
  const [pedido, setPedido] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [incluirDescontoNF, setIncluirDescontoNF] = useState(true);
  const [incluirAcrescimoNF, setIncluirAcrescimoNF] = useState(true);
  const [informarDescontoCorpo, setInformarDescontoCorpo] = useState(true);
  const [informarAcrescimoCorpo, setInformarAcrescimoCorpo] = useState(true);
  const [vendedorExterno, setVendedorExterno] = useState('0.00');
  const [vendedorInterno, setVendedorInterno] = useState('0.00');
  const [diferenciada, setDiferenciada] = useState(false);
  const [modalcliente, setModalcliente] = useState(false);
  const [especie, setEspecie] = useState('');
  const [marca, setMarca] = useState('');
  const [numero, setNumero] = useState('');
  const [editingDias, setEditingDias] = useState<Record<string, string>>({});
  const [pesoBruto, setPesoBruto] = useState('');
  const [pesoLiquido, setPesoLiquido] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [vendaData, setVendaData] = useState<any | null>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [fatura, setFatura] = useState<any>(null);
  // Estados para armazenar dados completos para emissão da NF-e
  const [dadosVenda, setDadosVenda] = useState<any>(null);
  const [dadosFatura, setDadosFatura] = useState<any>(null);
  const [itensVenda, setItensVenda] = useState<any[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any>(null);
  const [faturaSelecionadaItens, setFaturaSelecionadaItens] =
    useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [ipi, setIpi] = useState('0.00');
  const navigate = useRouter();
  const [icmsSuframa, setIcmsSuframa] = useState('0.00');

  // --- ESTADOS DE MENSAGENS ---
  const [textoBuscaMensagem, setTextoBuscaMensagem] = useState('');
  const [mensagensNF, setMensagensNF] = useState<Mensagem[]>([]);
  const [todasMensagens, setTodasMensagens] = useState<Mensagem[]>([]);
  const [sugestoes, setSugestoes] = useState<Mensagem[]>([]);
  const [isMensagemModalOpen, setIsMensagemModalOpen] = useState(false);

  // --- ESTADOS DE COBRANÇA (INTEGRADOS) ---
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [tiposDocumentoOriginais, setTiposDocumentoOriginais] = useState<
    { codigo: string; descricao: string }[]
  >([]);
  const [parcelas, setParcelas] = useState<
    { dias: number; vencimento: string }[]
  >([]);
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresa | null>(null);
  const [dadosSacado, setDadosSacado] = useState<DadosSacado | null>(null);
  const [formCobranca, setFormCobranca] = useState({
    banco: '',
    tipoFatura: 'BOLETO',
    prazoSelecionado: '',
    valorVista: '',
    habilitarValor: false,
    impostoNa1Parcela: false,
    freteNa1Parcela: false,
  });
  const [boletoPreviewURL, setBoletoPreviewURL] = useState<string | null>(null);
  const [isBoletoPreviewOpen, setIsBoletoPreviewOpen] = useState(false);

  type StatusVendaType = {
    tipodoc: string;
    cobranca: string;
    insc07: string;
  };

  interface Mensagem {
    codigo: number;
    mensagem: string;
  }

  interface Banco {
    banco: string;
    nome: string;
  }

  interface DadosEmpresa {
    cgc?: string;
    inscricaoestadual?: string;
    nomecontribuinte?: string;
    municipio?: string;
    uf?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    telefone?: string;
    [key: string]: any;
  }

  interface DadosSacado {
    codcli?: string;
    nomefant?: string;
    cpfcgc?: string;
    ender?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    [key: string]: any;
  }

  type ParcelaPreview = {
    documento: string;
    vencimento: string;
    valor: number;
    nossoNumero: string;
    tipo: string;
    banco: string;
  };

  // --- COMPONENTES DE MODAL AUXILIARES ---
  const ModalNovaMensagem = ({
    isOpen,
    onClose,
    onSave,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (texto: string) => Promise<void>;
  }) => {
    const [texto, setTexto] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Garante que todos hooks sejam chamados antes do return
    if (!isOpen) {
      // Chama todos hooks e variáveis de estado antes do return
      // ...existing code...
      return null;
    }

    const handleSave = async () => {
      if (!texto.trim()) {
        toast.warning('Por favor, digite uma mensagem.');
        return;
      }
      setIsSaving(true);
      try {
        await onSave(texto);
        setTexto('');
        onClose();
      } catch (error) {
        console.error('Erro ao salvar mensagem:', error);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] uppercase">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            CADASTRAR NOVA MENSAGEM
          </h3>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="DIGITE A NOVA MENSAGEM PARA A NOTA FISCAL..."
            className="w-full h-[100px] bg-white dark:bg-zinc-800"
            name="nova-mensagem-modal"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
              disabled={isSaving}
            >
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              className="h-10 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md border border-blue-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? 'SALVANDO...' : 'SALVAR'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const BoletoPreviewModal = ({
    isOpen,
    onClose,
    url,
  }: {
    isOpen: boolean;
    onClose: () => void;
    url: string | null;
  }) => {
    if (!isOpen || !url) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[9999] uppercase">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              PREVIEW DO BOLETO
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl"
            >
              &times;
            </button>
          </div>
          <iframe
            src={url}
            className="w-full h-full border-none rounded"
            title="PREVIEW DO BOLETO"
          />
        </div>
      </div>
    );
  };

  // --- COMPONENTE PRINCIPAL: FaturamentoNota ---

  // --- FUNÇÕES DE MENSAGENS ---
  const handleBuscaMensagemChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const valor = e.target.value;
    setTextoBuscaMensagem(valor.trim());
    if (valor.length > 0) {
      // Filtro robusto: ignora acentuação, espaços e case
      const normalize = (str: string) =>
        str
          .normalize('NFD')
          .replace(/[ -]/g, '')
          .replace(/\s+/g, '')
          .toLowerCase();
      const busca = normalize(valor);
      let sugestoesFiltradas;
      // Se o valor for exatamente igual ao código, retorna só essa mensagem
      const mensagemCodigo = todasMensagens.find(
        (m) => m.codigo.toString() === valor.trim(),
      );
      if (mensagemCodigo) {
        sugestoesFiltradas = [mensagemCodigo];
      } else {
        sugestoesFiltradas = todasMensagens.filter(
          (m) =>
            normalize(m.mensagem).includes(busca) &&
            !mensagensNF.some((mn) => mn.codigo === m.codigo),
        );
      }
      setSugestoes(sugestoesFiltradas);
    } else {
      setSugestoes([]);
    }
  };

  const handleSelecionarSugestao = (mensagem: Mensagem) => {
    setMensagensNF((prev) => [...prev, mensagem]);
    setTextoBuscaMensagem('');
    setSugestoes([]);
  };

  const removerMensagem = (codigoParaRemover: number) => {
    setMensagensNF(
      mensagensNF.filter((msg) => msg.codigo !== codigoParaRemover),
    );
  };

  const handleSalvarNovaMensagem = async (texto: string) => {
    try {
      const { data: result } = await axios.post(
        '/api/faturamento/mensagemNF_cadastrar',
        { mensagem: texto },
      );
      if (result.sucesso) {
        const novaMsgCadastrada = result.data;
        setTodasMensagens([...todasMensagens, novaMsgCadastrada]);
        setMensagensNF([...mensagensNF, novaMsgCadastrada]);
        toast.success('Mensagem cadastrada e adicionada!');
      } else {
        throw new Error(result.error || 'Falha ao criar a mensagem.');
      }
    } catch (error: any) {
      console.error('Erro ao adicionar mensagem:', error);
      toast.error(
        error.response?.data?.error || 'Não foi possível adicionar a mensagem.',
      );
    }
  };

  // --- FUNÇÕES DE COBRANÇA (INTEGRADAS) ---
  const handleCobrancaChange = (field: string, value: any) => {
    setFormCobranca((prev) => ({ ...prev, [field]: value }));
  };

  const gerarDataVencimento = (prazoEmDias: string | number): string => {
    const dias = parseInt(String(prazoEmDias), 10);
    if (isNaN(dias)) return '';
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + dias);
    return hoje.toLocaleDateString('pt-BR');
  };

  const opcoesTipoFatura = useMemo(() => {
    if (!formCobranca.banco) return [];
    const bancoSelecionado = bancos.find((b) => b.banco === formCobranca.banco);
    if (bancoSelecionado?.nome === 'MELO') {
      // Adiciona CARTEIRA como opção especial
      const carteira = { codigo: 'W', descricao: 'CARTEIRA' };
      const todasOpcoes = [carteira, ...tiposDocumentoOriginais];

      // Remove duplicatas baseado no código
      const opcoesUnicas = todasOpcoes.reduce((acc, doc) => {
        if (!acc.find((item) => item.codigo === doc.codigo)) {
          acc.push(doc);
        }
        return acc;
      }, [] as typeof todasOpcoes);

      return opcoesUnicas.map((doc) => ({
        value: doc.descricao,
        label: doc.descricao,
      }));
    }
    return [{ value: 'BOLETO', label: 'BOLETO' }];
  }, [formCobranca.banco, tiposDocumentoOriginais, bancos]);

  // Usar dados calculados da API se disponíveis, senão usar cálculos hardcoded como fallback
  const dadosResumoFinanceiro = vendaData?.resumoFinanceiro;

  // Usar totalGeral do backend se disponível, senão calcular localmente

  const totalNF = dadosResumoFinanceiro?.totalGeral ?? (
    totalProdutos - Number(desconto) + Number(acrescimo) + Number(frete)
  );
  const previewParcelas = useMemo<ParcelaPreview[]>(() => {
    // Usa parcelasPagamento (do hook) se disponível, senão usa parcelas (estado local)
    const parcelasParaUsar =
      parcelasPagamento.length > 0 ? parcelasPagamento : parcelas;

    if (parcelasParaUsar.length === 0) return [];

    let valorLiquido = totalNF;
    if (formCobranca.habilitarValor && formCobranca.valorVista) {
      valorLiquido -= parseFloat(formCobranca.valorVista) || 0;
    }
    let valorBaseParcela =
      parcelasParaUsar.length > 0 ? valorLiquido / parcelasParaUsar.length : 0;
    const parcelasCalculadas = parcelasParaUsar.map((p, index) => {
      // Suporta ambos os formatos: ParcelaPagamento (dia) e parcela local (dias)
      const diasPrazo = 'dia' in p ? p.dia : 'dias' in p ? p.dias : 0;

      return {
        documento: `NF${nroformulario}${String.fromCharCode(65 + index)}`,
        vencimento: gerarDataVencimento(diasPrazo),
        valor: valorBaseParcela,
        nossoNumero: `693913${index + 1}`,
        tipo: formCobranca.tipoFatura,
        banco: formCobranca.banco,
      };
    });
    if (parcelasCalculadas.length > 0) {
      if (formCobranca.impostoNa1Parcela) {
        // Implementar lógica de imposto se necessário
      }
      if (formCobranca.freteNa1Parcela) {
        parcelasCalculadas[0].valor += parseFloat(frete) || 0;
      }
    }
    return parcelasCalculadas;
  }, [
    parcelas,
    parcelasPagamento,
    formCobranca,
    totalNF,
    nroformulario,
    frete,
  ]);

  // --- FUNÇÕES DE PROCESSAMENTO ---
  const handleEmitirNotaExterna = async (payload: any) => {
    console.log('🚀 DEBUG - handleEmitirNotaExterna chamado com payload:', {
      tem_codfat: !!payload?.codfat,
      codfat_valor: payload?.codfat,
      tem_cliente: !!payload?.dbclien,
      cliente_email: payload?.dbclien?.email,
      cliente_cpfcgc: payload?.dbclien?.cpfcgc,
      cliente_tipo: payload?.dbclien?.tipo,
    });
    
    // 🎯 DECISÃO AUTOMÁTICA: NF-e (CNPJ) ou NFC-e (CPF)
    // O campo correto é 'cpfcgc' dentro de dbclien
    const documentoCliente = payload?.dbclien?.cpfcgc || '';
    
    console.log('🔍 DEBUG - Documento do cliente ANTES da seleção:', {
      dbclien_completo: payload?.dbclien ? Object.keys(payload.dbclien) : 'undefined',
      cpfcgc_raw: payload?.dbclien?.cpfcgc,
      cpfcgc_usado: documentoCliente,
      cpfcgc_limpo: documentoCliente.replace(/\D/g, ''),
      tamanho_limpo: documentoCliente.replace(/\D/g, '').length
    });
    
    const selecao = selecionarTipoEmissao(documentoCliente);

    console.log('📋 Tipo de emissão selecionado:', {
      documento: documentoCliente,
      documentoLimpo: documentoCliente.replace(/\D/g, ''),
      tamanho: documentoCliente.replace(/\D/g, '').length,
      tipoEmissao: selecao.tipoEmissao,
      modelo: selecao.modelo,
      descricao: selecao.descricao,
      endpoint: selecao.endpoint,
    });

    // Chamar a API apropriada baseado no tipo de documento
    const res = await axios.post(selecao.endpoint, payload);
    
    console.log('📨 DEBUG - Resposta da API de emissão:', {
      sucesso: res.data?.sucesso,
      emailEnviado: res.data?.emailEnviado,
      emailsTeste: res.data?.emailsTeste,
      status: res.data?.status,
      tipoEmissao: selecao.tipoEmissao,
      modelo: selecao.modelo,
    });

    if (!res.data || !res.data.sucesso) {
      throw new Error(
        res.data.motivo || `Falha ao emitir ${selecao.descricao}.`,
      );
    }

    // Adicionar informações do tipo de emissão na resposta
    return {
      ...res.data,
      tipoEmissao: selecao.tipoEmissao,
      modelo: selecao.modelo,
      descricao: selecao.descricao,
    };
  };

  const handleSalvarFaturaLocal = async () => {
    console.log('🏪 Iniciando salvamento da fatura...', {
      agrupandoFaturas,
      temFaturasAgrupadas: faturasAgrupadas?.length > 0,
      temVendasSelecionadas: vendasSelecionadas?.length > 0,
    });

    if (agrupandoFaturas && faturasAgrupadas && faturasAgrupadas.length > 0) {
      // MODO AGRUPAMENTO: Criar grupo de pagamento com faturas existentes
      console.log('📦 Salvando como AGRUPAMENTO...');

      const codfats = faturasAgrupadas
        .map((item) => item.faturas[0]?.codfat)
        .filter(Boolean);
      console.log('🔗 Faturas para agrupar:', codfats);

      const payloadGrupo = {
        codfats: codfats,
        codcli: cliente?.codcli,
      };

      const res = await axios.post(
        '/api/faturamento/grupo-pagamento',
        payloadGrupo,
      );
      if (!res.data || res.data.error) {
        throw new Error(res.data.error || 'Falha ao criar grupo de pagamento.');
      }

      console.log('✅ Grupo de pagamento criado:', res.data);
      return res.data.codgp; // Retorna o código do grupo
    } else {
      // MODO INDIVIDUAL: Criar fatura normal
      console.log('👤 Salvando como INDIVIDUAL...');

      const payload = {
        cliente,
        vendedor,
        transportadora,
        data,
        pedido,
        totalprod: totalProdutos,
        totalfat: totalNF,
        totalnf: totalNF, // ✅ Total da NF mapeado
        cod_conta: formCobranca?.banco || null, // ✅ cod_conta vindo do formulário de cobrança (renomeado)
        tipodoc: statusVenda?.tipodoc ?? 'N',
        cobranca: statusVenda?.cobranca ?? 'S',
        insc07: statusVenda?.insc07 ?? 'N',
        observacoes,
        vendas: vendasSelecionadas.map((v) => v.codvenda),
        usuario_associacao: cliente?.codcli || '',
      };

      const res = await axios.post('/api/faturamento/salvar', payload);
      if (!res.data || !res.data.sucesso) {
        throw new Error(res.data.error || 'Falha ao salvar a fatura.');
      }

      console.log('✅ Fatura individual criada:', res.data.codfat);
      return res.data.codfat;
    }
  };

  const handleSalvarMensagensFatura = async (codfat: string) => {
    if (mensagensNF.length === 0) return;
    const codigosMensagens = mensagensNF.map((msg) => String(msg.codigo));
    try {
      await axios.post('/api/faturamento/mensagemNF_salvar', {
        codfat: codfat,
        codigos_mensagens: codigosMensagens,
      });
    } catch (error: any) {
      console.error('Erro ao salvar mensagens da fatura:', error);
      throw new Error(
        'A fatura foi salva, mas houve um erro ao associar as mensagens.',
      );
    }
  };

  const handleSalvarDadosCobranca = async (codfat: string) => {
    console.log('🔄 handleSalvarDadosCobranca chamado com:', {
      codfat,
      statusVenda,
      formCobranca,
      parcelas,
      parcelasPagamento,
    });

    if (statusVenda.cobranca !== 'S') {
      console.log('❌ Cobrança não habilitada, pulando salvamento');
      return;
    }
    // Verifica se é um tipo de documento que requer parcelas
    const requerParcelas =
      formCobranca.tipoFatura === 'BOLETO' ||
      formCobranca.tipoFatura === 'BOLETO BANCARIO';

    // Combinar parcelas manuais e salvas para o preview
    const combinedParcelas = parcelas
      .map((p, idx) => ({
        ...p,
        isSaved: false,
        originalIndex: idx,
      }))
      .concat(
        parcelasPagamento.map((p) => ({
          ...p,
          isSaved: true,
          dias: p.dia,
          vencimento: p.data.split('T')[0],
          originalIndex: -1,
        })),
      )
      .sort(
        (a, b) =>
          new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime(),
      );

    console.log('📋 Verificação de parcelas:', {
      requerParcelas,
      parcelasLength: parcelas.length,
      combinedParcelasLength: combinedParcelas.length,
    });

    if (requerParcelas && combinedParcelas.length === 0) {
      throw new Error('Para gerar cobrança, adicione ao menos uma parcela.');
    }

    // Obtém o codvenda da primeira venda selecionada (se houver)
    const codvenda =
      vendasSelecionadas.length > 0 ? vendasSelecionadas[0].codvenda : null;

    try {
      console.log('📤 Enviando dados para API salvar-cobranca:', {
        codfat,
        codcli: cliente?.codcli,
        banco: formCobranca.banco,
        tipofat: formCobranca.tipoFatura,
        codvenda,
        parcelasCount: combinedParcelas.length,
        parcelas: combinedParcelas.map((p) => ({
          vencimento: p.vencimento,
          dias: p.dias,
          isSaved: p.isSaved,
        })),
      });

      await axios.post('/api/faturamento/salvar-cobranca', {
        codfat: codfat,
        codcli: cliente?.codcli,
        banco: formCobranca.banco,
        tipofat: formCobranca.tipoFatura,
        tipoDoc: formCobranca.tipoFatura,
        codvenda: codvenda, // Novo parâmetro para salvar parcelas na dbprazo_pagamento
        parcelas: requerParcelas
          ? combinedParcelas.map((p, index) => ({
              vencimento: p.vencimento,
              valor: totalNF / combinedParcelas.length, // Dividir o valor total pelas parcelas
              documento: `NF${nroformulario}${String.fromCharCode(65 + index)}`,
              nossoNumero: `693913${index + 1}`,
            }))
          : [],
      });
    } catch (error: any) {
      console.error('Erro ao salvar cobrança:', error);
      throw new Error(
        error.response?.data?.error || 'Falha ao salvar os dados da cobrança.',
      );
    }
  };

  const handleEnviarEmailCobranca = async (codfat: string) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`Cobrança por e-mail para fatura ${codfat} enviada.`);
    } catch (error: any) {
      console.error('Erro ao enviar cobrança por e-mail:', error);
      throw new Error(
        error.response?.data?.error || 'Falha ao enviar a cobrança por e-mail.',
      );
    }
  };

  const handleVerItensFatura = async () => {
    if (vendasSelecionadas.length === 0) {
      toast.info('Nenhum item na fatura para detalhar.');
      return;
    }
    const loadingToast = toast.loading('Buscando detalhes do item...');
    try {
      const venda = vendasSelecionadas[0];
      const nroOuCod = venda?.nrovenda || venda?.codvenda;
      if (!nroOuCod) {
        toast.error('Não foi possível encontrar o número ou código da venda.');
        toast.dismiss(loadingToast);
        return;
      }
      const { data } = await axios.get(
        `/api/faturamento/detalhes-venda?nrovenda=${nroOuCod}`,
      );
      setVendaData(data);
      const primeiroProduto = data.dbitvenda?.[0];
      if (!primeiroProduto) {
        toast.error('Nenhum produto encontrado para esta venda.');
        toast.dismiss(loadingToast);
        return;
      }
      setProdutoSelecionado(primeiroProduto);
      setIsProdutoModalOpen(true);
      toast.dismiss(loadingToast);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao buscar detalhes do produto.');
      console.error(err);
    }
  };

  const handleGerarPreview = () => {
    const dadosParaPreview = {
      fatura: {
        cliente: cliente,
        vendedor: { nome: vendedor },
        data: data,
        totalnf: totalNF,
        totalprod: totalProdutos,
        desconto: desconto,
        acrescimo: acrescimo,
        totalfrete: frete,
        obs: observacoes,
      },
      venda: {
        nrovenda: pedido,
      },
      produtos: vendasSelecionadas,
    };
    setPreviewData(dadosParaPreview);
    setIsPreviewOpen(true);
  };

  const handleProcessoCompleto = async (faturasAgrupadasParam?: any[]) => {
    // Criar janela imediatamente para evitar bloqueio de pop-up
    let pdfWindow: Window | null = window.open('about:blank', '_blank');
    if (!pdfWindow) {
      toast.error(
        'A abertura da nova aba foi bloqueada. Por favor, habilite os pop-ups para este site.',
      );
      return;
    }

    // Mostrar loading na janela
    pdfWindow.document.write(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8f9fa;">
        <div style="display: inline-block; position: relative;">
          <div style="border: 4px solid #e3e3e3; border-top: 4px solid #10b981; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 30px;"></div>
        </div>
        <h2 style="color: #333; margin-bottom: 15px; font-weight: 600;">Processando sua solicitação...</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5;">Aguarde enquanto salvamos os dados e processamos a nota fiscal.</p>
        <p style="color: #10b981; font-size: 14px; margin-top: 20px;">✅ Esta janela será atualizada automaticamente</p>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </div>
    `);

    const comCobranca = statusVenda.cobranca === 'S';
    // Para agrupamento: salvamento (1) + cobrança opcional (2) + geração agrupamento (1) + notificação (1)
    // Para individual: salvamento (1) + cobrança opcional (2) + emissão nota fiscal (2) ddd
    const totalSteps = agrupandoFaturas
      ? comCobranca
        ? 5
        : 2 // Agrupamento: salvamento + cobrança (opcional) + geração + notificação
      : comCobranca
      ? 5
      : 3; // Individual: salvamento + cobrança (opcional) + nota fiscal

    // Função helper para atualizar a janela com progresso
    const updateWindowProgress = (
      currentStep: number,
      stepName: string,
      status: 'loading' | 'success' | 'error' = 'loading',
      errorMessage?: string,
      additionalInfo?: string,
    ) => {
      if (!pdfWindow || pdfWindow.closed) return;

      const steps = agrupandoFaturas
        ? [
            'Salvando dados da fatura',
            ...(comCobranca ? ['Configurando cobrança'] : []),
            'Criando agrupamento',
            'Enviando notificação',
            'Finalizando processo',
          ]
        : [
            'Salvando dados da fatura',
            ...(comCobranca ? ['Configurando cobrança'] : []),
            'Emitindo nota fiscal',
            'Gerando PDF',
          ];

      const stepsList = steps
        .map((step, index) => {
          const stepNumber = index + 1;
          let icon = '';
          let statusClass = '';
          let bgColor = '';
          let borderColor = '';

          if (stepNumber < currentStep) {
            icon = `<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            statusClass = 'completed';
            bgColor = '#f0fdf4';
            borderColor = '#86efac';
          } else if (stepNumber === currentStep) {
            if (status === 'success') {
              icon = `<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
              statusClass = 'completed';
              bgColor = '#f0fdf4';
              borderColor = '#86efac';
            } else if (status === 'error') {
              icon = `<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
              statusClass = 'error';
              bgColor = '#fef2f2';
              borderColor = '#fca5a5';
            } else {
              icon = `<div class="spinner-current"></div>`;
              statusClass = 'active';
              bgColor = '#eff6ff';
              borderColor = '#93c5fd';
            }
          } else {
            icon = `<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle></svg>`;
            statusClass = 'pending';
            bgColor = '#f9fafb';
            borderColor = '#e5e7eb';
          }

          return `
          <div class="step-item ${statusClass}" style="
            display: flex; 
            align-items: center; 
            margin: 12px 0; 
            padding: 16px 20px; 
            border-radius: 12px; 
            background: ${bgColor};
            border: 2px solid ${borderColor};
            transition: all 0.3s ease;
            box-shadow: ${stepNumber === currentStep ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'};
          ">
            <div style="
              min-width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 16px;
            ">
              ${icon}
            </div>
            <div style="flex: 1;">
              <div style="
                font-size: 16px;
                font-weight: ${stepNumber === currentStep ? '600' : '500'};
                color: ${stepNumber < currentStep ? '#059669' : stepNumber === currentStep ? (status === 'error' ? '#dc2626' : '#2563eb') : '#6b7280'};
                margin-bottom: 4px;
              ">
                ${stepNumber}. ${step}
              </div>
              ${stepNumber === currentStep && status === 'loading' ? `
                <div style="
                  font-size: 13px;
                  color: #6b7280;
                  margin-top: 4px;
                ">
                  Processando...
                </div>
              ` : ''}
            </div>
          </div>
        `;
        })
        .join('');

      pdfWindow.document.open();
      pdfWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processando Fatura #${novoCodfat || '...'}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: #f3f4f6;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            
            .container {
              max-width: 700px;
              width: 100%;
              background: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              overflow: hidden;
              border: 1px solid #e5e7eb;
            }
            
            .header {
              background: white;
              color: #111827;
              padding: 24px 30px;
              text-align: center;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #111827;
            }
            
            .header p {
              font-size: 14px;
              color: #6b7280;
            }
            
            .content {
              padding: 30px;
              background: #ffffff;
            }
            
            .progress-bar-container {
              background: #e5e7eb;
              border-radius: 4px;
              height: 6px;
              margin: 20px 0 30px 0;
              overflow: hidden;
            }
            
            .progress-bar {
              height: 100%;
              background: #3b82f6;
              transition: width 0.5s ease;
              border-radius: 4px;
            }
            
            .info-card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin-bottom: 20px;
            }
            
            .info-card h3 {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
              font-weight: 600;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
            
            .info-item {
              display: flex;
              flex-direction: column;
            }
            
            .info-label {
              font-size: 11px;
              color: #9ca3af;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .info-value {
              font-size: 15px;
              color: #111827;
              font-weight: 600;
            }
            
            .alert {
              border-radius: 6px;
              padding: 14px 16px;
              margin: 20px 0;
              display: flex;
              align-items: flex-start;
              gap: 12px;
              border: 1px solid;
            }
            
            .alert-error {
              background: #fef2f2;
              border-color: #fecaca;
            }
            
            .alert-info {
              background: #eff6ff;
              border-color: #bfdbfe;
            }
            
            .alert-success {
              background: #f0fdf4;
              border-color: #bbf7d0;
            }
            
            .alert-icon {
              flex-shrink: 0;
              width: 20px;
              height: 20px;
            }
            
            .alert-content {
              flex: 1;
            }
            
            .alert-title {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 4px;
            }
            
            .alert-message {
              font-size: 13px;
              line-height: 1.5;
              color: #4b5563;
            }
            
            .footer {
              background: #f9fafb;
              padding: 16px 30px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            
            .footer p {
              font-size: 13px;
              color: #6b7280;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            
            .spinner-main {
              display: inline-block;
              width: 48px;
              height: 48px;
              border: 4px solid #e5e7eb;
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 16px;
            }
            
            .spinner-current {
              display: inline-block;
              width: 18px;
              height: 18px;
              border: 2px solid #e5e7eb;
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            
            .w-6 { width: 24px; }
            .h-6 { height: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${status === 'loading' && currentStep <= totalSteps ? `
                <div class="spinner-main"></div>
              ` : status === 'success' ? `
                <svg style="width: 48px; height: 48px; margin-bottom: 16px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              ` : status === 'error' ? `
                <svg style="width: 48px; height: 48px; margin-bottom: 16px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              ` : ''}
              <h1>
                ${status === 'error' ? 'Erro no Processamento' : status === 'success' ? 'Processo Concluído' : 'Processando Fatura'}
              </h1>
              <p>
                ${status === 'error' ? 'Houve um problema durante o processo' : status === 'success' ? 'Todas as etapas foram concluídas' : `Etapa ${currentStep} de ${totalSteps}: ${stepName}`}
              </p>
            </div>
            
            <div class="content">
              ${novoCodfat ? `
                <div class="info-card">
                  <h3>Informações da Fatura</h3>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Código da Fatura</span>
                      <span class="info-value">#${novoCodfat}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Tipo</span>
                      <span class="info-value">${agrupandoFaturas ? 'Agrupamento' : 'Individual'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Status</span>
                      <span class="info-value" style="color: ${status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#3b82f6'};">
                        ${status === 'error' ? 'Erro' : status === 'success' ? 'Sucesso' : 'Processando'}
                      </span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Etapa Atual</span>
                      <span class="info-value">${currentStep}/${totalSteps}</span>
                    </div>
                  </div>
                </div>
              ` : ''}
              
              <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${(currentStep / totalSteps) * 100}%;"></div>
              </div>
              
              <div style="margin: 24px 0;">
                ${stepsList}
              </div>
              
              ${status === 'error' && errorMessage ? `
                <div class="alert alert-error">
                  <svg class="alert-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: #dc2626;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <div class="alert-content">
                    <div class="alert-title" style="color: #dc2626;">Erro Detectado</div>
                    <div class="alert-message">${errorMessage}</div>
                  </div>
                </div>
              ` : ''}
              
              ${additionalInfo && status !== 'error' ? `
                <div class="alert alert-info">
                  <svg class="alert-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: #3b82f6;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div class="alert-content">
                    <div class="alert-message">${additionalInfo}</div>
                  </div>
                </div>
              ` : ''}
              
              ${status === 'success' && !errorMessage ? `
                <div class="alert alert-success">
                  <svg class="alert-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: #10b981;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div class="alert-content">
                    <div class="alert-title" style="color: #10b981;">Processo Concluído</div>
                    <div class="alert-message">Todos os dados foram processados com sucesso!</div>
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>
                ${status === 'error' ? 'Esta janela pode ser fechada.' : status === 'success' ? 'Processo finalizado com sucesso!' : 'Aguarde... Esta janela será atualizada automaticamente.'}
              </p>
            </div>
          </div>
        </body>
        </html>
      `);
      pdfWindow.document.close();
    };
    const loadingToast = toast.loading('Iniciando processo...');

    let etapa = '';
    let novoCodfat = '';
    let respostaEmissao: any = null;
    let todasEtapasSucesso = false; // Flag para controlar redirecionamento

    console.log('🚀 Iniciando processo de faturamento:', {
      comCobranca,
      agrupandoFaturas,
      statusVenda,
      formCobranca,
    });

    try {
      etapa = 'salvamento dos dados da fatura e mensagens';
      updateWindowProgress(
        1,
        agrupandoFaturas
          ? 'Preparando Agrupamento de Faturas'
          : 'Salvando dados da Fatura',
      );
      toast.loading(
        `[1/${totalSteps}] ${
          agrupandoFaturas
            ? 'Preparando Agrupamento de Faturas'
            : 'Salvando dados da Fatura'
        }...`,
        {
          id: loadingToast,
        },
      );
      novoCodfat = await handleSalvarFaturaLocal();
      await handleSalvarMensagensFatura(novoCodfat);
      updateWindowProgress(
        1,
        'Dados da fatura salvos',
        'success',
        undefined,
        `Código da fatura: ${novoCodfat}`,
      );

      // REMOVIDO: Abrir preview automático após salvar fatura
      // Para evitar que o modal abra sozinho, vou comentar essa seção

      // try {
      //   console.log('🔄 Abrindo espelho da nota em nova aba...');

      //   // Usar função mais simples - apenas abrir nova aba com dados de preview
      //   const dadosParaPreview = {
      //     fatura: {
      //       cliente: cliente,
      //       vendedor: { nome: vendedor },
      //       data: data,
      //       totalnf: totalNF,
      //       totalprod: totalProdutos,
      //       desconto: desconto,
      //       acrescimo: acrescimo,
      //       totalfrete: frete,
      //       obs: observacoes,
      //     },
      //     venda: {
      //       nrovenda: pedido,
      //     },
      //     produtos: vendasSelecionadas,
      //   };

      //   // Por enquanto, abrir modal de preview em vez de nova aba para evitar erros de tipagem
      //   setPreviewData(dadosParaPreview);
      //   setIsPreviewOpen(true);

      //   console.log('✅ Preview da nota aberto');

      // } catch (pdfError) {
      //   console.warn('⚠️ Erro ao abrir preview:', pdfError);
      // }

      console.log('✅ Fatura salva com sucesso, código:', novoCodfat);

      if (comCobranca) {
        console.log(
          '✅ Condição comCobranca atendida, iniciando salvamento de cobrança',
        );
        etapa = 'salvamento dos dados da cobrança';
        let currentStepNum = 2;
        updateWindowProgress(
          currentStepNum,
          agrupandoFaturas
            ? 'Configurando Cobrança Agrupada'
            : 'Salvando dados da Cobrança',
        );
        toast.loading(
          `[${currentStepNum}/${totalSteps}] ${
            agrupandoFaturas
              ? 'Configurando Cobrança Agrupada'
              : 'Salvando dados da Cobrança'
          }...`,
          {
            id: loadingToast,
          },
        );
        await handleSalvarDadosCobranca(novoCodfat);
        // Salvar parcelas na nova tabela se houver
        if (parcelas.length > 0 && dadosVenda.codvenda) {
          await salvarParcelas(
            dadosVenda.codvenda,
            parcelas.map((p) => ({ dia: p.dias })),
          );
        }
        updateWindowProgress(currentStepNum, 'Cobrança configurada', 'success');

        etapa = 'envio de e-mail da cobrança';
        currentStepNum = 3;
        updateWindowProgress(
          currentStepNum,
          agrupandoFaturas
            ? 'Configurando E-mail da Cobrança Agrupada'
            : 'Enviando Cobrança por E-mail',
        );
        toast.loading(
          `[${currentStepNum}/${totalSteps}] ${
            agrupandoFaturas
              ? 'Configurando E-mail da Cobrança Agrupada'
              : 'Enviando Cobrança por E-mail'
          }...`,
          {
            id: loadingToast,
          },
        );
        await handleEnviarEmailCobranca(novoCodfat);
        updateWindowProgress(
          currentStepNum,
          'E-mail de cobrança enviado',
          'success',
        );
      }

      // Para agrupamento, não emitir nota fiscal - apenas salvar os dados
      if (agrupandoFaturas) {
        // Etapa específica para agrupamento - criação do grupo
        etapa = 'criação do agrupamento de faturas';
        const stepAgrupamento = comCobranca ? 4 : 2;
        updateWindowProgress(stepAgrupamento, 'Gerando Agrupamento de Faturas');
        toast.loading(
          `[${stepAgrupamento}/${totalSteps}] Gerando Agrupamento de Faturas...`,
          {
            id: loadingToast,
          },
        );

        // Simular um pequeno delay para mostrar a etapa
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateWindowProgress(stepAgrupamento, 'Agrupamento criado', 'success');

        // Se tem cobrança, mostrar etapa de envio de email
        if (comCobranca) {
          etapa = 'finalização e notificação do agrupamento';
          const stepFinal = 5;
          updateWindowProgress(stepFinal, 'Enviando Confirmação por E-mail');
          toast.loading(
            `[${stepFinal}/${totalSteps}] Enviando Confirmação por E-mail...`,
            {
              id: loadingToast,
            },
          );

          // Simular delay do envio de email
          await new Promise((resolve) => setTimeout(resolve, 1500));
          updateWindowProgress(stepFinal, 'Confirmação enviada', 'success');
        }

        toast.success(
          `Agrupamento de faturas criado com sucesso! Código: ${novoCodfat}`,
          {
            id: loadingToast,
            duration: 6000,
          },
        );

        // Abrir a janela apenas após o sucesso do agrupamento
        if (!pdfWindow || pdfWindow.closed) {
          toast.error('A janela foi fechada inesperadamente. Verifique o resultado do agrupamento.');
          // ❌ NÃO redirecionar automaticamente quando janela foi fechada
          console.error('❌ Janela do agrupamento fechada - NÃO redirecionando');
          setTimeout(() => onClose(), 100);
          return;
        }

        if (pdfWindow && !pdfWindow.closed) {
          pdfWindow.document.write(`
          <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h1 style="color: #10b981;">✅ Agrupamento de Faturas Criado!</h1>
            <p style="color: #6b7280;">Código do Agrupamento: <strong>${novoCodfat}</strong></p>
            <p style="color: #6b7280;">Faturas agrupadas para cobrança unificada</p>
            ${
              comCobranca
                ? '<p style="color: #10b981;">📧 E-mail de confirmação enviado</p>'
                : ''
            }
            <hr style="margin: 20px 0;">
            <h3 style="color: #374151;">Resumo do Processo:</h3>
            <ul style="text-align: left; margin: 0 auto; display: inline-block; color: #6b7280;">
              <li>✅ Dados do agrupamento salvos</li>
              ${
                comCobranca
                  ? '<li>✅ Configurações de cobrança aplicadas</li>'
                  : ''
              }
              ${comCobranca ? '<li>✅ E-mail de cobrança configurado</li>' : ''}
              ${comCobranca ? '<li>✅ Notificação enviada ao cliente</li>' : ''}
              <li>✅ Agrupamento pronto para uso</li>
            </ul>
            <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">Esta janela pode ser fechada.</p>
          </div>
        `);
        }

        // ✅ Agrupamento concluído com sucesso - NÃO emitir nota fiscal
        // O redirecionamento acontecerá no final do try, após todas as etapas
        console.log('✅ Agrupamento criado com sucesso');
        todasEtapasSucesso = true; // Marcar sucesso completo
        
        // Pular a emissão de nota fiscal para agrupamento
        toast.success('Processo concluído com sucesso!', { id: loadingToast });
        
        // ✅ Redirecionamento após sucesso completo do agrupamento
        console.log('✅ Agrupamento finalizado, redirecionando...');
        setTimeout(() => {
          window.location.href = '/faturamento/consultaFatura';
        }, 1500);
        return; // Sair após redirecionar
      }

      etapa = 'emissão da nota fiscal';
      const currentStep = comCobranca ? 4 : 2;
      updateWindowProgress(currentStep, 'Emitindo Nota Fiscal');
      toast.loading(`[${currentStep}/${totalSteps}] Emitindo Nota Fiscal...`, {
        id: loadingToast,
      });
      // Garante que observacoes nunca seja vazio
      const observacoesValida =
        observacoes && observacoes.trim() ? observacoes : '.';
      const payloadEmissao = {
        dbclien: cliente,
        dbvenda: dadosVenda,
        dbfatura: dadosFatura,
        dbitvenda: itensVenda,
        emitente: dadosEmpresa, // Adicionar dados da empresa
        statusVenda,
        codfat: novoCodfat,
        isAgrupamento: agrupandoFaturas,
        observacoes: observacoesValida,
      };

      console.log('🚀 Payload de emissão:', {
        tem_cliente: !!cliente,
        tem_dadosVenda: !!dadosVenda,
        tem_dadosFatura: !!dadosFatura,
        tem_empresa: !!dadosEmpresa,
        qtd_itens: itensVenda?.length || 0,
        statusVenda,
        codfat: novoCodfat,
        isAgrupamento: agrupandoFaturas,
      });

      console.log('📋 Detalhes dos dados enviados:');
      console.log('- Empresa:', {
        nome: dadosEmpresa?.nomecontribuinte,
        cnpj: dadosEmpresa?.cnpj,
        keys: dadosEmpresa ? Object.keys(dadosEmpresa) : 'undefined',
      });
      console.log('- Cliente:', {
        nome: cliente?.nomefant || cliente?.nome,
        cnpj: cliente?.cpfcgc,
        keys: cliente ? Object.keys(cliente).slice(0, 10) : 'undefined',
      });
      console.log('- Primeiros produtos:', itensVenda?.slice(0, 2));

      console.log(
        '🔍 [INICIO] Preparando para consultar próximo número disponível...',
      );
      console.log('🔍 [DADOS] dadosVenda existe?', !!dadosVenda);
      console.log(
        '🔍 [DADOS] dadosVenda.numeroserie:',
        dadosVenda?.numeroserie,
      );
      console.log('🔍 [DADOS] dadosFatura existe?', !!dadosFatura);
      console.log('🔍 [DADOS] dadosFatura.nroform:', dadosFatura?.nroform);

      // ⚠️ IMPORTANTE: Consultar próximo número disponível ANTES de emitir
      // Isso evita duplicidade desde a primeira tentativa
      try {
        const serieAtual = dadosFatura?.serie || '1'; // Série vem de dbfatura.serie
        console.log(
          `🔍 Consultando próximo número disponível para série ${serieAtual} ANTES da emissão...`,
        );
        console.log(`🔍 Série origem: dbfatura.serie = ${dadosFatura?.serie}`);

        const responseProximoNumero = await axios.post(
          '/api/faturamento/obter-proximo-numero-nfe',
          {
            serie: serieAtual,
            numeroAtual: '1', // Não usado mais, endpoint pega o máximo do banco
          },
        );

        if (responseProximoNumero.data?.sucesso) {
          const proximoNumero = responseProximoNumero.data.proximoNumero;
          const ultimoUsado = responseProximoNumero.data.ultimoNumeroUsado || 0;
          console.log(
            `✅ Próximo número disponível: ${proximoNumero} (último usado: ${ultimoUsado}, série ${serieAtual})`,
          );

          // Atualizar o payload com o número correto ANTES da primeira tentativa
          if (dadosFatura) {
            dadosFatura.nroform = String(proximoNumero).padStart(9, '0');
          }
          if (dadosVenda) {
            dadosVenda.nrovenda = String(proximoNumero);
          }

          console.log(
            `📝 Número da NFe ajustado de ${
              dadosFatura?.nroform || 'N/A'
            } para: ${String(proximoNumero).padStart(9, '0')}`,
          );
        } else {
          console.warn(
            '⚠️ Não foi possível consultar próximo número, usando número da fatura',
          );
        }
      } catch (erroConsulta) {
        console.warn(
          '⚠️ Erro ao consultar próximo número disponível:',
          erroConsulta,
        );
        console.warn('Continuando com número original da fatura');
      }

      // Tentar emitir a nota fiscal
      let erroSefaz = false;
      let mensagemErroSefaz = '';
      let tentativasRestantes = 3; // Máximo de 3 tentativas para resolver duplicidade

      while (tentativasRestantes > 0) {
        try {
          // Log do número antes de enviar
          console.log(
            `🔍 [Tentativa ${4 - tentativasRestantes}] Enviando NFe com:`,
            {
              numero_dbfatura: payloadEmissao?.dbfatura?.nroform,
              numero_dbvenda: payloadEmissao?.dbvenda?.nrovenda,
              serie_dbvenda: payloadEmissao?.dbvenda?.numeroserie,
              tentativasRestantes,
            },
          );

          respostaEmissao = await handleEmitirNotaExterna(payloadEmissao);
          
          // Mensagem de sucesso personalizada baseada no tipo de emissão
          const tipoDocumento =
            respostaEmissao?.tipoEmissao === 'NFCE'
              ? 'Cupom Fiscal (NFC-e)'
              : 'Nota Fiscal (NF-e)';
          const modeloDocumento = respostaEmissao?.modelo || 'N/A';

          updateWindowProgress(
            currentStep,
            `${tipoDocumento} emitido com sucesso`,
            'success',
            undefined,
            `Número: ${
              respostaEmissao?.numero || 'N/A'
            } | Modelo: ${modeloDocumento}`,
          );

          console.log('✅ Documento fiscal emitido:', {
            tipo: respostaEmissao?.tipoEmissao,
            modelo: modeloDocumento,
            descricao: respostaEmissao?.descricao,
            numero: respostaEmissao?.numero,
          });

          break; // Sucesso, sair do loop
        } catch (errorSefaz: any) {
          const mensagemCompleta =
            errorSefaz?.response?.data?.motivo ||
            errorSefaz?.message ||
            'Erro na SEFAZ';
          const detalhesErro = errorSefaz?.response?.data?.detalhes;

          // 🚨 TRATAMENTO ESPECIAL: Erro de série vinculada a outra IE
          const isSerieVinculada =
            mensagemCompleta &&
            mensagemCompleta.toLowerCase().includes('serie') &&
            mensagemCompleta.toLowerCase().includes('vinculada') &&
            mensagemCompleta.toLowerCase().includes('inscricao');

          if (isSerieVinculada) {
            erroSefaz = true;
            const cnpj =
              detalhesErro?.cnpj || payloadEmissao?.emitente?.cnpj || 'N/A';
            const ie =
              detalhesErro?.ie || payloadEmissao?.emitente?.ie || 'N/A';
            const codfat =
              payloadEmissao?.codfat ||
              payloadEmissao?.dbfatura?.codfat ||
              'N/A';
            const acao = detalhesErro?.acao || '';

            mensagemErroSefaz = `
🚨 ERRO: SÉRIE VINCULADA A OUTRA INSCRIÇÃO ESTADUAL

A SEFAZ rejeitou porque a série "2" foi usada anteriormente com uma IE diferente.

📌 Informações:
   • CNPJ: ${cnpj}
   • Série: 2 (padrão do sistema, gerenciada pela SEFAZ)
   • IE Atual no Sistema: ${ie}
   • Código Fatura: ${codfat}

✅ SOLUÇÃO:

A série "2" é FIXA no sistema e gerenciada pela SEFAZ.
O problema está na Inscrição Estadual (IE), não na série!

🔍 COMO RESOLVER:

1️⃣ Verificar IE Correta:
   • Acesse: https://www.sintegra.gov.br/
   • Consulte o CNPJ: ${cnpj}
   • Anote a IE correta

2️⃣ Atualizar IE no Sistema:
   • Compare a IE da consulta com a IE atual (${ie})
   • Se for diferente, peça ao administrador para atualizar no banco de dados
   ${acao ? `\n   • SQL: ${acao}` : ''}

⚠️  IMPORTANTE: Não é necessário mudar a série! 
    A série "2" é padrão e está correta.
    O que precisa ser corrigido é a Inscrição Estadual.

📚 Documentação: docs/erro-serie-vinculada-ie.md
            `.trim();

            console.error('🚨 ========== ERRO SÉRIE VINCULADA ==========');
            console.error(`CNPJ: ${cnpj}`);
            console.error(`Série: 2 (padrão)`);
            console.error(`IE: ${ie}`);
            console.error(`Fatura: ${codfat}`);
            console.error('==========================================');

            updateWindowProgress(
              currentStep,
              '❌ Série vinculada a outra IE',
              'error',
              mensagemErroSefaz,
            );
            break; // Sair do loop - erro que requer intervenção manual
          }
          
          // Verificar se é erro de duplicidade (código 539)
          const isDuplicidade =
            mensagemCompleta.includes('539') ||
            mensagemCompleta.includes('Duplicidade de NF-e') ||
            mensagemCompleta.includes('diferenca na chave de acesso');

          const isChaveAcesso =
            mensagemCompleta.includes('chave de acesso') ||
            mensagemCompleta.includes('chNFe');

          if (isDuplicidade && tentativasRestantes > 1) {
            tentativasRestantes--;
            console.warn(`⚠️ Duplicidade detectada (Código 539), buscando próximo número disponível (${3 - tentativasRestantes + 1}/3)...`);
            console.log(`🔍 Estado ANTES do retry:`, {
              numero_atual_dbfatura: payloadEmissao?.dbfatura?.nroform,
              numero_atual_dbvenda: payloadEmissao?.dbvenda?.nrovenda,
              serie: payloadEmissao?.dbvenda?.numeroserie,
              tentativasRestantes
            });
            
            updateWindowProgress(currentStep, `Resolvendo duplicidade (${3 - tentativasRestantes + 1}/3)`, 'loading', undefined, 
              'Buscando próximo número de NFe disponível...');
            
            try {
              // Buscar próximo número disponível da SEFAZ
              const numeroAtual = payloadEmissao?.dbfatura?.nroform || '1';
              const serieAtual = payloadEmissao?.dbfatura?.serie || '1'; // Série vem de dbfatura

              console.log(
                `📊 Consultando próximo número disponível. Atual: ${numeroAtual}, Série: ${serieAtual}`,
              );

              const responseProximoNumero = await axios.post(
                '/api/faturamento/obter-proximo-numero-nfe',
                {
                  serie: serieAtual,
                  numeroAtual: numeroAtual,
                },
              );

              if (responseProximoNumero.data?.sucesso) {
                const novoNumero = responseProximoNumero.data.proximoNumero;
                console.log(
                  `✅ Próximo número disponível obtido: ${novoNumero} (anterior: ${numeroAtual})`,
                );

                // Atualizar o payload com o novo número
                if (payloadEmissao.dbfatura) {
                  payloadEmissao.dbfatura.nroform = String(novoNumero).padStart(
                    9,
                    '0',
                  );
                }
                if (payloadEmissao.dbvenda) {
                  payloadEmissao.dbvenda.nrovenda = String(novoNumero);
                }

                console.log(`🔍 Estado DEPOIS da atualização (API):`, {
                  numero_novo_dbfatura: payloadEmissao?.dbfatura?.nroform,
                  numero_novo_dbvenda: payloadEmissao?.dbvenda?.nrovenda,
                  serie: payloadEmissao?.dbvenda?.numeroserie,
                });

                updateWindowProgress(
                  currentStep,
                  `Tentando com número ${novoNumero} (${
                    3 - tentativasRestantes + 1
                  }/3)`,
                  'loading',
                  undefined,
                  'Reenviando para SEFAZ com nova numeração...',
                );

                await new Promise((resolve) => setTimeout(resolve, 2000));
                console.log(
                  `� Nova tentativa ${
                    3 - tentativasRestantes + 1
                  }/3 com número ${novoNumero}`,
                );
                continue; // Tentar novamente com novo número
              } else {
                console.error(
                  '❌ Falha ao obter próximo número disponível:',
                  responseProximoNumero.data,
                );
                // Fallback: incrementar baseado no último número conhecido
                const ultimoUsado =
                  responseProximoNumero.data?.ultimoNumeroUsado ||
                  parseInt(numeroAtual.replace(/^0+/, '') || '1', 10);
                const novoNumero = ultimoUsado + tentativasRestantes;
                console.log(
                  `⚠️ Usando incremento manual: último=${ultimoUsado}, novo=${novoNumero}`,
                );

                if (payloadEmissao.dbfatura) {
                  payloadEmissao.dbfatura.nroform = String(novoNumero).padStart(
                    9,
                    '0',
                  );
                }
                if (payloadEmissao.dbvenda) {
                  payloadEmissao.dbvenda.nrovenda = String(novoNumero);
                }

                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
              }
            } catch (erroProximoNumero) {
              console.error(
                '❌ Erro ao buscar próximo número disponível:',
                erroProximoNumero,
              );
              // Fallback: incrementar baseado no número atual
              const numeroAtual = payloadEmissao?.dbfatura?.nroform || '1';
              const numeroAtualInt = parseInt(
                numeroAtual.replace(/^0+/, '') || '1',
                10,
              );
              const novoNumero = numeroAtualInt + tentativasRestantes;
              console.log(
                `⚠️ Usando incremento manual (erro na consulta): atual=${numeroAtualInt}, novo=${novoNumero}`,
              );

              if (payloadEmissao.dbfatura) {
                payloadEmissao.dbfatura.nroform = String(novoNumero).padStart(
                  9,
                  '0',
                );
              }
              if (payloadEmissao.dbvenda) {
                payloadEmissao.dbvenda.nrovenda = String(novoNumero);
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }
          }

          // Se não é duplicidade ou esgotou tentativas, tratar como erro final
          erroSefaz = true;
          mensagemErroSefaz = mensagemCompleta;

          if (isDuplicidade) {
            mensagemErroSefaz = `DUPLICIDADE PERSISTIU: O sistema tentou 3 vezes com números diferentes, mas a SEFAZ continuou rejeitando por duplicidade. Detalhes: ${mensagemCompleta}`;
            console.error('❌ Duplicidade persistiu após 3 tentativas com números diferentes');
            
            updateWindowProgress(currentStep, 'Duplicidade não resolvida após 3 tentativas', 'error', 
              'A SEFAZ está rejeitando todas as tentativas de numeração. Pode haver uma NFe já autorizada com essa numeração.');
          } else {
            updateWindowProgress(
              currentStep,
              'Erro na emissão da nota fiscal',
              'error',
              mensagemErroSefaz,
            );
          }
          break; // Sair do loop em caso de erro final
        }
      }

      // Salvar fatura com NFS = 'N' quando há erro na SEFAZ
      if (erroSefaz && !agrupandoFaturas) {
        // Para vendas individuais, atualizar o status da fatura
        try {
          await axios.put(`/api/faturamento/atualizar-status-nfs`, {
            codfat: novoCodfat,
            nfs: 'N',
            motivo_erro: mensagemErroSefaz,
          });
          console.log('✅ Fatura salva com NFS = N devido ao erro na SEFAZ');
        } catch (updateError) {
          console.error(
            '❌ Erro ao atualizar status NFS da fatura:',
            updateError,
          );
        }

        const isDuplicidadeFinal = mensagemErroSefaz.includes('DUPLICIDADE PERSISTIU');
        const mensagemToast = isDuplicidadeFinal 
          ? `Fatura ${novoCodfat} salva, mas nota fiscal rejeitada por duplicidade (código 539) após 3 tentativas automáticas com números diferentes`
          : `Fatura ${novoCodfat} salva, mas nota fiscal não foi emitida: ${mensagemErroSefaz.length > 100 ? mensagemErroSefaz.substring(0, 100) + '...' : mensagemErroSefaz}`;
          
        toast.warning(mensagemToast, {
          id: loadingToast,
          duration: isDuplicidadeFinal ? 12000 : 8000,
        });
      }

      etapa = 'geração do PDF da nota';

      if (erroSefaz) {
        // Se houve erro na SEFAZ, mostrar mensagem de sucesso parcial
        if (!pdfWindow || pdfWindow.closed) {
          toast.error('A janela foi fechada inesperadamente.');
          window.location.href = '/faturamento/consultaFatura';
          return;
        }

        // Atualizar janela com informações de erro, mas manter os steps já completos
        updateWindowProgress(
          totalSteps,
          'Processo concluído (com erro na nota fiscal)',
          'error',
          mensagemErroSefaz,
          `Fatura ${novoCodfat} salva com sucesso, mas sem nota fiscal (NFS = N)`,
        );

        toast.success(
          `Fatura ${novoCodfat} salva com sucesso (sem nota fiscal)`,
          {
            id: loadingToast,
            duration: 6000,
          },
        );
      } else {
        // Processo normal - gerar PDF da nota
        const pdfStep = comCobranca ? 5 : 3;
        updateWindowProgress(pdfStep, 'Gerando PDF da Nota Fiscal');
        toast.loading(
          `[${pdfStep}/${totalSteps}] Gerando PDF da Nota Fiscal...`,
          { id: loadingToast },
        );

        if (respostaEmissao?.pdfBase64) {
          const blob = await fetch(
            `data:application/pdf;base64,${respostaEmissao.pdfBase64}`,
          ).then((r) => r.blob());
          const url = URL.createObjectURL(blob);

          // Verificar se a janela ainda está aberta
          if (!pdfWindow || pdfWindow.closed) {
            toast.error('A janela foi fechada inesperadamente. Por favor, verifique o resultado.');
            // ❌ NÃO redirecionar automaticamente - deixar usuário ver o erro
            console.error('❌ Janela fechada inesperadamente - NÃO redirecionando');
            return;
          }

          updateWindowProgress(pdfStep, 'PDF gerado com sucesso', 'success');
          // 3. Define o endereço da janela aberta.
          pdfWindow.location.href = url;
        } else {
          // Se não houver PDF, avisa o usuário e atualiza a janela aberta.
          updateWindowProgress(
            pdfStep,
            'Nota emitida, mas PDF não foi gerado',
            'error',
            'PDF não disponível',
          );
          toast.warning('Nota emitida, mas o PDF não foi gerado.', {
            id: loadingToast,
          });

          if (!pdfWindow || pdfWindow.closed) {
            toast.error('A janela foi fechada inesperadamente. Verifique se a nota foi emitida.');
            // ❌ NÃO redirecionar quando janela foi fechada
            console.error('❌ Janela fechada (sem PDF) - NÃO redirecionando');
            return;
          }

          if (pdfWindow && !pdfWindow.closed) {
            pdfWindow.document.write(
              '<h1>Nota emitida, mas o PDF não pôde ser gerado.</h1>',
            );
          }
        }

        toast.success('Processo concluído com sucesso!', { id: loadingToast });
        todasEtapasSucesso = true; // Marcar sucesso completo
      }
      
      // ✅ Redirecionamento APENAS se todas as etapas foram bem-sucedidas
      if (todasEtapasSucesso) {
        console.log('✅ Todas as etapas concluídas com sucesso, redirecionando...');
        setTimeout(() => {
          window.location.href = '/faturamento/consultaFatura';
        }, 1500);
      } else {
        console.warn('⚠️ Processo finalizado com erros - NÃO redirecionando');
      }
    } catch (error: any) {
      const mensagemErro =
        error?.response?.data?.motivo || error?.message || String(error);

      // Verificar se o erro é apenas da SEFAZ (fatura já foi salva)
      if (etapa === 'emissão da nota fiscal' && novoCodfat) {
        // Se a fatura foi salva mas houve erro na emissão da nota
        console.warn(
          '⚠️ Fatura salva, mas erro na emissão da nota:',
          mensagemErro,
        );

        // Tentar salvar a fatura com NFS = 'N'
        try {
          if (!agrupandoFaturas) {
            await axios.put(`/api/faturamento/atualizar-status-nfs`, {
              codfat: novoCodfat,
              nfs: 'N',
              motivo_erro: mensagemErro,
            });
          }

          if (pdfWindow && !pdfWindow.closed) {
            updateWindowProgress(
              totalSteps,
              'Processo concluído (com erro na nota fiscal)',
              'error',
              mensagemErro,
              `Fatura ${novoCodfat} salva com sucesso, mas sem nota fiscal (NFS = N)`,
            );
          }

          toast.warning(
            `Fatura ${novoCodfat} salva, mas nota fiscal não foi emitida: ${mensagemErro}`,
            {
              id: loadingToast,
              duration: 10000,
            },
          );

          // ❌ NÃO redirecionar quando há erro - usuário precisa ver o erro e decidir
          console.warn('❌ Erro na emissão da nota - NÃO redirecionando automaticamente');

          return; // Não continuar com o tratamento de erro geral
        } catch (updateError) {
          console.error('❌ Erro ao salvar status da fatura:', updateError);
        }
      }

      // 4. Tratamento de erro geral (para outros tipos de erro)
      if (pdfWindow && !pdfWindow.closed) {
        updateWindowProgress(
          1,
          `Erro na ${etapa}`,
          'error',
          mensagemErro,
          'O processo foi interrompido devido a um erro.',
        );
      }

      console.error(`Erro na etapa de ${etapa}:`, error);
      toast.error(`Erro na etapa de ${etapa}: ${mensagemErro}`, {
        id: loadingToast,
        duration: 10000,
      });
      
      // ❌ NÃO redirecionar em caso de erro - usuário precisa ver a mensagem
      console.error('❌ Processo interrompido com erro - NÃO redirecionando');
    }
  };
  // --- FUNÇÕES DE VALIDAÇÃO PARA AGRUPAMENTO ---
  const validarAgrupamento = async () => {
    if (vendasSelecionadas.length === 0) {
      toast.error('Nenhuma fatura selecionada para agrupamento.');
      return false;
    }

    // Regra 1: Todas as faturas devem ser do mesmo cliente
    const clientes = [...new Set(vendasSelecionadas.map((v) => v.codcli))];
    if (clientes.length > 1) {
      toast.error(
        'Todas as faturas devem pertencer ao mesmo cliente para agrupamento.',
      );
      return false;
    }

    // Obter códigos das faturas
    const codfats = vendasSelecionadas.map((v) => v.codfat);

    try {
      // Chamar API para verificar status das cobranças
      const response = await axios.post(
        '/api/faturamento/verificar-cobrancas-agrupamento',
        {
          codfats,
        },
      );

      if (!response.data.sucesso) {
        toast.error(
          response.data.error || 'Erro ao verificar status das cobranças.',
        );
        return false;
      }

      // Se houver cobranças pagas, não permitir agrupamento
      if (
        response.data.cobrancasPagas &&
        response.data.cobrancasPagas.length > 0
      ) {
        toast.error('Não é possível agrupar faturas com cobranças já pagas.');
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao validar agrupamento:', error);
      toast.error(
        error.response?.data?.error || 'Erro ao validar regras de agrupamento.',
      );
      return false;
    }
  };
  // --- FUNÇÕES DE GERAÇÃO DE PDF (PORTADAS DE ModalCobranca) ---
  const getValue = (value: any, defaultValue: string | number = ''): string => {
    if (value === null || value === undefined || value === '')
      return String(defaultValue);
    return String(value).trim();
  };

  const drawTicketBlock = (
    doc: jsPDF,
    startY: number,
    parcela: any,
    empresa: DadosEmpresa | null,
    sacado: DadosSacado | null,
    isPreview: boolean = false,
  ) => {
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - margin * 2;
    let y = startY;

    const drawField = (
      title: string,
      value: string,
      x: number,
      yPos: number,
      width: number,
      height: number,
      options: any = {},
    ) => {
      const {
        valueAlign = 'left',
        valueSize = 9,
        titleSize = 6,
        titleYOffset = 8,
        valueYOffset = 20,
      } = options;

      doc.setLineWidth(0.5);
      doc.rect(x, yPos, width, height);

      doc.setFontSize(titleSize).setFont('helvetica', 'normal');
      doc.text(title.toUpperCase(), x + 3, yPos + titleYOffset);

      let textX = valueAlign === 'right' ? x + width - 3 : x + 3;
      if (valueAlign === 'center') textX = x + width / 2;

      doc.setFontSize(valueSize).setFont('helvetica', 'bold');
      const textOptions: any = { align: valueAlign };
      doc.text(value, textX, yPos + valueYOffset, textOptions);
    };

    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text(getValue(empresa?.nomecontribuinte), margin, y);

    const bancoInfo = bancos.find((b) => b.banco === formCobranca.banco);
    doc.text(
      `${bancoInfo?.nome || 'Banco'} | ${bancoInfo?.banco || '000'}`,
      pageWidth - margin,
      y,
      { align: 'right' },
    );
    y += 12;
    doc.setFontSize(8);
    doc.text('SEU DISTRIBUIDOR 100% ATACADO', margin, y);
    y += 15;

    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('RECIBO DO CLIENTE', margin, y);
    y += 12;

    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Nome do Cliente', margin, y);
    y += 10;
    const sacadoNome = `(${getValue(sacado?.codcli)}) ${getValue(
      sacado?.nomefant,
    )} CNPJ ${getValue(sacado?.cpfcgc)}`;
    const sacadoEndereco = `${getValue(sacado?.ender)} - ${getValue(
      sacado?.bairro,
    )} - ${getValue(sacado?.cidade)}/${getValue(sacado?.uf)} CEP:${getValue(
      sacado?.cep,
    )}`;
    doc.text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 15;

    doc.text(`Número Docto.: ${parcela.documento}`, margin, y);
    doc.text(`Data do Vencto: ${parcela.vencimento}`, margin + 250, y);
    doc.text(
      `Valor Documento: ${parcela.valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}`,
      margin + 400,
      y,
    );
    y += 15;

    if (!isPreview) {
      doc.text(`Nosso Número: ${parcela.nossoNumero}`, margin, y);
    }
    doc.text('Autenticação Mecânica (no verso)', pageWidth - margin, y, {
      align: 'right',
    });

    y += 15;
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    doc.setFont('helvetica', 'bold').setFontSize(14);
    doc.text(
      `${bancoInfo?.nome || 'Banco'} | ${bancoInfo?.banco || '000'}`,
      margin,
      y + 18,
    );
    const linhaDigitavel = isPreview
      ? ''
      : '03399.00094 56000.000028 17208.901011 8 11440000140372';
    doc.setFont('helvetica', 'bold').setFontSize(11);
    if (!isPreview) {
      doc.text(linhaDigitavel, pageWidth - margin, y + 18, { align: 'right' });
    }
    y += 28;

    const fieldY1 = y;
    const mainWidth = contentWidth - 160;
    drawField(
      'Local de Pagamento',
      'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Banco Santander.',
      margin,
      fieldY1,
      mainWidth,
      35,
    );
    drawField(
      'Vencimento',
      parcela.vencimento,
      margin + mainWidth,
      fieldY1,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY2 = fieldY1 + 35;
    drawField(
      'Cedente',
      `${getValue(empresa?.nomecontribuinte)} - CNPJ: ${getValue(
        empresa?.cgc,
      )}`,
      margin,
      fieldY2,
      mainWidth,
      25,
    );
    drawField(
      'Agência / Cód.Cedente',
      '1403/0009560',
      margin + mainWidth,
      fieldY1 + 25,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY3 = fieldY2 + 25;
    drawField(
      'Data de Emissão',
      new Date().toLocaleDateString('pt-BR'),
      margin,
      fieldY3,
      90,
      25,
    );
    drawField('Número Docto', parcela.documento, margin + 90, fieldY3, 110, 25);
    drawField(
      'Espécie Docto',
      getValue(formCobranca.tipoFatura, 'DM'),
      margin + 200,
      fieldY3,
      80,
      25,
    );
    drawField('Aceite', 'N', margin + 280, fieldY3, 40, 25);
    drawField(
      'Data Processamento',
      new Date().toLocaleDateString('pt-BR'),
      margin + 320,
      fieldY3,
      mainWidth - 320,
      25,
    );
    drawField(
      'Nosso Número',
      isPreview ? '****' : parcela.nossoNumero,
      margin + mainWidth,
      fieldY3,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY4 = fieldY3 + 25;
    drawField('Uso do Banco', '', margin, fieldY4, 90, 25);
    drawField('CIP', '', margin + 90, fieldY4, 60, 25);
    drawField(
      'Carteira',
      'COBRANCA SIMPLES - RCR',
      margin + 150,
      fieldY4,
      170,
      25,
    );
    drawField('Moeda', 'R$', margin + 320, fieldY4, 45, 25);
    drawField('Quantidade', '', margin + 365, fieldY4, mainWidth - 365, 25);
    drawField(
      '(=) Valor do Docto',
      parcela.valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      margin + mainWidth,
      fieldY4,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY5 = fieldY4 + 25;
    const instrucoes = `:: Senhor(a) caixa, não receber em CHEQUES.
:: Após o vencimento cobrar mora de R$ 3.74 por dia de atraso.
:: Título sujeito a protesto à partir de 11 dias após vencimento.`;
    drawField(
      'Instruções (Todas informações deste bloqueto são de exclusiva responsabilidade do cedente)',
      instrucoes,
      margin,
      fieldY5,
      mainWidth,
      60,
      { valueSize: 7, valueYOffset: 15 },
    );
    drawField(
      '(-) Desconto/Abatimento',
      '',
      margin + mainWidth,
      fieldY5,
      160,
      20,
      { valueAlign: 'right' },
    );
    drawField('(+) Mora/Multa', '', margin + mainWidth, fieldY5 + 20, 160, 20, {
      valueAlign: 'right',
    });
    drawField(
      '(=) Valor Cobrado',
      '',
      margin + mainWidth,
      fieldY5 + 40,
      160,
      20,
      { valueAlign: 'right' },
    );

    y = fieldY5 + 65;
    doc.setFont('helvetica', 'normal').setFontSize(6);
    doc.text('SACADO', margin, y);
    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(6);
    doc.text('SACADOR/AVALISTA', margin + mainWidth, y);

    y += 10;
    const barcodeValue = isPreview
      ? ''
      : `03398114400001403729000956000000021720890101`;
    if (!isPreview) {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, barcodeValue, {
          displayValue: false,
          margin: 0,
          height: 40,
          width: 1.2,
        });
        doc.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          margin,
          y,
          contentWidth - 200,
          40,
        );
      } catch (e) {
        console.error('Erro no JsBarcode:', e);
      }
    }

    y += 45;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(
      'Autenticação Mecânica / Ficha de Compensação',
      pageWidth - margin,
      y,
      { align: 'right' },
    );

    return y + 10;
  };

  const gerarMultiplosBoletosPDF = (isPreview: boolean = false) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const bottomMargin = 30; // Reduced bottom margin
    let y = margin;

    if (previewParcelas.length === 0 || !dadosSacado || !dadosEmpresa) {
      doc.text('Dados insuficientes para gerar o boleto.', margin, y);
      return doc;
    }

    // Process boletos in pairs
    for (let i = 0; i < previewParcelas.length; i += 2) {
      // Start a new page for every two boletos (except for the first pair)
      if (i > 0) {
        doc.addPage();
        y = margin;
      }

      // Draw first boleto in the pair
      if (i < previewParcelas.length) {
        y = drawTicketBlock(
          doc,
          y,
          previewParcelas[i],
          dadosEmpresa,
          dadosSacado,
          isPreview,
        );

        // Check if there's a second boleto to draw
        if (i + 1 < previewParcelas.length) {
          // Add separator line after first boleto with less spacing
          y += 5;
          doc.setLineWidth(1);
          doc.line(margin, y, doc.internal.pageSize.width - margin, y);
          y += 10;

          // Always draw the second boleto (don't check space) - pass isPreview parameter
          y = drawTicketBlock(
            doc,
            y,
            previewParcelas[i + 1],
            dadosEmpresa,
            dadosSacado,
            isPreview,
          );
        }
      }

      // Check if we've exceeded the page height with bottom margin
      if (y > pageHeight - bottomMargin) {
        console.warn('Content may exceed page height');
      }
    }

    return doc;
  };

  const handleGerarPreviewBoleto = () => {
    // Verifica se há parcelas no hook ou no estado local
    const parcelasParaGerar =
      parcelasPagamento.length > 0 ? parcelasPagamento : parcelas;

    if (parcelasParaGerar.length === 0)
      return toast.error('Adicione parcelas para gerar o boleto.');
    if (!dadosEmpresa || !dadosSacado)
      return toast.error(
        'Aguarde o carregamento dos dados da empresa e do cliente.',
      );

    console.log('📋 Gerando preview com parcelas:', parcelasParaGerar);

    const loadingToast = toast.loading('Gerando preview do boleto...');
    try {
      const doc = gerarMultiplosBoletosPDF(true);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setBoletoPreviewURL(url);
      setIsBoletoPreviewOpen(true);
      toast.success('Preview gerado!', { id: loadingToast });
    } catch (error) {
      console.error('Erro ao gerar PDF do boleto:', error);
      toast.error('Falha ao gerar o preview do boleto.', { id: loadingToast });
    }
  };

  // --- useEffects ---
  // Normaliza e pré-seleciona o banco do cliente sempre que bancos ou cliente mudarem
  useEffect(() => {
    if (cliente?.banco && bancos.length > 0) {
      const bancoCliente = bancos.find(
        (b) =>
          b.banco.toString().trim().toLowerCase() ===
          cliente.banco.toString().trim().toLowerCase(),
      );
      if (bancoCliente) {
        setFormCobranca((prev: any) => ({
          ...prev,
          banco: bancoCliente.banco,
        }));
        console.log('🏦 Banco pré-selecionado:', bancoCliente.banco);
      } else {
        setFormCobranca((prev: any) => ({
          ...prev,
          banco: '',
        }));
        console.log(
          '⚠️ Banco do cliente não encontrado nos bancos disponíveis:',
          cliente.banco,
        );
      }
    }
  }, [cliente, bancos]);
  useEffect(() => {
    // Busca dados iniciais apenas uma vez por abertura do modal
    let carregandoDados = false;
    const fetchDadosIniciais = async () => {
      if (!isOpen || carregandoDados) return;
      carregandoDados = true;

      // LOGS PRINCIPAIS PARA DEBUG
      console.log('🔍 fetchDadosIniciais executado:', {
        isOpen,
        agrupandoFaturas,
        faturasAgrupadas,
        vendasSelecionadas,
        'faturasAgrupadas.length': faturasAgrupadas?.length,
        'vendasSelecionadas.length': vendasSelecionadas?.length,
      });

      if (agrupandoFaturas) {
        // Para agrupamento, usar dados diretos de faturasAgrupadas
        console.log(
          '🔍 Agrupamento detectado, faturasAgrupadas:',
          faturasAgrupadas,
        );

        if (faturasAgrupadas.length > 0) {
          try {
            // Usar dados diretos do primeiro item sem fazer nova requisição
            const primeiroItem = faturasAgrupadas[0];
            console.log('🎯 Primeiro item direto:', primeiroItem);

            if (primeiroItem && primeiroItem.dbvenda) {
              console.log('� Preenchendo campos do agrupamento...');

              // Dados do dbvenda
              setNroformulario(primeiroItem.dbvenda.nrovenda ?? '');
              setPedido(primeiroItem.dbvenda.nrovenda ?? '');
              setVendedor(primeiroItem.dbvenda.codvend ?? '');
              setObservacoes(primeiroItem.dbvenda.obs ?? '');
              setData(new Date().toISOString().substring(0, 10));
              setCliente(primeiroItem.dbclien || null);

              // Preencher banco automaticamente se vier do backend (agrupamento)

              // Transportadora: preferir da fatura se disponível, senão do dbvenda
              if (primeiroItem.faturas && primeiroItem.faturas.length > 0) {
                const primeiraFatura = primeiroItem.faturas[0];
                setFatura(primeiraFatura);
                setTransportadora(
                  primeiraFatura.codtransp ||
                    primeiroItem.dbvenda.transp?.trim() ||
                    '',
                );

                // Usar todas as faturas para exibição
                setFaturasParaExibir(
                  faturasAgrupadas.map((item) => item.faturas).flat(),
                );
                setCodigosFaturas(
                  faturasAgrupadas
                    .map((item) => item.faturas[0]?.codfat)
                    .filter(Boolean)
                    .join(', '),
                );
              } else {
                setTransportadora(primeiroItem.dbvenda.transp?.trim() || '');
              }

              // Armazenar dados para emissão da NF-e (agrupamento)
              setDadosVenda(primeiroItem.dbvenda);
              setDadosFatura(primeiroItem.faturas?.[0] || null);
              // Para agrupamento, consolidar todos os itens de todas as faturas
              const todosItens = faturasAgrupadas.flatMap(
                (item) => item.dbitvenda || [],
              );
              setItensVenda(todosItens);

              console.log('✅ Campos preenchidos com:', {
                pedido: primeiroItem.dbvenda.nrovenda,
                vendedor: primeiroItem.dbvenda.codvend,
                transportadora:
                  primeiroItem.faturas?.[0]?.codtransp ||
                  primeiroItem.dbvenda.transp,
                observacoes: primeiroItem.dbvenda.obs,
                tem_dbitvenda: !!todosItens.length,
                qtd_itens_total: todosItens.length,
              });

              // Pré-selecionar inscrição estadual baseado no ie_empresa da venda (agrupamento)
              const ieEmpresa = primeiroItem.dbvenda?.ie_empresa;
              if (ieEmpresa) {
                // Se começa com "07", seleciona 'S' (IE 07), senão mantém 'N' (IE 04)
                const insc07Value = ieEmpresa.toString().trim().startsWith('07') ? 'S' : 'N';
                setStatusVenda(prev => ({ ...prev, insc07: insc07Value }));
                console.log('🏛️ Inscrição estadual pré-selecionada (agrupamento):', { ieEmpresa, insc07Value });
              }
            }
          } catch (error) {
            console.error('❌ Erro ao processar faturas agrupadas:', error);
          }
          console.warn('⚠️ Nenhuma fatura agrupada encontrada');
        }
      } else if (vendasSelecionadas.length > 0) {
        console.log(
          '👤 Modo INDIVIDUAL detectado, vendasSelecionadas:',
          vendasSelecionadas,
        );
        const nros = vendasSelecionadas.map((v) => v.nrovenda).join(',');
        console.log('📋 Números de vendas:', nros);
        try {
          const res = await axios.get(
            `/api/faturamento/detalhes-venda?nrovenda=${nros}`,
          );
          console.log('📊 Resposta detalhes-venda:', res.data);
          console.log(
            '💰 Resumo financeiro da API:',
            res.data?.resumoFinanceiro,
          );
          const vendasArray = Array.isArray(res.data) ? res.data : [res.data];
          if (vendasArray.length > 0) {
            // 🆕 Armazenar a resposta completa da API para acessar o resumoFinanceiro
            // Para múltiplas vendas, consolidar o resumoFinanceiro
            if (vendasArray.length === 1) {
              setVendaData(vendasArray[0]);
            } else {
              // Consolidar resumoFinanceiro de múltiplas vendas
              const resumoConsolidado = vendasArray.reduce((acc, v) => {
                const r = v.resumoFinanceiro || {};
                return {
                  totalProdutos: (acc.totalProdutos || 0) + (r.totalProdutos || 0),
                  totalICMS: (acc.totalICMS || 0) + (r.totalICMS || 0),
                  totalIPI: (acc.totalIPI || 0) + (r.totalIPI || 0),
                  totalBaseICMS: (acc.totalBaseICMS || 0) + (r.totalBaseICMS || 0),
                  totalBaseIPI: (acc.totalBaseIPI || 0) + (r.totalBaseIPI || 0),
                  totalImpostos: (acc.totalImpostos || 0) + (r.totalImpostos || 0),
                  frete: (acc.frete || 0) + (r.frete || 0),
                  seguro: (acc.seguro || 0) + (r.seguro || 0),
                  desconto: (acc.desconto || 0) + (r.desconto || 0),
                  acrescimo: (acc.acrescimo || 0) + (r.acrescimo || 0),
                  totalGeral: (acc.totalGeral || 0) + (r.totalGeral || 0),
                  aliquotaICMS: r.aliquotaICMS || acc.aliquotaICMS || 0,
                  aliquotaIPI: r.aliquotaIPI || acc.aliquotaIPI || 0,
                };
              }, {} as any);
              setVendaData({ ...vendasArray[0], resumoFinanceiro: resumoConsolidado });
            }
            console.log('📊 VendaData atualizado com resumoFinanceiro:', vendasArray[0]?.resumoFinanceiro);
            
            // Para múltiplas vendas, consolidar dados do cliente e itens
            // Assumindo que todas as vendas são do mesmo cliente
            const dbclien = vendasArray[0].dbclien;
            setCliente(dbclien);
            setData(new Date().toISOString().substring(0, 10));
            setNroformulario(
              vendasArray.map((v) => v.dbvenda?.nrovenda).join(', '),
            );
            setPedido(vendasArray.map((v) => v.dbvenda?.nrovenda).join(', '));
            setObservacoes(
              vendasArray
                .map((v) => v.dbvenda?.obs)
                .filter(Boolean)
                .join(' | '),
            );
            setVendedor(
              Array.from(
                new Set(
                  vendasArray.map((v) => v.dbvenda?.codvend).filter(Boolean),
                ),
              ).join(', '),
            );
            // Transportadora: pega da primeira fatura ou da venda
            const transportadoraCod =
              vendasArray[0].faturas?.[0]?.codtransp ||
              vendasArray[0].dbvenda?.transp?.trim() ||
              '';
            setTransportadora(transportadoraCod);
            // Fatura: pega da primeira
            if (vendasArray[0].dbfatura) setFatura(vendasArray[0].dbfatura);
            // Dados para emissão da NF-e: pode ser array ou consolidado
            setDadosVenda(vendasArray.map((v) => v.dbvenda));
            setDadosFatura(vendasArray[0].dbfatura);
            // Consolidar todos os itens das vendas
            const todosItens = vendasArray.flatMap((v) => v.dbitvenda || []);
            setItensVenda(todosItens);
            
            // 🆕 Usar dados do resumoFinanceiro da API se disponível, senão usar fallback
            const resumoFinanceiroConsolidado = vendasArray.reduce((acc, v) => {
              const r = v.resumoFinanceiro || {};
              return {
                totalProdutos: (acc.totalProdutos || 0) + (r.totalProdutos || 0),
                totalICMS: (acc.totalICMS || 0) + (r.totalICMS || 0),
                totalIPI: (acc.totalIPI || 0) + (r.totalIPI || 0),
                totalBaseICMS: (acc.totalBaseICMS || 0) + (r.totalBaseICMS || 0),
                totalBaseIPI: (acc.totalBaseIPI || 0) + (r.totalBaseIPI || 0),
              };
            }, {} as any);
            
            // Verificar se temos dados válidos do resumoFinanceiro
            const temResumoValido = vendasArray.some(v => v.resumoFinanceiro && v.resumoFinanceiro.totalProdutos > 0);
            
            if (temResumoValido) {
              // Usar dados calculados pela API
              setTotalProdutos(resumoFinanceiroConsolidado.totalProdutos || 0);
              setTotalICMS(resumoFinanceiroConsolidado.totalICMS || 0);
              setTotalIPI(resumoFinanceiroConsolidado.totalIPI || 0);
              setTotalBaseICMS(resumoFinanceiroConsolidado.totalBaseICMS || 0);
              setTotalBaseIPI(resumoFinanceiroConsolidado.totalBaseIPI || 0);
              console.log('✅ Usando dados do resumoFinanceiro da API:', resumoFinanceiroConsolidado);
            } else {
              // Fallback: calcular a partir do dbvenda (para compatibilidade)
              const totalProdutosCalculado = vendasArray.reduce(
                (acc, v) => acc + (parseFloat(v.dbvenda?.total) || 0),
                0,
              );
              const totalICMSCalculado = vendasArray.reduce(
                (acc, v) => acc + (parseFloat(v.dbvenda?.totalicms) || 0),
                0,
              );
              const totalIPICalculado = vendasArray.reduce(
                (acc, v) => acc + (parseFloat(v.dbvenda?.totalipi) || 0),
                0,
              );
              const totalBaseICMSCalculado = vendasArray.reduce(
                (acc, v) => acc + (parseFloat(v.dbvenda?.baseicms) || 0),
                0,
              );
              const totalBaseIPICalculado = vendasArray.reduce(
                (acc, v) => acc + (parseFloat(v.dbvenda?.baseipi) || 0),
                0,
              );
              setTotalProdutos(totalProdutosCalculado);
              setTotalICMS(totalICMSCalculado);
              setTotalIPI(totalIPICalculado);
              setTotalBaseICMS(totalBaseICMSCalculado);
              setTotalBaseIPI(totalBaseIPICalculado);
              console.log('⚠️ Usando fallback dbvenda para calcular totais');
            }
            console.log('✅ Campos múltiplas vendas preenchidos:', {
              pedidos: vendasArray.map((v) => v.dbvenda?.nrovenda),
              vendedor: vendasArray.map((v) => v.dbvenda?.codvend),
              transportadora: transportadoraCod,
              observacoes: vendasArray.map((v) => v.dbvenda?.obs),
              qtd_itens_total: todosItens.length,
            });

            // Pré-selecionar inscrição estadual baseado no ie_empresa da venda
            const ieEmpresa = vendasArray[0]?.dbvenda?.ie_empresa;
            if (ieEmpresa) {
              // Se começa com "07", seleciona 'S' (IE 07), senão mantém 'N' (IE 04)
              const insc07Value = ieEmpresa.toString().trim().startsWith('07') ? 'S' : 'N';
              setStatusVenda(prev => ({ ...prev, insc07: insc07Value }));
              console.log('🏛️ Inscrição estadual pré-selecionada:', { ieEmpresa, insc07Value });
            }
          }
        } catch (error) {
          console.error('Erro ao buscar detalhes da venda:', error);
        }
      } else {
        console.log('❌ Nenhuma condição atendida:', {
          agrupandoFaturas,
          'vendasSelecionadas.length': vendasSelecionadas.length,
          'faturasAgrupadas.length': faturasAgrupadas.length,
        });
      }

      try {
        const res = await axios.get('/api/faturamento/opcoes-cobranca');
        setBancos(res.data.bancos);
        setTiposDocumentoOriginais(res.data.tiposDocumento);
        
        // 🆕 Buscar dados da empresa com filtros de cnpj_empresa e ie_empresa se disponível
        let empresaParams = '';
        
        // Tentar obter cnpj_empresa e ie_empresa da venda
        if (agrupandoFaturas && faturasAgrupadas.length > 0) {
          const primeiroItem = faturasAgrupadas[0];
          if (primeiroItem?.dbvenda?.cnpj_empresa) {
            empresaParams += `?cgc=${encodeURIComponent(primeiroItem.dbvenda.cnpj_empresa)}`;
          }
          if (primeiroItem?.dbvenda?.ie_empresa) {
            empresaParams += empresaParams ? '&' : '?';
            empresaParams += `inscricaoestadual=${encodeURIComponent(primeiroItem.dbvenda.ie_empresa)}`;
          }
          if (empresaParams) {
            console.log('🎯 Buscando empresa específica do agrupamento:', empresaParams);
          }
        } else if (vendasSelecionadas.length > 0) {
          // Para vendas individuais, buscar os dados da venda primeiro
          const nros = vendasSelecionadas.map((v) => v.nrovenda).join(',');
          try {
            const resVenda = await axios.get(`/api/faturamento/detalhes-venda?nrovenda=${nros}`);
            const vendasArray = Array.isArray(resVenda.data) ? resVenda.data : [resVenda.data];
            if (vendasArray.length > 0 && vendasArray[0]?.dbvenda) {
              if (vendasArray[0].dbvenda.cnpj_empresa) {
                empresaParams += `?cgc=${encodeURIComponent(vendasArray[0].dbvenda.cnpj_empresa)}`;
              }
              if (vendasArray[0].dbvenda.ie_empresa) {
                empresaParams += empresaParams ? '&' : '?';
                empresaParams += `inscricaoestadual=${encodeURIComponent(vendasArray[0].dbvenda.ie_empresa)}`;
              }
              if (empresaParams) {
                console.log('🎯 Buscando empresa específica da venda:', empresaParams);
              }
            }
          } catch (error) {
            console.warn('⚠️ Erro ao buscar dados da venda para filtro de empresa:', error);
          }
        }
        
        const { data } = await axios.get(`/api/faturamento/dadosempresa${empresaParams}`);
        setDadosEmpresa(data);
        
        const { data: msgs } = await axios.get(
          '/api/faturamento/mensagemNF_listar',
        );
        setTodasMensagens(msgs);
        // Pré-selecionar mensagens dos códigos 223, 224, 737, 693
        const codigosPreSelecionados = [223, 224, 737, 693, 20];
        const preSelecionadas = msgs.filter((msg: { codigo: any }) =>
          codigosPreSelecionados.includes(Number(msg.codigo)),
        );
        setMensagensNF(preSelecionadas);
      } catch (error) {
        console.error('Erro ao buscar dados iniciais:', error);
        toast.error('Falha ao carregar dados de faturamento.');
      }
      carregandoDados = false;
    };
    if (isOpen) fetchDadosIniciais();
  }, [isOpen, agrupandoFaturas]);

  useEffect(() => {
    if (isOpen && cliente?.codcli) {
      axios
        .get(`/api/faturamento/cliente/${cliente.codcli}`)
        .then((res) => setDadosSacado(res.data))
        .catch((err) => {
          console.error(`Erro ao buscar cliente ${cliente.codcli}:`, err);
          toast.error('Dados do cliente (sacado) não encontrados.');
        });
    }
  }, [isOpen, cliente]);

  useEffect(() => {
    if (statusVenda.cobranca === 'N') {
      setParcelas([]);
      setFormCobranca((prev) => ({
        ...prev,
        banco: '',
        prazoSelecionado: '',
        valorVista: '',
        habilitarValor: false,
        impostoNa1Parcela: false,
        freteNa1Parcela: false,
      }));
    }
  }, [statusVenda.cobranca]);

  // Efeito para calcular totais dos produtos e impostos baseado nos itens
  useEffect(() => {
    console.log('🧮 useEffect cálculo totais - Disparado com itensVenda:', {
      temItens: !!itensVenda,
      quantidade: itensVenda?.length || 0,
      agrupandoFaturas,
      primeiros3Itens: itensVenda?.slice(0, 3),
    });

    // Só calcula se houver itens ou vendas/agrupamento ativo
    if (
      (itensVenda && itensVenda.length > 0) ||
      vendasSelecionadas.length > 0 ||
      agrupandoFaturas
    ) {
      // Se temos dados da API com resumo financeiro, usar esses valores
      if (vendaData?.resumoFinanceiro) {
        setTotalProdutos(vendaData.resumoFinanceiro.totalProdutos || 0);
        setTotalImpostos(vendaData.resumoFinanceiro.totalImpostos || 0);
        setTotalICMS(vendaData.resumoFinanceiro.totalICMS || 0);
        setTotalIPI(vendaData.resumoFinanceiro.totalIPI || 0);
        setTotalBaseICMS(vendaData.resumoFinanceiro.totalBaseICMS || 0);
        setTotalBaseIPI(vendaData.resumoFinanceiro.totalBaseIPI || 0);
      } else {
        // Fallback: cálculo manual como antes
        let totalProd = 0;
        let totalImp = 0;
        let totalICMS = 0;
        let totalIPI = 0;
        let totalBaseICMS = 0;
        let totalBaseIPI = 0;
        itensVenda.forEach((item: any) => {
          totalProd += parseFloat(item.prunit || 0) * parseFloat(item.qtd || 1);
          totalImp += parseFloat(item.imposto || 0);
          totalICMS += parseFloat(item.totalicms || 0);
          totalIPI += parseFloat(item.totalipi || 0);
          totalBaseICMS += parseFloat(item.baseicms || 0);
          totalBaseIPI += parseFloat(item.baseipi || 0);
        });
        setTotalProdutos(totalProd);
        setTotalImpostos(totalImp);
        setTotalICMS(totalICMS);
        setTotalIPI(totalIPI);
        setTotalBaseICMS(totalBaseICMS);
        setTotalBaseIPI(totalBaseIPI);
      }
    }
  }, [itensVenda, vendasSelecionadas, agrupandoFaturas, vendaData]);

  // Efeito para limpar campos de transporte
  useEffect(() => {
    if (
      modalidadeTransporte === '9' ||
      modalidadeTransporte === '3' ||
      modalidadeTransporte === '0' ||
      modalidadeTransporte === '1' ||
      modalidadeTransporte === '2' ||
      modalidadeTransporte === '4'
    ) {
      setQuantidade('');
      setEspecie('');
      setMarca('');
      setNumero('');
      setPesoBruto('');
      setPesoLiquido('');
    }
  }, [modalidadeTransporte]);

  // EFEITOS PARA CÁLCULO DE DESCONTO/ACRÉSCIMO
  useEffect(() => {
    if (percDesconto && totalProdutos > 0) {
      const valorDesconto = (parseFloat(percDesconto) / 100) * totalProdutos;
      setDesconto(valorDesconto);
    } else {
      setDesconto(0);
    }
  }, [percDesconto, totalProdutos]);

  useEffect(() => {
    if (percAcrescimo && totalProdutos > 0) {
      const valorAcrescimo = (parseFloat(percAcrescimo) / 100) * totalProdutos;
      setAcrescimo(valorAcrescimo);
    } else {
      setAcrescimo(0);
    }
  }, [percAcrescimo, totalProdutos]);

  // Removido useEffect que sobrescrevia vendedor e transportadora após carregamento dos dados

  // --- RENDERIZAÇÃO ---
  const isTransporteDisabled =
    modalidadeTransporte === '9' ||
    modalidadeTransporte === '3' ||
    modalidadeTransporte === '0' ||
    modalidadeTransporte === '1' ||
    modalidadeTransporte === '2' ||
    modalidadeTransporte === '4';

  if (!isOpen) return null;

  console.log('📊 Usando dados do resumo financeiro:', {
    temDadosAPI: !!dadosResumoFinanceiro,
    totalProdutosAPI: dadosResumoFinanceiro?.totalProdutos,
    totalImpostosAPI: dadosResumoFinanceiro?.totalImpostos,
    totalIBS: dadosResumoFinanceiro?.totalValorIBS,
    totalCBS: dadosResumoFinanceiro?.totalValorCBS,
  });

  const aliquotaIBS = Number(dadosResumoFinanceiro?.totalAliquotaIBS ?? 0).toFixed(2);
  const valorIBS = Number(dadosResumoFinanceiro?.totalValorIBS ?? 0).toFixed(2);
  const aliquotaCBS = Number(dadosResumoFinanceiro?.totalAliquotaCBS ?? 0).toFixed(2);
  const valorCBS = Number(dadosResumoFinanceiro?.totalValorCBS ?? 0).toFixed(2);
  const valorFrete = Number(dadosResumoFinanceiro?.frete ?? (Number(frete) || 0)).toFixed(2);
  const valorDesconto = Number(dadosResumoFinanceiro?.desconto ?? (Number(desconto) || 0)).toFixed(2);
  const valorAcrescimo = Number(dadosResumoFinanceiro?.acrescimo ?? (Number(acrescimo) || 0)).toFixed(2);
  const valorTotalProdutos = Number(dadosResumoFinanceiro?.totalProdutos ?? totalProdutos ?? 0).toFixed(2);
  const valorTotalNF = Number(dadosResumoFinanceiro?.totalGeral ?? totalNF ?? 0).toFixed(2);
  const valorTotalFatura = valorTotalNF;

  // Usar alíquotas calculadas pelo backend (já arredondadas)
  const aliquotaICMS = dadosResumoFinanceiro?.aliquotaICMS?.toString() || '0.00';
  const aliquotaIPI = dadosResumoFinanceiro?.aliquotaIPI?.toString() || '0.00';

  // Preferir alíquotas por item (aliquota_icms / aliquota_ipi) quando presentes - média ponderada por base
  const aliqICMSPorItem = (() => {
    // Preferir alíquota calculada pelo backend quando disponível
    if (dadosResumoFinanceiro?.aliquotaICMS != null && dadosResumoFinanceiro?.aliquotaICMS !== undefined) {
      return Number(dadosResumoFinanceiro.aliquotaICMS).toFixed(2);
    }

    if (itensVenda && itensVenda.length > 0) {
      let weighted = 0;
      let baseSum = 0;
      itensVenda.forEach((it: any) => {
        const aliq = parseFloat(it.aliquota_icms ?? it.aliquotaICMS ?? 0);
        const base = parseFloat(it.baseicms ?? it.baseICMS ?? 0);
        if (!isNaN(aliq) && !isNaN(base) && base > 0) {
          weighted += aliq * base;
          baseSum += base;
        }
      });
      if (baseSum > 0) return (weighted / baseSum).toFixed(2);
    }
    return aliquotaICMS;
  })();

  const aliqIPIPorItem = (() => {
    // Preferir alíquota calculada pelo backend quando disponível
    if (dadosResumoFinanceiro?.aliquotaIPI != null && dadosResumoFinanceiro?.aliquotaIPI !== undefined) {
      return Number(dadosResumoFinanceiro.aliquotaIPI).toFixed(2);
    }

    if (itensVenda && itensVenda.length > 0) {
      let weighted = 0;
      let baseSum = 0;
      itensVenda.forEach((it: any) => {
        const aliq = parseFloat(it.aliquota_ipi ?? it.aliquotaIPI ?? 0);
        const base = parseFloat(it.baseipi ?? it.baseIPI ?? 0);
        if (!isNaN(aliq) && !isNaN(base) && base > 0) {
          weighted += aliq * base;
          baseSum += base;
        }
      });
      if (baseSum > 0) return (weighted / baseSum).toFixed(2);
    }
    return aliquotaIPI;
  })();

  const resumoFinanceiro = (
    <div className="bg-white dark:bg-zinc-800/50 px-4 py-3">
      <h3 className="text-lg font-semibold text-center text-zinc-800 dark:text-white mb-2">
        Resumo Financeiro - Nova Lei Tributária
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
        {/* IBS (Total + Municipal + Estadual) */}
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-col justify-center">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">ALÍQUOTA IBS (%)</p>
              <p className="text-md font-bold text-blue-700 dark:text-blue-300">
                {aliquotaIBS}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">VALOR IBS</p>
              <p className="text-md font-bold text-blue-600">
                R$ {valorIBS}
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-zinc-600 pt-2 mt-1">
              <p className="text-xs text-gray-500">IBS MUNICIPAL</p>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                R$ {Number(dadosResumoFinanceiro?.totalIBSMunicipal || 0.50).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">IBS ESTADUAL</p>
              <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                R$ {Number(dadosResumoFinanceiro?.totalIBSEstadual || 0.50).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-col justify-center">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">ALÍQUOTA CBS (%)</p>
              <p className="text-md font-bold text-purple-700 dark:text-purple-300">
                {aliquotaCBS}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">VALOR CBS</p>
              <p className="text-md font-bold text-purple-600">
                R$ {valorCBS}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-col justify-center">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">ALÍQUOTA ICMS (%)</p>
              <p className="text-md font-bold text-orange-700 dark:text-orange-300">
                {aliqICMSPorItem}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">BASE ICMS</p>
              <p className="text-md font-bold text-orange-600 dark:text-orange-400">
                R$ {Number(dadosResumoFinanceiro?.totalBaseICMS ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">VALOR ICMS</p>
              <p className="text-md font-bold text-orange-500">
                R$ {Number(dadosResumoFinanceiro?.totalICMS ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-col justify-center">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">ALÍQUOTA IPI (%)</p>
              <p className="text-md font-bold text-red-700 dark:text-red-300">
                {aliqIPIPorItem}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">BASE IPI</p>
              <p className="text-md font-bold text-red-600 dark:text-red-400">
                R$ {Number(dadosResumoFinanceiro?.totalBaseIPI ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">VALOR IPI</p>
              <p className="text-md font-bold text-red-500">
                R$ {Number(dadosResumoFinanceiro?.totalIPI ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-col justify-center">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">VALOR DO FRETE</p>
              <p className="text-md font-bold text-green-700">
                R$ {valorFrete}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">VALOR TOTAL DOS PRODUTOS</p>
              <p className="text-md font-bold text-blue-700">
                R$ {valorTotalProdutos}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded border-2 border-zinc-700 dark:border-zinc-500 flex flex-col justify-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-white">
            VALOR TOTAL DA NF
          </p>
          <p className="text-xl font-bold text-zinc-800 dark:text-white">
            R$ {valorTotalNF}
          </p>
        </div>
      </div>
    </div>
  );

  // Função para ver itens das faturas agrupadas
  const handleVerItensFaturaAgrupada = (fatura: any) => {
    // Buscar produtos da fatura pelo endpoint produtos-fatura
    if (!fatura?.codfat) {
      setFaturaSelecionadaItens({ ...fatura, vendas: fatura.vendas || [] });
      return;
    }

    fetch(`/api/faturamento/produtos-fatura?codfat=${fatura.codfat}`)
      .then((res) => res.json())
      .then((produtos) => {
        // Garantir que vendas seja um array válido
        const vendas = fatura.vendas || [];
        if (vendas.length === 0) {
          // Se não houver vendas, criar uma única venda com os produtos
          setFaturaSelecionadaItens({ ...fatura, vendas: [{ produtos }] });
        } else {
          // Associar produtos às vendas existentes, se possível
          setFaturaSelecionadaItens({ ...fatura, vendas });
        }
      })
      .catch(() => {
        setFaturaSelecionadaItens({ ...fatura, vendas: fatura.vendas || [] });
      });
  };

  return (
    <>
      <ModalNovaMensagem
        isOpen={isMensagemModalOpen}
        onClose={() => setIsMensagemModalOpen(false)}
        onSave={handleSalvarNovaMensagem}
      />
      <BoletoPreviewModal
        isOpen={isBoletoPreviewOpen}
        onClose={() => setIsBoletoPreviewOpen(false)}
        url={boletoPreviewURL}
      />

      <div className="flex flex-col h-full uppercase">
        {agrupandoFaturas && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-300 rounded text-blue-900">
            <div className="font-bold text-lg mb-1">FATURAS AGRUPADAS:</div>
            <ul className="mb-2">
              {faturasParaExibir.map((f, idx) => (
                <li key={f.codfat || f.id || idx} className="text-sm">
                  <span className="font-semibold">Fatura:</span>{' '}
                  {f.codfat || f.id} |
                  <span className="font-semibold"> Data:</span>{' '}
                  {f.data ? new Date(f.data).toLocaleDateString() : '—'} |
                  <span className="font-semibold"> Valor:</span> R${' '}
                  {f.totalprod || f.totalnf || f.total || '0.00'} |
                  <span className="font-semibold"> Cliente:</span>{' '}
                  {f.cliente?.nome || f.cliente || '—'}
                </li>
              ))}
            </ul>
            <div className="font-semibold mb-1">
              VENDAS AGRUPADAS:{' '}
              {faturasParaExibir
                .flatMap((f) =>
                  Array.isArray(f.codvenda) ? f.codvenda : [f.codvenda],
                )
                .filter(Boolean)
                .join(', ')}
            </div>
            <div className="mt-2">
              TOTAL PRODUTOS: R$ {totalProdutos.toFixed(2)}
            </div>
            <div className="mt-1">
              TOTAL IMPOSTOS: R$ {totalImpostos.toFixed(2)}
            </div>
          </div>
        )}
        <ModalFormFatura
          onClose={onClose}
          titulo={
            agrupandoFaturas
              ? `FATURAS AGRUPADAS | FATURAS: ${codigosFaturas} | VENDAS: ${faturasParaExibir
                  .flatMap((f) =>
                    Array.isArray(f.codvenda) ? f.codvenda : [f.codvenda],
                  )
                  .filter(Boolean)
                  .join(', ')}`
              : `DADOS DA FATURA - VENDA Nº ${nroformulario}`
          }
          handleSubmit={() => handleProcessoCompleto(faturasAgrupadas)}
          summary={resumoFinanceiro}
          handleClear={onClose}
          footer={
            <div className="flex justify-end items-center w-full">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex justify-end items-center gap-1 px-2 py-1 border rounded-md bg-gray-100 dark:bg-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm text-gray-700 dark:text-white">
                    <span className="text-base">⚙️</span> <span>Opções</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white dark:bg-zinc-900 shadow-md border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-white cursor-pointer">
                  {agrupandoFaturas ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          // Abre modal de itens da fatura agrupada
                          if (faturasParaExibir.length > 0) {
                            handleVerItensFaturaAgrupada(faturasParaExibir[0]);
                          }
                        }}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        <List size={16} className="mr-2" /> Itens da Fatura
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setModalcliente(true)}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        <FaUser className="mr-2" /> Detalhes do Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleProcessoCompleto(faturasAgrupadas)}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 font-bold text-green-600 dark:text-green-400"
                      >
                        <FaNoteSticky className="mr-2" /> Emitir cobrança
                        agrupada
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => setModalcliente(true)}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        <FaUser className="mr-2" /> Detalhes do Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleVerItensFatura}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        <List size={16} className="mr-2" /> Itens da Fatura
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleGerarPreview}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                      >
                        <FileSearch size={16} className="mr-2" /> Espelho da
                        Nota
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleProcessoCompleto(faturasAgrupadas)}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 font-bold text-green-600 dark:text-green-400"
                      >
                        <FaNoteSticky className="mr-2" /> Emitir e salvar fatura
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
          tabs={[]}
          activeTab="dados"
          setActiveTab={() => {}}
          renderTabContent={() => (
            <div className="flex-grow p-4 space-y-4">
              {/* Quando for agrupamento, mostrar dados da cobrança primeiro */}

              <SecaoCollapse
                titulo="OPÇÕES DE FATURAMENTO/STATUS DE VENDA"
                icone={<Settings />}
                padraoAberto={!agrupandoFaturas}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                  <SelectInput
                    label="Tipo Documentação"
                    name="tipodoc"
                    disabled
                    value={statusVenda.tipodoc}
                    onValueChange={(v) =>
                      setStatusVenda((p) => ({ ...p, tipodoc: v }))
                    }
                    options={[
                      { value: 'F', label: 'FAG' },
                      { value: 'N', label: 'NOTA FISCAL' },
                    ]}
                  />
                  <SelectInput
                    label="Gerar Cobrança"
                    name="cobranca"
                    value={statusVenda.cobranca}
                    onValueChange={(v) =>
                      setStatusVenda((p) => ({ ...p, cobranca: v }))
                    }
                    options={[
                      { value: 'S', label: 'SIM' },
                      { value: 'N', label: 'NÃO' },
                    ]}
                  />
                  <div className="space-y-1 text-gray-700 dark:text-gray-200">
                    <label className="text-sm font-medium">
                      Inscrição Estadual
                    </label>
                    <input
                      type="text"
                      name="inscricaoEstadual"
                      disabled
                      value={vendaData?.dbvenda?.ie_empresa || vendasSelecionadas?.[0]?.dbvenda?.ie_empresa || '-'}
                      className="flex h-10 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white uppercase"
                      readOnly
                    />
                  </div>
                </div>
              </SecaoCollapse>

              <SecaoCollapse
                titulo="DADOS BÁSICOS"
                icone={<FileText />}
                padraoAberto={!agrupandoFaturas}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 p-4">
                  <div>
                    <SelectInput
                      label="Modalidade de Transporte"
                      name="modalidadeTransporte"
                      options={[
                        {
                          value: '0',
                          label:
                            '0 - Contratação do Frete por conta do Remetente (CIF)',
                        },
                        {
                          value: '1',
                          label:
                            '1 - Contratação do Frete por conta do Destinatário (FOB)',
                        },
                        {
                          value: '2',
                          label:
                            '2 - Contratação do Frete por conta de Terceiros',
                        },
                        {
                          value: '3',
                          label:
                            '3 - Transporte Próprio por conta do Remetente',
                        },
                        {
                          value: '4',
                          label:
                            '4 - Transporte Próprio por conta do Destinatário',
                        },
                        {
                          value: '9',
                          label: '9 - Sem Ocorrência de Transporte',
                        },
                      ]}
                      value={modalidadeTransporte}
                      onValueChange={(v) => {
                        setModalidadeTransporte(v);
                        // Se "9 - Sem Ocorrência de Transporte", definir transportadora padrão (0430 - Melo)
                        if (v === '9') {
                          setTransportadora('00430');
                        }
                      }}
                    />
                  </div>
                  <FormInput
                    label="Pedido"
                    value={pedido}
                    onChange={(e) => setPedido(e.target.value)}
                    name="pedido"
                    type="text"
                  />
                  <AutocompletePessoa
                    label="Transportadora"
                    value={transportadora}
                    onChange={setTransportadora}
                    tipo="transportadora"
                  />
                  <AutocompletePessoa
                    label="Vendedor"
                    value={vendedor}
                    onChange={setVendedor}
                    tipo="vendedor"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Observações
                    </label>
                    <Textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Observações gerais..."
                      className="h-24"
                      name={'observacoes'}
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensagens NF
                    </label>
                    <div className="flex gap-2 items-end">
                      <input
                        type="text"
                        value={textoBuscaMensagem}
                        // @ts-expect-error
                        onChange={handleBuscaMensagemChange}
                        placeholder="Digite o código ou parte do texto da mensagem..."
                        className="h-10 px-2 border border-gray-300 dark:border-zinc-700 rounded w-full bg-white dark:bg-zinc-900 text-black dark:text-white"
                        name={'busca-mensagem'}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIsMensagemModalOpen(true)}
                        className="h-10 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md border border-blue-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 flex items-center gap-2"
                      >
                        <span className="text-lg leading-none">+</span>
                        <span>Adicionar</span>
                      </button>
                    </div>
                    {sugestoes.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                        {sugestoes
                          .filter((sugestao) => {
                            // Filtro robusto: ignora acentuação, espaços e case
                            const normalize = (str: string) =>
                              str
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .replace(/\s+/g, '')
                                .toLowerCase();
                            const busca = normalize(textoBuscaMensagem);
                            return (
                              sugestao.codigo.toString().includes(busca) ||
                              normalize(sugestao.mensagem).includes(busca)
                            );
                          })
                          .map((sugestao) => (
                            <li
                              key={sugestao.codigo}
                              onClick={() => handleSelecionarSugestao(sugestao)}
                              className="px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700 text-base flex items-center gap-2"
                            >
                              <span className="font-bold text-blue-900 dark:text-blue-300 text-lg min-w-[48px]">
                                {sugestao.codigo}
                              </span>
                              <span className="text-gray-800 dark:text-gray-100 text-base uppercase">
                                {sugestao.mensagem.toUpperCase()}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                    <ul className="mt-2 space-y-1">
                      {mensagensNF.map((msg) => (
                        <li
                          key={msg.codigo}
                          className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded flex justify-between items-center text-sm"
                        >
                          <span className="break-words uppercase">
                            {msg.codigo} - {msg.mensagem.toUpperCase()}
                          </span>
                          <button
                            onClick={() => removerMensagem(msg.codigo)}
                            className="text-red-500 hover:text-red-700 ml-4"
                          >
                            <TrashIcon />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </SecaoCollapse>

              {!agrupandoFaturas && statusVenda.cobranca === 'S' && (
                <SecaoCollapse
                  titulo="DADOS DE COBRANÇA"
                  icone={<FaMoneyBill />}
                  padraoAberto={true}
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <fieldset className="col-span-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
                      <legend className="text-sm font-semibold px-2">
                        Configurações da Cobrança
                      </legend>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Banco
                        </label>
                        <SelectInput
                          name="banco"
                          value={formCobranca.banco}
                          onValueChange={(v) =>
                            handleCobrancaChange('banco', v)
                          }
                          options={bancos.map((b) => ({
                            value: b.banco,
                            label: b.nome,
                          }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Tipo de Fatura/Documento
                        </label>
                        <SelectInput
                          name="tipoFatura"
                          value={formCobranca.tipoFatura}
                          onValueChange={(v) =>
                            handleCobrancaChange('tipoFatura', v)
                          }
                          options={opcoesTipoFatura}
                          disabled={!formCobranca.banco}
                        />
                      </div>
                      <div className="space-y-2 pt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formCobranca.habilitarValor}
                            onChange={(e) =>
                              handleCobrancaChange(
                                'habilitarValor',
                                e.target.checked,
                              )
                            }
                          />{' '}
                          Habilitar valor de entrada
                        </label>
                        {formCobranca.habilitarValor && (
                          <FormInput
                            label="Valor de Entrada (R$)"
                            name="valorVista"
                            type="number"
                            value={formCobranca.valorVista}
                            onChange={(e) =>
                              handleCobrancaChange('valorVista', e.target.value)
                            }
                          />
                        )}
                      </div>
                    </fieldset>

                    <fieldset
                      className={`col-span-1 border-2 rounded-lg p-4 flex flex-col justify-between ${
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                          ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-70'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                      disabled={
                        formCobranca.tipoFatura !== 'BOLETO' &&
                        formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                      }
                    >
                      <legend className="text-sm font-semibold px-2">
                        Prazo e Parcelas
                      </legend>
                      <div>
                        <div className="mt-2">
                          <label
                            className={`block text-sm font-medium mb-1 ${
                              formCobranca.tipoFatura !== 'BOLETO' &&
                              formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                                ? 'text-gray-500 dark:text-gray-400'
                                : ''
                            }`}
                          >
                            Prazo (em dias)
                          </label>
                          <div className="flex items-center gap-2">
                            <FormInput
                              name="prazo"
                              type="number"
                              value={formCobranca.prazoSelecionado}
                              onChange={(e) =>
                                handleCobrancaChange(
                                  'prazoSelecionado',
                                  e.target.value,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const dias = parseInt(
                                    formCobranca.prazoSelecionado,
                                  );
                                  if (!dias || dias <= 0) {
                                    toast.error('Insira um prazo válido.');
                                    return;
                                  }
                                  const vencimento = new Date();
                                  vencimento.setDate(
                                    vencimento.getDate() + dias,
                                  );
                                  setParcelas([
                                    ...parcelas,
                                    {
                                      dias,
                                      vencimento: vencimento
                                        .toISOString()
                                        .split('T')[0],
                                    },
                                  ]);
                                  handleCobrancaChange('prazoSelecionado', '');
                                }
                              }}
                              placeholder="Ex: 30"
                              disabled={
                                formCobranca.tipoFatura !== 'BOLETO' &&
                                formCobranca.tipoFatura !== 'Boleto bancario'
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const dias = parseInt(
                                  formCobranca.prazoSelecionado,
                                );
                                if (!dias || dias <= 0)
                                  return toast.error('Insira um prazo válido.');
                                const vencimento = new Date();
                                vencimento.setDate(vencimento.getDate() + dias);
                                setParcelas([
                                  ...parcelas,
                                  {
                                    dias,
                                    vencimento: vencimento
                                      .toISOString()
                                      .split('T')[0],
                                  },
                                ]);
                                handleCobrancaChange('prazoSelecionado', '');
                              }}
                              className={`h-10 px-4 rounded whitespace-nowrap ${
                                formCobranca.tipoFatura !== 'BOLETO' &&
                                formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                              disabled={
                                formCobranca.tipoFatura !== 'BOLETO' &&
                                formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                              }
                            >
                              + Adicionar
                            </button>
                          </div>
                        </div>
                        {(() => {
                          const combinedParcelas = parcelas
                            .map((p, idx) => ({
                              ...p,
                              isSaved: false,
                              originalIndex: idx,
                            }))
                            .concat(
                              parcelasPagamento.map((p) => ({
                                ...p,
                                isSaved: true,
                                dias: p.dia,
                                vencimento: p.data.split('T')[0],
                                originalIndex: -1,
                              })),
                            )
                            .sort(
                              (a, b) =>
                                new Date(a.vencimento).getTime() -
                                new Date(b.vencimento).getTime(),
                            );
                          return (
                            <ul className="mt-3 text-sm space-y-2 h-40 overflow-y-auto p-1 rounded bg-gray-100 dark:bg-zinc-800">
                              {combinedParcelas.map((item, index) => (
                                <li
                                  key={
                                    item.isSaved
                                      ? `saved-${(item as any).id}`
                                      : `manual-${item.originalIndex}`
                                  }
                                  className={`flex flex-col gap-2 p-2 rounded shadow-sm ${
                                    formCobranca.tipoFatura !== 'BOLETO' &&
                                    formCobranca.tipoFatura !==
                                      'BOLETO BANCARIO'
                                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                      : 'bg-white dark:bg-zinc-700'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">
                                      Parcela {index + 1}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-gray-600">
                                        Dias:
                                      </label>
                                      <input
                                        type="number"
                                        value={
                                          editingDias[
                                            item.isSaved
                                              ? `saved-${(item as any).id}`
                                              : `manual-${item.originalIndex}`
                                          ] ?? item.dias
                                        }
                                        onChange={(e) => {
                                          const key = item.isSaved
                                            ? `saved-${(item as any).id}`
                                            : `manual-${item.originalIndex}`;
                                          const newValue = e.target.value;
                                          setEditingDias((prev) => ({
                                            ...prev,
                                            [key]: newValue,
                                          }));

                                          const val = parseInt(newValue);
                                          if (
                                            !isNaN(val) &&
                                            val >= 0 &&
                                            val !== item.dias
                                          ) {
                                            if (item.isSaved) {
                                              atualizarParcela(
                                                (item as any).id,
                                                val,
                                              ).then(() => {
                                                setEditingDias((prev) => {
                                                  const updated = { ...prev };
                                                  delete updated[key];
                                                  return updated;
                                                });
                                              });
                                            } else {
                                              const novoVencimento = new Date();
                                              novoVencimento.setDate(
                                                novoVencimento.getDate() + val,
                                              );
                                              const novasParcelas = [
                                                ...parcelas,
                                              ];
                                              novasParcelas[
                                                item.originalIndex
                                              ] = {
                                                ...novasParcelas[
                                                  item.originalIndex
                                                ],
                                                dias: val,
                                                vencimento: novoVencimento
                                                  .toISOString()
                                                  .split('T')[0],
                                              };
                                              setParcelas(novasParcelas);
                                              setEditingDias((prev) => {
                                                const updated = { ...prev };
                                                delete updated[key];
                                                return updated;
                                              });
                                            }
                                          }
                                        }}
                                        onBlur={() => {
                                          const key = item.isSaved
                                            ? `saved-${(item as any).id}`
                                            : `manual-${item.originalIndex}`;
                                          setEditingDias((prev) => {
                                            const updated = { ...prev };
                                            delete updated[key];
                                            return updated;
                                          });
                                        }}
                                        className="w-16 px-2 py-1 text-xs border rounded"
                                        min="0"
                                        disabled={
                                          formCobranca.tipoFatura !==
                                            'BOLETO' &&
                                          formCobranca.tipoFatura !==
                                            'BOLETO BANCARIO'
                                        }
                                      />
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (item.isSaved) {
                                          await removerParcela(
                                            (item as any).id,
                                          );
                                        } else {
                                          setParcelas(
                                            parcelas.filter(
                                              (_, idx) =>
                                                idx !== item.originalIndex,
                                            ),
                                          );
                                        }
                                      }}
                                      className={`${
                                        formCobranca.tipoFatura !== 'BOLETO' &&
                                        formCobranca.tipoFatura !==
                                          'BOLETO BANCARIO'
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'text-red-500 hover:text-red-700'
                                      }`}
                                      disabled={
                                        formCobranca.tipoFatura !== 'BOLETO' &&
                                        formCobranca.tipoFatura !==
                                          'BOLETO BANCARIO'
                                      }
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium">
                                      Data de Vencimento:
                                    </label>
                                    <input
                                      type="date"
                                      value={item.vencimento}
                                      onChange={async (e) => {
                                        const newDate = e.target.value;
                                        if (item.isSaved) {
                                          const today = new Date();
                                          const diffTime =
                                            new Date(newDate).getTime() -
                                            today.getTime();
                                          const diffDays = Math.ceil(
                                            diffTime / (1000 * 60 * 60 * 24),
                                          );
                                          if (diffDays >= 0) {
                                            await atualizarParcela(
                                              (item as any).id,
                                              diffDays,
                                            );
                                          }
                                        } else {
                                          const novasParcelas = [...parcelas];
                                          novasParcelas[item.originalIndex] = {
                                            ...novasParcelas[
                                              item.originalIndex
                                            ],
                                            vencimento: newDate,
                                          };
                                          setParcelas(novasParcelas);
                                        }
                                      }}
                                      className={`text-xs px-2 py-1 border rounded ${
                                        formCobranca.tipoFatura !== 'BOLETO' &&
                                        formCobranca.tipoFatura !==
                                          'BOLETO BANCARIO'
                                          ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                                          : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white'
                                      }`}
                                      disabled={
                                        formCobranca.tipoFatura !== 'BOLETO' &&
                                        formCobranca.tipoFatura !==
                                          'BOLETO BANCARIO'
                                      }
                                    />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}{' '}
                      </div>{' '}
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={handleGerarPreviewBoleto}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                            formCobranca.tipoFatura !== 'BOLETO' &&
                            formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                          disabled={
                            formCobranca.tipoFatura !== 'BOLETO' &&
                            formCobranca.tipoFatura !== 'BOLETO BANCARIO'
                          }
                        >
                          <FileSymlink size={16} /> Gerar Preview do Boleto
                        </button>
                      </div>
                    </fieldset>
                  </div>
                </SecaoCollapse>
              )}

              <SecaoCollapse
                titulo="VALORES E AJUSTES"
                icone={<Calculator />}
                padraoAberto={!agrupandoFaturas}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded border">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-center bg-red-100 dark:bg-red-900 py-2 rounded">
                      DESCONTO
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="desconto-sim"
                          name="informar-desconto"
                          checked={informarDescontoCorpo}
                          onChange={() => setInformarDescontoCorpo(true)}
                        />
                        <label htmlFor="desconto-sim" className="text-sm">
                          SIM
                        </label>
                        <input
                          type="radio"
                          id="desconto-nao"
                          name="informar-desconto"
                          checked={!informarDescontoCorpo}
                          onChange={() => setInformarDescontoCorpo(false)}
                          className="ml-4"
                        />
                        <label htmlFor="desconto-nao" className="text-sm">
                          NÃO
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <FormInput
                          label="Percentual"
                          value={percDesconto}
                          onChange={(e) => setPercDesconto(e.target.value)}
                          name="perc-desconto"
                          type="number"
                          step="0.01"
                          readOnly={!informarDescontoCorpo}
                        />
                        <FormInput
                          label="Valor"
                          value={desconto.toFixed(2)}
                          name="desconto"
                          type="number"
                          step="0.01"
                          readOnly={true}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={incluirDescontoNF}
                          onChange={(e) =>
                            setIncluirDescontoNF(e.target.checked)
                          }
                        />{' '}
                        Incluir Desconto na NF
                      </label>
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded border">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-center bg-green-100 dark:bg-green-900 py-2 rounded">
                      ACRÉSCIMO
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="acrescimo-sim"
                          name="informar-acrescimo"
                          checked={informarAcrescimoCorpo}
                          onChange={() => setInformarAcrescimoCorpo(true)}
                        />
                        <label htmlFor="acrescimo-sim" className="text-sm">
                          SIM
                        </label>
                        <input
                          type="radio"
                          id="acrescimo-nao"
                          name="informar-acrescimo"
                          checked={!informarAcrescimoCorpo}
                          onChange={() => setInformarAcrescimoCorpo(false)}
                          className="ml-4"
                        />
                        <label htmlFor="acrescimo-nao" className="text-sm">
                          NÃO
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <FormInput
                          label="Percentual"
                          value={percAcrescimo}
                          onChange={(e) => setPercAcrescimo(e.target.value)}
                          name="perc-acrescimo"
                          type="number"
                          step="0.01"
                          readOnly={!informarAcrescimoCorpo}
                        />
                        <FormInput
                          label="Valor"
                          value={acrescimo.toFixed(2)}
                          name="acrescimo"
                          type="number"
                          step="0.01"
                          readOnly={true}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={incluirAcrescimoNF}
                          onChange={(e) =>
                            setIncluirAcrescimoNF(e.target.checked)
                          }
                        />{' '}
                        Incluir Acréscimo na NF
                      </label>
                    </div>
                  </div>
                </div>
              </SecaoCollapse>
              <SecaoCollapse
                titulo="FRETE E TRANSPORTE"
                icone={<Truck />}
                padraoAberto={!agrupandoFaturas}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                      FRETE
                    </h4>
                    <FormInput
                      label="Valor"
                      value={frete}
                      onChange={(e) => setFrete(e.target.value)}
                      name="frete"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                      DADOS DO TRANSPORTE
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput
                        label="Quantidade"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                        name="quantidade"
                        type="number"
                        disabled={isTransporteDisabled}
                      />
                      <FormInput
                        label="Espécie"
                        value={especie}
                        onChange={(e) => setEspecie(e.target.value)}
                        name="especie"
                        type="text"
                        disabled={isTransporteDisabled}
                      />
                      <FormInput
                        label="Marca"
                        value={marca}
                        onChange={(e) => setMarca(e.target.value)}
                        name="marca"
                        type="text"
                        disabled={isTransporteDisabled}
                      />
                      <FormInput
                        label="Número"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        name="numero"
                        type="text"
                        disabled={isTransporteDisabled}
                      />
                      <FormInput
                        label="Peso Bruto"
                        value={pesoBruto}
                        onChange={(e) => setPesoBruto(e.target.value)}
                        name="peso-bruto"
                        type="number"
                        step="0.01"
                        disabled={isTransporteDisabled}
                      />
                      <FormInput
                        label="Peso Líquido"
                        value={pesoLiquido}
                        onChange={(e) => setPesoLiquido(e.target.value)}
                        name="peso-liquido"
                        type="number"
                        step="0.01"
                        disabled={isTransporteDisabled}
                      />
                    </div>
                  </div>
                </div>
              </SecaoCollapse>
              <SecaoCollapse
                titulo="Comissão Diferenciada"
                icone={<Percent />}
                padraoAberto={!agrupandoFaturas}
              >
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={diferenciada}
                        onChange={(e) => setDiferenciada(e.target.checked)}
                      />
                      <span className="font-medium">Diferenciada</span>
                    </label>
                  </div>
                  {diferenciada && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Vendedor Externo (%)"
                        value={vendedorExterno}
                        onChange={(e) => setVendedorExterno(e.target.value)}
                        name="vendedor-externo"
                        type="number"
                        step="0.01"
                      />
                      <FormInput
                        label="Vendedor Interno (%)"
                        value={vendedorInterno}
                        onChange={(e) => setVendedorInterno(e.target.value)}
                        name="vendedor-interno"
                        type="number"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>
              </SecaoCollapse>
            </div>
          )}
        />
        {/* --- MODAIS AUXILIARES --- */}
        <DetalhesClienteModal
          isOpen={modalcliente}
          onClose={() => setModalcliente(false)}
          cliente={cliente}
        />
        {isPreviewOpen && previewData && (
          <NotaFiscalPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            fatura={previewData.fatura}
            produtos={previewData.produtos}
            venda={previewData.venda}
          />
        )}
        {isProdutoModalOpen && (
          <DetalhesProdutoModal
            isOpen={isProdutoModalOpen}
            onClose={() => setIsProdutoModalOpen(false)}
            produto={produtoSelecionado}
            venda={vendaData}
          />
        )}
      </div>
    </>
  );
}
