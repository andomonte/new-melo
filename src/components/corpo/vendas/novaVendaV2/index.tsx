'use client';

import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import {
  X, Loader2, Plus, Trash2, Keyboard, User, ShoppingCart,
  CheckCircle, AlertTriangle, Search,
} from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import { AuthContext } from '@/contexts/authContexts';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { CellValueChangedEvent } from 'ag-grid-community';
import ProductZoomModal from '@/components/common/ProductZoomModal';
import ModalAdicionarItemRapido from '../bloqueadas/ModalAdicionarItemRapido';
import ModalEquivalentes from '../bloqueadas/ModalEquivalentes';
import ModalHistoricoProduto from '../bloqueadas/ModalHistoricoProduto';
import SelecionarVendedor from '../novaVenda/selectVendedor';
import SelecionarOperador from '../novaVenda/selectOperador';
import api from '@/components/services/api';

ModuleRegistry.registerModules([AllCommunityModule]);

// ===================== Tipos =====================
type Permissao = {
  cadastrar?: boolean;
  editar?: boolean;
  remover?: boolean;
  consultar?: boolean;
  grupoId: string;
  id: number;
  tb_telas: { CODIGO_TELA: number; PATH_TELA: string; NOME_TELA: string };
};

interface AuthContextProps {
  user: {
    usuario: string;
    perfil: string;
    codusr: string;
    filial: string;
    permissoes?: Permissao[];
    funcoes?: string[];
    armazens?: { value: string; label: string }[];
  } | null;
}

// ===================== Helpers =====================
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===================== Componente Principal =====================
const NovaVendaV2 = () => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;

  // ---------- Estados do cliente ----------
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [resultadosCliente, setResultadosCliente] = useState<any[]>([]);
  const [showResultadosCliente, setShowResultadosCliente] = useState(false);
  const [clienteIdx, setClienteIdx] = useState(-1);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const resultadosRef = useRef<HTMLDivElement>(null);

  // ---------- Estados do vendedor/operador ----------
  const [dadosVendedor, setDadosVendedor] = useState<any[]>([]);
  const [checkVendedor, setCheckVendedor] = useState(false);
  const [openVendedor, setOpenVendedor] = useState(false);
  const [vendedorSel, setVendedorSel] = useState<{ codigo: string; nome: string }>({ codigo: '', nome: '' });
  const [checkOperador, setCheckOperador] = useState(false);
  const [openOperador, setOpenOperador] = useState(false);
  const [operadorSel, setOperadorSel] = useState<{ codigo: string; nome: string }>({ codigo: '', nome: '' });

  // ---------- Estados do grid ----------
  const [itensGrid, setItensGrid] = useState<any[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [zoomProduto, setZoomProduto] = useState<any>(null);
  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);

  const gridRef = useRef<any>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const ultimaCelulaRef = useRef<any>(null);
  const modaisAbertosRef = useRef(false);

  // ---------- Permissões ----------
  const [userPermissions, setUserPermissions] = useState({ cadastrar: false, editar: false, remover: false });

  useEffect(() => {
    if (user?.permissoes) {
      let telaHref = sessionStorage.getItem('telaAtualMelo');
      try { telaHref = telaHref ? JSON.parse(telaHref) : null; } catch {}
      const telaPerfil = user.permissoes.find((p) => p.tb_telas?.PATH_TELA === telaHref);
      if (telaPerfil) {
        setUserPermissions({ cadastrar: telaPerfil.cadastrar || false, editar: telaPerfil.editar || false, remover: telaPerfil.remover || false });
      }
    }
  }, [user]);

  // ---------- Foco inicial no input cliente ----------
  useEffect(() => {
    setTimeout(() => clienteInputRef.current?.focus(), 200);
  }, []);

  // ---------- Carregar vendedores ----------
  useEffect(() => {
    api.post('/api/dbOracle/buscarVendedor').then((response) => {
      if (response.data) setDadosVendedor(response.data);
    }).catch(() => {});
  }, []);

  // ---------- Auto-set vendedor do usuário logado ----------
  useEffect(() => {
    if (dadosVendedor.length > 0 && vendedorSel.codigo === '' && user?.codusr) {
      const vendedorUsuario = dadosVendedor.filter(
        (val: any) => val.CODVEND === user.codusr,
      );
      if (vendedorUsuario.length) {
        setVendedorSel({ nome: vendedorUsuario[0].NOME, codigo: vendedorUsuario[0].CODVEND });
      }
    }
  }, [dadosVendedor, user, vendedorSel]);

  // ---------- Handlers vendedor/operador ----------
  const handleVendedor = useCallback((vendedor: { codigo: string; nome: string }) => {
    if (vendedor.nome !== 'fechar vendedor') {
      setVendedorSel(vendedor);
    } else {
      setCheckVendedor(false);
      // Restaura para o vendedor do usuário logado
      const vendedorUsuario = dadosVendedor.filter(
        (val: any) => val.CODVEND === user?.codusr,
      );
      if (vendedorUsuario.length) {
        setVendedorSel({ nome: vendedorUsuario[0].NOME, codigo: vendedorUsuario[0].CODVEND });
      }
    }
    setOpenVendedor(false);
  }, [dadosVendedor, user]);

  const handleOperador = useCallback((operador: { codigo: string; nome: string }) => {
    if (operador.nome !== 'fechar Operador') {
      setOperadorSel(operador);
    } else {
      setCheckOperador(false);
      setOperadorSel({ codigo: '', nome: '' });
    }
    setOpenOperador(false);
  }, []);

  // ---------- Sync modais abertos ----------
  modaisAbertosRef.current = addItemOpen || !!zoomProduto || modalEquivalentes || modalHistProduto || openVendedor || openOperador;

  // ---------- Selecionar cliente — busca crédito e atraso como tela original ----------
  const selecionarCliente = useCallback(async (cli: any) => {
    const codcli = cli.CODCLI || cli.codcli;
    const nome = cli.NOMEFANT || cli.NOME || cli.nomefant || cli.nome || '';
    const cpfcgc = cli.CPFCGC || cli.cpfcgc || '';

    setBuscaCliente(`${codcli} - ${nome}`);
    setShowResultadosCliente(false);

    let saldo = Number(cli.LIMITE_DISPONIVEL || cli.limite_disponivel || 0);
    let diasAtrasado = 0;

    try {
      const [resCredito, resAtraso] = await Promise.allSettled([
        api.post('/api/dbOracle/buscarCreditoTemp', { codcli }),
        api.post('/api/vendas/postgresql/buscarAtraso', { codcli }),
      ]);

      if (resCredito.status === 'fulfilled' && resCredito.value.data) {
        const cred = resCredito.value.data;
        const creditoTemp = Number(cred.CREDITO_DISPONIVEL || cred.credito_disponivel || 0);
        saldo += creditoTemp;
      }

      if (resAtraso.status === 'fulfilled' && resAtraso.value.data) {
        const atraso = resAtraso.value.data;
        diasAtrasado = Number(atraso.DIAS_ATRASO || atraso.dias_atraso || atraso.diasatraso || 0);
      }
    } catch {}

    setClienteSelecionado({
      codcli,
      nome: cli.NOME || cli.nome || '',
      nomefant: nome,
      cpfcgc,
      limite: Number(cli.LIMITE_TOTAL || cli.LIMITE || cli.limite || 0),
      debito: Number(cli.DEBITO_ATUAL || cli.DEBITO || cli.debito || 0),
      saldo,
      tipo: cli.TIPO || cli.tipo || '',
      tipoPreco: cli.TIPOPRECO || cli.tipopreco || '',
      codvend: cli.CODVEND || cli.codvend || '',
      claspgto: cli.CLASPGTO || cli.claspgto || '',
      diasAtrasado,
      limiteAtraso: Number(cli.ATRASO || cli.atraso || 0),
      kickback: cli.KICKBACK || cli.kickback || false,
    });

    toast({ title: `Cliente ${nome} selecionado` });
  }, [toast]);

  // ---------- Buscar cliente ----------
  // Buscar cliente — IGUAL tela original (usa /api/vendas/postgresql/buscarCliente)
  // Se número puro (até 5 dígitos): busca por código exato
  // Se texto: busca por nome, CNPJ ou código
  const buscarCliente = useCallback(async (termo: string) => {
    const t = termo.trim();
    if (t.length < 1) return;

    // Número puro até 5 dígitos: busca direta por código (igual Delphi)
    const isCodigoPuro = /^\d{1,5}$/.test(t);
    if (isCodigoPuro) {
      const codFormatado = t.padStart(5, '0');
      setLoadingCliente(true);
      try {
        const res = await api.post('/api/vendas/postgresql/buscarCliente', {
          descricao: codFormatado,
          pagina: 0,
          tamanhoPagina: 1,
        });
        const data = res.data?.data || [];
        if (data.length === 1) {
          // Encontrou direto — seleciona sem mostrar dropdown
          selecionarCliente(data[0]);
          return;
        }
        // Não encontrou — mostra dropdown
        setResultadosCliente(data);
        setShowResultadosCliente(true);
        setClienteIdx(-1);
      } catch {
        toast({ title: 'Erro ao buscar cliente', variant: 'destructive' });
      } finally {
        setLoadingCliente(false);
      }
      return;
    }

    // Texto: busca por nome/CNPJ/código (mín 3 chars)
    if (t.length < 3) return;
    setLoadingCliente(true);
    try {
      const res = await api.post('/api/vendas/postgresql/buscarCliente', {
        descricao: t,
        pagina: 0,
        tamanhoPagina: 20,
      });
      const data = res.data?.data || [];
      const campo = res.data?.campoBusca || 'nome';
      setResultadosCliente(Array.isArray(data) ? data.map((c: any) => ({ ...c, _campoBusca: campo })) : []);
      setShowResultadosCliente(true);
      setClienteIdx(-1);
    } catch {
      toast({ title: 'Erro ao buscar clientes', variant: 'destructive' });
    } finally {
      setLoadingCliente(false);
    }
  }, [toast, selecionarCliente]);

  // ---------- Restaurar foco no grid ----------
  const restaurarFocoGrid = useCallback(() => {
    setTimeout(() => {
      const a = gridRef.current?.api;
      if (!a) return;
      const fc = a.getFocusedCell();
      if (fc) a.setFocusedCell(fc.rowIndex, fc.column?.getColId?.() || 'ref');
      else if (ultimaCelulaRef.current) {
        const idx = itensGrid.findIndex((r) => r.codprod === ultimaCelulaRef.current.codprod);
        if (idx >= 0) a.setFocusedCell(idx, 'ref');
      }
    }, 100);
  }, [itensGrid]);

  // ---------- Handlers de itens ----------
  const handleAdicionarItens = useCallback((itensNovos: any[]) => {
    itensNovos.forEach((item) => {
      if (item.qtd === 0) {
        setItensGrid((prev) => prev.filter((r) => r.codprod !== item.codprod));
      } else {
        setItensGrid((prev) => {
          const idx = prev.findIndex((r) => r.codprod === item.codprod);
          if (idx >= 0) {
            const novos = [...prev];
            novos[idx] = { ...novos[idx], qtd: item.qtd, total_item: item.qtd * novos[idx].prunit };
            return novos;
          }
          return [{ ...item, _novo: true }, ...prev];
        });
      }
    });
  }, []);

  const handleRemoverItem = useCallback((codprod: string) => {
    setItensGrid((prev) => prev.filter((r) => r.codprod !== codprod));
    toast({ title: `Item ${codprod} removido.` });
  }, [toast]);

  // ---------- AG Grid helpers ----------
  const fmtMoeda = (v: any) => v != null ? `R$ ${Number(v).toFixed(2)}` : '-';
  const fmtPerc = (v: any) => v != null ? `${parseFloat(Number(v).toFixed(2))}%` : '-';

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
        if (row.prvenda_original > 0) row.desconto_percentual = ((row.prvenda_original - row.prunit) / row.prvenda_original) * 100;
      } else if (field === 'desconto_percentual') {
        const desc = Math.min(Math.max(Number(event.newValue) || 0, 0), 100);
        row.desconto_percentual = desc;
        if (row.prvenda_original > 0) {
          row.prunit = row.prvenda_original * (1 - desc / 100);
          row.total_item = row.qtd * row.prunit;
        }
      }
      novos[rowIndex] = row;
      return novos;
    });
  }, []);

  const ProdutoCellRenderer = useCallback((props: any) => {
    const d = props.data;
    if (!d) return null;
    return (
      <div style={{ lineHeight: 1.4, padding: '4px 8px', width: '100%', textAlign: 'left' }}>
        <div title={d.descr || ''} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>{d.descr || '-'}</div>
        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src={d.origem === 'N' ? '/images/brasil.png' : '/images/importado.png'} alt={d.origem === 'N' ? 'Nacional' : 'Importado'} style={{ width: 16, height: 11, objectFit: 'contain' }} />
          {d._novo ? <span style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', backgroundColor: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>NOVO</span> : null}
        </div>
      </div>
    );
  }, []);

  const DeleteItemRenderer = useCallback((props: any) => {
    const codprod = props.data?.codprod;
    if (!codprod) return null;
    return (
      <button onClick={() => handleRemoverItem(codprod)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Remover item">
        <Trash2 size={15} />
      </button>
    );
  }, [handleRemoverItem]);

  const itensColumnDefs = useMemo((): any[] => [
    { headerName: '', field: '_delete', width: 40, maxWidth: 40, sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRendererSelector: () => ({ component: DeleteItemRenderer }),
    },
    { headerName: 'Ref', field: 'ref', width: 100, cellStyle: { fontWeight: 500 } },
    { headerName: 'Produto', field: 'descr', flex: 2, minWidth: 180, autoHeight: true,
      cellStyle: { textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 0 },
      cellRendererSelector: () => ({ component: ProdutoCellRenderer }),
    },
    { headerName: 'Marca', field: 'marca_nome', flex: 1, minWidth: 80, autoHeight: true,
      cellRenderer: (p: any) => {
        const val = p.value || '-';
        return <div title={val} style={{ lineHeight: 1.3, padding: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12 }}>{val}</div>;
      },
    },
    { headerName: 'Estoque', field: 'estoque', width: 70,
      cellStyle: { fontWeight: 600, color: '#2563eb' },
    },
    { headerName: 'Preço Tabela', field: 'prvenda_original', width: 100, valueFormatter: (p: any) => fmtMoeda(p.value) },
    { headerName: 'Desc. à Vista', field: 'desconto_percentual', width: 85, editable: true,
      cellStyle: { backgroundColor: '#f5f3ff', fontWeight: 600 },
      valueParser: (p: any) => {
        const v = parseFloat(String(p.newValue).replace('%', '').replace(',', '.').trim()) || 0;
        return Math.min(Math.max(v, 0), 100);
      },
      valueFormatter: (p: any) => fmtPerc(p.value),
    },
    { headerName: 'Qtd', field: 'qtd', width: 60, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    { headerName: 'Preço Vendido', field: 'prunit', width: 100, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('R$', '').replace(',', '.').trim()) || 0,
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    { headerName: 'Total c/ Imp.', field: 'total_com_impostos', width: 100,
      cellStyle: { fontWeight: 500, color: '#6b7280' },
      valueGetter: (p: any) => {
        const d = p.data;
        if (!d) return 0;
        return Number(d.total_com_impostos || d.total_item || 0);
      },
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    { headerName: 'Subtotal', field: 'total_item', width: 100,
      cellStyle: { fontWeight: 700, color: '#16a34a' },
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
  ], []);

  // ---------- Cálculos ----------
  const totalVenda = itensGrid.reduce((acc, i) => acc + (Number(i.total_item) || 0), 0);
  const totalItens = itensGrid.length;

  // ---------- Atalhos de teclado ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (modaisAbertosRef.current) return;

      // Setas no grid
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !emInput) {
        const wrapper = gridWrapperRef.current;
        if (wrapper && wrapper.contains(e.target as Node)) {
          const a = gridRef.current?.api;
          if (!a) return;
          const focused = a.getFocusedCell();
          if (!focused) return;
          e.preventDefault(); e.stopImmediatePropagation();
          const total = a.getDisplayedRowCount();
          const col = focused.column?.getColId?.() || 'ref';
          const next = e.key === 'ArrowDown' ? Math.min(focused.rowIndex + 1, total - 1) : Math.max(focused.rowIndex - 1, 0);
          a.setFocusedCell(next, col);
          a.ensureIndexVisible(next);
          return;
        }
        return;
      }

      // Ctrl+Z zoom
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        if (emInput || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const rd = ultimaCelulaRef.current;
        if (rd) setZoomProduto({ codprod: rd.codprod, ref: rd.ref, descr: rd.descr });
        else toast({ title: 'Selecione um item na planilha' });
        return;
      }

      if (emInput) return;

      // F9 equivalentes
      if (e.key === 'F9') {
        e.preventDefault(); e.stopImmediatePropagation();
        const item = ultimaCelulaRef.current;
        if (item) {
          if (item.codgpe) { setProdutoEquivalente(item); setModalEquivalentes(true); }
          else {
            fetch(`/api/produtos/get/${item.codprod}`).then(r => r.json()).then(data => {
              const gpe = (data.codgpe || '').trim();
              if (gpe) { setProdutoEquivalente({ ...item, codgpe: gpe }); setModalEquivalentes(true); }
              else toast({ title: 'Produto sem grupo de equivalência' });
            }).catch(() => toast({ title: 'Erro ao buscar equivalência' }));
          }
        } else toast({ title: 'Selecione um item na planilha' });
        return;
      }

      // F10 histórico
      if (e.key === 'F10') {
        e.preventDefault(); e.stopImmediatePropagation();
        const item = ultimaCelulaRef.current;
        if (item) { setProdutoHist({ codprod: item.codprod, ref: item.ref, descr: item.descr }); setModalHistProduto(true); }
        else toast({ title: 'Selecione um item na planilha' });
        return;
      }

      // Ctrl++ adicionar
      if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === 'Add')) {
        e.preventDefault(); e.stopImmediatePropagation();
        setAddItemOpen(true);
        return;
      }

      // F3 vendedor
      if (e.key === 'F3') {
        e.preventDefault(); e.stopImmediatePropagation();
        setCheckVendedor(true);
        setOpenVendedor(true);
        return;
      }

      // F4 operador
      if (e.key === 'F4') {
        e.preventDefault(); e.stopImmediatePropagation();
        setCheckOperador(true);
        setOpenOperador(true);
        return;
      }
    };

    const clickHandler = (e: MouseEvent) => {
      if (modaisAbertosRef.current) return;
      const wrapper = gridWrapperRef.current;
      if (wrapper && !wrapper.contains(e.target as Node)) {
        gridRef.current?.api?.clearFocusedCell();
        ultimaCelulaRef.current = null;
      }
      // Fechar resultados cliente ao clicar fora
      if (resultadosRef.current && !resultadosRef.current.contains(e.target as Node) && clienteInputRef.current && !clienteInputRef.current.contains(e.target as Node)) {
        setShowResultadosCliente(false);
      }
    };

    window.addEventListener('keydown', handler, true);
    window.addEventListener('mousedown', clickHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('mousedown', clickHandler, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
          {/* Cabeçalho */}
          <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#347AB6] dark:text-gray-100">Nova Venda</h2>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-600">{formatCurrency(totalVenda)}</span>
                <span className="text-sm font-semibold text-gray-500">({totalItens} itens)</span>
              </div>
            </div>

            {/* Linha do cliente + vendedor + operador */}
            <div className="flex items-center gap-4 mt-2">
              {/* Busca cliente */}
              <div className="w-[50%] relative">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-gray-400 shrink-0" />
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    {clienteSelecionado ? (
                      <button onClick={() => {
                        setClienteSelecionado(null);
                        setBuscaCliente('');
                        setVendedorSel({ codigo: '', nome: '' });
                        setCheckVendedor(false);
                        setOperadorSel({ codigo: '', nome: '' });
                        setCheckOperador(false);
                        clienteInputRef.current?.focus();
                      }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10" title="Limpar cliente">
                        <X size={14} />
                      </button>
                    ) : null}
                    <input
                      ref={clienteInputRef}
                      type="text"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Se tem item focado no dropdown, seleciona
                          if (showResultadosCliente && clienteIdx >= 0 && resultadosCliente[clienteIdx]) {
                            e.preventDefault();
                            selecionarCliente(resultadosCliente[clienteIdx]);
                            return;
                          }
                          // Buscar (buscarCliente já trata mín chars internamente)
                          if (buscaCliente.trim().length >= 1) {
                            buscarCliente(buscaCliente);
                          }
                          return;
                        }
                        if (e.key === 'ArrowDown' && showResultadosCliente && resultadosCliente.length > 0) {
                          e.preventDefault();
                          setClienteIdx((prev) => Math.min(prev + 1, resultadosCliente.length - 1));
                        }
                        if (e.key === 'ArrowUp' && showResultadosCliente) {
                          e.preventDefault();
                          setClienteIdx((prev) => Math.max(prev - 1, 0));
                        }
                        if (e.key === 'Escape') setShowResultadosCliente(false);
                      }}
                      placeholder="Buscar cliente (nome, código, CNPJ ou UF) + Enter"
                      className="w-full h-9 pl-8 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate"
                    />
                    {loadingCliente ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" /> : null}

                    {/* Dropdown resultados */}
                    {showResultadosCliente && resultadosCliente.length > 0 ? (
                      <div ref={resultadosRef} className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                        {resultadosCliente.map((cli, idx) => {
                          const nome = cli.NOMEFANT || cli.NOME || '';
                          const razao = cli.NOMEFANT ? cli.NOME : '';
                          const campo = cli._campoBusca || 'nome';
                          return (
                            <div key={cli.CODCLI || idx}
                              tabIndex={0}
                              role="button"
                              className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-zinc-700 ${idx === clienteIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                              onClick={() => selecionarCliente(cli)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selecionarCliente(cli); } }}
                            >
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                <span className={campo === 'codcli' ? 'text-blue-600' : ''}>{cli.CODCLI}</span>
                                <span className="mx-1 text-gray-300">—</span>
                                <span className={campo === 'nome' ? 'text-blue-600' : ''}>{nome}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                {razao ? <span className={campo === 'nome' ? 'text-blue-500' : ''}>{razao}</span> : null}
                                {cli.CPFCGC ? <span className={campo === 'cpfcgc' ? 'text-blue-600 font-semibold' : ''}>{cli.CPFCGC}</span> : null}
                                {cli.UF ? <span className={campo === 'uf' ? 'text-blue-600 font-semibold' : ''}>{cli.CIDADE ? `${cli.CIDADE}/${cli.UF}` : cli.UF}</span> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Vendedor + Operador — 50% dividido em 2, altura total = h-9 */}
              <div className="w-[50%] flex gap-3">
                {/* Vendedor */}
                <div className="flex-1 h-9 flex flex-col justify-between px-1 py-0.5">
                  <div className="flex items-center gap-1 leading-none">
                    <input
                      type="checkbox"
                      checked={checkVendedor}
                      onChange={() => {
                        const novoCheck = !checkVendedor;
                        if (novoCheck) {
                          setOpenVendedor(true);
                        } else {
                          // Restaura vendedor do usuário logado
                          const vendedorUsuario = dadosVendedor.filter(
                            (val: any) => val.CODVEND === user?.codusr,
                          );
                          if (vendedorUsuario.length) {
                            setVendedorSel({ nome: vendedorUsuario[0].NOME, codigo: vendedorUsuario[0].CODVEND });
                          }
                        }
                        setCheckVendedor(novoCheck);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).click();
                        }
                      }}
                      className="accent-indigo-600 w-3 h-3"
                    />
                    <span className="text-[10px] font-medium text-indigo-600">Vendedor <span className="text-[8px] text-gray-400">(F3)</span></span>
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-none">
                    {vendedorSel.codigo ? `${vendedorSel.codigo} - ${vendedorSel.nome.substring(0, 30)}` : '-'}
                  </div>
                  {openVendedor ? <SelecionarVendedor handleVendedor={handleVendedor} /> : null}
                </div>

                {/* Operador */}
                <div className="flex-1 h-9 flex flex-col justify-between px-1 py-0.5">
                  <div className="flex items-center gap-1 leading-none">
                    <input
                      type="checkbox"
                      checked={checkOperador}
                      onChange={() => {
                        const novoCheck = !checkOperador;
                        setCheckOperador(novoCheck);
                        if (novoCheck) {
                          setOpenOperador(true);
                        } else {
                          setOperadorSel({ codigo: '', nome: '' });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).click();
                        }
                      }}
                      className="accent-lime-600 w-3 h-3"
                    />
                    <span className="text-[10px] font-medium text-lime-600">Operador <span className="text-[8px] text-gray-400">(F4)</span></span>
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-none">
                    {operadorSel.nome ? operadorSel.nome.substring(0, 30) : '-'}
                  </div>
                  {openOperador ? <SelecionarOperador handleOperador={handleOperador} /> : null}
                </div>
              </div>
            </div>

            {/* Info do cliente selecionado */}
            {clienteSelecionado ? (
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <span><b>Saldo:</b> <span className={Number(clienteSelecionado.saldo || clienteSelecionado.limite || 0) > 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(Number(clienteSelecionado.saldo || clienteSelecionado.limite || 0))}</span></span>
                <span><b>Limite:</b> {formatCurrency(Number(clienteSelecionado.limite || 0))}</span>
                <span><b>CNPJ/CPF:</b> {clienteSelecionado.cpfcgc || '-'}</span>
                <span><b>Tipo:</b> {clienteSelecionado.tipo || '-'}</span>
              </div>
            ) : null}
          </div>

          {/* Grid de itens */}
          <div className="flex-1 flex flex-col px-3 py-2 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <button onClick={() => setAddItemOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md">
                  <Plus size={14} /> Adicionar Item
                </button>
                <span className="text-[11px] text-gray-400">
                  {totalItens} itens | Duplo clique edita | Botão direito para mais opções
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Keyboard size={11} />
                  Ctrl+Z Zoom | F3 Vend. | F4 Oper. | F9 Equiv. | F10 Hist. | Ctrl++ Adicionar
                </span>
              </div>
            </div>

            {/* AG Grid */}
            <style>{`
              .venda-grid .ag-cell { border-right: 1px solid #d1d5db !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; }
              .venda-grid .ag-cell[col-id="descr"] { align-items: flex-start !important; justify-content: flex-start !important; padding: 0 !important; }
              .venda-grid .ag-row { border-bottom: 1px solid #d1d5db !important; background-color: white !important; }
              .venda-grid .ag-row-hover,
              .venda-grid .ag-row-selected { background-color: white !important; }
              .venda-grid .ag-row .ag-cell { background-color: white !important; }
              .venda-grid .ag-row .ag-cell[col-id="qtd"],
              .venda-grid .ag-row .ag-cell[col-id="prunit"] { background-color: #eff6ff !important; }
              .venda-grid .ag-row .ag-cell[col-id="desconto_percentual"] { background-color: #f5f3ff !important; }
              .venda-grid .ag-cell-focus { outline: 2px solid #a8a29e !important; outline-offset: -2px; background-color: rgba(0,0,0,0.05) !important; }
              .venda-grid .ag-header-cell { border-right: 1px solid #d1d5db !important; }
              .venda-grid .ag-header-cell-resize { width: 4px !important; cursor: col-resize !important; }
              .venda-grid .ag-header-cell-label { justify-content: center !important; font-size: 11px !important; text-align: center !important; }
              .venda-grid .ag-header-cell-text { text-align: center !important; width: 100% !important; }
              .venda-grid .ag-input-field-input { font-size: 13px !important; text-align: center !important; }

              .dark .venda-grid .ag-root-wrapper { background-color: #18181b !important; }
              .dark .venda-grid .ag-header { background-color: #27272a !important; border-color: #3f3f46 !important; }
              .dark .venda-grid .ag-header-cell { border-color: #3f3f46 !important; color: #a1a1aa !important; }
              .dark .venda-grid .ag-row, .dark .venda-grid .ag-row-hover, .dark .venda-grid .ag-row-selected { background-color: #18181b !important; }
              .dark .venda-grid .ag-row .ag-cell { background-color: #18181b !important; color: #e4e4e7 !important; border-color: #3f3f46 !important; }
              .dark .venda-grid .ag-row .ag-cell[col-id="qtd"],
              .dark .venda-grid .ag-row .ag-cell[col-id="prunit"] { background-color: #1e2a3a !important; }
              .dark .venda-grid .ag-row .ag-cell[col-id="desconto_percentual"] { background-color: #1e1e2e !important; }
              .dark .venda-grid .ag-cell-focus { outline-color: #71717a !important; background-color: rgba(255,255,255,0.05) !important; }
              .dark .venda-grid .ag-row { border-color: #3f3f46 !important; }
            `}</style>
            <div className="flex-1 venda-grid" ref={gridWrapperRef}>
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
                enterNavigatesVertically={true}
                enterNavigatesVerticallyAfterEdit={true}
                alwaysShowVerticalScroll={true}
                suppressHorizontalScroll={true}
                getRowId={(params: any) => params.data.codprod}
                suppressRowHoverHighlight={true}
                rowHeight={48}
              />
            </div>
          </div>

          {/* Rodapé resumo */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-sm font-semibold text-gray-500">{totalItens} itens</span>
                <span className="font-bold text-xl text-blue-600">Total: {formatCurrency(totalVenda)}</span>
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="text-xs text-gray-500">
          {ultimaCelulaRef.current ? `${ultimaCelulaRef.current.ref || ultimaCelulaRef.current.codprod}` : 'Nenhum item selecionado'}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setAddItemOpen(true)}>
          <Plus size={14} className="mr-2" /> Adicionar Item
          <span className="ml-auto text-[10px] text-gray-400">Ctrl++</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const item = ultimaCelulaRef.current;
          if (item) setZoomProduto({ codprod: item.codprod, ref: item.ref, descr: item.descr });
        }}>
          <ShoppingCart size={14} className="mr-2" /> Zoom Produto
          <span className="ml-auto text-[10px] text-gray-400">Ctrl+Z</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const item = ultimaCelulaRef.current;
          if (item) {
            fetch(`/api/produtos/get/${item.codprod}`).then(r => r.json()).then(data => {
              const gpe = (data.codgpe || '').trim();
              if (gpe) { setProdutoEquivalente({ ...item, codgpe: gpe }); setModalEquivalentes(true); }
              else toast({ title: 'Produto sem grupo de equivalência' });
            }).catch(() => toast({ title: 'Erro' }));
          }
        }}>
          Equivalentes
          <span className="ml-auto text-[10px] text-gray-400">F9</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const item = ultimaCelulaRef.current;
          if (item) { setProdutoHist(item); setModalHistProduto(true); }
        }}>
          Histórico Produto
          <span className="ml-auto text-[10px] text-gray-400">F10</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default NovaVendaV2;
