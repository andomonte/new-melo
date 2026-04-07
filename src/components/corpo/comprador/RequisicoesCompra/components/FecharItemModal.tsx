/**
 * Modal para fechar item da ordem de compra
 *
 * Permite selecionar um item e fechar toda sua pendência
 * (quantidade = quantidade_atendida, move diferença para quantidade_fechada)
 */

import React, { useState, useEffect } from 'react';
import { X, Archive, Package, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
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
}

interface FecharItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordemId: number;
  reqId: number;
  reqVersao: number;
  onSuccess: () => void;
  userId?: string;
  userName?: string;
}

export function FecharItemModal({
  isOpen,
  onClose,
  ordemId,
  reqId,
  reqVersao,
  onSuccess,
  userId,
  userName
}: FecharItemModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [itens, setItens] = useState<ItemOrdem[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<ItemOrdem | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Carregar itens da ordem
  useEffect(() => {
    if (isOpen) {
      loadItens();
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
          pendencia
        };
      });

      // Filtrar apenas itens com pendência > 0
      const itensComPendenciaPositiva = itensComPendencia.filter(item => item.pendencia > 0);
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

  const handleFecharItem = async () => {
    if (!itemSelecionado) return;

    setSubmitting(true);
    try {
      const response = await api.post(`/api/ordens/${ordemId}/fechar-item`, {
        codprod: itemSelecionado.codprod,
        userId,
        userName
      });

      if (response.data.success) {
        toast({
          title: 'Sucesso',
          description: response.data.message || 'Item fechado com sucesso'
        });

        // Se a ordem foi fechada, informar
        if (response.data.data?.ordem_fechada) {
          toast({
            title: 'Ordem Fechada',
            description: 'Todos os itens foram fechados. A ordem foi finalizada.'
          });
        }

        onSuccess();
        onClose();
      } else {
        toast({
          title: 'Erro',
          description: response.data.message || 'Erro ao fechar item',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Erro ao fechar item:', error);
      toast({
        title: 'Erro',
        description: error.response?.data?.message || 'Erro ao fechar item',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
      setConfirmando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Archive className="text-green-600 dark:text-green-400" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Fechar Item
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ordem #{ordemId} - Selecione o item para fechar toda a pendência
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
              <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
              <p className="text-lg font-medium">Nenhum item com pendência</p>
              <p className="text-sm">Todos os itens desta ordem já foram fechados</p>
            </div>
          ) : confirmando && itemSelecionado ? (
            // Tela de confirmação
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                      Confirmar fechamento do item
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Esta ação irá fechar toda a pendência do item. Não poderá ser desfeita.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Detalhes do Item
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Código:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado.codprod}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Referência:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado.ref || '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Descrição:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado.descr}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quantidade Total:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {itemSelecionado.quantidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quantidade Atendida:</span>
                    <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                      {itemSelecionado.quantidade_atendida}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Pendência a Fechar:</span>
                    <span className="ml-2 font-bold text-red-600 dark:text-red-400 text-lg">
                      {itemSelecionado.pendencia} unidades
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setConfirmando(false);
                    setItemSelecionado(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleFecharItem}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fechando...
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      Confirmar Fechamento
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Lista de itens
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Fechar Item</strong> irá zerar toda a pendência do item selecionado.
                  A quantidade será igualada à quantidade já atendida.
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
                        <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">
                          {item.pendencia}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setItemSelecionado(item);
                              setConfirmando(true);
                            }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
                          >
                            Fechar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!confirmando && (
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
