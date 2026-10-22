/**
 * Tabela de itens dentro de uma fatura da DI
 * Padrão visual do sistema (raw tailwind, flex divs)
 *
 * Visões por BANDA (como o grid da Importação EX do Delphi): a identidade do item
 * fica sempre à esquerda (Status, #, Ref, Marca, Descrição, Estoque, Qtd) e os botões
 * agrupados trocam só as colunas de valor → cada visão cabe na tela, sem rolagem
 * horizontal gigante.
 *   - Associação: + Ordem (OC) + ações (vincular produto/OC, dividir, remover)
 *   - Valores: Proforma · Invoice · Em Real
 *   - Despesa / Tributos: Despesa · ICMS · PIS/COFINS
 *   - Resultado: Custo Manaus · Imposto · Nota de Entrada
 */

import React, { useState } from 'react';
import { Plus, Trash2, Package, Link2, ShoppingCart, Scissors, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import type { ItemImportacao, AdicaoImportacao } from '../types/importacao';
import { fmtDecimal, codigoDescricaoDI, descricaoSemPrefixoDI } from '../utils/formatters';
import { BuscarProdutoModal } from './BuscarProdutoModal';
import { ImportarPedidoModal } from './ImportarPedidoModal';
import type { ItemPedidoSelecionado } from './ImportarPedidoModal';
import { AssociarOrdemModal } from './AssociarOrdemModal';
import type { AlocacaoOrdem } from './AssociarOrdemModal';
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
  onAssociarOrdens?: (
    itemIndex: number,
    codprod: string,
    referencia: string,
    alocacoes: AlocacaoOrdem[],
  ) => void;
  readOnly?: boolean;
}

// Formatação dos valores (vêm do Postgres como string após salvar — numeric → string)
const fmtR = (v?: number | null) => (v != null ? fmtDecimal(v) : '-');          // 2 casas
const fmtP = (v?: number | null) => (v != null ? `${fmtDecimal((Number(v) || 0) * 100, 3)}%` : '-'); // fração → %
const fmtF = (v?: number | null) => (v != null ? fmtDecimal(v, 4) : '-');       // fator (ex.: 1.0021)

// Uma coluna de valor dentro de uma banda
interface ColBanda {
  head: string;
  w: string;                 // classe de largura (tailwind) — igual no header e no corpo
  cls?: string;              // classes extras da célula de dado
  cell: (it: ItemImportacao) => React.ReactNode;
}

const NUM = 'text-gray-500 dark:text-gray-400';
const REAL = 'text-emerald-700 dark:text-emerald-400';
const STRONG = 'font-medium text-gray-900 dark:text-gray-100';
const STRONG2 = 'font-medium text-gray-700 dark:text-gray-200';

type ViewKey =
  | 'assoc' | 'proforma' | 'invoice' | 'real'
  | 'despesa' | 'icms' | 'pis' | 'custo' | 'imposto' | 'nf';

interface Visao {
  label: string;
  hint: string;
  cols: ColBanda[];          // colunas de valor (vazio na Associação)
}

// Visões por banda. A identidade é fixa; estas são só as colunas de valor.
const VIEWS: Record<ViewKey, Visao> = {
  assoc: { label: 'Associação', hint: 'Vincular produto e ordem de compra (OC). Ações por item à direita.', cols: [] },
  proforma: { label: 'Proforma', hint: 'Preço de proforma (US$) por item.', cols: [
    { head: 'Un. US$', w: 'w-24', cls: 'text-gray-600 dark:text-gray-300', cell: (it) => fmtR(it.proforma_unit) },
    { head: 'Total US$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.proforma_total) },
  ]},
  invoice: { label: 'Invoice', hint: 'Preço de invoice (US$) por item.', cols: [
    { head: 'Un. US$', w: 'w-24', cls: 'text-gray-600 dark:text-gray-300', cell: (it) => fmtR(it.invoice_unit) },
    { head: 'Total US$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.invoice_total) },
  ]},
  real: { label: 'Em Real', hint: 'Valor convertido em R$ (câmbio médio + 0,10).', cols: [
    { head: 'Un. R$', w: 'w-24', cls: REAL, cell: (it) => fmtR(it.real_unit) },
    { head: 'Total R$', w: 'w-28', cls: REAL, cell: (it) => fmtR(it.real_total) },
  ]},
  despesa: { label: 'Despesa', hint: 'Rateio das despesas da DI por item (% = invoice ÷ total da mercadoria).', cols: [
    { head: '%', w: 'w-16', cls: `${NUM} tabular-nums`, cell: (it) => fmtP(it.despesa_perc) },
    { head: 'Total R$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.despesa_total) },
    { head: 'Un. R$', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.despesa_unit) },
  ]},
  icms: { label: 'ICMS', hint: 'ICMS-ST rateado por item.', cols: [
    { head: '%', w: 'w-16', cls: `${NUM} tabular-nums`, cell: (it) => fmtP(it.icms_perc) },
    { head: 'Total R$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.icms_total) },
    { head: 'Un. R$', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.icms_unit) },
  ]},
  pis: { label: 'PIS/COFINS', hint: 'PIS/COFINS — sempre 0 por item (já entra no custo, igual ao Delphi).', cols: [
    { head: '%', w: 'w-16', cls: `${NUM} tabular-nums`, cell: (it) => fmtP(it.pis_cofins_perc ?? it.icms_perc) },
    { head: 'Total R$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.pis_cofins_total) },
    { head: 'Un. R$', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.pis_cofins_unit) },
  ]},
  custo: { label: 'Custo Manaus', hint: 'Custo final em Manaus (R$ e US$) — o que vai para o estoque.', cols: [
    { head: 'Un. R$', w: 'w-24', cls: STRONG, cell: (it) => fmtR(it.custo_unit_real) },
    { head: 'Total R$', w: 'w-28', cls: STRONG2, cell: (it) => fmtR(it.custo_total_real) },
    { head: 'US$', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.custo_unit_dolar) },
  ]},
  imposto: { label: 'Imposto', hint: 'Conferência fiscal do CIF (fator de gross-up, CIF e ICMS da DI).', cols: [
    { head: 'Fator', w: 'w-16', cls: `${NUM} tabular-nums`, cell: (it) => fmtF(it.imp_perc) },
    { head: 'CIF Un. US$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.imp_cif_unit) },
    { head: 'CIF Tot. R$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.imp_cif_total) },
    { head: 'ICMS %', w: 'w-16', cls: `${NUM} tabular-nums`, cell: (it) => fmtP(it.imp_icms_perc) },
    { head: 'ICMS Tot.', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.imp_icms_total) },
    { head: 'ICMS Un.', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.imp_icms_unit) },
  ]},
  nf: { label: 'Nota de Entrada', hint: 'Valores que compõem a Nota de Entrada (CIF, Real e Despesa → NF Un./Tot.).', cols: [
    { head: 'CIF Un. US$', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.nf_cif_unit) },
    { head: 'CIF Tot. US$', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.nf_cif_total) },
    { head: 'Real Un.', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.nf_real_unit) },
    { head: 'Real Tot.', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.nf_real_total) },
    { head: 'Desp. Un.', w: 'w-24', cls: NUM, cell: (it) => fmtR(it.nf_desp_unit) },
    { head: 'Desp. Tot.', w: 'w-28', cls: NUM, cell: (it) => fmtR(it.nf_desp_total) },
    { head: 'NF Un.', w: 'w-24', cls: STRONG2, cell: (it) => fmtR(it.nf_unit) },
    { head: 'NF Tot.', w: 'w-28', cls: STRONG2, cell: (it) => fmtR(it.nf_total) },
  ]},
};

// Agrupamento dos botões, como as bandas do Delphi
const GRUPOS: { cap: string; keys: ViewKey[] }[] = [
  { cap: '', keys: ['assoc'] },
  { cap: 'Valores', keys: ['proforma', 'invoice', 'real'] },
  { cap: 'Despesa / Tributos', keys: ['despesa', 'icms', 'pis'] },
  { cap: 'Resultado', keys: ['custo', 'imposto', 'nf'] },
];

export const ItensTable: React.FC<ItensTableProps> = ({
  itens,
  adicoes = [],
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  codCredor,
  fornecedorNome,
  onDividirItem,
  onAssociarOrdens,
  onImportarDoPedido,
  readOnly = false,
}) => {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalPedidoAberto, setModalPedidoAberto] = useState(false);
  const [modalOrdemAberto, setModalOrdemAberto] = useState(false);
  const [modalDividirAberto, setModalDividirAberto] = useState(false);
  const [itemSelecionadoIdx, setItemSelecionadoIdx] = useState<number>(-1);
  const [itemOrdemIdx, setItemOrdemIdx] = useState<number>(-1);
  const [itemDividirIdx, setItemDividirIdx] = useState<number>(-1);
  const [filtro, setFiltro] = useState('');
  // Visão por banda (default Associação — fluxo de vincular produto/OC).
  const [view, setView] = useState<ViewKey>('assoc');
  const v = VIEWS[view];
  const ehAssoc = view === 'assoc';

  // Busca dentro da fatura: referência, marca, descrição, código ou nº do item.
  const q = filtro.trim().toLowerCase();
  const casa = (item: ItemImportacao) =>
    q === '' ||
    [item.referencia, item.marca, item.descricao, item.codprod, item.num_item != null ? String(item.num_item) : '']
      .some((val) => (val || '').toLowerCase().includes(q));

  // Hierarquia Fornecedor → Adição → Item.
  const SEM_ADICAO = -1;
  const adicaoMap = new Map<number, AdicaoImportacao>();
  adicoes.forEach((a) => adicaoMap.set(Number(a.numero_adicao), a));

  const grupos = new Map<number, { item: ItemImportacao; originalIdx: number }[]>();
  itens.forEach((item, originalIdx) => {
    if (!casa(item)) return;
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
  const mostrarAdicoes = !(chavesOrdenadas.length === 1 && chavesOrdenadas[0] === SEM_ADICAO);
  const fmtNum = (val: unknown) => fmtDecimal(Number(val) || 0);

  const totalProforma = itens.reduce((s, i) => s + (Number(i.proforma_total) || 0), 0);
  const totalInvoice = itens.reduce((s, i) => s + (Number(i.invoice_total) || 0), 0);
  const totalCusto = itens.reduce((s, i) => s + (Number(i.custo_total_real) || 0), 0);

  const handleAssociar = (idx: number) => {
    setItemSelecionadoIdx(idx);
    setModalAberto(true);
  };

  // Aprendizado: grava ref(DI) → produto para auto-associar nas próximas importações.
  const gravarAprendizado = (codprod: string, item?: ItemImportacao) => {
    if (!codprod || !codCredor || !item) return;
    const referenciaNFe = (codigoDescricaoDI(item.descricao) || item.referencia || '').trim();
    if (!referenciaNFe) return;
    api
      .post('/api/entrada-xml/salvar-aprendizado', {
        referenciaNFe,
        codCredor,
        codProduto: codprod,
        codMarca: item.marca || undefined,
      })
      .catch(() => { /* best-effort; não bloqueia a associação */ });
  };

  const handleDividir = (idx: number) => {
    setItemDividirIdx(idx);
    setModalDividirAberto(true);
  };

  const handleAssociarOrdem = (idx: number) => {
    setItemOrdemIdx(idx);
    setModalOrdemAberto(true);
  };

  const handleOrdensAlocadas = (codprod: string, referencia: string, alocacoes: AlocacaoOrdem[]) => {
    if (onAssociarOrdens && itemOrdemIdx >= 0) {
      gravarAprendizado(codprod, itens[itemOrdemIdx]);
      onAssociarOrdens(itemOrdemIdx, codprod, referencia, alocacoes);
    }
    setModalOrdemAberto(false);
    setItemOrdemIdx(-1);
  };

  const handleProdutoSelecionado = (
    codprod: string,
    _descricao: string,
    referencia?: string,
    marca?: string,
  ) => {
    if (onUpdateItem && itemSelecionadoIdx >= 0) {
      onUpdateItem(itemSelecionadoIdx, { codprod, referencia, marca });
      gravarAprendizado(codprod, itens[itemSelecionadoIdx]);
    }
    setModalAberto(false);
    setItemSelecionadoIdx(-1);
  };

  const renderLinha = ({ item, originalIdx }: { item: ItemImportacao; originalIdx: number }) => {
    const associado = !!item.codprod;
    const comPedido = associado && !!item.id_orc;
    const codDI = codigoDescricaoDI(item.descricao);
    const texto = descricaoSemPrefixoDI(item.descricao) || '-';
    return (
      <div
        key={originalIdx}
        className="group flex gap-2 px-3 py-2 text-xs border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors items-center"
      >
        {/* Identidade (sempre visível) */}
        <div className="w-24">
          {comPedido ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
              Associado + OC
            </span>
          ) : associado ? (
            <span
              title="Produto associado, mas ainda SEM ordem de compra — incompleto para a nota"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
            >
              Sem OC
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
        </div>
        <div className="w-24 text-gray-600 dark:text-gray-300 truncate">
          {associado ? (item.marca || '-') : '-'}
        </div>
        {/* Ordem de compra (OC) — só na Associação */}
        {ehAssoc && (
          <div className="w-32 shrink-0">
            {item.id_orc ? (
              <span
                title="Ordem de compra vinculada a este item"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              >
                <ShoppingCart size={9} /> #{item.id_orc}
              </span>
            ) : associado ? (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">sem ordem</span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">-</span>
            )}
          </div>
        )}
        <div
          className="flex-1 min-w-[180px] text-gray-600 dark:text-gray-300 truncate"
          title={`${codDI ? codDI + ' ' : ''}${texto}`}
        >
          {codDI && (
            <span
              className="font-mono text-[#347AB6] dark:text-blue-300 mr-1.5"
              title="Código da DI (referência na descrição da mercadoria)"
            >
              {codDI}
            </span>
          )}
          {texto}
        </div>
        {/* Estoque (sempre visível) */}
        <div className="w-16 text-right tabular-nums text-gray-600 dark:text-gray-300">
          {associado && item.estoque != null ? fmtDecimal(item.estoque, 0) : '-'}
        </div>
        <div className="w-14 text-center text-gray-900 dark:text-gray-100">{item.qtd}</div>

        {/* Colunas da banda ativa */}
        {v.cols.map((c, i) => (
          <div key={i} className={`${c.w} text-right ${c.cls || NUM}`}>{c.cell(item)}</div>
        ))}

        {/* Ações — só na Associação */}
        {ehAssoc && !readOnly && (
          <div className="w-28 flex items-center justify-end gap-1">
            {!associado && onUpdateItem && (
              <button
                onClick={() => handleAssociar(originalIdx)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-[#347AB6] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
              >
                <Link2 size={10} />
                Associar
              </button>
            )}
            {onAssociarOrdens && !comPedido && (codCredor || fornecedorNome) && (
              <button
                onClick={() => handleAssociarOrdem(originalIdx)}
                title="Associar à ordem de compra (mostra as ordens abertas do fornecedor)"
                className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-indigo-500" />
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
      {/* Cabeçalho da seção: contador, busca, ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0">
          Itens ({q ? `${totalFiltrado}/${itens.length}` : itens.length})
        </span>
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

      {/* Barra de bandas (botões agrupados como o Delphi) */}
      <div className="flex items-end gap-3 flex-wrap">
        {GRUPOS.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold pl-0.5 leading-none">
              {g.cap || ' '}
            </span>
            <div className="flex rounded-md border border-gray-300 dark:border-zinc-600 overflow-hidden">
              {g.keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  className={`px-2.5 py-1 text-xs font-medium border-l first:border-l-0 border-gray-300 dark:border-zinc-600 transition-colors ${
                    view === k
                      ? 'bg-[#347AB6] text-white'
                      : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {VIEWS[k].label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">{v.hint}</p>

      {/* Tabela */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-x-auto">
        {/* min-w-[720px] = piso p/ telas estreitas; sem min-w-max, a Descrição (flex-1)
            trunca e as colunas da banda ficam sempre visíveis, sem scroll lateral. */}
        <div className="min-w-[720px]">
          {/* Cabeçalho */}
          <div className="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-600">
            <div className="flex gap-2 px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
              <div className="w-24">Status</div>
              <div className="w-10 text-center">#</div>
              <div className="w-28">Referência</div>
              <div className="w-24">Marca</div>
              {ehAssoc && <div className="w-32">Ordem (OC)</div>}
              <div className="flex-1 min-w-[180px]">Descrição</div>
              <div className="w-16 text-right">Estoque</div>
              <div className="w-14 text-center">Qtd</div>
              {v.cols.map((c, i) => (
                <div key={i} className={`${c.w} text-right`}>{c.head}</div>
              ))}
              {ehAssoc && !readOnly && <div className="w-28" />}
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

      {/* Modal de associar à ordem (alocação multi-ordem, por item) */}
      {(codCredor || fornecedorNome) && onAssociarOrdens && (
        <AssociarOrdemModal
          aberto={modalOrdemAberto}
          onFechar={() => { setModalOrdemAberto(false); setItemOrdemIdx(-1); }}
          onConfirmar={handleOrdensAlocadas}
          codCredor={codCredor}
          fornecedorNome={fornecedorNome}
          buscaInicial={
            itemOrdemIdx >= 0 && itemOrdemIdx < itens.length
              ? itens[itemOrdemIdx]?.referencia || codigoDescricaoDI(itens[itemOrdemIdx]?.descricao) || ''
              : ''
          }
          qtdItem={itemOrdemIdx >= 0 && itemOrdemIdx < itens.length ? Number(itens[itemOrdemIdx]?.qtd) || 0 : 0}
          codprodAtual={itemOrdemIdx >= 0 && itemOrdemIdx < itens.length ? (itens[itemOrdemIdx]?.codprod || undefined) : undefined}
          descricaoItem={itemOrdemIdx >= 0 && itemOrdemIdx < itens.length ? itens[itemOrdemIdx]?.descricao : undefined}
          onProdutoAssociado={(codprod, referencia, marca) => {
            if (onUpdateItem && itemOrdemIdx >= 0) {
              onUpdateItem(itemOrdemIdx, { codprod, referencia, marca });
              gravarAprendizado(codprod, itens[itemOrdemIdx]);
            }
          }}
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
