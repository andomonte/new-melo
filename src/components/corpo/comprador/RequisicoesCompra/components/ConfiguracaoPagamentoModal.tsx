import React, { useState, useEffect } from 'react';
import { X, DollarSign, Plus, Trash2, Calendar } from 'lucide-react';
import { useConfiguracaoPagamento } from '../hooks/useConfiguracaoPagamento';
import { toast } from 'sonner';
import { OrdemCompraDTO } from '../../types/OrdemCompraDTO';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

interface ConfiguracaoPagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemCompraDTO;
  onSuccess: () => void;
  nfeId?: string; // Opcional: para buscar parcelas do XML
}

const opcoestipoDocumento = [
  { value: 'BOLETO', label: 'Boleto Bancário' },
  { value: 'TRANSFERENCIA', label: 'Transferência Bancária' },
  { value: 'PIX', label: 'PIX' },
  { value: 'NOTA_PROMISSORIA', label: 'Nota Promissória' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export const ConfiguracaoPagamentoModal: React.FC<
  ConfiguracaoPagamentoModalProps
> = ({ isOpen, onClose, ordem, onSuccess, nfeId }) => {
  const {
    bancos,
    configuracao,
    loading,
    setConfiguracao,
    buscarBancos,
    buscarConfiguracao,
    salvarConfiguracao,
    adicionarParcela,
    removerParcela,
    atualizarParcela,
    limparConfiguracao,
  } = useConfiguracaoPagamento();

  const [prazoInput, setPrazoInput] = useState('');
  const [buscandoSugeridas, setBuscandoSugeridas] = useState(false);

  // Data mínima: amanhã (pelo menos 1 dia após hoje)
  const getDataMinima = () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);
    return amanha;
  };

  // Verificar se pagamento já foi configurado (desabilita edição)
  const cobrancaJaGerada = ordem.orc_pagamento_configurado || false;

  // Buscar parcelas sugeridas quando abre o modal
  useEffect(() => {
    if (isOpen) {
      console.log('=== DEBUG MODAL CONFIGURAÇÃO ===');
      console.log('Ordem ID:', ordem.orc_id);
      console.log('NFe ID:', nfeId);
      console.log(
        'orc_pagamento_configurado:',
        ordem.orc_pagamento_configurado,
      );
      console.log('cobrancaJaGerada:', cobrancaJaGerada);

      buscarBancos();

      // Se já tem pagamento configurado, buscar a configuração existente
      if (cobrancaJaGerada) {
        console.log('Buscando configuração existente...');
        buscarConfiguracao(ordem.orc_id);
      } else {
        console.log('Limpando configuração (ordem não configurada ainda)');
        limparConfiguracao();

        // Se tem nfeId, buscar parcelas sugeridas do XML
        if (nfeId) {
          buscarParcelasSugeridas();
        }
      }
    }
  }, [isOpen]);

  const buscarParcelasSugeridas = async () => {
    if (!nfeId) return;

    setBuscandoSugeridas(true);
    try {
      const url = `/api/entrada-xml/parcelas-sugeridas?nfeId=${nfeId}&ordemId=${ordem.orc_id}`;
      console.log(`🔍 Buscando parcelas sugeridas em: ${url}`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        console.log(`✅ ${data.data.length} parcela(s) sugerida(s) encontrada(s)`);

        // Pre-preencher as parcelas sugeridas
        setConfiguracao((prev) => ({
          ...prev,
          parcelas: data.data.map((sugerida: any) => {
            // Calcular dias entre hoje e a data de vencimento
            const hoje = new Date();
            const dataVenc = new Date(sugerida.data_vencimento);
            const diffTime = dataVenc.getTime() - hoje.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
              numero_parcela: sugerida.numero_parcela,
              numero_duplicata: sugerida.numero_duplicata,
              valor_parcela: sugerida.valor_parcela,
              data_vencimento: sugerida.data_vencimento,
              dias: diffDays > 0 ? diffDays : 0,
              tipo_documento: sugerida.tipo_documento,
              status: 'PENDENTE',
              origem: sugerida.origem, // 'XML' ou 'ANTECIPADO'
            };
          }),
        }));

        toast.success(`${data.data.length} parcela(s) sugerida(s) carregada(s) do XML`);
      } else {
        console.log('ℹ️  Nenhuma parcela sugerida encontrada');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar parcelas sugeridas:', error);
      toast.error('Erro ao buscar parcelas sugeridas do XML');
    } finally {
      setBuscandoSugeridas(false);
    }
  };

  const handleSubmit = async () => {
    // Verificar se tem apenas pagamento antecipado (entrada sem parcelas)
    const temApenasEntrada = configuracao.habilitarEntrada && configuracao.parcelas.length === 1;

    if (temApenasEntrada) {
      // Pedir confirmação
      const confirmado = window.confirm(
        'Tem certeza que deseja criar pagamento com apenas valor antecipado (sem parcelas)?\n\n' +
        'Isso significa que o pagamento será à vista.'
      );

      if (!confirmado) {
        return; // Cancelou
      }
    }

    const success = await salvarConfiguracao(ordem.orc_id);
    if (success) {
      toast.success('Pagamento configurado com sucesso!');
      limparConfiguracao();
      onSuccess();
      onClose(); // Fechar o modal após salvar
    }
  };

  const handleAdicionarParcela = () => {
    const dias = parseInt(prazoInput);
    if (!dias || dias < 1) {
      toast.error('O prazo deve ser no mínimo 1 dia');
      return;
    }

    const valorTotal = ordem.orc_valor_total || 0;
    const valorEntrada = configuracao.habilitarEntrada
      ? parseFloat(configuracao.valorEntrada) || 0
      : 0;

    // Se é a primeira parcela E tem entrada habilitada, adiciona "Pagamento Antecipado"
    if (configuracao.parcelas.length === 0 && configuracao.habilitarEntrada) {
      adicionarParcela(dias, valorEntrada);
      setPrazoInput('');
    } else {
      // Calcular valor correto para esta parcela
      const valorRestante = valorTotal - valorEntrada;
      const indicePrimeiraParcelaRecalcular = configuracao.habilitarEntrada
        ? 1
        : 0;
      const totalParcelas =
        configuracao.parcelas.length + 1 - indicePrimeiraParcelaRecalcular;
      const valorPorParcela =
        totalParcelas > 0 ? valorRestante / totalParcelas : 0;

      // Arredondar para 2 casas decimais
      const valorArredondado = Math.round(valorPorParcela * 100) / 100;

      // Adicionar nova parcela com valor correto
      adicionarParcela(dias, valorArredondado);
      setPrazoInput('');

      // Recalcular TODAS as parcelas (não só a nova)
      setTimeout(() => recalcularParcelas(), 10);
    }
  };

  const recalcularParcelas = () => {
    const valorTotal = ordem.orc_valor_total || 0;
    const valorEntrada = configuracao.habilitarEntrada
      ? parseFloat(configuracao.valorEntrada) || 0
      : 0;
    const valorRestante = valorTotal - valorEntrada;

    setConfiguracao((prev) => {
      const novasParcelas = [...prev.parcelas];

      // Se tem entrada, primeira parcela é "Pagamento Antecipado" (não recalcular)
      const indicePrimeiraParcelaRecalcular = prev.habilitarEntrada ? 1 : 0;
      const parcelasParaRecalcular =
        novasParcelas.length - indicePrimeiraParcelaRecalcular;

      if (parcelasParaRecalcular > 0) {
        const valorPorParcela = valorRestante / parcelasParaRecalcular;

        // Atualizar valor de todas as parcelas (exceto Pagamento Antecipado)
        // Arredondar para 2 casas decimais
        for (
          let i = indicePrimeiraParcelaRecalcular;
          i < novasParcelas.length;
          i++
        ) {
          novasParcelas[i].valor_parcela =
            Math.round(valorPorParcela * 100) / 100;
        }
      }

      return {
        ...prev,
        parcelas: novasParcelas,
      };
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdicionarParcela();
    }
  };

  const handleValorEntradaChange = (valor: string) => {
    setConfiguracao((prev) => {
      const valorEntrada = parseFloat(valor) || 0;
      const novasParcelas = [...prev.parcelas];

      // Se já tem parcelas e a primeira é "Pagamento Antecipado", atualizar o valor dela
      if (prev.habilitarEntrada && novasParcelas.length > 0) {
        novasParcelas[0].valor_parcela = valorEntrada;
      }

      return {
        ...prev,
        valorEntrada: valor,
        parcelas: novasParcelas,
      };
    });

    // Recalcular todas as parcelas restantes após atualizar valor de entrada
    setTimeout(() => recalcularParcelas(), 10);
  };

  const handleRemoverParcela = (index: number) => {
    removerParcela(index);
    // Recalcular após remover
    setTimeout(() => recalcularParcelas(), 10);
  };

  const handleAtualizarValorParcela = (index: number, valor: number) => {
    // Apenas atualizar o valor - NÃO recalcular outras automaticamente
    // Usuário pode editar manualmente se quiser valores diferentes
    atualizarParcela(index, 'valor_parcela', valor);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <style>{`
        /* Remover setas dos inputs numéricos */
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
                Configurar Pagamento
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ordem #{ordem.orc_id} - {ordem.fornecedor_nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Alerta de Cobrança Gerada */}
          {cobrancaJaGerada && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Configuração Bloqueada
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    A cobrança já foi gerada para esta ordem. As configurações
                    de pagamento não podem mais ser alteradas. Você pode apenas
                    visualizar as informações.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Informações da Ordem */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Fornecedor:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {ordem.fornecedor_nome}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Valor Total:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white font-bold">
                  R${' '}
                  {(ordem.orc_valor_total || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: Banco e Tipo */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Banco *
                </label>
                <input
                  type="text"
                  value="MELO COMERCIO"
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Documento *
                </label>
                <select
                  value={configuracao.tipoDocumento}
                  onChange={(e) =>
                    setConfiguracao((prev) => ({
                      ...prev,
                      tipoDocumento: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={!configuracao.banco || loading || cobrancaJaGerada}
                >
                  {opcoestipoDocumento.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={configuracao.habilitarEntrada}
                    onChange={(e) =>
                      setConfiguracao((prev) => ({
                        ...prev,
                        habilitarEntrada: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={cobrancaJaGerada}
                  />
                  Habilitar valor de entrada (Pagamento antecipado)
                </label>

                {configuracao.habilitarEntrada && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valor de Entrada (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={ordem.orc_valor_total}
                      value={configuracao.valorEntrada}
                      onChange={(e) => handleValorEntradaChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={cobrancaJaGerada}
                      readOnly={cobrancaJaGerada}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Coluna 2: Parcelas */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adicionar Parcela (dias) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={prazoInput}
                    onChange={(e) => setPrazoInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: 30"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={loading || cobrancaJaGerada}
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarParcela}
                    disabled={loading || cobrancaJaGerada}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Lista de Parcelas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Parcelas Configuradas ({configuracao.parcelas.length})
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900/20">
                  {configuracao.parcelas.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                      Nenhuma parcela adicionada
                    </div>
                  ) : (
                    configuracao.parcelas.map((parcela, index) => {
                      // Se habilitou entrada e é a primeira parcela, mostrar "Pagamento Antecipado"
                      const isEntrada =
                        configuracao.habilitarEntrada && index === 0;
                      const nomeParcela = isEntrada
                        ? 'Pagamento Antecipado'
                        : `Parcela ${parcela.numero_parcela}`;

                      // Formatar data para exibição brasileira
                      const dataFormatada = parcela.data_vencimento
                        ? new Date(
                            parcela.data_vencimento + 'T00:00:00',
                          ).toLocaleDateString('pt-BR')
                        : '';

                      // Badge de origem
                      const origem = (parcela as any).origem;
                      const badgeOrigem = origem === 'XML'
                        ? { text: 'DO XML', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
                        : origem === 'ANTECIPADO'
                        ? { text: 'ANTECIPADO', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
                        : null;

                      return (
                        <div
                          key={index}
                          className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {nomeParcela}
                              </span>
                              {badgeOrigem && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeOrigem.color}`}>
                                  {badgeOrigem.text}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoverParcela(index)}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={cobrancaJaGerada}
                            >
                              <Trash2 size={16} />
                            </button>
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
                                  const valor = e.target.value;
                                  if (valor === '' || parseInt(valor) >= 0) {
                                    atualizarParcela(
                                      index,
                                      'dias',
                                      valor === '' ? 0 : parseInt(valor),
                                    );
                                  }
                                }}
                                onBlur={(e) => {
                                  // Se ficou vazio, setar como 0
                                  if (e.target.value === '') {
                                    atualizarParcela(index, 'dias', 0);
                                  }
                                }}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                disabled={cobrancaJaGerada}
                                readOnly={cobrancaJaGerada}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400">
                                Vencimento:
                              </label>
                              <DatePicker
                                selected={
                                  parcela.data_vencimento
                                    ? (() => {
                                        // 🔧 Normalizar formato de data do PostgreSQL ou ISO
                                        const dataStr = parcela.data_vencimento;

                                        // Se já tem timestamp (2025-12-15 00:00:00), extrair só a data
                                        if (dataStr.includes(' ')) {
                                          const [datePart] = dataStr.split(' ');
                                          return new Date(datePart + 'T00:00:00');
                                        }

                                        // Se é ISO date (2025-12-15), adicionar timestamp
                                        if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                          return new Date(dataStr + 'T00:00:00');
                                        }

                                        // Fallback: tentar parsear direto
                                        return new Date(dataStr);
                                      })()
                                    : null
                                }
                                onChange={(date: Date | null) => {
                                  if (date) {
                                    const year = date.getFullYear();
                                    const month = String(
                                      date.getMonth() + 1,
                                    ).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(
                                      2,
                                      '0',
                                    );
                                    const dataISO = `${year}-${month}-${day}`;
                                    atualizarParcela(
                                      index,
                                      'data_vencimento',
                                      dataISO,
                                    );
                                  }
                                }}
                                dateFormat="dd/MM/yyyy"
                                locale={ptBR}
                                minDate={getDataMinima()}
                                disabled={cobrancaJaGerada}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                                  handleAtualizarValorParcela(
                                    index,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                disabled={cobrancaJaGerada}
                                readOnly={cobrancaJaGerada}
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
          {configuracao.parcelas.length > 0 &&
            (() => {
              const valorTotal = ordem.orc_valor_total || 0;
              const valorEntrada = configuracao.habilitarEntrada
                ? parseFloat(configuracao.valorEntrada) || 0
                : 0;
              const somaParcelas = configuracao.parcelas.reduce(
                (acc, p) => acc + p.valor_parcela,
                0,
              );
              const diferenca = Math.abs(valorTotal - somaParcelas);
              const isValido = diferenca < 0.01; // Aceitar diferença de até 1 centavo

              // Se tem entrada, contar apenas as parcelas APÓS o Pagamento Antecipado
              const indicePrimeiraParcelaRestante =
                configuracao.habilitarEntrada ? 1 : 0;
              const parcelasRestantes = configuracao.parcelas.slice(
                indicePrimeiraParcelaRestante,
              );
              const quantidadeParcelas = parcelasRestantes.length;
              const valorParcelas = parcelasRestantes.reduce(
                (acc, p) => acc + p.valor_parcela,
                0,
              );

              return (
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
                        {valorTotal.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    {configuracao.habilitarEntrada && valorEntrada > 0 && (
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
                        {quantidadeParcelas > 0
                          ? `${quantidadeParcelas}x de R$ ${(
                              valorParcelas / quantidadeParcelas
                            ).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : `${
                              configuracao.parcelas.length
                            }x = R$ ${somaParcelas.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}`}
                      </div>
                    </div>
                  </div>
                  {!isValido && (
                    <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-200">
                      ⚠️ A soma das parcelas (R${' '}
                      {somaParcelas.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      ) não corresponde ao valor total da ordem (R${' '}
                      {valorTotal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      ).
                    </div>
                  )}
                </div>
              );
            })()}
        </div>

        {/* Footer */}
        {!cobrancaJaGerada && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || configuracao.parcelas.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Salvando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
