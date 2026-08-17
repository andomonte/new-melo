'use client';

import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { X, Loader2, Trash2, Save, AlertTriangle, Keyboard } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AuthContext } from '@/contexts/authContexts';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { CellValueChangedEvent } from 'ag-grid-community';
import ProductZoomModal from '@/components/common/ProductZoomModal';
import ModalEquivalentes from '../bloqueadas/ModalEquivalentes';
import ModalHistoricoProduto from '../bloqueadas/ModalHistoricoProduto';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';

ModuleRegistry.registerModules([AllCommunityModule]);

// ===================== Tipos =====================
interface ItemVenda {
  codprod: string;
  ref: string;
  descr: string;
  qtd: number;
  qtd_original: number; // guarda a qtd original para comparação
  prunit: number;
  prvenda_original: number;
  desconto_percentual: number;
  total_item: number;
  prcompra: number;
  prcustoatual: number;
  margem: number;
  codmarca: string;
  marca_nome: string;
  origem: string;
  impostos?: any;
  total_com_imposto?: number;
  _removido?: boolean;
}

interface VendaInfo {
  codvenda: string;
  codcli: string;
  cliente_nome: string;
  vendedor_nome: string;
  operador_nome: string;
  data: string;
  total: number;
  status: string;
}

interface ModalEditarVendaFinalizadaProps {
  isOpen: boolean;
  onClose: () => void;
  codvenda: string;
  onSalvar: () => void;
}

// ===================== Helpers =====================
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v: any) => v != null ? `${parseFloat(Number(v).toFixed(2))}%` : '-';

const ModalEditarVendaFinalizada: React.FC<ModalEditarVendaFinalizadaProps> = ({
  isOpen,
  onClose,
  codvenda,
  onSalvar,
}) => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as any;
  const gridRef = useRef<AgGridReact>(null);
  const ultimaCelulaRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendaInfo, setVendaInfo] = useState<VendaInfo | null>(null);
  const [itensGrid, setItensGrid] = useState<ItemVenda[]>([]);
  const [itensRemovidos, setItensRemovidos] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [zoomProduto, setZoomProduto] = useState<any>(null);
  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);

  // ===================== Carregar dados da venda =====================
  const carregarVenda = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/vendas/analise-liberacao?codvenda=${codvenda}`);
      if (!resp.ok) throw new Error('Erro ao carregar venda');
      const data = await resp.json();

      setVendaInfo({
        codvenda: data.venda.codvenda,
        codcli: data.venda.codcli,
        cliente_nome: data.cliente?.nome || '',
        vendedor_nome: data.venda.vendedor_nome || '',
        operador_nome: data.venda.operador_nome || '',
        data: data.venda.data ? new Date(data.venda.data).toLocaleDateString('pt-BR') : '',
        total: Number(data.venda.total) || 0,
        status: data.venda.status,
      });

      setItensGrid(
        (data.itens || []).map((item: any) => ({
          ...item,
          qtd_original: Number(item.qtd), // guardar qtd original
        })),
      );
      setItensRemovidos([]);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [codvenda, toast]);

  useEffect(() => {
    if (isOpen && codvenda) {
      carregarVenda();
    }
  }, [isOpen, codvenda, carregarVenda]);

  // ===================== Teclado =====================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Escape fecha o modal
      if (e.key === 'Escape' && !confirmRemove && !confirmSave && !zoomProduto && !modalEquivalentes && !modalHistProduto) {
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      // Ctrl+S salvar
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (temAlteracoes) setConfirmSave(true);
        return;
      }

      // Ctrl+Z zoom produto
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const item = ultimaCelulaRef.current;
        if (item?.codprod) setZoomProduto(item);
        return;
      }

      // F9 equivalentes
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const item = ultimaCelulaRef.current;
        if (item?.codprod) {
          setProdutoEquivalente(item);
          setModalEquivalentes(true);
        }
        return;
      }

      // F10 histórico
      if (e.key === 'F10') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const item = ultimaCelulaRef.current;
        if (item?.codprod) {
          setProdutoHist(item);
          setModalHistProduto(true);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, confirmRemove, confirmSave, zoomProduto, modalEquivalentes, modalHistProduto, onClose]);

  // ===================== Handlers do Grid =====================
  const handleRemoverItem = useCallback((codprod: string) => {
    setConfirmRemove(codprod);
  }, []);

  const confirmarRemocao = useCallback(() => {
    if (!confirmRemove) return;
    setItensGrid(prev => prev.filter(r => r.codprod !== confirmRemove));
    setItensRemovidos(prev => [...prev, confirmRemove]);
    toast({ title: `Item ${confirmRemove} removido.` });
    setConfirmRemove(null);
  }, [confirmRemove, toast]);

  const onItemCellChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field;
    const rowIndex = event.rowIndex;
    if (rowIndex == null || !field) return;

    setItensGrid(prev => {
      const novos = [...prev];
      const row = { ...novos[rowIndex] };

      if (field === 'qtd') {
        let novaQtd = Number(event.newValue) || 0;

        // Não pode ser zero ou negativa
        if (novaQtd <= 0) {
          novaQtd = 1;
          toast({ title: 'Quantidade mínima é 1', description: 'Use o botão remover para excluir o item.', variant: 'destructive' });
        }

        // Não pode aumentar além da qtd original
        if (novaQtd > row.qtd_original) {
          novaQtd = row.qtd_original;
          toast({ title: 'Quantidade não pode aumentar', description: `Máximo permitido: ${row.qtd_original}`, variant: 'destructive' });
        }

        row.qtd = novaQtd;
      }

      // Recalcular total
      const desc = Number(row.desconto_percentual) || 0;
      row.total_item = row.qtd * row.prunit * (1 - desc / 100);

      novos[rowIndex] = row;
      return novos;
    });
  }, [toast]);

  // ===================== Detectar alterações =====================
  const temAlteracoes = useMemo(() => {
    if (itensRemovidos.length > 0) return true;
    return itensGrid.some(item => item.qtd !== item.qtd_original);
  }, [itensGrid, itensRemovidos]);

  // ===================== Salvar =====================
  const handleSalvar = useCallback(async () => {
    setConfirmSave(false);
    setSaving(true);

    try {
      const itensAlterados = itensGrid
        .filter(item => item.qtd !== item.qtd_original)
        .map(item => ({ codprod: item.codprod, qtd: item.qtd }));

      const resp = await fetch('/api/vendas/editar-finalizada', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codvenda,
          itens: itensAlterados,
          itensRemovidos,
          usuario: user?.usuario || 'SISTEMA',
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      toast({ title: 'Venda editada com sucesso', description: `Novo total: ${formatCurrency(data.total)}` });
      onSalvar();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [codvenda, itensGrid, itensRemovidos, user, toast, onSalvar]);

  // ===================== Cell Renderers =====================
  const DeleteItemRenderer = useCallback((props: any) => {
    const codprod = props.data?.codprod;
    if (!codprod) return null;
    return (
      <button onClick={() => handleRemoverItem(codprod)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Remover item">
        <Trash2 size={15} />
      </button>
    );
  }, [handleRemoverItem]);

  const ProdutoCellRenderer = useCallback((props: any) => {
    const d = props.data;
    if (!d) return null;
    return (
      <div style={{ lineHeight: 1.4, padding: '4px 8px', width: '100%', textAlign: 'left' }}>
        <div title={d.descr || ''} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>{d.descr || '-'}</div>
        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src={d.origem === 'N' ? '/images/brasil.png' : '/images/importado.png'} alt={d.origem === 'N' ? 'Nacional' : 'Importado'} style={{ width: 16, height: 11, objectFit: 'contain' }} />
        </div>
      </div>
    );
  }, []);

  // ===================== Colunas do Grid =====================
  const itensColumnDefs = useMemo((): any[] => [
    { headerName: '', field: '_delete', width: 40, maxWidth: 40, sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRendererSelector: () => ({ component: DeleteItemRenderer }),
    },
    { headerName: 'Ref', field: 'ref', width: 100,
      cellStyle: { fontWeight: 600 },
    },
    { headerName: 'Produto', field: 'descr', flex: 2, minWidth: 150, autoHeight: true,
      cellStyle: { textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 0 },
      cellRendererSelector: () => ({ component: ProdutoCellRenderer }),
    },
    { headerName: 'Marca', field: 'marca_nome', flex: 1, minWidth: 80, autoHeight: true,
      cellRenderer: (p: any) => {
        const val = p.value || '-';
        return <div title={val} style={{ lineHeight: 1.3, padding: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12 }}>{val}</div>;
      },
    },
    { headerName: 'Qtd Original', field: 'qtd_original', width: 90,
      cellStyle: { fontWeight: 500, color: '#6b7280' },
    },
    { headerName: 'Qtd', field: 'qtd', width: 70, editable: true,
      cellStyle: (params: any) => {
        const alterado = params.data && params.data.qtd !== params.data.qtd_original;
        return {
          backgroundColor: alterado ? '#fef3c7' : '#dbeafe',
          fontWeight: 600,
          color: alterado ? '#92400e' : undefined,
        };
      },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    { headerName: 'Preço Unit.', field: 'prunit', width: 110,
      cellStyle: { fontWeight: 600 },
      valueFormatter: (p: any) => formatCurrency(Number(p.value) || 0),
    },
    { headerName: 'Desc.', field: 'desconto_percentual', width: 70,
      cellStyle: { fontWeight: 600 },
      valueFormatter: (p: any) => fmtPerc(p.value),
    },
    { headerName: 'Total c/ Imp.', field: 'total_com_imposto', width: 110,
      cellStyle: { fontWeight: 500, color: '#6b7280' },
      cellRenderer: (p: any) => {
        const d = p.data;
        if (!d) return '-';
        const imp = d.impostos;
        const val = Number(d.total_com_imposto || d.total_item || 0);
        const title = imp ? `ICMS: R$ ${(imp.icms || 0).toFixed(2)}\nIPI: R$ ${(imp.ipi || 0).toFixed(2)}\nST: R$ ${(imp.st || 0).toFixed(2)}\nPIS: R$ ${(imp.pis || 0).toFixed(2)}\nCOFINS: R$ ${(imp.cofins || 0).toFixed(2)}` : '';
        return <span title={title} style={{ cursor: imp ? 'help' : 'default' }}>{formatCurrency(val)}</span>;
      },
    },
    { headerName: 'Subtotal', field: 'total_item', width: 110,
      cellStyle: { fontWeight: 700, color: '#16a34a' },
      valueFormatter: (p: any) => formatCurrency(Number(p.value) || 0),
    },
  ], []);

  // ===================== Cálculos =====================
  const totalVenda = itensGrid.reduce((acc, i) => acc + (Number(i.total_item) || 0), 0);
  const totalOriginal = vendaInfo?.total || 0;
  const totalItens = itensGrid.length;
  const itensAlterados = itensGrid.filter(i => i.qtd !== i.qtd_original).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b-2 border-orange-500/20 dark:border-zinc-700 bg-gradient-to-r from-orange-500/5 to-transparent dark:from-zinc-800 dark:to-zinc-900">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 tracking-tight">
            Editar Venda — {codvenda}
          </h2>
          {temAlteracoes ? (
            <span className="px-2 py-0.5 text-xs font-bold text-amber-800 bg-amber-100 rounded-full">
              {itensAlterados + itensRemovidos.length} alteração(ões)
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mr-2">
            <Keyboard size={12} />
            Ctrl+Z Zoom | F9 Equiv. | F10 Hist. | Ctrl+S Salvar
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-500 hover:text-gray-700 transition-colors"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Info da venda */}
      {vendaInfo ? (
        <div className="px-5 py-2 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center gap-6 text-sm">
          <div><span className="font-semibold text-gray-600 dark:text-gray-400">Cliente:</span> <span className="font-bold text-gray-900 dark:text-white">{vendaInfo.codcli} — {vendaInfo.cliente_nome}</span></div>
          <div><span className="font-semibold text-gray-600 dark:text-gray-400">Vendedor:</span> <span className="text-gray-900 dark:text-white">{vendaInfo.vendedor_nome || '-'}</span></div>
          <div><span className="font-semibold text-gray-600 dark:text-gray-400">Data:</span> <span className="text-gray-900 dark:text-white">{vendaInfo.data}</span></div>
          <div><span className="font-semibold text-gray-600 dark:text-gray-400">Total Original:</span> <span className="font-bold text-blue-600">{formatCurrency(totalOriginal)}</span></div>
        </div>
      ) : null}

      {/* Aviso de regras */}
      <div className="px-5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} />
        <span>Quantidade só pode ser <strong>reduzida</strong> (nunca aumentada). Para remover um item, use o botão vermelho. Preço não é editável.</span>
      </div>

      {/* Body — Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={40} />
          <span className="ml-3 text-gray-500">Carregando itens da venda...</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-4 py-2 overflow-hidden">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex-1 venda-grid">
                <style>{`
                  .venda-grid .ag-header-cell-label { font-weight: 700; font-size: 12px; }
                  .venda-grid .ag-cell { font-size: 13px; display: flex; align-items: center; }
                  .dark .venda-grid .ag-header { background: #1e293b !important; color: #e2e8f0 !important; }
                  .dark .venda-grid .ag-row { border-color: #3f3f46 !important; }
                `}</style>
                <AgGridReact
                  ref={gridRef}
                  theme={themeQuartz.withParams({ borderColor: '#d1d5db', wrapperBorder: true })}
                  rowData={itensGrid}
                  columnDefs={itensColumnDefs}
                  defaultColDef={{ sortable: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true }}
                  onCellValueChanged={onItemCellChanged}
                  onCellFocused={(e: any) => {
                    if (e.rowIndex != null) {
                      const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(e.rowIndex);
                      if (rowNode?.data) ultimaCelulaRef.current = rowNode.data;
                    }
                  }}
                  onCellMouseOver={(e: any) => {
                    const cellEl = e.event?.target?.closest?.('.ag-cell');
                    if (cellEl) { const isDark = document.documentElement.classList.contains('dark'); cellEl.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }
                  }}
                  onCellMouseOut={(e: any) => {
                    const cellEl = e.event?.target?.closest?.('.ag-cell');
                    if (cellEl) cellEl.style.backgroundColor = '';
                  }}
                  stopEditingWhenCellsLoseFocus={true}
                  singleClickEdit={false}
                  enterNavigatesVertically={false}
                  enterNavigatesVerticallyAfterEdit={false}
                  alwaysShowVerticalScroll={true}
                  suppressHorizontalScroll={true}
                  getRowId={(params: any) => params.data.codprod}
                  suppressRowHoverHighlight={true}
                  suppressHeaderFocus={true}
                  rowHeight={48}
                  overlayNoRowsTemplate={'<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#9ca3af"><span style="font-size:14px;font-weight:600">Todos os itens foram removidos</span></div>'}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-zinc-600 shadow-lg rounded-lg">
              <ContextMenuLabel className="text-xs text-gray-400">Ações</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => {
                const item = ultimaCelulaRef.current;
                if (item?.codprod) setZoomProduto(item);
              }}>
                Zoom Produto (Ctrl+Z)
              </ContextMenuItem>
              <ContextMenuItem onClick={() => {
                const item = ultimaCelulaRef.current;
                if (item?.codprod) { setProdutoEquivalente(item); setModalEquivalentes(true); }
              }}>
                Equivalentes (F9)
              </ContextMenuItem>
              <ContextMenuItem onClick={() => {
                const item = ultimaCelulaRef.current;
                if (item?.codprod) { setProdutoHist(item); setModalHistProduto(true); }
              }}>
                Histórico Produto (F10)
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-red-600" onClick={() => {
                const item = ultimaCelulaRef.current;
                if (item?.codprod) handleRemoverItem(item.codprod);
              }}>
                Remover Item
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      )}

      {/* Rodapé — Totais + Salvar */}
      <div className="shrink-0 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-300">{totalItens} itens</span>
          {itensRemovidos.length > 0 ? (
            <span className="text-xs font-semibold text-red-600">{itensRemovidos.length} removido(s)</span>
          ) : null}
          <span className="font-bold text-xl text-blue-600 dark:text-blue-400">Total: {formatCurrency(totalVenda)}</span>
          {totalVenda !== totalOriginal ? (
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
              (era {formatCurrency(totalOriginal)} — diferença: {formatCurrency(totalVenda - totalOriginal)})
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200"
          >
            Cancelar
          </button>
          <button
            disabled={!temAlteracoes || saving || itensGrid.length === 0}
            onClick={() => setConfirmSave(true)}
            className="px-4 py-1.5 text-xs font-bold rounded-md bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Alterações (Ctrl+S)
          </button>
        </div>
      </div>

      {/* Dialog confirmar remoção */}
      {confirmRemove ? (
        <AlertDialog open={true} onOpenChange={() => setConfirmRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover item?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o item <strong>{confirmRemove}</strong> da venda?
                Esta ação será efetivada ao salvar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarRemocao} className="bg-red-600 hover:bg-red-700">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* Dialog confirmar salvamento */}
      {confirmSave ? (
        <AlertDialog open={true} onOpenChange={() => setConfirmSave(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar alterações na venda {codvenda}?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-1">
                  {itensAlterados > 0 ? (
                    <p>{itensAlterados} item(ns) com quantidade alterada</p>
                  ) : null}
                  {itensRemovidos.length > 0 ? (
                    <p>{itensRemovidos.length} item(ns) removido(s)</p>
                  ) : null}
                  <p className="font-bold mt-2">
                    Total: {formatCurrency(totalOriginal)} → {formatCurrency(totalVenda)}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSalvar} className="bg-orange-600 hover:bg-orange-700">
                Confirmar e Salvar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* Modais auxiliares */}
      {zoomProduto ? (
        <ProductZoomModal
          open={true}
          onOpenChange={(open: boolean) => { if (!open) setZoomProduto(null); }}
          productId={zoomProduto.codprod}
        />
      ) : null}

      {modalEquivalentes && produtoEquivalente ? (
        <ModalEquivalentes
          isOpen={modalEquivalentes}
          onClose={() => { setModalEquivalentes(false); setProdutoEquivalente(null); }}
          produto={produtoEquivalente}
          itensExistentes={itensGrid.map(i => i.codprod)}
          onAdicionarItens={() => {
            // Não permite adicionar — apenas consulta
            toast({ title: 'Consulta apenas', description: 'Nesta tela não é possível adicionar novos itens.' });
            setModalEquivalentes(false);
          }}
        />
      ) : null}

      {modalHistProduto && produtoHist ? (
        <ModalHistoricoProduto
          isOpen={modalHistProduto}
          onClose={() => { setModalHistProduto(false); setProdutoHist(null); }}
          produto={produtoHist}
        />
      ) : null}
    </div>
  );
};

export default ModalEditarVendaFinalizada;
