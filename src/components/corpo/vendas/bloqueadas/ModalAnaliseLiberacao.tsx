'use client';

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import {
  X,
  Loader2,
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Calendar,
  CreditCard,
  AlertCircle,
  Plus,
  Trash2,
  Keyboard,
  ArrowLeftRight,
  History,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import ProductZoomModal from '@/components/common/ProductZoomModal';
import ModalAdicionarItemRapido from './ModalAdicionarItemRapido';
import ModalEquivalentes from './ModalEquivalentes';
import ModalHistoricoProduto from './ModalHistoricoProduto';
import ModalFinalizarVenda from './ModalFinalizarVenda';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { CellValueChangedEvent } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

interface ItemVenda {
  codprod: string;
  ref: string;
  descr: string;
  qtd: number;
  prunit: number;
  prvenda_original: number;
  desconto_valor: number;
  desconto_percentual: number;
  total_item: number;
  prcompra: number;
  prcustoatual: number;
  margem: number;
  codmarca: string;
  marca_nome: string;
  origem: string;
  impostos?: {
    icms: number;
    ipi: number;
    pis: number;
    cofins: number;
    st: number;
    total_impostos: number;
  };
  total_com_imposto?: number;
}

interface HistoricoCompra {
  codvenda: string;
  data: string;
  total: number;
  status: string;
}

interface TituloFinanceiro {
  documento: string;
  dt_venc: string;
  valor: number;
  dias_atraso: number;
  status: string;
}

interface AnaliseCliente {
  codcli: string;
  nome: string;
  nomefant: string;
  cpfcgc: string;
  status: string;
  tipo: string;
  limite: number;
  debito: number;
  limite_disponivel: number;
  atraso_permitido: number;
  claspgto: string;
  faixafin: string;
  media_compras_3m: number;
  maior_compra_12m: number;
  total_compras_12m: number;
  qtd_compras_12m: number;
  ultima_compra_data: string | null;
  ultima_compra_valor: number;
  dias_desde_ultima_compra: number | null;
  titulos_vencer: number;
  titulos_vencidos: number;
  atraso_medio: number;
  maior_atraso: number;
  qtd_titulos_abertos: number;
  qtd_titulos_vencidos: number;
  historico_compras: HistoricoCompra[];
  titulos_abertos: TituloFinanceiro[];
  score: 'BOM' | 'REGULAR' | 'RUIM' | 'NOVO';
  score_detalhes: string[];
  cliente_ativo: boolean;
}

interface AnaliseData {
  venda: {
    codvenda: string;
    nrovenda: string;
    data: string;
    total: number;
    status: string;
    bloqueada: string;
    tipo: string;
    obs: string;
    obsfat: string;
    codvend: string;
  };
  itens: ItemVenda[];
  cliente: AnaliseCliente;
  resumo_desconto: {
    total_desconto: number;
    percentual_medio: number;
    maior_desconto_percentual: number;
  };
}

interface ModalAnaliseLiberacaoProps {
  isOpen: boolean;
  onClose: () => void;
  codvenda: string;
  onLiberar: () => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

const ScoreBadge: React.FC<{ score: string }> = ({ score }) => {
  const configs = {
    BOM: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-200', icon: CheckCircle },
    REGULAR: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-200', icon: AlertCircle },
    RUIM: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-200', icon: XCircle },
    NOVO: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-200', icon: User },
  };
  const config = configs[score as keyof typeof configs] || configs.NOVO;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <Icon size={14} />
      {score}
    </span>
  );
};

const ModalAnaliseLiberacao: React.FC<ModalAnaliseLiberacaoProps> = ({
  isOpen,
  onClose,
  codvenda,
  onLiberar,
}) => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as any;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnaliseData | null>(null);

  // Modais secundários
  const [modalCliente, setModalCliente] = useState(false);
  const [modalFinanceiro, setModalFinanceiro] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [modalAlertas, setModalAlertas] = useState(false);

  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);
  const [modalFinalizar, setModalFinalizar] = useState(false);

  // Refs para evitar re-registrar handlers quando modais abrem/fecham
  const modaisAbertosRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && codvenda) {
      fetchAnalise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, codvenda]);

  const fetchAnalise = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/vendas/analise-liberacao?codvenda=${codvenda}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar análise');
      }
      const result = await response.json();
      setData(result);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar a análise.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- AG Grid: itens da venda ----------
  const [itensGrid, setItensGrid] = React.useState<any[]>([]);
  const [itemParaRemover, setItemParaRemover] = React.useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [zoomProduto, setZoomProduto] = React.useState<any>(null);
  const [linhaSelecionada, setLinhaSelecionada] = React.useState(-1);
  const gridRef = React.useRef<any>(null);
  const gridWrapperRef = React.useRef<HTMLDivElement>(null);
  const hoveredRowRef = React.useRef<any>(null);
  const ultimaCelulaRef = React.useRef<any>(null);
  const itensOriginaisRef = React.useRef<Set<string>>(new Set());

  const handleRemoverItem = useCallback((codprod: string) => {
    setItensGrid((prev) => prev.filter((r) => r.codprod !== codprod));
    // Remover do banco
    fetch('/api/vendas/analise-itens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codvenda, codprod, usuario: user?.usuario }),
    }).catch(() => {});
    toast({ title: `Item ${codprod} removido.` });
  }, [toast, codvenda, user?.usuario]);

  const handleAdicionarItens = useCallback((itensNovos: any[]) => {
    itensNovos.forEach((item) => {
      if (item.qtd === 0) {
        // Remover
        setItensGrid((prev) => prev.filter((r) => r.codprod !== item.codprod));
        fetch('/api/vendas/analise-itens', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codvenda, codprod: item.codprod, usuario: user?.usuario }),
        }).catch(() => {});
      } else {
        // Salvar no banco, esperar resposta com impostos, e só então inserir no grid
        fetch('/api/vendas/analise-itens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codvenda, codprod: item.codprod, qtd: item.qtd, prunit: item.prunit, prcompra: item.prcompra, ref: item.ref, descr: item.descr, usuario: user?.usuario }),
        })
          .then((res) => res.json())
          .then((result) => {
            const imp = result.impostos || {};
            const totalImpostos = (imp.totalicms || 0) + (imp.totalipi || 0) + (imp.valorpis || 0) + (imp.valorcofins || 0) + (imp.totalsubst_trib || 0);
            const totalItem = item.qtd * item.prunit;

            const itemCompleto = {
              ...item,
              codgpe: result.codgpe || item.codgpe || '',
              origem: result.origem || item.origem || 'N',
              impostos: {
                icms: imp.totalicms || 0,
                ipi: imp.totalipi || 0,
                pis: imp.valorpis || 0,
                cofins: imp.valorcofins || 0,
                st: imp.totalsubst_trib || 0,
                total_impostos: totalImpostos,
              },
              total_com_imposto: totalItem + totalImpostos,
            };

            setItensGrid((prev) => {
              const idx = prev.findIndex((r) => r.codprod === item.codprod);
              if (idx >= 0) {
                // Atualizar no lugar (não mover)
                const novos = [...prev];
                novos[idx] = { ...novos[idx], ...itemCompleto, total_item: item.qtd * novos[idx].prunit };
                return novos;
              }
              // Novo: inserir no topo
              return [itemCompleto, ...prev];
            });
          })
          .catch(() => {
            // Fallback: inserir sem impostos
            setItensGrid((prev) => {
              const idx = prev.findIndex((r) => r.codprod === item.codprod);
              if (idx >= 0) {
                const novos = [...prev];
                novos[idx] = { ...novos[idx], qtd: item.qtd, total_item: item.qtd * novos[idx].prunit };
                return novos;
              }
              return [item, ...prev];
            });
          });
      }
    });
  }, [codvenda]);

  React.useEffect(() => {
    if (data?.itens) {
      itensOriginaisRef.current = new Set(data.itens.map((i) => i.codprod));
      setItensGrid(data.itens.map((item) => ({ ...item })));
    }
  }, [data?.itens]);

  const fmtMoeda = (v: any) => v != null ? `R$ ${Number(v).toFixed(2)}` : '-';
  const fmtPerc = (v: any) => v != null ? `${parseFloat(Number(v).toFixed(2))}%` : '-';

  const ProdutoCellRenderer = useCallback((props: any) => {
    const d = props.data;
    if (!d) return null;
    return (
      <div style={{ lineHeight: 1.4, padding: '4px 8px', width: '100%', textAlign: 'left' }}>
        <div title={d.descr || ''} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>{d.descr || '-'}</div>
        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <img
            src={d.origem === 'N' ? '/images/brasil.png' : '/images/importado.png'}
            alt={d.origem === 'N' ? 'Nacional' : 'Importado'}
            style={{ width: 16, height: 11, objectFit: 'contain' }}
          />
          {d._novo ? <span style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>NOVO</span> : null}
        </div>
      </div>
    );
  }, []);

  const onItemCellChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field;
    const rowIndex = event.rowIndex;
    if (rowIndex == null || !field) return;

    setItensGrid((prev) => {
      const novos = [...prev];
      const row = { ...novos[rowIndex] };

      if (field === 'qtd') {
        row.qtd = Number(event.newValue) || 0;
        row.total_item = row.qtd * row.prunit;
      } else if (field === 'prunit') {
        row.prunit = Number(event.newValue) || 0;
        row.total_item = row.qtd * row.prunit;
        if (row.prvenda_original > 0) {
          row.desconto_percentual = ((row.prvenda_original - row.prunit) / row.prvenda_original) * 100;
        }
        if (row.prcompra > 0) {
          row.margem = ((row.prunit / row.prcompra) - 1) * 100;
        }
      }

      novos[rowIndex] = row;
      return novos;
    });
  }, []);

  const DeleteItemRenderer = React.useCallback((props: any) => {
    const codprod = props.data?.codprod;
    if (!codprod) return null;
    return (
      <button onClick={() => setItemParaRemover(codprod)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Remover item">
        <Trash2 size={15} />
      </button>
    );
  }, []);

  const itensColumnDefs = React.useMemo((): any[] => [
    { headerName: '', field: '_delete', width: 40, maxWidth: 40, sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRendererSelector: () => ({ component: DeleteItemRenderer }),
    },
    { headerName: 'Referência', field: 'ref', width: 120, cellStyle: { fontWeight: 500 } },
    {
      headerName: 'Produto', field: 'descr', flex: 2, minWidth: 150,
      autoHeight: true,
      cellStyle: { textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start' },
      cellRendererSelector: () => ({ component: ProdutoCellRenderer }),
    },
    { headerName: 'Marca', field: 'marca_nome', flex: 1, minWidth: 80, autoHeight: true,
      cellRenderer: (p: any) => {
        const val = p.value || '-';
        return (
          <div title={val} style={{ lineHeight: 1.3, padding: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12 }}>
            {val}
          </div>
        );
      },
    },
    { headerName: 'Qtd', field: 'qtd', width: 55, type: 'numericColumn', editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    { headerName: 'Custo', field: 'prcompra', width: 70,
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    { headerName: 'Preço Tabela', field: 'prvenda_original', width: 90,
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    { headerName: 'Preço Vendido', field: 'prunit', width: 95, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('R$', '').replace(',', '.').trim()) || 0,
      cellRendererSelector: () => ({
        component: (p: any) => {
          if (!p.data) return <span>{fmtMoeda(p.value)}</span>;
          const totalComImp = p.data.total_com_imposto || 0;
          const totalSemImp = (p.data.prunit || 0) * (p.data.qtd || 1);
          const impUnitario = totalComImp > totalSemImp ? (totalComImp - totalSemImp) / (p.data.qtd || 1) : 0;
          return impUnitario > 0 ? (
            <div style={{ lineHeight: 1.2, textAlign: 'center' }}>
              <div>{fmtMoeda(p.value)}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>(+{fmtMoeda(impUnitario)})</div>
            </div>
          ) : <span>{fmtMoeda(p.value)}</span>;
        },
      }),
    },
    { headerName: '% Desc', field: 'desconto_percentual', width: 70, type: 'numericColumn',
      valueFormatter: (p: any) => fmtPerc(p.value),
      cellStyle: (p: any) => ({
        color: (p.value ?? 0) > 10 ? '#dc2626' : (p.value ?? 0) > 5 ? '#d97706' : '#16a34a',
        fontWeight: 600,
      }),
    },
    { headerName: 'Margem', field: 'margem', width: 80, type: 'numericColumn',
      valueFormatter: (p: any) => fmtPerc(p.value),
      cellStyle: (p: any) => {
        const isImportado = p.data?.origem !== 'N';
        const limite = isImportado ? 40 : 20;
        return {
          color: (p.value ?? 0) < 0 ? '#dc2626' : (p.value ?? 0) < limite ? '#d97706' : '#16a34a',
          fontWeight: 600,
        };
      },
    },
    { headerName: 'Total', field: 'total_item', width: 95,
      cellStyle: { fontWeight: 600, color: '#2563eb' },
      cellRendererSelector: () => ({
        component: (p: any) => {
          const total = Number(p.value) || 0;
          const totalComImp = p.data?.total_com_imposto || 0;
          return totalComImp > total ? (
            <div style={{ lineHeight: 1.2, textAlign: 'center' }}>
              <div>{fmtMoeda(total)}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>({fmtMoeda(totalComImp)})</div>
            </div>
          ) : <span>{fmtMoeda(total)}</span>;
        },
      }),
    },
  ], []);

  // ---------- Sync ref de modais abertos ----------
  modaisAbertosRef.current = modalCliente || modalFinanceiro || modalHistorico || modalAlertas || !!zoomProduto || addItemOpen || modalEquivalentes || modalHistProduto || modalFinalizar;

  const restaurarFocoGrid = useCallback(() => {
    setTimeout(() => {
      const api = gridRef.current?.api;
      if (!api) return;
      const fc = api.getFocusedCell();
      if (fc) {
        api.setFocusedCell(fc.rowIndex, fc.column?.getColId?.() || 'ref');
      } else if (ultimaCelulaRef.current) {
        const idx = itensGrid.findIndex((r: any) => r.codprod === ultimaCelulaRef.current.codprod);
        if (idx >= 0) api.setFocusedCell(idx, 'ref');
      }
    }, 100);
  }, [itensGrid]);

  // ---------- Atalhos de teclado (registra UMA vez, usa refs) ----------
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (modaisAbertosRef.current) return;

      // Setas cima/baixo
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !emInput) {
        const wrapper = gridWrapperRef.current;
        if (wrapper && wrapper.contains(e.target as Node)) {
          const api = gridRef.current?.api;
          if (!api) return;
          const focused = api.getFocusedCell();
          if (!focused) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          const totalRows = api.getDisplayedRowCount();
          const currentCol = focused.column?.getColId?.() || 'ref';
          const nextRow = e.key === 'ArrowDown'
            ? Math.min(focused.rowIndex + 1, totalRows - 1)
            : Math.max(focused.rowIndex - 1, 0);
          api.setFocusedCell(nextRow, currentCol);
          api.ensureIndexVisible(nextRow);
          setLinhaSelecionada(nextRow);
          return;
        }
        e.preventDefault();
        const modalEl = document.querySelector('[data-analise-modal]');
        if (!modalEl) return;
        const focusables = Array.from(modalEl.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const idx = focusables.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown'
          ? (idx < focusables.length - 1 ? idx + 1 : 0)
          : (idx > 0 ? idx - 1 : focusables.length - 1);
        focusables[next]?.focus();
        return;
      }

      // Zoom produto: Ctrl+Z
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        if (emInput || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const rd = ultimaCelulaRef.current;
        if (rd) {
          setZoomProduto({ codprod: rd.codprod, ref: rd.ref, descr: rd.descr });
        } else {
          toast({ title: 'Selecione um item na planilha' });
        }
        return;
      }

      if (emInput) return;

      if (e.key === 'F2') { e.preventDefault(); setModalCliente(true); }
      else if (e.key === 'F3') { e.preventDefault(); setModalFinanceiro(true); }
      else if (e.key === 'F4') { e.preventDefault(); setModalHistorico(true); }
      else if (e.key === 'F5') { e.preventDefault(); setModalAlertas(true); }
      else if (e.key === 'F9') {
        e.preventDefault(); e.stopImmediatePropagation();
        // Mesma lógica do zoom: focado no grid OU ultimaCelulaRef
        const focused = gridRef.current?.api?.getFocusedCell();
        let item: any = null;
        if (focused) {
          const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(focused.rowIndex);
          if (rowNode?.data) item = rowNode.data;
        }
        if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
        if (item) {
          if (item.codgpe) {
            setProdutoEquivalente({ codprod: item.codprod, ref: item.ref, descr: item.descr, codgpe: item.codgpe, origem: item.origem });
            setModalEquivalentes(true);
          } else {
            // Fallback: buscar codgpe via API
            fetch(`/api/produtos/get/${item.codprod}`)
              .then(r => r.json())
              .then(data => {
                const gpe = (data.codgpe || '').trim();
                if (gpe) {
                  setProdutoEquivalente({ codprod: item.codprod, ref: item.ref, descr: item.descr, codgpe: gpe, origem: data.dolar || 'N' });
                  setModalEquivalentes(true);
                } else {
                  toast({ title: 'Produto sem grupo de equivalência' });
                }
              }).catch(() => toast({ title: 'Erro ao buscar equivalência' }));
          }
        } else {
          toast({ title: 'Selecione um item na planilha' });
        }
      }
      else if (e.key === 'F10') {
        e.preventDefault(); e.stopImmediatePropagation();
        const fc = gridRef.current?.api?.getFocusedCell();
        let item: any = null;
        if (fc) { const rn = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex); if (rn?.data) item = rn.data; }
        if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
        if (item) { setProdutoHist({ codprod: item.codprod, ref: item.ref, descr: item.descr }); setModalHistProduto(true); }
        else toast({ title: 'Selecione um item na planilha' });
      }
      else if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === 'Add')) { e.preventDefault(); e.stopImmediatePropagation(); setAddItemOpen(true); }
      else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); e.stopImmediatePropagation(); setModalFinalizar(true); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    const clickHandler = (e: MouseEvent) => {
      if (modaisAbertosRef.current) return;
      const wrapper = gridWrapperRef.current;
      const modalEl = document.querySelector('[data-analise-modal]');
      const target = e.target as Node;
      if (wrapper && modalEl && modalEl.contains(target) && !wrapper.contains(target)) {
        gridRef.current?.api?.clearFocusedCell();
        setLinhaSelecionada(-1);
        ultimaCelulaRef.current = null;
      }
    };

    window.addEventListener('keydown', handler, true);
    window.addEventListener('mousedown', clickHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('mousedown', clickHandler, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // ---------- Cálculos dos cards ----------
  const totalTabela = itensGrid.reduce((acc, item) => acc + (Number(item.prvenda_original) || 0) * (Number(item.qtd) || 0), 0);
  const totalVendido = itensGrid.reduce((acc, item) => acc + (Number(item.prunit) || 0) * (Number(item.qtd) || 0), 0);
  const totalCusto = itensGrid.reduce((acc, item) => acc + (Number(item.prcompra) || 0) * (Number(item.qtd) || 0), 0);
  const totalDesconto = totalTabela - totalVendido;
  const percDesconto = totalTabela > 0 ? (totalDesconto / totalTabela) * 100 : 0;
  const margemTabela = totalCusto > 0 ? ((totalTabela / totalCusto) - 1) * 100 : 0;
  const margemObtida = totalCusto > 0 ? ((totalVendido / totalCusto) - 1) * 100 : 0;

  // Análise de margem por item: nacional >= 20%, importado >= 40%
  let itensForaDaMargem = 0;
  itensGrid.forEach((item) => {
    const isImportado = item.origem !== 'N';
    const limiteMin = isImportado ? 40 : 20;
    if ((Number(item.margem) || 0) < limiteMin) itensForaDaMargem++;
  });

  const custoNacional = itensGrid.filter((i) => i.origem === 'N').reduce((acc, i) => acc + (Number(i.prcompra) || 0) * (Number(i.qtd) || 0), 0);
  const custoImportado = totalCusto - custoNacional;
  const margemMinEsperada = totalCusto > 0
    ? ((custoNacional * 1.20 + custoImportado * 1.40) / totalCusto - 1) * 100
    : 20;
  const dentroMargem = itensForaDaMargem === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-analise-modal className="bg-white dark:bg-zinc-900 shadow-lg w-screen h-screen flex flex-col">
            {/* Cabeçalho: título + dados básicos do cliente (compacto) */}
            <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      Análise para Liberação - Venda {codvenda}
                    </h2>
                    {data ? <ScoreBadge score={data.cliente.score} /> : null}
                  </div>
                  {data ? (
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                      <span><b>Cliente:</b> {data.cliente.codcli} - {data.cliente.nomefant || data.cliente.nome}</span>
                      <span><b>Data:</b> {formatDate(data.venda.data)}</span>
                      <span><b>{data.venda.operador_nome ? 'Operador' : 'Vendedor'}:</b> {data.venda.operador_nome || data.venda.vendedor_nome || data.venda.codvend}</span>
                      {data.cliente.cpfcgc ? <span><b>CNPJ/CPF:</b> {data.cliente.cpfcgc}</span> : null}
                      <span className={data.cliente.limite_disponivel > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        <b>Limite Disp.:</b> {formatCurrency(data.cliente.limite_disponivel)}
                      </span>
                      {data.cliente.titulos_vencidos > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          <b>Vencidos:</b> {formatCurrency(data.cliente.titulos_vencidos)}
                        </span>
                      ) : null}
                      {data.cliente.score_detalhes.length > 0 ? (
                        <button
                          onClick={() => setModalAlertas(true)}
                          className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1 hover:text-yellow-800 dark:hover:text-yellow-300 hover:underline"
                          title="F5 - Ver alertas"
                        >
                          <AlertTriangle size={12} />
                          {data.cliente.score_detalhes.length} alerta(s)
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando análise...</span>
              </div>
            ) : null}

            {/* Conteúdo */}
            {!loading && data ? (
              <>
                {/* Cards resumo */}
                <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-700">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Valor Tabela</p>
                      <p className="text-base font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totalTabela)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-700">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Desconto</p>
                      <p className="text-base font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalDesconto)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-700">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">% Desconto</p>
                      <p className="text-base font-bold text-orange-600 dark:text-orange-400">{percDesconto.toFixed(1)}%</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-blue-300 dark:border-blue-700">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Valor da Venda</p>
                      <p className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalVendido)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-700">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Margem Tabela</p>
                      <p className={`text-base font-bold ${margemTabela >= margemMinEsperada ? 'text-green-600 dark:text-green-400' : margemTabela >= margemMinEsperada * 0.7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {margemTabela.toFixed(2)}%
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg border-2 ${dentroMargem ? 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30' : 'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30'}`}>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Margem Obtida</p>
                      <p className={`text-base font-bold ${dentroMargem ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {margemObtida.toFixed(2)}%
                      </p>
                      {itensForaDaMargem > 0 ? (
                        <p className="text-[10px] text-red-600 dark:text-red-400">{itensForaDaMargem} {itensForaDaMargem === 1 ? 'item fora' : 'itens fora'}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Grid de itens (ocupa todo o espaço restante) */}
                <div className="flex-1 flex flex-col px-3 overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setAddItemOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md"
                      >
                        <Plus size={14} /> Adicionar Item
                      </button>
                      <span className="text-[11px] text-gray-400">
                        {itensGrid.length} itens | Duplo clique edita | Botão direito para mais opções
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <Keyboard size={11} />
                        F2 Cliente | F3 Financeiro | F4 Histórico | F5 Alertas | F9 Equiv. | F10 Hist. Produto | Ctrl+Z Zoom | Ctrl++ Adicionar | Ctrl+L Liberar | Esc
                      </span>
                      <button
                        onClick={() => setModalFinalizar(true)}
                        className="px-4 py-1.5 text-xs font-medium rounded-md bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        Liberar Venda
                      </button>
                    </div>
                  </div>
                  <style>{`
                    .analise-grid .ag-cell { border-right: 1px solid #d1d5db !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; }
                    .analise-grid .ag-cell[col-id="descr"] { align-items: flex-start !important; justify-content: flex-start !important; padding: 0 !important; }
                    .analise-grid .ag-row { border-bottom: 1px solid #d1d5db !important; }
                    .analise-grid .ag-row,
                    .analise-grid .ag-row-even,
                    .analise-grid .ag-row-odd,
                    .analise-grid .ag-row-hover,
                    .analise-grid .ag-row-selected,
                    .analise-grid .ag-row-hover.ag-row-selected { background-color: white !important; background: white !important; }
                    .analise-grid .ag-row .ag-cell,
                    .analise-grid .ag-row-selected .ag-cell { background-color: white !important; }
                    .analise-grid .ag-row .ag-cell[col-id="qtd"],
                    .analise-grid .ag-row .ag-cell[col-id="prunit"],
                    .analise-grid .ag-row-selected .ag-cell[col-id="qtd"],
                    .analise-grid .ag-row-selected .ag-cell[col-id="prunit"] { background-color: #eff6ff !important; }
                    .analise-grid .ag-cell-focus { outline: 2px solid #a8a29e !important; outline-offset: -2px; background-color: rgba(0,0,0,0.05) !important; }
                    .analise-grid .ag-cell-range-selected,
                    .analise-grid .ag-cell-range-single-cell { background-color: rgba(0,0,0,0.05) !important; }

                    .dark .analise-grid .ag-root-wrapper { background-color: #18181b !important; }
                    .dark .analise-grid .ag-header { background-color: #27272a !important; border-color: #3f3f46 !important; }
                    .dark .analise-grid .ag-header-cell { border-color: #3f3f46 !important; color: #a1a1aa !important; }
                    .dark .analise-grid .ag-row,
                    .dark .analise-grid .ag-row-even,
                    .dark .analise-grid .ag-row-odd,
                    .dark .analise-grid .ag-row-hover,
                    .dark .analise-grid .ag-row-selected,
                    .dark .analise-grid .ag-row-hover.ag-row-selected { background-color: #18181b !important; background: #18181b !important; }
                    .dark .analise-grid .ag-row .ag-cell,
                    .dark .analise-grid .ag-row-selected .ag-cell { background-color: #18181b !important; color: #e4e4e7 !important; border-color: #3f3f46 !important; }
                    .dark .analise-grid .ag-row .ag-cell[col-id="qtd"],
                    .dark .analise-grid .ag-row .ag-cell[col-id="prunit"],
                    .dark .analise-grid .ag-row-selected .ag-cell[col-id="qtd"],
                    .dark .analise-grid .ag-row-selected .ag-cell[col-id="prunit"] { background-color: #1e2a3a !important; }
                    .dark .analise-grid .ag-cell-focus { outline-color: #71717a !important; background-color: rgba(255,255,255,0.05) !important; }
                    .dark .analise-grid .ag-cell-range-selected,
                    .dark .analise-grid .ag-cell-range-single-cell { background-color: rgba(255,255,255,0.05) !important; }
                    .dark .analise-grid .ag-row { border-color: #3f3f46 !important; }
                    .analise-grid .ag-header-cell { border-right: 1px solid #d1d5db !important; }
                    .analise-grid .ag-header-cell-resize { width: 4px !important; cursor: col-resize !important; }
                    .analise-grid .ag-header-cell-label { justify-content: center !important; font-size: 11px !important; text-align: center !important; }
                    .analise-grid .ag-header-cell-text { text-align: center !important; width: 100% !important; }
                    .analise-grid .ag-input-field-input { font-size: 13px !important; text-align: center !important; }
                    .analise-grid .ag-cell-value { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
                  `}</style>
                  <div className="flex-1 analise-grid" ref={gridWrapperRef}>
                    <AgGridReact
                      ref={gridRef}
                      theme={themeQuartz.withParams({ borderColor: '#d1d5db', wrapperBorder: true })}
                      rowData={itensGrid}
                      columnDefs={itensColumnDefs}
                      defaultColDef={{ sortable: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true }}
                      onCellValueChanged={onItemCellChanged}
                      stopEditingWhenCellsLoseFocus={true}
                      singleClickEdit={false}
                      enterNavigatesVertically={true}
                      enterNavigatesVerticallyAfterEdit={true}
                      alwaysShowVerticalScroll={true}
                      suppressHorizontalScroll={true}
                      getRowId={(params: any) => params.data.codprod}
                      onCellMouseOver={(e: any) => {
                        hoveredRowRef.current = e.data;
                        const cellEl = e.event?.target?.closest?.('.ag-cell');
                        if (cellEl) {
                          const isDark = document.documentElement.classList.contains('dark');
                          cellEl.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                        }
                      }}
                      onCellMouseOut={(e: any) => {
                        hoveredRowRef.current = null;
                        const cellEl = e.event?.target?.closest?.('.ag-cell');
                        if (cellEl) cellEl.style.backgroundColor = '';
                      }}
                      onCellFocused={(e: any) => {
                        if (e.rowIndex != null) {
                          setLinhaSelecionada(e.rowIndex);
                          const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(e.rowIndex);
                          if (rowNode?.data) ultimaCelulaRef.current = rowNode.data;
                        }
                      }}
                      rowSelection="single"
                      suppressRowHoverHighlight={true}
                      rowHeight={48}
                    />
                  </div>
                </div>

                {/* Margem inferior */}
                <div className="h-3" />
              </>
            ) : null}
          </div>
        </ContextMenuTrigger>

        {/* Context Menu (botão direito) */}
        <ContextMenuContent className={`w-56 ${addItemOpen ? 'hidden' : ''}`}>
          <ContextMenuLabel className="text-xs text-gray-500">Venda {codvenda}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setModalCliente(true)}>
            <User size={14} className="mr-2" /> Dados do Cliente
            <span className="ml-auto text-[10px] text-gray-400">F2</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setModalFinanceiro(true)}>
            <DollarSign size={14} className="mr-2" /> Situação Financeira
            <span className="ml-auto text-[10px] text-gray-400">F3</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setModalHistorico(true)}>
            <Clock size={14} className="mr-2" /> Histórico de Compras
            <span className="ml-auto text-[10px] text-gray-400">F4</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setModalAlertas(true)}>
            <AlertTriangle size={14} className="mr-2" /> Pontos de Atenção
            <span className="ml-auto text-[10px] text-gray-400">F5</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => {
            const rd = ultimaCelulaRef.current;
            if (rd) {
              setZoomProduto({ codprod: rd.codprod, ref: rd.ref, descr: rd.descr });
            } else {
              toast({ title: 'Selecione um item na planilha' });
            }
          }}>
            <FileText size={14} className="mr-2" /> Zoom Produto
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+Z</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const rd = ultimaCelulaRef.current;
            if (rd && rd.codgpe) {
              setProdutoEquivalente({ codprod: rd.codprod, ref: rd.ref, descr: rd.descr, codgpe: rd.codgpe, origem: rd.origem });
              setModalEquivalentes(true);
            } else {
              toast({ title: rd ? 'Produto sem grupo de equivalência' : 'Selecione um item na planilha' });
            }
          }}>
            <ArrowLeftRight size={14} className="mr-2" /> Equivalentes
            <span className="ml-auto text-[10px] text-gray-400">F9</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const fc = gridRef.current?.api?.getFocusedCell();
            let item: any = null;
            if (fc) { const rn = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex); if (rn?.data) item = rn.data; }
            if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
            if (item) { setProdutoHist({ codprod: item.codprod, ref: item.ref, descr: item.descr }); setModalHistProduto(true); }
            else toast({ title: 'Selecione um item na planilha' });
          }}>
            <History size={14} className="mr-2" /> Histórico Produto
            <span className="ml-auto text-[10px] text-gray-400">F10</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setAddItemOpen(true)}>
            <Plus size={14} className="mr-2" /> Adicionar Item
            <span className="ml-auto text-[10px] text-gray-400">Ctrl++</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setModalFinalizar(true)} className="text-green-600">
            <CheckCircle size={14} className="mr-2" /> Liberar Venda
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+L</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* ========== Modal: Dados do Cliente ========== */}
      {data && modalCliente ? (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex justify-center items-center p-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col">
            {/* Cabeçalho */}
            <div className="flex justify-between items-center px-7 py-5 border-b border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <User size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100">Dados do Cliente</h3>
              </div>
              <button
                onClick={() => setModalCliente(false)}
                aria-label="Fechar"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-400 dark:text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-auto px-7 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card: Informações Básicas */}
                <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-zinc-700">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <User size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200">Informações Básicas</h4>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Código</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">{data.cliente.codcli}</span>
                    </div>
                    <div className="flex justify-between items-start px-5 py-3 gap-4">
                      <span className="text-sm text-slate-500 dark:text-gray-400 shrink-0">Razão Social</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 text-right break-words min-w-0">{data.cliente.nome}</span>
                    </div>
                    <div className="flex justify-between items-start px-5 py-3 gap-4">
                      <span className="text-sm text-slate-500 dark:text-gray-400 shrink-0">Nome Fantasia</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 text-right break-words min-w-0">{data.cliente.nomefant || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">CNPJ/CPF</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">{data.cliente.cpfcgc || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Status</span>
                      {data.cliente.status === 'S' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Ativo</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {data.cliente.status === 'N' ? 'Inativo' : data.cliente.status || '-'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card: Informações de Crédito */}
                <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-zinc-700">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200">Informações de Crédito</h4>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Limite de Crédito</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">{formatCurrency(data.cliente.limite)}</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Débito Atual</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(data.cliente.debito)}</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Limite Disponível</span>
                      <span className={`text-sm font-semibold ${data.cliente.limite_disponivel > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(data.cliente.limite_disponivel)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Atraso Permitido</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">{data.cliente.atraso_permitido} dias</span>
                    </div>
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-sm text-slate-500 dark:text-gray-400">Classificação Pgto</span>
                      {data.cliente.claspgto ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {data.cliente.claspgto}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-800 dark:text-gray-200">-</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pontos de Atenção */}
              {data.cliente.score_detalhes.length > 0 ? (
                <div className="mt-6 border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/15 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">Pontos de Atenção</h4>
                  </div>
                  <div className="space-y-2 pl-[42px]">
                    {data.cliente.score_detalhes.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0" />
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Rodapé */}
            <div className="px-7 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end">
              <button
                onClick={() => setModalCliente(false)}
                className="px-5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========== Modal: Situação Financeira ========== */}
      {data && modalFinanceiro ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center p-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <DollarSign size={18} /> Situação Financeira
              </h3>
              <button onClick={() => setModalFinanceiro(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              {/* Cards resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Títulos a Vencer</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(data.cliente.titulos_vencer)}</p>
                  <p className="text-[10px] text-gray-400">{data.cliente.qtd_titulos_abertos - data.cliente.qtd_titulos_vencidos} título(s)</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Títulos Vencidos</p>
                  <p className={`text-lg font-bold ${data.cliente.titulos_vencidos > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(data.cliente.titulos_vencidos)}</p>
                  <p className="text-[10px] text-gray-400">{data.cliente.qtd_titulos_vencidos} título(s)</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Atraso Médio</p>
                  <p className={`text-lg font-bold ${data.cliente.atraso_medio > 30 ? 'text-red-600' : data.cliente.atraso_medio > 15 ? 'text-orange-600' : 'text-green-600'}`}>{data.cliente.atraso_medio} dias</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Maior Atraso</p>
                  <p className={`text-lg font-bold ${data.cliente.maior_atraso > 60 ? 'text-red-600' : data.cliente.maior_atraso > 30 ? 'text-orange-600' : 'text-green-600'}`}>{data.cliente.maior_atraso} dias</p>
                </div>
              </div>

              {/* Tabela de títulos */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><FileText size={14} /> Títulos em Aberto</h4>
                {data.cliente.titulos_abertos.length === 0 ? (
                  <p className="text-gray-500 text-center py-6 text-sm">Nenhum título em aberto</p>
                ) : (
                  <div className="overflow-auto max-h-60">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 text-sm">
                      <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dias Atraso</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                        {data.cliente.titulos_abertos.map((t, i) => (
                          <tr key={i} className={t.dias_atraso > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{t.documento}</td>
                            <td className="px-3 py-1.5 text-center text-gray-700 dark:text-gray-300">{formatDate(t.dt_venc)}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{formatCurrency(t.valor)}</td>
                            <td className={`px-3 py-1.5 text-center font-semibold ${t.dias_atraso > 0 ? 'text-red-600' : 'text-gray-400'}`}>{t.dias_atraso > 0 ? t.dias_atraso : '-'}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'VENCIDO' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{t.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-2 border-t border-gray-200 dark:border-zinc-700 flex justify-end">
              <button onClick={() => setModalFinanceiro(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========== Modal: Histórico de Compras ========== */}
      {data && modalHistorico ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center p-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Clock size={18} /> Histórico de Compras
              </h3>
              <button onClick={() => setModalHistorico(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Média Compras (3m)</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(data.cliente.media_compras_3m)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Maior Compra (12m)</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(data.cliente.maior_compra_12m)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Compras (12m)</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(data.cliente.total_compras_12m)}</p>
                  <p className="text-[10px] text-gray-400">{data.cliente.qtd_compras_12m} compras</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Última Compra</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatDate(data.cliente.ultima_compra_data)}</p>
                  {data.cliente.dias_desde_ultima_compra !== null ? (
                    <p className="text-[10px] text-gray-400">há {data.cliente.dias_desde_ultima_compra} dias</p>
                  ) : null}
                </div>
              </div>

              {/* Tabela de histórico */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Calendar size={14} /> Últimas Compras</h4>
                {data.cliente.historico_compras.length === 0 ? (
                  <p className="text-gray-500 text-center py-6 text-sm">Nenhuma compra registrada</p>
                ) : (
                  <div className="overflow-auto max-h-60">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 text-sm">
                      <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código Venda</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Data</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                        {data.cliente.historico_compras.map((c, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{c.codvenda}</td>
                            <td className="px-3 py-1.5 text-center text-gray-700 dark:text-gray-300">{formatDate(c.data)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{formatCurrency(c.total)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                c.status === 'F' ? 'bg-green-100 text-green-800' :
                                c.status === 'B' ? 'bg-red-100 text-red-800' :
                                c.status === 'N' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {c.status === 'F' ? 'Faturada' : c.status === 'B' ? 'Bloqueada' : c.status === 'N' ? 'Normal' : c.status || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-2 border-t border-gray-200 dark:border-zinc-700 flex justify-end">
              <button onClick={() => setModalHistorico(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========== Zoom Produto ========== */}
      <ProductZoomModal
        open={!!zoomProduto}
        onOpenChange={(open) => { if (!open) { setZoomProduto(null); restaurarFocoGrid(); } }}
        productId={zoomProduto?.codprod}
        product={zoomProduto}
      />

      {/* ========== Modal: Adicionar Produtos ========== */}
      <ModalAdicionarItemRapido
        isOpen={addItemOpen}
        onClose={() => { setAddItemOpen(false); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItens}
        itensExistentes={itensGrid.filter((i) => !i._novo).map((i) => i.codprod)}
      />

      {/* ========== Modal: Equivalentes ========== */}
      <ModalEquivalentes
        isOpen={modalEquivalentes}
        onClose={() => { setModalEquivalentes(false); setProdutoEquivalente(null); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItens}
        itensExistentes={itensGrid.map((i) => i.codprod)}
        produto={produtoEquivalente}
      />

      {/* ========== Modal: Histórico Produto ========== */}
      <ModalHistoricoProduto
        isOpen={modalHistProduto}
        onClose={() => { setModalHistProduto(false); setProdutoHist(null); restaurarFocoGrid(); }}
        produto={produtoHist}
      />

      {/* ========== Modal: Finalizar Venda ========== */}
      <ModalFinalizarVenda
        isOpen={modalFinalizar}
        onClose={() => { setModalFinalizar(false); restaurarFocoGrid(); }}
        codvenda={codvenda}
        onFinalizar={onLiberar}
        usuario={user?.usuario}
      />

      {/* ========== Modal: Pontos de Atenção ========== */}
      {data && modalAlertas ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center p-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg max-h-[60vh] flex flex-col">
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                <AlertTriangle size={18} /> Pontos de Atenção
              </h3>
              <button onClick={() => setModalAlertas(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {data.cliente.score_detalhes.length > 0 ? (
                <ul className="space-y-2">
                  {data.cliente.score_detalhes.map((detalhe, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-yellow-600" />
                      {detalhe}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center py-6 text-sm">Nenhum ponto de atenção identificado.</p>
              )}
            </div>
            <div className="px-5 py-2 border-t border-gray-200 dark:border-zinc-700 flex justify-end">
              <button onClick={() => setModalAlertas(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* AlertDialog pra confirmar exclusão de item */}
      <AlertDialog open={!!itemParaRemover} onOpenChange={(open) => { if (!open) setItemParaRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Item</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o item <b>{itemParaRemover}</b> da venda?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => {
              if (itemParaRemover) handleRemoverItem(itemParaRemover);
              setItemParaRemover(null);
            }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModalAnaliseLiberacao;
