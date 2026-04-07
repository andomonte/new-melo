import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Package, CheckCircle, AlertCircle, DollarSign, Truck } from 'lucide-react';
import { ConfiguracaoPagamentoNFeModal } from './ConfiguracaoPagamentoNFeModal';
import CadastroConhecimentoModal from './CadastroConhecimentoModal';
import { toast } from 'sonner';

interface DadosConhecimento {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  icms: number;
  baseicms: number;
  totalcon: number;
  totaltransp: number;
  dtcon: string;
  cif: 'S' | 'N';
  tipocalc: '1' | '2';
  tipocon: '08' | '09' | '10';
  kg?: number;
  kgcub?: number;
  chave?: string;
  protocolo?: string;
  nomebarco?: string;
  placacarreta?: string;
}

interface NFEProcessada {
  id: string;  // codnfe_ent é VARCHAR/STRING (ex: "999TEST02")
  chave_nfe: string;
  numero_nfe: string;
  serie_nfe: string;
  data_emissao: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  valor_total: number;
  total_itens: number;
  itens_associados: number;
  pode_gerar_entrada: boolean;
  pagamento_configurado?: boolean; // ✅ NOVO: indica se pagamento já foi configurado
  statusDisplay: string;
  ordensCompra: Array<{
    orc_id: number;
    orc_numero: string;
    orc_data: string;
    req_numero: string;
  }>;
}

interface GerarEntradaNFeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEntradaGerada?: (entradaId: number, numeroEntrada: string, nfeId: string) => void;
  nfeIdPreSelecionada?: string; // ID da NFe para pré-selecionar ao abrir
}

const GerarEntradaNFeModal: React.FC<GerarEntradaNFeModalProps> = ({
  isOpen,
  onClose,
  onEntradaGerada,
  nfeIdPreSelecionada
}) => {
  const [nfes, setNfes] = useState<NFEProcessada[]>([]);
  const [filtro, setFiltro] = useState('');
  const [nfeSelecionada, setNfeSelecionada] = useState<NFEProcessada | null>(null);
  const [numeroSelo, setNumeroSelo] = useState('');
  const [dataSelo, setDataSelo] = useState<string>(new Date().toISOString().split('T')[0]); // Data atual como padrão
  const [numeroConhecimento, setNumeroConhecimento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  // ✅ NOVO: Estado para modal de configuração de pagamento
  const [showConfigPagamento, setShowConfigPagamento] = useState(false);

  // ✅ NOVO: Estado para modal de cadastro de conhecimento
  const [showCadastroConhecimento, setShowCadastroConhecimento] = useState(false);
  const [dadosConhecimento, setDadosConhecimento] = useState<DadosConhecimento | null>(null);
  const [temConhecimento, setTemConhecimento] = useState(false);
  const [verificandoConhecimento, setVerificandoConhecimento] = useState(false);
  const [statusConhecimento, setStatusConhecimento] = useState<'nenhum' | 'cadastrado' | 'pendente'>('nenhum');

  useEffect(() => {
    if (isOpen) {
      carregarNFes();
    }
  }, [isOpen]);

  // Pré-selecionar NFe quando receber nfeIdPreSelecionada e lista carregar
  useEffect(() => {
    if (nfeIdPreSelecionada && nfes.length > 0 && !nfeSelecionada) {
      const nfeParaSelecionar = nfes.find(nfe => nfe.id === nfeIdPreSelecionada);
      if (nfeParaSelecionar) {
        setNfeSelecionada(nfeParaSelecionar);
      }
    }
  }, [nfeIdPreSelecionada, nfes, nfeSelecionada]);

  // Verificar automaticamente se tem conhecimento cadastrado quando NFe é selecionada
  useEffect(() => {
    const verificarConhecimento = async () => {
      if (!nfeSelecionada) {
        setStatusConhecimento('nenhum');
        setTemConhecimento(false);
        setDadosConhecimento(null);
        return;
      }

      setVerificandoConhecimento(true);
      try {
        // Buscar CTe pendente para esta NFe
        const response = await fetch(`/api/cte/pendentes?chavenfe=${nfeSelecionada.chave_nfe}`);
        const data = await response.json();

        if (data.success && data.found && data.data) {
          // Tem conhecimento pendente (importado pelo robô)
          setStatusConhecimento('pendente');
          setTemConhecimento(true);
          setDadosConhecimento({
            codtransp: data.data.codtransp,
            nrocon: data.data.nrocon,
            serie: data.data.serie,
            cfop: data.data.cfop,
            icms: data.data.icms,
            baseicms: data.data.baseicms,
            totalcon: data.data.totalcon,
            totaltransp: data.data.totaltransp || data.data.totalcon,
            dtcon: data.data.dtcon,
            cif: data.data.cif,
            tipocalc: '1',
            tipocon: data.data.tipocon as '08' | '09' | '10',
            kg: data.data.kg,
            kgcub: data.data.kgcub,
            chave: data.data.chave,
            protocolo: data.data.protocolo,
          });
        } else {
          setStatusConhecimento('nenhum');
        }
      } catch (error) {
        console.error('Erro ao verificar conhecimento:', error);
        setStatusConhecimento('nenhum');
      } finally {
        setVerificandoConhecimento(false);
      }
    };

    verificarConhecimento();
  }, [nfeSelecionada]);

  const carregarNFes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro) params.append('filtro', filtro);

      const response = await fetch(`/api/entrada-xml/nfes-processadas?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao carregar NFes');
      }

      setNfes(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };


  const gerarEntrada = async () => {
    if (!nfeSelecionada) {
      setError('Selecione uma NFe');
      return;
    }

    if (!nfeSelecionada.pode_gerar_entrada) {
      setError('Esta NFe ainda não tem todos os itens associados');
      return;
    }

    // ✅ NOVO: Verificar se o pagamento foi configurado
    if (!nfeSelecionada.pagamento_configurado) {
      setError('Configure o pagamento da NFe antes de gerar a entrada');
      setShowConfigPagamento(true);
      return;
    }

    // Validação do Selo
    if (numeroSelo && numeroSelo.trim() !== '') {
      // Se informou número do selo, a data é obrigatória
      if (!dataSelo) {
        setError('Informe a data do selo');
        return;
      }

      // Validar se data do selo não é maior que hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataSeloDate = new Date(dataSelo);
      dataSeloDate.setHours(0, 0, 0, 0);

      if (dataSeloDate > hoje) {
        setError('A data do selo não pode ser maior que a data atual');
        return;
      }
    }

    setGerando(true);
    setError(null);

    try {
      const response = await fetch('/api/entrada-xml/gerar-entrada', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nfeId: nfeSelecionada.id,  // Usar ID da NFe, não a chave
          dados: {
            informarSelo: !!numeroSelo,
            numeroSelo: numeroSelo || '',
            dataSelo: (numeroSelo && dataSelo) ? dataSelo : null, // ✅ Incluir data do selo
            temConhecimento: temConhecimento,
            numeroConhecimento: dadosConhecimento?.nrocon || numeroConhecimento || '',
            observacoes: observacoes || '',
            // Dados do conhecimento/frete
            codtransp: dadosConhecimento?.codtransp,
            fretecif: dadosConhecimento?.cif,
            totaltransp: dadosConhecimento?.totaltransp,
            totcon: dadosConhecimento?.totalcon,
            dtcon: dadosConhecimento?.dtcon,
          },
          // Dados completos do conhecimento para cadastro na tabela dbconhecimentoent
          conhecimento: temConhecimento ? dadosConhecimento : null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao gerar entrada');
      }

      toast.success('NFe processada com sucesso!', {
        description: data.message || 'Para gerar a entrada, acesse a tela de Entradas de Mercadorias.'
      });

      if (onEntradaGerada) {
        onEntradaGerada(0, '', nfeSelecionada.id);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setGerando(false);
    }
  };

  // ✅ NOVO: Handler após configurar pagamento com sucesso
  const handleSuccessConfigPagamento = async () => {
    setShowConfigPagamento(false);
    setError(null);

    // Guardar ID da NFe selecionada antes de recarregar
    const nfeIdSelecionada = nfeSelecionada?.id;

    // Recarregar lista de NFes do banco para pegar dados atualizados
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtro) params.append('filtro', filtro);

      const response = await fetch(`/api/entrada-xml/nfes-processadas?${params}`);
      const data = await response.json();

      if (response.ok && data.data) {
        setNfes(data.data);

        // Atualizar a NFe selecionada com os dados mais recentes
        if (nfeIdSelecionada) {
          const nfeAtualizada = data.data.find((nfe: NFEProcessada) => nfe.id === nfeIdSelecionada);
          if (nfeAtualizada) {
            setNfeSelecionada(nfeAtualizada);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao recarregar NFes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Processar XML
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtro de Pesquisa
              </label>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por chave NFe, número, fornecedor ou CNPJ..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <button
              onClick={carregarNFes}
              disabled={loading}
              className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Search size={16} />
              Pesquisar
            </button>
          </div>
        </div>

        {/* Lista de NFes */}
        <div className="flex-1 flex overflow-hidden">
          {/* Lista à esquerda */}
          <div className="w-2/3 border-r border-gray-200 dark:border-zinc-700 overflow-y-auto">
            {error && (
              <div className="m-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando NFes...</p>
              </div>
            ) : nfes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Nenhuma NFe encontrada para gerar entrada
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {nfes.map((nfe) => (
                  <div
                    key={nfe.id}
                    onClick={() => setNfeSelecionada(nfe)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      nfeSelecionada?.id === nfe.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            NFe {nfe.numero_nfe}/{nfe.serie_nfe}
                          </h3>
                          {nfe.statusDisplay === 'Associação concluída' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {nfe.fornecedor_nome}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          CNPJ: {nfe.fornecedor_cnpj}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                          <span>Data: {formatarData(nfe.data_emissao)}</span>
                          <span>Valor: {formatarValor(nfe.valor_total)}</span>
                          <span>Itens: {nfe.itens_associados}/{nfe.total_itens}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          nfe.statusDisplay === 'Associação concluída'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {nfe.statusDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes à direita */}
          <div className="w-1/3 p-6 overflow-y-auto">
            {nfeSelecionada ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Detalhes da NFe
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Chave:</span>
                      <p className="text-gray-600 dark:text-gray-400 break-all">{nfeSelecionada.chave_nfe}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Número/Série:</span>
                      <p className="text-gray-600 dark:text-gray-400">{nfeSelecionada.numero_nfe}/{nfeSelecionada.serie_nfe}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Fornecedor:</span>
                      <p className="text-gray-600 dark:text-gray-400">{nfeSelecionada.fornecedor_nome}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Valor Total:</span>
                      <p className="text-gray-600 dark:text-gray-400">{formatarValor(nfeSelecionada.valor_total)}</p>
                    </div>
                  </div>
                </div>

                {/* ✅ NOVO: Seção de Configuração de Pagamento */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Configuração de Pagamento
                  </h4>
                  <div className={`p-4 border rounded-lg ${
                    nfeSelecionada.pagamento_configurado
                      ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                      : 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
                  }`}>
                    {nfeSelecionada.pagamento_configurado ? (
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Pagamento configurado com sucesso</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 mb-3">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Pagamento não configurado</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                          Configure o pagamento da NFe (antecipados + parcelas do XML) antes de gerar a entrada.
                        </p>
                        <button
                          onClick={() => setShowConfigPagamento(true)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2"
                        >
                          <DollarSign size={16} />
                          Configurar Pagamento
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {nfeSelecionada.ordensCompra.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Ordens de Compra</h4>
                    <div className="space-y-2">
                      {nfeSelecionada.ordensCompra.map((ordem) => (
                        <div key={ordem.orc_id} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-xs">
                          <p><strong>OC:</strong> {ordem.orc_numero}</p>
                          <p><strong>Req:</strong> {ordem.req_numero}</p>
                          <p><strong>Data:</strong> {formatarData(ordem.orc_data)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Informações da Entrada</h4>

                  {/* Seção do Selo */}
                  <div className="space-y-3 p-4 border border-gray-200 dark:border-zinc-700 rounded-lg">
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Selo da Nota Fiscal
                    </h5>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Número do Selo
                      </label>
                      <input
                        type="text"
                        value={numeroSelo}
                        onChange={(e) => setNumeroSelo(e.target.value)}
                        placeholder="Informe o número do selo"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data do Selo
                      </label>
                      <input
                        type="date"
                        value={dataSelo}
                        onChange={(e) => setDataSelo(e.target.value)}
                        max={new Date().toISOString().split('T')[0]} // Não permite data futura
                        disabled={!numeroSelo || numeroSelo.trim() === ''}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {numeroSelo && numeroSelo.trim() !== '' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Data do selo não pode ser maior que hoje
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Seção de Conhecimento de Transporte - Verificação Automática */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-blue-600" />
                      Conhecimento de Transporte (CTe)
                    </h4>

                    {verificandoConhecimento ? (
                      <div className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">Verificando conhecimento...</span>
                        </div>
                      </div>
                    ) : statusConhecimento === 'pendente' && dadosConhecimento ? (
                      <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Conhecimento encontrado automaticamente</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p><strong>CTe:</strong> {dadosConhecimento.nrocon} / {dadosConhecimento.serie}</p>
                          <p><strong>Tipo:</strong> {dadosConhecimento.cif === 'S' ? 'CIF (frete fornecedor)' : 'FOB (frete comprador)'}</p>
                          <p><strong>Valor:</strong> R$ {dadosConhecimento.totalcon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <button
                          onClick={() => setShowCadastroConhecimento(true)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          Editar conhecimento
                        </button>
                      </div>
                    ) : temConhecimento && dadosConhecimento ? (
                      <div className="p-4 border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Conhecimento configurado</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p><strong>CTe:</strong> {dadosConhecimento.nrocon} / {dadosConhecimento.serie}</p>
                          <p><strong>Tipo:</strong> {dadosConhecimento.cif === 'S' ? 'CIF (frete fornecedor)' : 'FOB (frete comprador)'}</p>
                          <p><strong>Valor:</strong> R$ {dadosConhecimento.totalcon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <button
                          onClick={() => setShowCadastroConhecimento(true)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          Editar conhecimento
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Nenhum conhecimento encontrado</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                          Se esta entrada possui CTe, cadastre manualmente ou faça upload do XML.
                        </p>
                        <button
                          onClick={() => setShowCadastroConhecimento(true)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2"
                        >
                          <Truck size={16} />
                          Cadastrar Conhecimento
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Observações adicionais (opcional)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={gerarEntrada}
                  disabled={!nfeSelecionada.pode_gerar_entrada || !nfeSelecionada.pagamento_configurado || gerando}
                  className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {gerando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processando XML...
                    </>
                  ) : (
                    <>
                      <Package size={16} />
                      Processar XML
                    </>
                  )}
                </button>
                {!nfeSelecionada.pagamento_configurado && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-2">
                    Configure o pagamento da NFe para habilitar o processamento
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Selecione uma NFe para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Modal de Configuração de Pagamento */}
      {nfeSelecionada && (
        <ConfiguracaoPagamentoNFeModal
          isOpen={showConfigPagamento}
          onClose={() => setShowConfigPagamento(false)}
          nfeId={nfeSelecionada.id}
          onSuccess={handleSuccessConfigPagamento}
        />
      )}

      {/* Modal de Cadastro de Conhecimento */}
      <CadastroConhecimentoModal
        isOpen={showCadastroConhecimento}
        onClose={() => setShowCadastroConhecimento(false)}
        onSalvar={(dados) => {
          setDadosConhecimento(dados);
          setShowCadastroConhecimento(false);
        }}
        valorTotalNfe={nfeSelecionada?.valor_total}
      />
    </>
  );
};

export default GerarEntradaNFeModal;