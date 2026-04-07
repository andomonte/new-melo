import React, { useState, useEffect } from 'react';
import { X, DollarSign, Trash2, Lock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { Autocomplete } from '@/components/common/Autocomplete';

interface ParcelaSugerida {
  numero_parcela: number;
  numero_duplicata: string;
  valor_parcela: number;
  data_vencimento: string;
  tipo_documento: string;
  origem: 'XML' | 'ANTECIPADO';
  detalhes?: DetalhePagamentoAntecipado[];
}

interface DetalhePagamentoAntecipado {
  ordemId: string;
  valor: number;
  dataVencimento: string;
  paga: boolean;
  dataPagamento: string | null;
}

interface Parcela {
  numero_parcela: number;
  numero_duplicata: string;
  valor_parcela: number;
  data_vencimento: string;
  dias: number;
}

interface ConfiguracaoPagamentoNFeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfeId: string;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
  // Novas props para ordens manuais (quando NFe não está associada)
  ordensAntecipadas?: number[];
  valorAntecipado?: number;
}

const opcoestipoDocumento = [
  { value: 'BOLETO', label: 'Boleto Bancário' },
  { value: 'DUPLICATA', label: 'Duplicata' },
  { value: 'TRANSFERENCIA', label: 'Transferência Bancária' },
  { value: 'PIX', label: 'PIX' },
  { value: 'PROMISSORIA', label: 'Nota Promissória' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export const ConfiguracaoPagamentoNFeModal: React.FC<
  ConfiguracaoPagamentoNFeModalProps
> = ({ isOpen, onClose, nfeId, onSuccess, userId, userName, ordensAntecipadas, valorAntecipado }) => {
  const [loading, setLoading] = useState(false);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [parcelasSugeridas, setParcelasSugeridas] = useState<ParcelaSugerida[]>(
    [],
  );
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [banco, setBanco] = useState<string | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState('BOLETO');
  const [modalKey, setModalKey] = useState(0);
  const [valorNFe, setValorNFe] = useState(0);
  const [valorEntrada, setValorEntrada] = useState(0);
  const [habilitarEntrada, setHabilitarEntrada] = useState(false);
  const [prazoInput, setPrazoInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pagamentoConfigurado, setPagamentoConfigurado] = useState(false);

  // Data mínima: amanhã (pelo menos 1 dia após hoje)
  const getDataMinima = () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);
    return amanha;
  };

  // Buscar parcelas sugeridas quando o modal abrir
  useEffect(() => {
    if (isOpen && nfeId) {
      // Reset do estado ao abrir o modal
      setError(null);
      setParcelas([]);
      setValorNFe(0);
      setValorEntrada(0);
      setHabilitarEntrada(false);
      setBanco(null);
      setTipoDocumento('BOLETO');
      setPrazoInput('');
      setPagamentoConfigurado(false);
      setModalKey(prev => prev + 1); // Reset do Autocomplete

      // Se foram passadas ordens antecipadas manualmente, aplicar o valor
      if (ordensAntecipadas && ordensAntecipadas.length > 0 && valorAntecipado && valorAntecipado > 0) {
        setHabilitarEntrada(true);
        setValorEntrada(valorAntecipado);
      }

      // Buscar dados
      buscarParcelasSugeridas();
    }
  }, [isOpen, nfeId, ordensAntecipadas, valorAntecipado]);

  // Usar ref para controlar recálculo
  const [recalcularTrigger, setRecalcularTrigger] = React.useState(0);

  // Recalcular valores quando necessário
  useEffect(() => {
    if (parcelas.length > 0 && valorNFe > 0) {
      const valorRestante = valorNFe - valorEntrada;
      const totalParcelas = parcelas.length;
      const valorPorParcela =
        Math.round((valorRestante / totalParcelas) * 100) / 100;

      // Calcular diferença do último centavo
      const somaParcelas = valorPorParcela * totalParcelas;
      const ajuste = Math.round((valorRestante - somaParcelas) * 100) / 100;

      const parcelasRecalculadas = parcelas.map((p, i) => {
        const isUltima = i === totalParcelas - 1;
        return {
          ...p,
          numero_parcela: i + 1,
          numero_duplicata: `${String(i + 1).padStart(
            3,
            '0',
          )}/${totalParcelas}`,
          valor_parcela: isUltima ? valorPorParcela + ajuste : valorPorParcela,
        };
      });

      // Só atualizar se os valores realmente mudaram (evitar loop)
      const valoresIguais = parcelas.every(
        (p, i) =>
          Math.abs(p.valor_parcela - parcelasRecalculadas[i].valor_parcela) <
            0.01 &&
          p.numero_parcela === parcelasRecalculadas[i].numero_parcela &&
          p.numero_duplicata === parcelasRecalculadas[i].numero_duplicata,
      );

      if (!valoresIguais) {
        setParcelas(parcelasRecalculadas);
      }
    }
  }, [recalcularTrigger, valorNFe, valorEntrada]);

  const buscarParcelasSugeridas = async () => {
    setLoadingParcelas(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/entrada-xml/parcelas-sugeridas-v2?nfeId=${nfeId}`,
      );
      const data = await response.json();

      if (data.success) {
        // Verificar se pagamento já foi configurado
        if (data.pagamentoConfigurado) {
          setPagamentoConfigurado(true);
        }

        setParcelasSugeridas(data.data);
        setValorNFe(data.debug?.valorTotalNFe || 0);

        // Se tem parcela 0 (antecipado), habilitar entrada automaticamente
        const parcelaAntecipado = data.data.find(
          (p: ParcelaSugerida) => p.numero_parcela === 0,
        );
        if (parcelaAntecipado) {
          setHabilitarEntrada(true);
          setValorEntrada(parcelaAntecipado.valor_parcela);
        }

        // Carregar parcelas do XML como sugestão
        const parcelasXML = data.data
          .filter((p: ParcelaSugerida) => p.numero_parcela > 0)
          .map((p: ParcelaSugerida) => {
            const dataVenc = new Date(p.data_vencimento);
            const hoje = new Date();
            const dias = Math.ceil(
              (dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
            );

            return {
              numero_parcela: p.numero_parcela,
              numero_duplicata: p.numero_duplicata,
              valor_parcela: p.valor_parcela,
              data_vencimento: p.data_vencimento,
              dias: dias > 0 ? dias : 0,
            };
          });

        setParcelas(parcelasXML);

        // Avisar se não encontrou parcelas no XML (apenas se não está configurado)
        if (parcelasXML.length === 0 && !data.pagamentoConfigurado) {
          toast.info('Nenhuma parcela encontrada no XML. Adicione as parcelas manualmente.');
        }
      } else {
        setError(data.message || 'Erro ao buscar parcelas sugeridas');
      }
    } catch (err) {
      console.error('Erro ao buscar parcelas:', err);
      setError('Erro de comunicação com o servidor');
    } finally {
      setLoadingParcelas(false);
    }
  };

  const handleSalvar = async () => {
    if (!banco) {
      setError('Por favor, selecione um banco');
      toast.error('Por favor, selecione um banco');
      return;
    }

    // Validar se soma das parcelas + entrada = valor da NFe
    const somaParcelas = parcelas.reduce((sum, p) => sum + p.valor_parcela, 0);
    const totalComEntrada = somaParcelas + valorEntrada;
    const diferenca = Math.abs(totalComEntrada - valorNFe);

    if (diferenca > 0.1) {
      setError(
        `A soma das parcelas (R$ ${somaParcelas.toFixed(
          2,
        )}) + entrada (R$ ${valorEntrada.toFixed(
          2,
        )}) = R$ ${totalComEntrada.toFixed(
          2,
        )} difere do valor da NFe (R$ ${valorNFe.toFixed(2)})`,
      );
      toast.error(
        'A soma das parcelas + entrada não corresponde ao valor da NFe',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/entrada-xml/configurar-pagamento-nfe',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nfeId,
            banco,
            tipoDocumento,
            userId,
            userName,
            parcelas: parcelas.map((p) => ({
              numero_parcela: p.numero_parcela,
              numero_duplicata: p.numero_duplicata,
              valor_parcela: p.valor_parcela,
              data_vencimento: p.data_vencimento,
              tipo_documento: tipoDocumento,
            })),
            // Ordens manuais (quando NFe não está associada)
            ordensAssociadas: ordensAntecipadas,
            valorAntecipadoManual: valorAntecipado,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Pagamento configurado com sucesso!');
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Erro ao configurar pagamento');
        toast.error(data.error || 'Erro ao configurar pagamento');
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError('Erro de comunicação com o servidor');
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarParcelas = () => {
    const qtdParcelas = parseInt(prazoInput);
    if (!qtdParcelas || qtdParcelas <= 0) {
      toast.error('Insira uma quantidade válida de parcelas.');
      return;
    }
    if (qtdParcelas > 48) {
      toast.error('Máximo de 48 parcelas permitido.');
      return;
    }

    const hoje = new Date();
    const valorRestante = valorNFe - valorEntrada;
    const valorPorParcela = Math.round((valorRestante / qtdParcelas) * 100) / 100;
    const somaParcelas = valorPorParcela * qtdParcelas;
    const ajuste = Math.round((valorRestante - somaParcelas) * 100) / 100;

    const novasParcelas: Parcela[] = [];
    for (let i = 1; i <= qtdParcelas; i++) {
      const diasParcela = i * 30;
      const dataVencimento = new Date(hoje);
      dataVencimento.setDate(dataVencimento.getDate() + diasParcela);

      const year = dataVencimento.getFullYear();
      const month = String(dataVencimento.getMonth() + 1).padStart(2, '0');
      const day = String(dataVencimento.getDate()).padStart(2, '0');
      const dataISO = `${year}-${month}-${day}`;

      const isUltima = i === qtdParcelas;
      novasParcelas.push({
        numero_parcela: i,
        numero_duplicata: `${String(i).padStart(3, '0')}/${qtdParcelas}`,
        valor_parcela: isUltima ? valorPorParcela + ajuste : valorPorParcela,
        data_vencimento: dataISO,
        dias: diasParcela,
      });
    }

    setParcelas(novasParcelas);
    toast.success(`${qtdParcelas} parcela(s) gerada(s) automaticamente!`);
  };

  const handleLimparParcelas = () => {
    setParcelas([]);
    setPrazoInput('');
  };

  const handleRemoverParcela = (index: number) => {
    const novasParcelas = parcelas.filter((_, i) => i !== index);
    setParcelas(novasParcelas);

    // Disparar recálculo
    setRecalcularTrigger((prev) => prev + 1);
  };

  const handleAtualizarParcela = (
    index: number,
    campo: keyof Parcela,
    valor: any,
  ) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = {
      ...novasParcelas[index],
      [campo]: valor,
    };
    setParcelas(novasParcelas);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGerarParcelas();
    }
  };

  const somaParcelas = parcelas.reduce((sum, p) => sum + p.valor_parcela, 0);
  const totalComEntrada = somaParcelas + valorEntrada;
  const diferenca = Math.abs(valorNFe - totalComEntrada);
  const isValido = diferenca < 0.1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DollarSign className="text-green-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Configurar Pagamento da NFe
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                NFe #{nfeId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Alerta de Configuração Bloqueada */}
          {pagamentoConfigurado && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Lock className="text-yellow-600 dark:text-yellow-400" size={24} />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Configuração Bloqueada
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    O pagamento já foi configurado para esta NFe. As configurações não podem mais ser alteradas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-4 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {loadingParcelas ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">
                Carregando parcelas sugeridas...
              </p>
            </div>
          ) : (
            <>
              {/* Informações da NFe */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Valor Total NFe:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-bold">
                      R${' '}
                      {valorNFe.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {habilitarEntrada && valorEntrada > 0 && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Entrada (Antecipado):
                      </span>
                      <span className="ml-2 text-green-600 dark:text-green-400 font-bold">
                        R${' '}
                        {valorEntrada.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Configurações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna 1: Banco e Tipo */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código da Conta *
                    </label>
                    <Autocomplete
                      resetKey={modalKey}
                      placeholder="Buscar conta..."
                      apiUrl="/api/contas-pagar/contas-dbconta"
                      value={banco}
                      onChange={(value) => setBanco(value)}
                      disabled={loading || pagamentoConfigurado}
                      mapResponse={(data) => data.contas || []}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Conta bancária vinculada ao pagamento
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Documento *
                    </label>
                    <select
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={loading || pagamentoConfigurado}
                    >
                      {opcoestipoDocumento.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Coluna 2: Parcelas */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantidade de Parcelas
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="48"
                        value={prazoInput}
                        onChange={(e) => setPrazoInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ex: 3"
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={loading || pagamentoConfigurado}
                      />
                      <button
                        type="button"
                        onClick={handleGerarParcelas}
                        disabled={loading || pagamentoConfigurado}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Gerar Parcelas
                      </button>
                      <button
                        type="button"
                        onClick={handleLimparParcelas}
                        disabled={loading || pagamentoConfigurado || parcelas.length === 0}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      As parcelas serão geradas com intervalos de 30 dias a partir da data de emissão (30, 60, 90 dias...)
                    </p>
                  </div>

                  {/* Lista de Parcelas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Parcelas Configuradas ({parcelas.length})
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900/20">
                      {parcelas.length === 0 ? (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                          Nenhuma parcela adicionada
                        </div>
                      ) : (
                        parcelas.map((parcela, index) => {
                          let dataFormatada = '';
                          if (parcela.data_vencimento) {
                            try {
                              const date = new Date(
                                parcela.data_vencimento + 'T00:00:00',
                              );
                              if (!isNaN(date.getTime())) {
                                dataFormatada =
                                  date.toLocaleDateString('pt-BR');
                              }
                            } catch {
                              dataFormatada = '';
                            }
                          }

                          return (
                            <div
                              key={index}
                              className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  Parcela {parcela.numero_parcela} -{' '}
                                  {parcela.numero_duplicata}
                                </span>
                                {!pagamentoConfigurado && (
                                  <button
                                    onClick={() => handleRemoverParcela(index)}
                                    className="text-red-500 hover:text-red-700"
                                    disabled={loading}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                                    Dias:
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={parcela.dias || ''}
                                    onChange={(e) => {
                                      const dias =
                                        parseInt(e.target.value) || 0;
                                      handleAtualizarParcela(
                                        index,
                                        'dias',
                                        dias,
                                      );

                                      // Recalcular data de vencimento
                                      const hoje = new Date();
                                      const novaData = new Date(hoje);
                                      novaData.setDate(
                                        novaData.getDate() + dias,
                                      );
                                      const year = novaData.getFullYear();
                                      const month = String(
                                        novaData.getMonth() + 1,
                                      ).padStart(2, '0');
                                      const day = String(
                                        novaData.getDate(),
                                      ).padStart(2, '0');
                                      handleAtualizarParcela(
                                        index,
                                        'data_vencimento',
                                        `${year}-${month}-${day}`,
                                      );
                                    }}
                                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    disabled={loading || pagamentoConfigurado}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                                    Vencimento:
                                  </label>
                                  <DatePicker
                                    selected={(() => {
                                      if (!parcela.data_vencimento) return null;
                                      try {
                                        const date = new Date(
                                          parcela.data_vencimento + 'T00:00:00',
                                        );
                                        return isNaN(date.getTime())
                                          ? null
                                          : date;
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                    onChange={(date: Date | null) => {
                                      if (date) {
                                        const year = date.getFullYear();
                                        const month = String(
                                          date.getMonth() + 1,
                                        ).padStart(2, '0');
                                        const day = String(
                                          date.getDate(),
                                        ).padStart(2, '0');
                                        handleAtualizarParcela(
                                          index,
                                          'data_vencimento',
                                          `${year}-${month}-${day}`,
                                        );
                                      }
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    locale={ptBR}
                                    minDate={getDataMinima()}
                                    disabled={loading || pagamentoConfigurado}
                                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    calendarClassName="dark:bg-gray-800 dark:text-white"
                                    wrapperClassName="w-full"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-gray-400">
                                    Valor (R$):
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={parcela.valor_parcela}
                                    onChange={(e) =>
                                      handleAtualizarParcela(
                                        index,
                                        'valor_parcela',
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    disabled={loading || pagamentoConfigurado}
                                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              {parcelas.length > 0 && (
                <div
                  className={`p-4 rounded-lg ${
                    isValido
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Resumo do Pagamento
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Valor Total:
                      </span>
                      <div className="font-bold text-gray-900 dark:text-white">
                        R${' '}
                        {valorNFe.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    {habilitarEntrada && valorEntrada > 0 && (
                      <div>
                        <span className="text-gray-700 dark:text-gray-300">
                          Entrada:
                        </span>
                        <div className="font-bold text-blue-600 dark:text-blue-400">
                          R${' '}
                          {valorEntrada.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Total Parcelado:
                      </span>
                      <div
                        className={`font-bold ${
                          isValido
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {parcelas.length}x de R${' '}
                        {(somaParcelas / parcelas.length).toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </div>
                    </div>
                  </div>
                  {!isValido && (
                    <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-200">
                      ⚠️ A soma das parcelas (R${' '}
                      {somaParcelas.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      )
                      {valorEntrada > 0 &&
                        ` + entrada (R$ ${valorEntrada.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })})`}{' '}
                      = R${' '}
                      {totalComEntrada.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      não corresponde ao valor total da NFe (R${' '}
                      {valorNFe.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      ).
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {pagamentoConfigurado ? 'Fechar' : 'Cancelar'}
          </button>
          {pagamentoConfigurado ? (
            <div className="px-6 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md flex items-center gap-2">
              <CheckCircle size={18} />
              Pagamento Configurado
            </div>
          ) : (
            <button
              onClick={handleSalvar}
              disabled={loading || !banco || parcelas.length === 0 || !isValido}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? 'Salvando...' : 'Confirmar Pagamento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
