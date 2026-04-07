/**
 * Modal para baixar pendência parcial de um item da ordem de compra
 *
 * Permite selecionar um item e informar a quantidade a baixar
 * (quantidade -= quantidade_baixar, quantidade_fechada += quantidade_baixar)
 */

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Package, AlertTriangle, Loader2, Minus, Plus } from 'lucide-react';
import api from '@/components/services/api';
import { useToast } from '@/hooks/use-toast';

interface ItemOrdem {
  codprod: string;
  ref?: string;
  descr?: string;
  quantidade: number;
  quantidade_atendida: number;
  quantidade_fechada?: number;
  preco_unitario: number;
  pendencia: number;
  multiplo?: number;
}

interface BaixarPendenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordemId: number;
  reqId: number;
  reqVersao: number;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
}

export function BaixarPendenciaModal({
  isOpen,
  onClose,
  ordemId,
  reqId,
  reqVersao,
  onSuccess,
  userId,
  userName
}: BaixarPendenciaModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [itens, setItens] = useState<ItemOrdem[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<ItemOrdem | null>(null);
  const [quantidadeBaixar, setQuantidadeBaixar] = useState<number>(0);
  const [step, setStep] = useState<'select' | 'input'>('select');

  // Carregar itens da ordem
  useEffect(() => {
    if (isOpen) {
      loadItens();
      setStep('select');
      setItemSelecionado(null);
      setQuantidadeBaixar(0);
    }
  }, [isOpen, reqId, reqVersao]);

  const loadItens = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/requisicoesCompra/items?req_id=${reqId}&req_versao=${reqVersao}`);
      const data = response.data?.data || [];

      // Mapear e calcular pendência
      const itensComPendencia: ItemOrdem[] = data.map((item: any) => {
        const quantidade = Number(item.quantidade) || 0;
        const quantidadeAtendida = Number(item.quantidade_atendida) || 0;
        const quantidadeFechada = Number(item.quantidade_fechada) || 0;
        const pendencia = quantidade - quantidadeAtendida;

        return {
          codprod: item.codprod,
          ref: item.produto?.ref || item.ref,
          descr: item.produto?.descr || item.descricao || 'Produto não encontrado',
          quantidade,
          quantidade_atendida: quantidadeAtendida,
          quantidade_fechada: quantidadeFechada,
          preco_unitario: Number(item.preco_unitario) || 0,
          pendencia,
          multiplo: item.produto?.multiplo || item.multiplo || 1
        };
      });

      // Filtrar apenas itens com pendência > 1 (para poder baixar parcialmente)
      // Se pendência = 1, deve usar Fechar Item
      const itensComPendenciaPositiva = itensComPendencia.filter(item => item.pendencia > 1);
      setItens(itensComPendenciaPositiva);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar itens da ordem',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionarItem = (item: ItemOrdem) => {
    setItemSelecionado(item);
    setQuantidadeBaixar(1);
    setStep('input');
  };

  const handleVoltar = () => {
    setStep('select');
    setItemSelecionado(null);
    setQuantidadeBaixar(0);
  };

  const handleBaixarPendencia = async () => {
    if (!itemSelecionado || quantidadeBaixar <= 0) return;

    // Validar quantidade
    if (quantidadeBaixar >= itemSelecionado.pendencia) {
      toast({
        title: 'Atenção',
        description: 'Para baixar toda a pendência, utilize a função "Fechar Item"',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/api/ordens/${ordemId}/baixar-pendencia`, {
        codprod: itemSelecionado.codprod,
        quantidade: quantidadeBaixar,
        userId,
        userName
      });

      if (response.data.success) {
        toast({
          title: 'Sucesso',
          description: response.data.message || 'Pendência baixada com sucesso'
        });
        onSuccess();
        onClose();
      } else {
        toast({
          title: 'Erro',
          description: response.data.message || 'Erro ao baixar pendência',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Erro ao baixar pendência:', error);
      toast({
        title: 'Erro',
        description: error.response?.data?.message || 'Erro ao baixar pendência',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const incrementarQuantidade = () => {
    if (!itemSelecionado) return;
    const maxPermitido = itemSelecionado.pendencia - 1; // -1 porque não pode baixar tudo
    if (quantidadeBaixar < maxPermitido) {
      setQuantidadeBaixar(prev => prev + 1);
    }
  };

  const decrementarQuantidade = () => {
    if (quantidadeBaixar > 1) {
      setQuantidadeBaixar(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CheckSquare className="text-green-500 dark:text-green-400" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Baixar Pendência
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ordem #{ordemId} - {step === 'select' ? 'Selecione o item' : 'Informe a quantidade'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Package className="h-12 w-12 mb-4 text-gray-400" />
              <p className="text-lg font-medium">Nenhum item disponível</p>
              <p className="text-sm text-center">
                Não há itens com pendência maior que 1 unidade.
                <br />
                Para pendência de 1 unidade, use "Fechar Item".
              </p>
            </div>
          ) : step === 'select' ? (
            // Step 1: Selecionar item
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Baixar Pendência</strong> permite reduzir parcialmente a quantidade pendente de um item.
                  Selecione o item que deseja baixar.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700">
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Código</th>
                      <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Quantidade</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Atendida</th>
                      <th className="text-right p-3 font-semibold text-gray-700 dark:text-gray-300">Pendência</th>
                      <th className="text-center p-3 font-semibold text-gray-700 dark:text-gray-300">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => (
                      <tr
                        key={item.codprod}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="p-3 text-gray-900 dark:text-gray-100 font-mono text-sm">
                          {item.codprod}
                        </td>
                        <td className="p-3 text-gray-900 dark:text-gray-100">
                          <div>{item.descr}</div>
                          {item.ref && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Ref: {item.ref}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right text-gray-900 dark:text-gray-100">
                          {item.quantidade}
                        </td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400">
                          {item.quantidade_atendida}
                        </td>
                        <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">
                          {item.pendencia}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleSelecionarItem(item)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors"
                          >
                            Baixar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Step 2: Informar quantidade
            <div className="space-y-6">
              {/* Info do item */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Item Selecionado
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Código:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado?.codprod}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Referência:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado?.ref || '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Descrição:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado?.descr}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quantidade Total:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado?.quantidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quantidade Atendida:</span>
                    <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                      {itemSelecionado?.quantidade_atendida}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Pendência Disponível:</span>
                    <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                      {itemSelecionado?.pendencia}
                    </span>
                  </div>
                  {itemSelecionado?.multiplo && itemSelecionado.multiplo > 1 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Múltiplo:</span>
                      <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                        {itemSelecionado.multiplo}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Input de quantidade */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Quantidade a Baixar
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={decrementarQuantidade}
                    disabled={quantidadeBaixar <= 1}
                    className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    value={quantidadeBaixar}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const maxPermitido = (itemSelecionado?.pendencia || 1) - 1;
                      if (val >= 1 && val <= maxPermitido) {
                        setQuantidadeBaixar(val);
                      }
                    }}
                    className="w-32 text-center text-2xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min={1}
                    max={(itemSelecionado?.pendencia || 1) - 1}
                  />
                  <button
                    onClick={incrementarQuantidade}
                    disabled={quantidadeBaixar >= ((itemSelecionado?.pendencia || 1) - 1)}
                    className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Máximo permitido: {(itemSelecionado?.pendencia || 1) - 1} unidades
                </p>
              </div>

              {/* Resumo */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Após a baixa:
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      Pendência restante: <strong>{(itemSelecionado?.pendencia || 0) - quantidadeBaixar}</strong> unidades
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleVoltar}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleBaixarPendencia}
                  disabled={submitting || quantidadeBaixar <= 0 || quantidadeBaixar >= (itemSelecionado?.pendencia || 0)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Baixando...
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      Baixar {quantidadeBaixar} unidade{quantidadeBaixar > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer (apenas no step select) */}
        {step === 'select' && !loading && (
          <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
