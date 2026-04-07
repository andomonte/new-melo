/**
 * Tab "Faturas / Pedidos" da Declaração de Importação
 * Padrão visual do sistema (raw tailwind)
 *
 * Estrutura:
 *   DI
 *   ├── Fatura 1 (Fornecedor A -> Pedido de Compra X)
 *   │   ├── Item 1
 *   │   └── Item 2
 *   └── Fatura 2 (Fornecedor B -> Pedido de Compra Z)
 *       └── Item 3
 */

import React, { useState } from 'react';
import { Plus, ShoppingCart, Wand2, Loader2, CheckCircle2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaturaImportacao, ItemImportacao } from '../types/importacao';
import { FaturaCard } from './FaturaCard';
import { AdicionarFaturaModal } from './AdicionarFaturaModal';
import { MoverItensModal } from './MoverItensModal';
import type { ItemPedidoSelecionado } from './ImportarPedidoModal';

interface FaturasTabProps {
  faturas: FaturaImportacao[];
  onAddFatura: (dados?: Partial<FaturaImportacao>) => void;
  onRemoveFatura: (index: number) => void;
  onAddItem: (faturaIndex: number, item: ItemImportacao) => void;
  onRemoveItem: (faturaIndex: number, itemIndex: number) => void;
  onUpdateItem?: (faturaIndex: number, itemIndex: number, updates: Partial<ItemImportacao>) => void;
  onAutoAssociar?: () => void;
  autoAssociando?: boolean;
  autoAssociadoStats?: { total: number; associados: number; por_ref: number; por_ref_com_marca?: number; por_aprendizado: number; por_similaridade: number } | null;
  onVincularPedidos?: () => void;
  vinculandoPedidos?: boolean;
  vinculadoStats?: { total: number; vinculados: number } | null;
  onAssociarEVincular?: () => void;
  associandoEVinculando?: boolean;
  associarEVincularStats?: { total_itens: number; associados: number; vinculados: number; por_ref: number; por_ref_com_marca?: number; por_aprendizado: number; por_similaridade: number } | null;
  onImportarDoPedido?: (faturaIdx: number, itens: ItemPedidoSelecionado[]) => void;
  onDividirItem?: (faturaIndex: number, itemIndex: number, qtdPrimeiro: number) => void;
  onMoverItens?: (faturaOrigemIdx: number, itensIndices: number[], destinoFaturaIdx: number | 'nova') => void;
  readOnly?: boolean;
}

export const FaturasTab: React.FC<FaturasTabProps> = ({
  faturas,
  onAddFatura,
  onRemoveFatura,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onAutoAssociar,
  autoAssociando = false,
  autoAssociadoStats,
  onVincularPedidos,
  vinculandoPedidos = false,
  vinculadoStats,
  onAssociarEVincular,
  associandoEVinculando = false,
  associarEVincularStats,
  onImportarDoPedido,
  onDividirItem,
  onMoverItens,
  readOnly = false,
}) => {
  const [modalFaturaAberto, setModalFaturaAberto] = useState(false);
  const [moverFaturaIdx, setMoverFaturaIdx] = useState<number>(-1);

  const totalItens = faturas.reduce((s, f) => s + (f.itens?.length || 0), 0);
  const totalAssociados = faturas.reduce((s, f) => s + (f.itens?.filter((i) => !!i.codprod).length || 0), 0);
  const totalComPedido = faturas.reduce((s, f) => s + (f.itens?.filter((i) => !!i.codprod && !!i.id_orc).length || 0), 0);
  const totalFornecedores = new Set(faturas.map((f) => f.cod_credor)).size;

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-5 gap-4">
        <IndicadorCard titulo="Total de Faturas" valor={String(faturas.length)} />
        <IndicadorCard titulo="Total de Itens" valor={String(totalItens)} />
        <IndicadorCard titulo="Itens Associados" valor={`${totalAssociados}/${totalItens}`} />
        <IndicadorCard titulo="Itens c/ Pedido" valor={`${totalComPedido}/${totalAssociados}`} />
        <IndicadorCard titulo="Fornecedores" valor={String(totalFornecedores)} />
      </div>

      {/* Banner de resultado combinado (associar + vincular) */}
      {associarEVincularStats && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3 text-sm">
          <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">
              {associarEVincularStats.associados} itens associados, {associarEVincularStats.vinculados} vinculados a pedidos
            </p>
            <div className="flex gap-4 mt-1 text-xs text-green-700 dark:text-green-400">
              {associarEVincularStats.por_ref > 0 && (
                <span>Por referencia: {associarEVincularStats.por_ref}</span>
              )}
              {associarEVincularStats.por_ref_com_marca != null && associarEVincularStats.por_ref_com_marca > 0 && (
                <span>Com filtro marca: {associarEVincularStats.por_ref_com_marca}</span>
              )}
              {associarEVincularStats.por_aprendizado > 0 && (
                <span>Por aprendizado: {associarEVincularStats.por_aprendizado}</span>
              )}
              {associarEVincularStats.por_similaridade > 0 && (
                <span>Por similaridade: {associarEVincularStats.por_similaridade}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banner de resultado da auto-associação (legado, caso use individualmente) */}
      {autoAssociadoStats && !associarEVincularStats && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3 text-sm">
          <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">
              {autoAssociadoStats.associados} de {autoAssociadoStats.total} itens associados automaticamente
            </p>
            <div className="flex gap-4 mt-1 text-xs text-green-700 dark:text-green-400">
              {autoAssociadoStats.por_ref > 0 && (
                <span>Por referencia: {autoAssociadoStats.por_ref}</span>
              )}
              {autoAssociadoStats.por_ref_com_marca != null && autoAssociadoStats.por_ref_com_marca > 0 && (
                <span>Com filtro marca: {autoAssociadoStats.por_ref_com_marca}</span>
              )}
              {autoAssociadoStats.por_aprendizado > 0 && (
                <span>Por aprendizado: {autoAssociadoStats.por_aprendizado}</span>
              )}
              {autoAssociadoStats.por_similaridade > 0 && (
                <span>Por similaridade: {autoAssociadoStats.por_similaridade}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banner de resultado da vinculação de pedidos (legado) */}
      {vinculadoStats && !associarEVincularStats && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3 text-sm">
          <Link size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">
              {vinculadoStats.vinculados} de {vinculadoStats.total} itens vinculados a pedidos de compra
            </p>
          </div>
        </div>
      )}

      {/* Header + ações */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Faturas / Pedidos de Compra
        </h3>
        <div className="flex gap-2">
          {!readOnly && totalItens > 0 && (totalAssociados < totalItens || totalComPedido < totalAssociados) && onAssociarEVincular && (
            <Button
              size="sm"
              variant="outline"
              disabled={associandoEVinculando}
              onClick={onAssociarEVincular}
              className="flex items-center gap-1 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              {associandoEVinculando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {associandoEVinculando ? 'Processando...' : 'Associar e Vincular'}
            </Button>
          )}
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setModalFaturaAberto(true)}
              className="flex items-center gap-1 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              <Plus size={14} />
              Adicionar Fatura
            </Button>
          )}
        </div>
      </div>

      {/* Lista de faturas */}
      {faturas.length === 0 ? (
        <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma fatura/pedido adicionado
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Adicione faturas para vincular fornecedores, pedidos de compra e itens
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {faturas.map((fatura, idx) => (
            <FaturaCard
              key={idx}
              fatura={fatura}
              index={idx}
              onRemove={() => onRemoveFatura(idx)}
              onAddItem={(item) => onAddItem(idx, item)}
              onRemoveItem={(itemIdx) => onRemoveItem(idx, itemIdx)}
              onUpdateItem={onUpdateItem ? (itemIdx, updates) => onUpdateItem(idx, itemIdx, updates) : undefined}
              onImportarDoPedido={onImportarDoPedido ? (itens) => onImportarDoPedido(idx, itens) : undefined}
              onDividirItem={onDividirItem ? (itemIdx, qtdPrimeiro) => onDividirItem(idx, itemIdx, qtdPrimeiro) : undefined}
              onMoverItens={onMoverItens && faturas.length > 0 ? () => setMoverFaturaIdx(idx) : undefined}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
      {/* Modal de adicionar fatura */}
      <AdicionarFaturaModal
        aberto={modalFaturaAberto}
        onFechar={() => setModalFaturaAberto(false)}
        onConfirmar={(dados) => {
          onAddFatura({
            cod_credor: dados.cod_credor,
            fornecedor_nome: dados.fornecedor_nome,
            cod_cliente: dados.cod_cliente,
            cod_comprador: dados.cod_comprador,
          });
          setModalFaturaAberto(false);
        }}
      />

      {/* Modal de mover itens entre faturas */}
      {moverFaturaIdx >= 0 && moverFaturaIdx < faturas.length && onMoverItens && (
        <MoverItensModal
          aberto={moverFaturaIdx >= 0}
          onFechar={() => setMoverFaturaIdx(-1)}
          onConfirmar={(itensIndices, destino) => {
            onMoverItens(moverFaturaIdx, itensIndices, destino);
            setMoverFaturaIdx(-1);
          }}
          faturaOrigem={faturas[moverFaturaIdx]}
          faturaOrigemIdx={moverFaturaIdx}
          todasFaturas={faturas}
        />
      )}
    </div>
  );
};

const IndicadorCard: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
    <div className="text-xs text-gray-500 dark:text-gray-400">{titulo}</div>
    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{valor}</div>
  </div>
);
