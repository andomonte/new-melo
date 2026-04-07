/**
 * Card individual de uma fatura dentro da DI
 * Expansível para mostrar itens
 * Padrão visual do sistema (raw tailwind)
 */

import React from 'react';
import { ChevronDown, ChevronRight, Trash2, ArrowRightLeft } from 'lucide-react';
import type { FaturaImportacao, ItemImportacao } from '../types/importacao';
import { ItensTable } from './ItensTable';
import type { ItemPedidoSelecionado } from './ImportarPedidoModal';

interface FaturaCardProps {
  fatura: FaturaImportacao;
  index: number;
  onRemove: () => void;
  onAddItem: (item: ItemImportacao) => void;
  onRemoveItem: (itemIndex: number) => void;
  onUpdateItem?: (itemIndex: number, updates: Partial<ItemImportacao>) => void;
  onImportarDoPedido?: (itens: ItemPedidoSelecionado[]) => void;
  onDividirItem?: (itemIndex: number, qtdPrimeiro: number) => void;
  onMoverItens?: () => void;
  readOnly?: boolean;
}

export const FaturaCard: React.FC<FaturaCardProps> = ({
  fatura,
  index,
  onRemove,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onImportarDoPedido,
  onDividirItem,
  onMoverItens,
  readOnly = false,
}) => {
  const [expandido, setExpandido] = React.useState(false);

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Header clicável */}
      <div
        onClick={() => setExpandido(!expandido)}
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-750 transition-colors"
      >
        {expandido ? (
          <ChevronDown size={16} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 shrink-0" />
        )}

        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 shrink-0">
          Fatura {index + 1}
        </span>

        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
          {fatura.fornecedor_nome || `Fornecedor: ${fatura.cod_credor || 'N/A'}`}
        </span>

        {fatura.nro_invoice && (
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            Invoice: {fatura.nro_invoice}
          </span>
        )}

        {fatura.id_ordem_compra && (
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            PC: {fatura.id_ordem_compra}
          </span>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto shrink-0">
          {(() => {
            const total = fatura.itens?.length || 0;
            const associados = fatura.itens?.filter((i) => !!i.codprod).length || 0;
            const comPedido = fatura.itens?.filter((i) => !!i.codprod && !!i.id_orc).length || 0;
            if (total === 0) return '0 itens';
            if (comPedido > 0) return `${comPedido} c/ pedido / ${associados} assoc. / ${total} total`;
            return `${associados}/${total} associados`;
          })()}
        </span>

        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            {(fatura.itens?.length || 0) > 0 && onMoverItens && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoverItens();
                }}
                className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Mover itens para outra fatura"
              >
                <ArrowRightLeft className="h-4 w-4 text-blue-500" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo expandido */}
      {expandido && (
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
          {/* Dados da fatura */}
          <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-md text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Fornecedor:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fatura.fornecedor_nome || fatura.cod_credor || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cliente:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fatura.cod_cliente || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Comprador:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fatura.cod_comprador || '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Invoice:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fatura.nro_invoice || '-'}
              </span>
            </div>
          </div>

          {/* Itens */}
          <ItensTable
            itens={fatura.itens || []}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
            onUpdateItem={onUpdateItem}
            codCredor={fatura.cod_credor}
            fornecedorNome={fatura.fornecedor_nome}
            onImportarDoPedido={onImportarDoPedido}
            onDividirItem={onDividirItem}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
};
