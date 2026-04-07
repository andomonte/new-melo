/**
 * Tabela de itens dentro de uma fatura da DI
 * Padrão visual do sistema (raw tailwind, flex divs)
 * Inclui badge de status (Pendente/Associado) e botão Associar
 */

import React, { useState } from 'react';
import { Plus, Trash2, Package, Link2, ShoppingCart, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ItemImportacao } from '../types/importacao';
import { fmtDecimal } from '../utils/formatters';
import { BuscarProdutoModal } from './BuscarProdutoModal';
import { ImportarPedidoModal } from './ImportarPedidoModal';
import type { ItemPedidoSelecionado } from './ImportarPedidoModal';
import { DividirItemModal } from './DividirItemModal';

interface ItensTableProps {
  itens: ItemImportacao[];
  onAddItem: (item: ItemImportacao) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem?: (itemIndex: number, updates: Partial<ItemImportacao>) => void;
  codCredor?: string;
  fornecedorNome?: string;
  onImportarDoPedido?: (itens: ItemPedidoSelecionado[]) => void;
  onDividirItem?: (itemIndex: number, qtdPrimeiro: number) => void;
  readOnly?: boolean;
}

export const ItensTable: React.FC<ItensTableProps> = ({
  itens,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  codCredor,
  fornecedorNome,
  onDividirItem,
  onImportarDoPedido,
  readOnly = false,
}) => {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalPedidoAberto, setModalPedidoAberto] = useState(false);
  const [modalDividirAberto, setModalDividirAberto] = useState(false);
  const [itemSelecionadoIdx, setItemSelecionadoIdx] = useState<number>(-1);
  const [itemDividirIdx, setItemDividirIdx] = useState<number>(-1);

  // Ordenar: pendentes (sem codprod) primeiro, mantendo índice original
  const itensOrdenados = itens
    .map((item, idx) => ({ item, originalIdx: idx }))
    .sort((a, b) => {
      const aAssociado = a.item.codprod ? 1 : 0;
      const bAssociado = b.item.codprod ? 1 : 0;
      return aAssociado - bAssociado;
    });

  const totalProforma = itens.reduce((s, i) => s + (i.proforma_total || 0), 0);
  const totalInvoice = itens.reduce((s, i) => s + (i.invoice_total || 0), 0);
  const totalCusto = itens.reduce((s, i) => s + (i.custo_total_real || 0), 0);

  const handleAssociar = (idx: number) => {
    setItemSelecionadoIdx(idx);
    setModalAberto(true);
  };

  const handleDividir = (idx: number) => {
    setItemDividirIdx(idx);
    setModalDividirAberto(true);
  };

  const handleProdutoSelecionado = (codprod: string) => {
    if (onUpdateItem && itemSelecionadoIdx >= 0) {
      onUpdateItem(itemSelecionadoIdx, { codprod });
    }
    setModalAberto(false);
    setItemSelecionadoIdx(-1);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Itens ({itens.length})
        </span>
        {!readOnly && (
          <div className="flex gap-2">
            {(codCredor || fornecedorNome) && onImportarDoPedido && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalPedidoAberto(true)}
                className="flex items-center gap-1 text-xs h-7"
              >
                <ShoppingCart size={12} />
                Importar do Pedido
              </Button>
            )}
            <Button size="sm" disabled className="flex items-center gap-1 text-xs h-7 bg-[#347AB6] hover:bg-[#2a5f8f] text-white">
              <Plus size={12} />
              Adicionar Item
            </Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
          <div className="flex gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <div className="w-24">Status</div>
            <div className="w-24">Código</div>
            <div className="flex-1 min-w-0">Descrição</div>
            <div className="w-14 text-center">Qtd</div>
            <div className="w-28 text-right">Proforma (USD)</div>
            <div className="w-28 text-right">Invoice (USD)</div>
            <div className="w-28 text-right">Custo (BRL)</div>
            {!readOnly && <div className="w-24" />}
          </div>
        </div>

        {/* Corpo */}
        {itens.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <div className="text-center">
              <Package className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum item nesta fatura</p>
            </div>
          </div>
        ) : (
          itensOrdenados.map(({ item, originalIdx }) => {
            const associado = !!item.codprod;
            const comPedido = associado && !!item.id_orc;
            return (
              <div
                key={originalIdx}
                className="flex gap-2 px-3 py-2 text-xs border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors items-center"
              >
                {/* Badge de status - 3 estados */}
                <div className="w-24">
                  {comPedido ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                      Associado + PC
                    </span>
                  ) : associado ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400 border border-lime-200 dark:border-lime-800">
                      Associado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      Pendente
                    </span>
                  )}
                </div>

                <div className="w-24 font-mono text-gray-900 dark:text-gray-100">
                  {item.codprod || '-'}
                  {item.id_orc && (
                    <div className="text-[9px] text-gray-400 dark:text-gray-500">PC: {item.id_orc}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-gray-600 dark:text-gray-300 truncate">
                  {item.descricao || '-'}
                </div>
                <div className="w-14 text-center text-gray-900 dark:text-gray-100">{item.qtd}</div>
                <div className="w-28 text-right text-gray-600 dark:text-gray-300">
                  {fmtDecimal(item.proforma_unit)}
                </div>
                <div className="w-28 text-right text-gray-600 dark:text-gray-300">
                  {fmtDecimal(item.invoice_unit)}
                </div>
                <div className="w-28 text-right font-medium text-gray-900 dark:text-gray-100">
                  {item.custo_unit_real ? `R$ ${fmtDecimal(item.custo_unit_real)}` : '-'}
                </div>
                {!readOnly && (
                  <div className="w-24 flex items-center justify-end gap-1">
                    {!associado && onUpdateItem && (
                      <button
                        onClick={() => handleAssociar(originalIdx)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-[#347AB6] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
                      >
                        <Link2 size={10} />
                        Associar
                      </button>
                    )}
                    {item.qtd > 1 && onDividirItem && (
                      <button
                        onClick={() => handleDividir(originalIdx)}
                        className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Dividir item"
                      >
                        <Scissors className="h-3 w-3 text-blue-500" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveItem(originalIdx)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Totais */}
      {itens.length > 0 && (
        <div className="flex justify-end gap-6 text-xs px-2">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Proforma: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              USD {totalProforma.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Invoice: </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              USD {totalInvoice.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Custo Total: </span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              R$ {totalCusto.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Modal de busca de produto */}
      <BuscarProdutoModal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setItemSelecionadoIdx(-1); }}
        onSelecionar={handleProdutoSelecionado}
        descricaoItem={itemSelecionadoIdx >= 0 && itemSelecionadoIdx < itens.length ? itens[itemSelecionadoIdx]?.descricao : undefined}
      />

      {/* Modal de importar do pedido */}
      {(codCredor || fornecedorNome) && onImportarDoPedido && (
        <ImportarPedidoModal
          aberto={modalPedidoAberto}
          onFechar={() => setModalPedidoAberto(false)}
          onConfirmar={(itensPedido) => {
            onImportarDoPedido(itensPedido);
            setModalPedidoAberto(false);
          }}
          codCredor={codCredor}
          fornecedorNome={fornecedorNome}
        />
      )}

      {/* Modal de dividir item */}
      <DividirItemModal
        aberto={modalDividirAberto}
        onFechar={() => { setModalDividirAberto(false); setItemDividirIdx(-1); }}
        onConfirmar={(qtdPrimeiro) => {
          if (onDividirItem && itemDividirIdx >= 0) {
            onDividirItem(itemDividirIdx, qtdPrimeiro);
          }
          setModalDividirAberto(false);
          setItemDividirIdx(-1);
        }}
        item={itemDividirIdx >= 0 && itemDividirIdx < itens.length ? itens[itemDividirIdx] : null}
      />
    </div>
  );
};
