/**
 * Tabela de itens dentro de uma fatura da DI
 * Padrão visual do sistema (raw tailwind, flex divs)
 * Inclui badge de status (Pendente/Associado) e botão Associar
 */

import React, { useState } from 'react';
import { Plus, Trash2, Package, Link2, ShoppingCart, Scissors, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ItemImportacao, AdicaoImportacao } from '../types/importacao';
import { fmtDecimal, codigoDescricaoDI, descricaoSemPrefixoDI } from '../utils/formatters';
import { BuscarProdutoModal } from './BuscarProdutoModal';
import { ImportarPedidoModal } from './ImportarPedidoModal';
import type { ItemPedidoSelecionado } from './ImportarPedidoModal';
import { DividirItemModal } from './DividirItemModal';

interface ItensTableProps {
  itens: ItemImportacao[];
  adicoes?: AdicaoImportacao[];
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
  adicoes = [],
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
  const [filtro, setFiltro] = useState('');

  // Busca dentro da fatura: referência, marca, descrição, código ou nº do item.
  const q = filtro.trim().toLowerCase();
  const casa = (item: ItemImportacao) =>
    q === '' ||
    [item.referencia, item.marca, item.descricao, item.codprod, item.num_item != null ? String(item.num_item) : '']
      .some((v) => (v || '').toLowerCase().includes(q));

  // Hierarquia Fornecedor → Adição → Item:
  // agrupa os itens por numero_adicao (asc) e, dentro de cada adição,
  // ordena por num_item (nSeqAdic). Mantém o índice original para os
  // callbacks (associar/remover/dividir usam a posição no array da fatura).
  const SEM_ADICAO = -1;
  const adicaoMap = new Map<number, AdicaoImportacao>();
  adicoes.forEach((a) => adicaoMap.set(Number(a.numero_adicao), a));

  const grupos = new Map<number, { item: ItemImportacao; originalIdx: number }[]>();
  itens.forEach((item, originalIdx) => {
    if (!casa(item)) return; // filtro da busca (preserva originalIdx)
    const na = Number(item.numero_adicao);
    const key = Number.isFinite(na) && na > 0 ? na : SEM_ADICAO;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push({ item, originalIdx });
  });
  const totalFiltrado = [...grupos.values()].reduce((s, a) => s + a.length, 0);
  const chavesOrdenadas = [...grupos.keys()].sort((a, b) => {
    if (a === SEM_ADICAO) return 1;
    if (b === SEM_ADICAO) return -1;
    return a - b;
  });
  grupos.forEach((arr) =>
    arr.sort((a, b) => {
      const na = Number(a.item.num_item);
      const nb = Number(b.item.num_item);
      const va = Number.isFinite(na) ? na : a.originalIdx + 1;
      const vb = Number.isFinite(nb) ? nb : b.originalIdx + 1;
      return va - vb || a.originalIdx - b.originalIdx;
    }),
  );
  // Só mostra cabeçalhos de adição quando há adição de verdade;
  // DI antiga/itens avulsos (tudo em SEM_ADICAO) cai na lista plana.
  const mostrarAdicoes = !(chavesOrdenadas.length === 1 && chavesOrdenadas[0] === SEM_ADICAO);
  const fmtNum = (v: unknown) => fmtDecimal(Number(v) || 0);

  // Number(...) porque os valores voltam do Postgres como string após salvar a DI
  // (numeric → string); sem isso, 0 + "3.5" concatena e .toFixed quebra.
  const totalProforma = itens.reduce((s, i) => s + (Number(i.proforma_total) || 0), 0);
  const totalInvoice = itens.reduce((s, i) => s + (Number(i.invoice_total) || 0), 0);
  const totalCusto = itens.reduce((s, i) => s + (Number(i.custo_total_real) || 0), 0);

  const handleAssociar = (idx: number) => {
    setItemSelecionadoIdx(idx);
    setModalAberto(true);
  };

  const handleDividir = (idx: number) => {
    setItemDividirIdx(idx);
    setModalDividirAberto(true);
  };

  const handleProdutoSelecionado = (
    codprod: string,
    _descricao: string,
    referencia?: string,
    marca?: string,
  ) => {
    if (onUpdateItem && itemSelecionadoIdx >= 0) {
      onUpdateItem(itemSelecionadoIdx, { codprod, referencia, marca });
    }
    setModalAberto(false);
    setItemSelecionadoIdx(-1);
  };

  const renderLinha = ({ item, originalIdx }: { item: ItemImportacao; originalIdx: number }) => {
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

        <div className="w-10 text-center text-gray-400 dark:text-gray-500 tabular-nums">
          {item.num_item ?? '-'}
        </div>
        <div className="w-28 font-mono text-gray-900 dark:text-gray-100 truncate">
          {associado ? (item.referencia || '-') : '-'}
          {item.id_orc && (
            <div className="text-[9px] text-gray-400 dark:text-gray-500">PC: {item.id_orc}</div>
          )}
        </div>
        <div className="w-24 text-gray-600 dark:text-gray-300 truncate">
          {associado ? (item.marca || '-') : '-'}
        </div>
        <div className="flex-1 min-w-0 text-gray-600 dark:text-gray-300 truncate">
          {(() => {
            // Mostra o código da própria DI (REF./PN# embutido na descrição) no
            // início da linha, no lugar do "[000001]" — permite conferir a
            // sequência contra o XML antes de associar. Sem código: só limpa o prefixo.
            const codDI = codigoDescricaoDI(item.descricao);
            const texto = descricaoSemPrefixoDI(item.descricao) || '-';
            return (
              <>
                {codDI && (
                  <span
                    className="font-mono text-[#347AB6] dark:text-blue-300 mr-1.5"
                    title="Código da DI (referência na descrição da mercadoria)"
                  >
                    {codDI}
                  </span>
                )}
                {texto}
              </>
            );
          })()}
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
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0">
          Itens ({q ? `${totalFiltrado}/${itens.length}` : itens.length})
        </span>
        {/* Busca dentro da fatura */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar referência, marca, descrição..."
            className="w-full pl-8 pr-7 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-md text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
          />
          {filtro && (
            <button
              onClick={() => setFiltro('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2 shrink-0">
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
      <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-x-auto">
        <div className="min-w-[960px]">
        {/* Header */}
        <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
          <div className="flex gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <div className="w-24">Status</div>
            <div className="w-10 text-center">#</div>
            <div className="w-28">Referência</div>
            <div className="w-24">Marca</div>
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
        ) : totalFiltrado === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum item para “{filtro}”</p>
          </div>
        ) : !mostrarAdicoes ? (
          (grupos.get(SEM_ADICAO) || []).map(renderLinha)
        ) : (
          chavesOrdenadas.map((key) => {
            const linhas = grupos.get(key)!;
            const ad = key === SEM_ADICAO ? undefined : adicaoMap.get(key);
            const assoc = linhas.filter((l) => !!l.item.codprod).length;
            return (
              <div key={key}>
                {/* Cabeçalho da adição */}
                <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50/70 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 text-[11px]">
                  <span className="font-semibold text-[#347AB6] dark:text-blue-300 shrink-0">
                    {key === SEM_ADICAO ? 'Sem adição' : `Adição ${String(key).padStart(3, '0')}`}
                  </span>
                  {ad?.ncm && (
                    <span className="text-gray-500 dark:text-gray-400 shrink-0">
                      NCM <span className="font-mono text-gray-700 dark:text-gray-200">{ad.ncm}</span>
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500 shrink-0">
                    {assoc}/{linhas.length} assoc.
                  </span>
                  {ad && (
                    <span className="ml-auto flex items-center gap-4 text-gray-500 dark:text-gray-400 shrink-0">
                      <span>FOB <span className="font-medium text-gray-700 dark:text-gray-200">US$ {fmtNum(ad.vl_fob)}</span></span>
                      <span>Frete <span className="font-medium text-gray-700 dark:text-gray-200">US$ {fmtNum(ad.vl_frete)}</span></span>
                      <span>PIS/COFINS <span className="font-medium text-gray-700 dark:text-gray-200">R$ {fmtNum(ad.vl_pis_cofins)}</span></span>
                      <span>ICMS <span className="font-medium text-gray-700 dark:text-gray-200">R$ {fmtNum(ad.vl_icms)}</span></span>
                    </span>
                  )}
                </div>
                {linhas.map(renderLinha)}
              </div>
            );
          })
        )}
        </div>
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
