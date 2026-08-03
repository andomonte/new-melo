'use client';

import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import {
  X, Loader2, Plus, Trash2, Keyboard, ShoppingCart,
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
import ModalPrazoParcelas from '../novaVenda/prazo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  // ---------- Persistência sessionStorage ----------
  const SS_KEY = 'novaVendaV2_draft';
  const saveDraftRef = useRef<any>(null);
  const draft = useRef<any>(null);
  if (draft.current === null) {
    try { const raw = sessionStorage.getItem(SS_KEY); draft.current = raw ? JSON.parse(raw) : {}; } catch { draft.current = {}; }
  }

  // ---------- Estados do cliente ----------
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(() => draft.current?.clienteSelecionado || null);
  const [buscaCliente, setBuscaCliente] = useState(() => draft.current?.buscaCliente || '');
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [resultadosCliente, setResultadosCliente] = useState<any[]>([]);
  const [showResultadosCliente, setShowResultadosCliente] = useState(false);
  const [clienteIdx, setClienteIdx] = useState(-1);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const resultadosRef = useRef<HTMLDivElement>(null);

  // ---------- Estados do vendedor ----------
  const [vendedorSel, setVendedorSel] = useState<{ codigo: string; nome: string }>(() => draft.current?.vendedorSel || { codigo: '', nome: '' });
  const [buscaVendedor, setBuscaVendedor] = useState(() => draft.current?.buscaVendedor || '');
  const [resultadosVendedor, setResultadosVendedor] = useState<any[]>([]);
  const [showResultadosVendedor, setShowResultadosVendedor] = useState(false);
  const [vendedorIdx, setVendedorIdx] = useState(-1);
  const [loadingVendedor, setLoadingVendedor] = useState(false);
  const vendedorInputRef = useRef<HTMLInputElement>(null);
  const resultadosVendedorRef = useRef<HTMLDivElement>(null);

  // ---------- Estados do operador ----------
  const [operadorSel, setOperadorSel] = useState<{ codigo: string; nome: string }>(() => draft.current?.operadorSel || { codigo: '', nome: '' });
  const [buscaOperador, setBuscaOperador] = useState(() => draft.current?.buscaOperador || '');
  const [resultadosOperador, setResultadosOperador] = useState<any[]>([]);
  const [showResultadosOperador, setShowResultadosOperador] = useState(false);
  const [operadorIdx, setOperadorIdx] = useState(-1);
  const [loadingOperador, setLoadingOperador] = useState(false);
  const operadorInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const transpInputRef = useRef<HTMLInputElement>(null);
  const resultadosOperadorRef = useRef<HTMLDivElement>(null);

  // ---------- Estados do grid ----------
  const [itensGrid, setItensGrid] = useState<any[]>(() => draft.current?.itensGrid || []);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [zoomProduto, setZoomProduto] = useState<any>(null);
  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);

  // ---------- Estados da finalização ----------
  const [documento, setDocumento] = useState<{ COD_OPERACAO: string; DESCR: string }>(() => draft.current?.documento || { COD_OPERACAO: '', DESCR: '' });
  const [dadosDocumento, setDadosDocumento] = useState<{ COD_OPERACAO: string; DESCR: string }[]>([]);
  const [buscaDoc, setBuscaDoc] = useState('');
  const [showDoc, setShowDoc] = useState(false);
  const [docIdx, setDocIdx] = useState(0);
  const [buscaTransp, setBuscaTransp] = useState('');
  const [showTransp, setShowTransp] = useState(false);
  const [transpIdx, setTranspIdx] = useState(0);
  const [prazo, setPrazo] = useState(() => draft.current?.prazo || '');
  const [prazosArray, setPrazosArray] = useState<{ id: number; dataVencimento: Date; dias: number }[]>(() => {
    const saved = draft.current?.prazosArray;
    if (Array.isArray(saved)) return saved.map((p: any) => ({ ...p, dataVencimento: new Date(p.dataVencimento) }));
    return [];
  });
  const [openModalPrazo, setOpenModalPrazo] = useState(false);
  const [fPagamento, setFPagamento] = useState(() => draft.current?.fPagamento || '');
  const [opcoesFP, setOpcoesFP] = useState<{ id: string; descricao: string }[]>([]);
  const [transporteSel, setTransporteSel] = useState<{ CODTPTRANSP: string; DESCR: string }>(() => draft.current?.transporteSel || { CODTPTRANSP: '002', DESCR: 'CARRO (MELO)' });
  const [dadosTransporte, setDadosTransporte] = useState<{ CODTPTRANSP: string; DESCR: string }[]>([]);
  const [valTransp, setValTransp] = useState(() => draft.current?.valTransp || 'R$ 0,00');
  const [valTranspDec, setValTranspDec] = useState(() => draft.current?.valTranspDec || 0);
  const [obsFat, setObsFat] = useState(() => draft.current?.obsFat || '');
  const [pedido, setPedido] = useState(() => draft.current?.pedido || '');
  const [obs, setObs] = useState(() => draft.current?.obs || '');
  const [requisicao, setRequisicao] = useState(() => draft.current?.requisicao || '');

  const gridRef = useRef<any>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const ultimaCelulaRef = useRef<any>(null);
  const modaisAbertosRef = useRef(false);
  const navegarFocalvelRef = useRef<((d: 'next' | 'prev') => void) | null>(null);

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

  // ---------- Persistência largura colunas ----------
  const SCREEN_KEY = 'nova-venda-v2';
  const saveColTimeoutRef = useRef<any>(null);

  const salvarPrefsGrid = useCallback(() => {
    if (!user?.usuario) return;
    if (saveColTimeoutRef.current) clearTimeout(saveColTimeoutRef.current);
    saveColTimeoutRef.current = setTimeout(() => {
      const a = gridRef.current?.api;
      if (!a) return;
      const cols = a.getAllDisplayedColumns();
      const colWidths: Record<string, number> = {};
      const colOrder: string[] = [];
      cols.forEach((col: any) => {
        const id = col.getColId();
        colWidths[id] = col.getActualWidth();
        colOrder.push(id);
      });
      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.usuario, screen: SCREEN_KEY, preferences: { colWidths, colOrder } }),
      }).catch(() => {});
    }, 1000);
  }, [user]);

  const onColumnResized = useCallback((e: any) => {
    if (e.finished && e.column) salvarPrefsGrid();
  }, [salvarPrefsGrid]);

  const onColumnMoved = useCallback((e: any) => {
    if (e.finished) salvarPrefsGrid();
  }, [salvarPrefsGrid]);

  const onGridReady = useCallback(() => {
    if (!user?.usuario) return;
    fetch(`/api/userPreferences?user=${encodeURIComponent(user.usuario)}&screen=${encodeURIComponent(SCREEN_KEY)}`)
      .then(r => r.json())
      .then(data => {
        const prefs = data?.preferences;
        if (!prefs) return;
        const a = gridRef.current?.api;
        if (!a) return;

        // Restaurar ordem das colunas
        if (Array.isArray(prefs.colOrder) && prefs.colOrder.length > 0) {
          a.moveColumns(prefs.colOrder, 0);
        }

        // Restaurar larguras
        if (prefs.colWidths && typeof prefs.colWidths === 'object') {
          Object.entries(prefs.colWidths).forEach(([colId, width]) => {
            const col = a.getColumn(colId);
            if (col) a.setColumnWidths([{ key: colId, newWidth: width as number }]);
          });
        }
      })
      .catch(() => {});
  }, [user]);

  // ---------- Carregar dados de finalização ----------
  useEffect(() => {
    // Transportadoras (com dedupe)
    api.post('/api/dbOracle/buscarTransporte').then(r => {
      const rows = Array.isArray(r.data) ? r.data : [];
      const seen = new Map<string, any>();
      for (const row of rows) {
        const key = String(row.CODTPTRANSP || '').trim();
        if (key && !seen.has(key)) seen.set(key, row);
      }
      setDadosTransporte(Array.from(seen.values()));
    }).catch(() => {});
    // Formas de pagamento
    api.get('/api/vendas/fpagamento').then(r => {
      if (r.data) setOpcoesFP(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
    // Documentos (com dedupe)
    api.post('/api/dbOracle/buscarDocumento').then(r => {
      const rows = Array.isArray(r.data) ? r.data : [];
      const seen = new Map<string, any>();
      for (const row of rows) {
        const key = String(row.COD_OPERACAO || '').trim();
        if (key && !seen.has(key)) seen.set(key, row);
      }
      setDadosDocumento(Array.from(seen.values()));
    }).catch(() => {});
  }, []);

  // Filtro de documentos e transportadoras por busca
  const docsFiltrados = useMemo(() => {
    if (!buscaDoc.trim()) return dadosDocumento;
    const v = buscaDoc.toUpperCase();
    return dadosDocumento.filter(d => (d.DESCR || '').toUpperCase().includes(v) || String(d.COD_OPERACAO || '').includes(v));
  }, [dadosDocumento, buscaDoc]);

  const transpFiltrados = useMemo(() => {
    if (!buscaTransp.trim()) return dadosTransporte;
    const v = buscaTransp.toUpperCase();
    return dadosTransporte.filter(t => (t.DESCR || '').toUpperCase().includes(v) || String(t.CODTPTRANSP || '').includes(v));
  }, [dadosTransporte, buscaTransp]);

  // (isAvista, opcoesFPFiltradas movidos para depois de totalVenda)

  // ---------- Persistir draft no sessionStorage ----------
  useEffect(() => {
    if (saveDraftRef.current) clearTimeout(saveDraftRef.current);
    saveDraftRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(SS_KEY, JSON.stringify({
          clienteSelecionado, buscaCliente,
          vendedorSel, buscaVendedor,
          operadorSel, buscaOperador,
          itensGrid,
          documento, prazo, prazosArray, fPagamento,
          transporteSel, valTransp, valTranspDec,
          obsFat, pedido, obs, requisicao,
        }));
      } catch {}
    }, 500);
  }, [clienteSelecionado, buscaCliente, vendedorSel, buscaVendedor, operadorSel, buscaOperador, itensGrid, documento, prazo, prazosArray, fPagamento, transporteSel, valTransp, valTranspDec, obsFat, pedido, obs, requisicao]);

  // ---------- Foco inicial no input cliente ----------
  useEffect(() => {
    setTimeout(() => clienteInputRef.current?.focus(), 200);
  }, []);

  // ---------- Permissão EV (trocar vendedor) ----------
  const temEV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'EV');
  }, [user]);
  const temBPV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'BPV');
  }, [user]);
  const temMPV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'MPV');
  }, [user]);

  // ---------- Auto-set operador do usuário logado ----------
  useEffect(() => {
    if (user?.codusr && operadorSel.codigo === '') {
      api.post('/api/dbOracle/buscarVendedorCod', { descricao: user.codusr }).then((res) => {
        const data = res.data || [];
        const found = data.find((v: any) => v.CODVEND === user.codusr);
        if (found) {
          setOperadorSel({ codigo: found.CODVEND, nome: found.NOME });
          setBuscaOperador(`${found.CODVEND} - ${found.NOME}`);
        }
      }).catch(() => {});
    }
  }, [user]);

  // ---------- Buscar vendedor/operador (mesma API) ----------
  const buscarVendedorOperador = useCallback(async (termo: string, tipo: 'vendedor' | 'operador') => {
    if (termo.trim().length < 3) return;
    const setLoading = tipo === 'vendedor' ? setLoadingVendedor : setLoadingOperador;
    const setResultados = tipo === 'vendedor' ? setResultadosVendedor : setResultadosOperador;
    const setShow = tipo === 'vendedor' ? setShowResultadosVendedor : setShowResultadosOperador;
    const setIdx = tipo === 'vendedor' ? setVendedorIdx : setOperadorIdx;

    setLoading(true);
    try {
      const res = await api.post('/api/dbOracle/buscarVendedorCod', { descricao: termo.trim() });
      const data = res.data || [];
      setResultados(data.map((v: any) => ({ codigo: v.CODVEND, nome: v.NOME || '' })));
      setShow(true);
      setIdx(0);
    } catch {
      toast({ title: `Erro ao buscar ${tipo}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const selecionarVendedor = useCallback((v: { codigo: string; nome: string }) => {
    setVendedorSel(v);
    setBuscaVendedor(`${v.codigo} - ${v.nome}`);
    setShowResultadosVendedor(false);
    setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
  }, []);

  const selecionarOperador = useCallback((v: { codigo: string; nome: string }) => {
    setOperadorSel(v);
    setBuscaOperador(`${v.codigo} - ${v.nome}`);
    setShowResultadosOperador(false);
    setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
  }, []);

  // ---------- Sync modais abertos ----------
  modaisAbertosRef.current = addItemOpen || !!zoomProduto || modalEquivalentes || modalHistProduto;

  // Refs para dropdowns (evitar stale closures no handler global)
  const dropdownAbertoRef = useRef(false);
  dropdownAbertoRef.current = showResultadosCliente || showResultadosVendedor || showResultadosOperador || showDoc || showTransp;

  // ---------- Navegação por teclado (Tab + Setas) ----------
  const cabecalhoRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const painelFinRef = useRef<HTMLDivElement>(null);
  const COLUNAS_EDITAVEIS = useMemo(() => ['desconto_percentual', 'qtd', 'prunit'], []);

  // Coleta focáveis de um container
  const getFocaveisEm = useCallback((container: HTMLElement | null): HTMLElement[] => {
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(
      'input:not([tabindex="-1"]):not([disabled]), button:not([tabindex="-1"]):not([disabled]), select:not([tabindex="-1"]):not([disabled])'
    )).filter(el => el.offsetParent !== null);
  }, []);

  // Navega: cabeçalho → toolbar → GRID → painel → cabeçalho (ciclo)
  const navegarFocavel = useCallback((direcao: 'next' | 'prev') => {
    const a = gridRef.current?.api;
    const temItensGrid = a && a.getDisplayedRowCount() > 0;
    const active = document.activeElement as HTMLElement;

    // Descobrir em qual zona estamos
    const emCabecalho = cabecalhoRef.current?.contains(active);
    const emToolbar = toolbarRef.current?.contains(active);
    const emGrid = gridWrapperRef.current?.contains(active);
    const emPainel = painelFinRef.current?.contains(active);

    // Focáveis de cada zona
    const focCab = getFocaveisEm(cabecalhoRef.current);
    const focTb = getFocaveisEm(toolbarRef.current);
    const focPn = getFocaveisEm(painelFinRef.current);

    const entrarGrid = () => {
      if (temItensGrid) { a.setFocusedCell(0, 'ref'); return true; }
      return false;
    };
    const entrarGridFim = () => {
      if (temItensGrid) {
        const cols = a.getAllDisplayedColumns();
        const lastCol = cols[cols.length - 1]?.getColId() || 'ref';
        a.setFocusedCell(a.getDisplayedRowCount() - 1, lastCol);
        return true;
      }
      return false;
    };

    if (direcao === 'next') {
      if (emCabecalho) {
        const idx = focCab.indexOf(active);
        if (idx < focCab.length - 1) { focCab[idx + 1].focus(); return; }
        if (focTb.length > 0) { focTb[0].focus(); return; }
        if (entrarGrid()) return;
        if (focPn.length > 0) { focPn[0].focus(); return; }
        focCab[0]?.focus();
      } else if (emToolbar) {
        const idx = focTb.indexOf(active);
        if (idx < focTb.length - 1) { focTb[idx + 1].focus(); return; }
        if (entrarGrid()) return;
        if (focPn.length > 0) { focPn[0].focus(); return; }
        focCab[0]?.focus();
      } else if (emGrid) {
        if (focPn.length > 0) { focPn[0].focus(); return; }
        focCab[0]?.focus();
      } else if (emPainel) {
        const idx = focPn.indexOf(active);
        if (idx < focPn.length - 1) { focPn[idx + 1].focus(); return; }
        focCab[0]?.focus();
      } else {
        focCab[0]?.focus();
      }
    } else {
      if (emCabecalho) {
        const idx = focCab.indexOf(active);
        if (idx > 0) { focCab[idx - 1].focus(); return; }
        if (focPn.length > 0) { focPn[focPn.length - 1].focus(); return; }
        if (entrarGridFim()) return;
        if (focTb.length > 0) { focTb[focTb.length - 1].focus(); return; }
      } else if (emToolbar) {
        const idx = focTb.indexOf(active);
        if (idx > 0) { focTb[idx - 1].focus(); return; }
        focCab[focCab.length - 1]?.focus();
      } else if (emGrid) {
        if (focTb.length > 0) { focTb[focTb.length - 1].focus(); return; }
        focCab[focCab.length - 1]?.focus();
      } else if (emPainel) {
        const idx = focPn.indexOf(active);
        if (idx > 0) { focPn[idx - 1].focus(); return; }
        if (entrarGridFim()) return;
        if (focTb.length > 0) { focTb[focTb.length - 1].focus(); return; }
      }
    }
  }, [getFocaveisEm]);
  navegarFocalvelRef.current = navegarFocavel;

  // Setas dentro do grid: navega entre células, pula linha, sai do grid nos extremos
  const navigateToNextCellHandler = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, key } = params;
    if (!previousCellPosition) return nextCellPosition;
    const a = gridRef.current?.api;
    if (!a) return nextCellPosition;

    const totalRows = a.getDisplayedRowCount();
    const cols = a.getAllDisplayedColumns();
    const currentColIdx = cols.findIndex((c: any) => c.getColId() === previousCellPosition.column?.getColId());

    if (key === 'ArrowRight') {
      if (currentColIdx < cols.length - 1) {
        return { rowIndex: previousCellPosition.rowIndex, column: cols[currentColIdx + 1] };
      }
      // Última coluna: próxima linha, primeira coluna
      if (previousCellPosition.rowIndex + 1 < totalRows) {
        return { rowIndex: previousCellPosition.rowIndex + 1, column: cols[0] };
      }
      // Última célula do grid: sai para painel
      setTimeout(() => navegarFocavel('next'), 0);
      return previousCellPosition;
    }

    if (key === 'ArrowLeft') {
      if (currentColIdx > 0) {
        return { rowIndex: previousCellPosition.rowIndex, column: cols[currentColIdx - 1] };
      }
      // Primeira coluna: linha anterior, última coluna
      if (previousCellPosition.rowIndex > 0) {
        return { rowIndex: previousCellPosition.rowIndex - 1, column: cols[cols.length - 1] };
      }
      // Primeira célula do grid: sai para toolbar
      setTimeout(() => navegarFocavel('prev'), 0);
      return previousCellPosition;
    }

    if (key === 'ArrowDown') {
      if (previousCellPosition.rowIndex + 1 < totalRows) {
        return { rowIndex: previousCellPosition.rowIndex + 1, column: previousCellPosition.column };
      }
      // Última linha: sai para painel
      setTimeout(() => navegarFocavel('next'), 0);
      return previousCellPosition;
    }

    if (key === 'ArrowUp') {
      if (previousCellPosition.rowIndex > 0) {
        return { rowIndex: previousCellPosition.rowIndex - 1, column: previousCellPosition.column };
      }
      // Primeira linha: sai para toolbar
      setTimeout(() => navegarFocavel('prev'), 0);
      return previousCellPosition;
    }

    return nextCellPosition;
  }, [navegarFocavel]);

  // Tab dentro do grid: pula entre células editáveis
  const tabToNextCellHandler = useCallback((params: any) => {
    const { backwards, previousCellPosition } = params;
    const a = gridRef.current?.api;
    if (!a || !previousCellPosition) return previousCellPosition;

    const totalRows = a.getDisplayedRowCount();
    if (totalRows === 0) return previousCellPosition;

    const row = previousCellPosition.rowIndex ?? 0;
    const col = previousCellPosition.column?.getColId?.() ?? '';
    const editIdx = COLUNAS_EDITAVEIS.indexOf(col);

    if (!backwards) {
      if (editIdx >= 0 && editIdx < COLUNAS_EDITAVEIS.length - 1) {
        return { rowIndex: row, column: a.getColumn(COLUNAS_EDITAVEIS[editIdx + 1]) };
      }
      if (row + 1 < totalRows) {
        return { rowIndex: row + 1, column: a.getColumn(COLUNAS_EDITAVEIS[0]) };
      }
      // Fim do grid: vai para o painel
      setTimeout(() => navegarFocavel('next'), 0);
      return previousCellPosition;
    } else {
      if (editIdx > 0) {
        return { rowIndex: row, column: a.getColumn(COLUNAS_EDITAVEIS[editIdx - 1]) };
      }
      if (row > 0) {
        return { rowIndex: row - 1, column: a.getColumn(COLUNAS_EDITAVEIS[COLUNAS_EDITAVEIS.length - 1]) };
      }
      // Início do grid: volta pro toolbar
      setTimeout(() => navegarFocavel('prev'), 0);
      return previousCellPosition;
    }
  }, [COLUNAS_EDITAVEIS, navegarFocavel]);

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

    // Auto-set vendedor do cliente
    const codvend = cli.CODVEND || cli.codvend || '';
    if (codvend) {
      try {
        const resVend = await api.post('/api/dbOracle/buscarVendedorCod', { descricao: codvend });
        const vendedores = resVend.data || [];
        const found = vendedores.find((v: any) => v.CODVEND === codvend);
        if (found) {
          setVendedorSel({ codigo: found.CODVEND, nome: found.NOME });
          setBuscaVendedor(`${found.CODVEND} - ${found.NOME}`);
        }
      } catch {}
    }

    toast({ title: `Cliente ${nome} selecionado` });
    setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
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
        setClienteIdx(0);
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
      setClienteIdx(0);
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
      if (!a || a.getDisplayedRowCount() === 0) return;
      const fc = a.getFocusedCell();
      if (fc) { a.setFocusedCell(fc.rowIndex, fc.column?.getColId?.() || 'ref'); return; }
      if (ultimaCelulaRef.current) {
        const idx = itensGrid.findIndex((r) => r.codprod === ultimaCelulaRef.current.codprod);
        if (idx >= 0) { a.setFocusedCell(idx, 'ref'); return; }
      }
      // Fallback: focar no primeiro item
      a.setFocusedCell(0, 'ref');
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
            const descAtVista = novos[idx].desconto_percentual || 0; // preserva desc à vista existente
            novos[idx] = {
              ...novos[idx],
              qtd: item.qtd,
              prunit: item.prunit,
              prvenda_original: item.prvenda_original ?? novos[idx].prvenda_original,
              desconto_percentual: descAtVista,
              total_item: item.qtd * item.prunit * (1 - descAtVista / 100),
            };
            return novos;
          }
          return [{ ...item, _novo: true, desconto_percentual: 0 }, ...prev];
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
      } else if (field === 'prunit') {
        row.prunit = Number(event.newValue) || 0;
      } else if (field === 'desconto_percentual') {
        row.desconto_percentual = Math.min(Math.max(Number(event.newValue) || 0, 0), 2);
      }

      // Calcular preço efetivo (preço vendido - desconto à vista)
      const desc = Number(row.desconto_percentual) || 0;
      const precoEfetivo = row.prunit * (1 - desc / 100);

      // Verificar margem: preço efetivo vs custo × (1 + margem%)
      const prcompra = Number(row.prcompra) || 0;
      const isImp = row.origem !== 'N';
      const margemPerc = isImp ? 40 : 20;
      const precoMinimo = prcompra > 0 ? prcompra * (1 + margemPerc / 100) : 0;

      // Se preço efetivo ficou abaixo da margem, limitar o desconto
      if (precoMinimo > 0 && precoEfetivo < precoMinimo && desc > 0 && !temMPV) {
        // Calcular desconto máximo que mantém na margem
        const descMax = row.prunit > 0 ? ((row.prunit - precoMinimo) / row.prunit) * 100 : 0;
        row.desconto_percentual = Math.max(Math.round(descMax * 100) / 100, 0);
      }

      // Recalcular total com desconto à vista
      const descFinal = Number(row.desconto_percentual) || 0;
      row.total_item = row.qtd * row.prunit * (1 - descFinal / 100);

      novos[rowIndex] = row;
      return novos;
    });
  }, [temMPV]);

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
    { headerName: 'Estoque', field: 'estoque', width: 80, minWidth: 80,
      cellStyle: { fontWeight: 600, color: '#2563eb' },
    },
    { headerName: 'Qtd', field: 'qtd', width: 60, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    { headerName: 'Preço Tabela', field: 'prvenda_original', width: 100, valueFormatter: (p: any) => fmtMoeda(p.value) },
    { headerName: clienteSelecionado?.tipoPreco ? `Preço ${clienteSelecionado.tipoPreco}` : 'Preço Vendido', field: 'prunit', width: 110, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('R$', '').replace(',', '.').trim()) || 0,
      cellRenderer: (p: any) => {
        const prunit = Number(p.value) || 0;
        const original = Number(p.data?.prvenda_original) || 0;
        const editado = original > 0 && Math.abs(prunit - original) > 0.01;
        const abaixo = prunit < original;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {fmtMoeda(prunit)}
            {editado ? (
              <span style={{ fontSize: 10, color: abaixo ? '#dc2626' : '#16a34a' }}>{abaixo ? '▼' : '▲'}</span>
            ) : null}
          </span>
        );
      },
    },
    { headerName: 'Desc. à Vista', field: 'desconto_percentual', width: 85, editable: true, sortable: false,
      cellStyle: { backgroundColor: '#f5f3ff', fontWeight: 600 },
      valueFormatter: (p: any) => fmtPerc(p.value),
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
  ], [clienteSelecionado?.tipoPreco]);

  // ---------- Cálculos ----------
  const totalVenda = itensGrid.reduce((acc, i) => acc + (Number(i.total_item) || 0), 0);
  const totalItens = itensGrid.length;

  // Desconto à vista ativo em algum item → força "À VISTA"
  const temDescontoAvista = useMemo(() => itensGrid.some(i => (Number(i.desconto_percentual) || 0) > 0), [itensGrid]);

  // Prazo efetivo: se tem desconto à vista ou saldo insuficiente → "À VISTA"
  const isAvista = useMemo(() => {
    if (temDescontoAvista) return true;
    if (clienteSelecionado && totalVenda > 0 && (Number(clienteSelecionado.saldo || 0) - totalVenda <= 0)) return true;
    const prazoStr = String(prazo).trim().toUpperCase();
    return prazoStr === 'À VISTA' || prazoStr === 'A VISTA' || prazoStr === '0';
  }, [temDescontoAvista, clienteSelecionado, totalVenda, prazo]);

  // Filtrar formas de pagamento por prazo
  const opcoesFPFiltradas = useMemo(() => {
    if (!opcoesFP.length) return [];
    if (isAvista) {
      return opcoesFP.filter(fp => ['PIX', 'DINHEIRO', 'CARTAO DEBITO', 'CARTAO CREDITO', 'DEBITO', 'CREDITO'].some(t => fp.descricao?.toUpperCase().includes(t)));
    }
    return opcoesFP.filter(fp => !fp.descricao?.toUpperCase().includes('OUTROS'));
  }, [opcoesFP, isAvista]);

  // ---------- Atalhos de teclado ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (modaisAbertosRef.current) return;

      const dropdownAberto = dropdownAbertoRef.current;
      const estaNoGrid = gridWrapperRef.current?.contains(e.target as Node) || gridWrapperRef.current?.contains(document.activeElement as Node);

      // Tab fora do grid: usa navegarFocavel
      if (e.key === 'Tab' && !dropdownAberto && !estaNoGrid) {
        e.preventDefault();
        navegarFocavel(e.shiftKey ? 'prev' : 'next');
        return;
      }

      // ← → ↑ ↓ fora do grid: mesmo que Tab
      // Só bloqueia se input editável COM texto (cursor precisa mover)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !dropdownAberto && !estaNoGrid) {
        const inputEl = e.target as HTMLInputElement;
        const inputEditavelComTexto = emInput && !inputEl?.readOnly && (inputEl?.value || '').length > 0;
        if (inputEditavelComTexto) return;
        e.preventDefault(); e.stopImmediatePropagation();
        navegarFocavel((e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'next' : 'prev');
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

      // Ctrl+D desconto à vista em todos
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault(); e.stopImmediatePropagation();
        setItensGrid((prev) => {
          if (prev.length === 0) return prev;
          const todosAtivos = prev.every(i => (Number(i.desconto_percentual) || 0) > 0);
          return prev.map(row => {
            const novoDesc = todosAtivos ? 0 : 2;
            return { ...row, desconto_percentual: novoDesc, total_item: row.qtd * row.prunit * (1 - novoDesc / 100) };
          });
        });
        return;
      }

      // Ctrl++ adicionar (funciona mesmo em input)
      if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === 'Add')) {
        e.preventDefault(); e.stopImmediatePropagation();
        setAddItemOpen(true);
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

      // F3 vendedor
      if (e.key === 'F3') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (temEV) vendedorInputRef.current?.focus();
        else toast({ title: 'Sem permissão para trocar vendedor' });
        return;
      }

      // F4 operador
      if (e.key === 'F4') {
        e.preventDefault(); e.stopImmediatePropagation();
        operadorInputRef.current?.focus();
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
          <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-slate-900">
            {/* Linha do cliente + vendedor + operador — 3 colunas iguais */}
            <div ref={cabecalhoRef} className="flex items-start gap-3 mt-2">
              {/* Busca cliente */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Cliente</label>
                <div className="relative">
                  {clienteSelecionado ? (
                    <button onClick={() => {
                      setClienteSelecionado(null);
                      setBuscaCliente('');
                      setVendedorSel({ codigo: '', nome: '' });
                      setBuscaVendedor('');
                      clienteInputRef.current?.focus();
                    }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10" title="Limpar cliente (Enter)">
                      <X size={14} />
                    </button>
                  ) : (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    ref={clienteInputRef}
                    tabIndex={clienteSelecionado ? -1 : 0}
                    type="text"
                    value={buscaCliente}
                    readOnly={!!clienteSelecionado}
                    onChange={(e) => { if (!clienteSelecionado) setBuscaCliente(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (showResultadosCliente && clienteIdx >= 0 && resultadosCliente[clienteIdx]) {
                          e.preventDefault();
                          selecionarCliente(resultadosCliente[clienteIdx]);
                          return;
                        }
                        if (buscaCliente.trim().length >= 1) buscarCliente(buscaCliente);
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
                    placeholder="Nome, código, CNPJ ou UF"
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg ${clienteSelecionado ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate`}
                  />
                  {loadingCliente ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" /> : null}
                  {showResultadosCliente && resultadosCliente.length > 0 ? (
                    <div ref={resultadosRef} className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {resultadosCliente.map((cli, idx) => {
                        const nome = cli.NOMEFANT || cli.NOME || '';
                        const razao = cli.NOMEFANT ? cli.NOME : '';
                        const campo = cli._campoBusca || 'nome';
                        return (
                          <div key={cli.CODCLI || idx}
                            tabIndex={0} role="button"
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

              {/* Busca vendedor */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mb-0.5 block">Vendedor</label>
                <div className="relative">
                  {vendedorSel.codigo && temEV ? (
                    <button onClick={() => {
                      setVendedorSel({ codigo: '', nome: '' });
                      setBuscaVendedor('');
                      vendedorInputRef.current?.focus();
                    }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10" title="Limpar vendedor (Enter)">
                      <X size={14} />
                    </button>
                  ) : !vendedorSel.codigo ? (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : null}
                  <input
                    ref={vendedorInputRef}
                    tabIndex={vendedorSel.codigo ? -1 : 0}
                    type="text"
                    value={buscaVendedor}
                    onChange={(e) => { if (temEV && !vendedorSel.codigo) setBuscaVendedor(e.target.value); }}
                    readOnly={!temEV || !!vendedorSel.codigo}
                    onKeyDown={(e) => {
                      if (!temEV || vendedorSel.codigo) return;
                      if (e.key === 'Enter') {
                        if (showResultadosVendedor && vendedorIdx >= 0 && resultadosVendedor[vendedorIdx]) {
                          e.preventDefault();
                          selecionarVendedor(resultadosVendedor[vendedorIdx]);
                          return;
                        }
                        if (buscaVendedor.trim().length >= 3) buscarVendedorOperador(buscaVendedor, 'vendedor');
                        return;
                      }
                      if (e.key === 'ArrowDown' && showResultadosVendedor && resultadosVendedor.length > 0) {
                        e.preventDefault();
                        setVendedorIdx((prev) => Math.min(prev + 1, resultadosVendedor.length - 1));
                      }
                      if (e.key === 'ArrowUp' && showResultadosVendedor) {
                        e.preventDefault();
                        setVendedorIdx((prev) => Math.max(prev - 1, 0));
                      }
                      if (e.key === 'Escape') setShowResultadosVendedor(false);
                    }}
                    placeholder={temEV ? 'Buscar vendedor' : 'Sem permissão'}
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg ${!temEV || vendedorSel.codigo ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 truncate`}
                  />
                  {loadingVendedor ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-indigo-500" /> : null}
                  {showResultadosVendedor && resultadosVendedor.length > 0 ? (
                    <div ref={resultadosVendedorRef} className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {resultadosVendedor.map((v, idx) => (
                        <div key={v.codigo || idx}
                          tabIndex={0} role="button"
                          className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-zinc-700 text-sm font-semibold text-gray-900 dark:text-gray-100 ${idx === vendedorIdx ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onClick={() => selecionarVendedor(v)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selecionarVendedor(v); } }}
                        >
                          {v.codigo} - {v.nome}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Busca operador */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-lime-600 dark:text-lime-400 mb-0.5 block">Operador</label>
                <div className="relative">
                  {operadorSel.codigo ? (
                    <button onClick={() => {
                      setOperadorSel({ codigo: '', nome: '' });
                      setBuscaOperador('');
                      operadorInputRef.current?.focus();
                    }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10" title="Limpar operador (Enter)">
                      <X size={14} />
                    </button>
                  ) : (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    ref={operadorInputRef}
                    tabIndex={operadorSel.codigo ? -1 : 0}
                    type="text"
                    value={buscaOperador}
                    readOnly={!!operadorSel.codigo}
                    onChange={(e) => { if (!operadorSel.codigo) setBuscaOperador(e.target.value); }}
                    onKeyDown={(e) => {
                      if (operadorSel.codigo) return;
                      if (e.key === 'Enter') {
                        if (showResultadosOperador && operadorIdx >= 0 && resultadosOperador[operadorIdx]) {
                          e.preventDefault();
                          selecionarOperador(resultadosOperador[operadorIdx]);
                          return;
                        }
                        if (buscaOperador.trim().length >= 3) buscarVendedorOperador(buscaOperador, 'operador');
                        return;
                      }
                      if (e.key === 'ArrowDown' && showResultadosOperador && resultadosOperador.length > 0) {
                        e.preventDefault();
                        setOperadorIdx((prev) => Math.min(prev + 1, resultadosOperador.length - 1));
                      }
                      if (e.key === 'ArrowUp' && showResultadosOperador) {
                        e.preventDefault();
                        setOperadorIdx((prev) => Math.max(prev - 1, 0));
                      }
                      if (e.key === 'Escape') setShowResultadosOperador(false);
                    }}
                    placeholder="Buscar operador"
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg ${operadorSel.codigo ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-lime-400 truncate`}
                  />
                  {loadingOperador ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-lime-500" /> : null}
                  {showResultadosOperador && resultadosOperador.length > 0 ? (
                    <div ref={resultadosOperadorRef} className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {resultadosOperador.map((v, idx) => (
                        <div key={v.codigo || idx}
                          tabIndex={0} role="button"
                          className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-zinc-700 text-sm font-semibold text-gray-900 dark:text-gray-100 ${idx === operadorIdx ? 'bg-lime-50 dark:bg-lime-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onClick={() => selecionarOperador(v)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selecionarOperador(v); } }}
                        >
                          {v.codigo} - {v.nome}
                        </div>
                      ))}
                    </div>
                  ) : null}
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
            <div ref={toolbarRef} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <button onClick={() => setAddItemOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md">
                  <Plus size={14} /> Adicionar Item
                </button>
                <button onClick={() => {
                  setItensGrid((prev) => {
                    if (prev.length === 0) return prev;
                    const todosAtivos = prev.every(i => (Number(i.desconto_percentual) || 0) > 0);
                    return prev.map(row => {
                      const novoDesc = todosAtivos ? 0 : 2;
                      return { ...row, desconto_percentual: novoDesc, total_item: row.qtd * row.prunit * (1 - novoDesc / 100) };
                    });
                  });
                }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md ${temDescontoAvista ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-gray-300'}`}
                  title="Ativar/desativar 2% desc. à vista em todos (Ctrl+D)"
                >
                  % Desc. à Vista
                </button>
                <span className="text-[11px] text-gray-400">
                  {totalItens} itens | Duplo clique edita | Botão direito para mais opções
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Keyboard size={11} />
                  Ctrl+Z Zoom | Ctrl+D Desc. | F3 Vend. | F4 Oper. | F9 Equiv. | F10 Hist. | Ctrl++ Adicionar
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
              .venda-grid .ag-root-wrapper { border: 1px solid #d1d5db !important; }
              .venda-grid .ag-header { background-color: #f3f4f6 !important; border-bottom: 2px solid #d1d5db !important; }
              .venda-grid .ag-header-cell { border-right: 1px solid #d1d5db !important; }
              .venda-grid .ag-sort-indicator-icon { display: none !important; }
              .venda-grid .ag-sort-indicator-container { display: none !important; }
              .venda-grid .ag-header-cell:last-child { border-right: none !important; }
              .venda-grid .ag-row .ag-cell:last-child { border-right: none !important; }
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
                defaultColDef={{ sortable: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, sortingOrder: ['asc', 'desc'] }}
                onGridReady={onGridReady}
                onColumnResized={onColumnResized}
                onColumnMoved={onColumnMoved}
                onCellValueChanged={onItemCellChanged}
                onCellClicked={(e: any) => {
                  if (e.column?.getColId() === 'desconto_percentual' && e.data) {
                    const descAtual = Number(e.data.desconto_percentual) || 0;
                    const novoDesc = descAtual === 0 ? 2 : 0;
                    const rowIdx = e.rowIndex;
                    // Atualizar via API do AG Grid para não perder foco
                    e.node.setData({ ...e.data, desconto_percentual: novoDesc, total_item: e.data.qtd * e.data.prunit * (1 - novoDesc / 100) });
                    // Sync state silenciosamente
                    setItensGrid((prev) => {
                      const novos = [...prev];
                      novos[rowIdx] = { ...novos[rowIdx], desconto_percentual: novoDesc, total_item: novos[rowIdx].qtd * novos[rowIdx].prunit * (1 - novoDesc / 100) };
                      return novos;
                    });
                  }
                }}
                onCellKeyDown={(e: any) => {
                  if (e.event?.key === 'Enter' && e.column?.getColId() === '_delete' && e.data?.codprod) {
                    e.event.preventDefault();
                    e.event.stopImmediatePropagation();
                    handleRemoverItem(e.data.codprod);
                  }
                }}
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
                overlayNoRowsTemplate={'<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#9ca3af"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;opacity:0.4"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><span style="font-size:14px;font-weight:600">Carrinho vazio</span><span style="font-size:12px;margin-top:4px">Adicione itens com o botão acima ou Ctrl++</span></div>'}
                tabToNextCell={tabToNextCellHandler as any}
                navigateToNextCell={navigateToNextCellHandler as any}
                rowHeight={48}
              />
            </div>
          </div>

          {/* Painel de finalização */}
          <div ref={painelFinRef} className="shrink-0 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-4 py-3">
            {/* Linha 1: Documento, Prazo, Forma Pagamento */}
            <div className="grid grid-cols-3 gap-3">
              {/* Documento */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Documento</label>
                <div className="relative">
                  {documento.COD_OPERACAO ? (
                    <button onClick={() => {
                        setDocumento({ COD_OPERACAO: '', DESCR: '' }); setBuscaDoc('');
                        setTimeout(() => docInputRef.current?.focus(), 50);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10">
                      <X size={14} />
                    </button>
                  ) : (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input type="text"
                    ref={docInputRef}
                    tabIndex={documento.COD_OPERACAO ? -1 : 0}
                    readOnly={!!documento.COD_OPERACAO}
                    value={documento.COD_OPERACAO ? `${documento.COD_OPERACAO} - ${documento.DESCR}` : buscaDoc}
                    onChange={(e) => { setBuscaDoc(e.target.value); setShowDoc(true); setDocIdx(0); }}
                    onFocus={() => { if (!documento.COD_OPERACAO) setShowDoc(true); }}
                    onBlur={() => setTimeout(() => setShowDoc(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && showDoc && docsFiltrados.length > 0) {
                        e.preventDefault();
                        setDocumento(docsFiltrados[docIdx]);
                        setBuscaDoc('');
                        setShowDoc(false);
                        setTimeout(() => navegarFocavel('next'), 50);
                      } else if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                      if (e.key === 'ArrowDown' && showDoc) { e.preventDefault(); setDocIdx(p => Math.min(p + 1, docsFiltrados.length - 1)); }
                      if (e.key === 'ArrowUp' && showDoc) { e.preventDefault(); setDocIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowDoc(false);
                    }}
                    placeholder="Documento"
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg ${documento.COD_OPERACAO ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate`}
                  />
                  {showDoc && !documento.COD_OPERACAO && docsFiltrados.length > 0 ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {docsFiltrados.map((d, idx) => (
                        <div key={String(d.COD_OPERACAO)}
                          className={`px-3 py-1.5 cursor-pointer text-sm ${idx === docIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onMouseDown={(ev) => { ev.preventDefault(); setDocumento(d); setBuscaDoc(''); setShowDoc(false); setTimeout(() => navegarFocavel('next'), 50); }}
                        >{String(d.COD_OPERACAO)} - {d.DESCR}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Prazo */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Prazo</label>
                <div className="relative">
                  {prazo && !isAvista ? (
                    <button onClick={() => { setPrazo(''); setPrazosArray([]); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10">
                      <X size={14} />
                    </button>
                  ) : null}
                  <input type="text" readOnly
                    tabIndex={prazo ? -1 : 0}
                    value={isAvista ? 'À VISTA' : prazo || ''}
                    onFocus={() => { if (!isAvista && !prazo) setOpenModalPrazo(true); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !prazo && !isAvista) { e.preventDefault(); setOpenModalPrazo(true); } else if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                    placeholder="Definir prazo"
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg cursor-pointer ${prazo || isAvista ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} ${isAvista ? 'text-orange-600 font-semibold' : ''} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate`}
                  />
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Forma Pagamento</label>
                <div className="relative">
                  {fPagamento ? (
                    <button onClick={() => setFPagamento('')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10">
                      <X size={14} />
                    </button>
                  ) : (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <Select value={fPagamento} onValueChange={(v) => setFPagamento(v)}>
                    <SelectTrigger tabIndex={fPagamento ? -1 : 0} className={`h-9 text-sm border-gray-200 dark:border-zinc-600 rounded-lg pr-8 ${fPagamento ? 'bg-gray-100 dark:bg-zinc-900' : ''}`}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {opcoesFPFiltradas.map((fp) => (
                        <SelectItem key={fp.id} value={fp.id}>{fp.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Linha 2: Transportadora, Valor Transporte, Obs Fat, Pedido */}
            <div className="grid grid-cols-4 gap-3 mt-2">
              {/* Transportadora */}
              <div className="flex-1 relative">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Transportadora</label>
                <div className="relative">
                  {transporteSel.CODTPTRANSP ? (
                    <button onClick={() => {
                        setTransporteSel({ CODTPTRANSP: '', DESCR: '' }); setBuscaTransp('');
                        setTimeout(() => transpInputRef.current?.focus(), 50);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 hover:text-gray-600 z-10">
                      <X size={14} />
                    </button>
                  ) : (
                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input type="text"
                    ref={transpInputRef}
                    tabIndex={transporteSel.CODTPTRANSP ? -1 : 0}
                    readOnly={!!transporteSel.CODTPTRANSP}
                    value={transporteSel.CODTPTRANSP ? `${transporteSel.CODTPTRANSP} - ${transporteSel.DESCR}` : buscaTransp}
                    onChange={(e) => { setBuscaTransp(e.target.value); setShowTransp(true); setTranspIdx(0); }}
                    onFocus={() => { if (!transporteSel.CODTPTRANSP) setShowTransp(true); }}
                    onBlur={() => setTimeout(() => setShowTransp(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && showTransp && transpFiltrados.length > 0) {
                        e.preventDefault();
                        setTransporteSel(transpFiltrados[transpIdx]);
                        setBuscaTransp('');
                        setShowTransp(false);
                        setTimeout(() => navegarFocavel('next'), 50);
                      } else if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                      if (e.key === 'ArrowDown' && showTransp) { e.preventDefault(); setTranspIdx(p => Math.min(p + 1, transpFiltrados.length - 1)); }
                      if (e.key === 'ArrowUp' && showTransp) { e.preventDefault(); setTranspIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowTransp(false);
                    }}
                    placeholder="Transportadora"
                    className={`w-full h-9 pl-3 pr-8 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg ${transporteSel.CODTPTRANSP ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'bg-white dark:bg-zinc-800'} dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate`}
                  />
                  {showTransp && !transporteSel.CODTPTRANSP && transpFiltrados.length > 0 ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {transpFiltrados.map((t, idx) => (
                        <div key={t.CODTPTRANSP}
                          className={`px-3 py-1.5 cursor-pointer text-sm ${idx === transpIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onMouseDown={(ev) => { ev.preventDefault(); setTransporteSel(t); setBuscaTransp(''); setShowTransp(false); setTimeout(() => navegarFocavel('next'), 50); }}
                        >{t.CODTPTRANSP} - {t.DESCR}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Valor Transporte */}
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={valTransp}
                  onFocus={(e) => { e.target.select(); }}
                  onChange={(e) => {
                    const nums = e.target.value.replace(/\D/g, '');
                    const dec = Number(nums) / 100;
                    setValTranspDec(dec);
                    setValTransp(dec.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-400 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Valor Transporte</label>
              </div>

              {/* Obs Fat */}
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={obsFat} onChange={(e) => setObsFat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-400 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Obs. Faturamento</label>
              </div>

              {/* Pedido */}
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={pedido} onChange={(e) => setPedido(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-400 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Pedido</label>
              </div>
            </div>

            {/* Linha 3: Obs + Requisição */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={obs} onChange={(e) => setObs(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-400 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Observação</label>
              </div>
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={requisicao} onChange={(e) => setRequisicao(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-400 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Requisição</label>
              </div>
            </div>

            {/* Modal Prazo */}
            {openModalPrazo ? (
              <ModalPrazoParcelas
                onClose={() => setOpenModalPrazo(false)}
                dadosIniciais={prazosArray.length > 0 ? prazosArray : undefined}
                onConfirm={(novosPrazos: any[]) => {
                  setPrazosArray(novosPrazos);
                  if (novosPrazos.length > 0) {
                    setPrazo(novosPrazos.map((p: any) => p.dias).join(' '));
                  } else {
                    setPrazo('');
                  }
                  setOpenModalPrazo(false);
                }}
              />
            ) : null}

            {/* Linha final: Totais + Saldo + Botões */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-500">{totalItens} itens</span>
                <span className="font-bold text-xl text-blue-600">Total: {formatCurrency(totalVenda)}</span>
                {clienteSelecionado ? (
                  <>
                    <span className="text-xs text-gray-500">Saldo: <span className={Number(clienteSelecionado.saldo || 0) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatCurrency(Number(clienteSelecionado.saldo || 0))}</span></span>
                    <span className="text-xs text-gray-500">Pós venda: <span className={Number(clienteSelecionado.saldo || 0) - totalVenda > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatCurrency(Number(clienteSelecionado.saldo || 0) - totalVenda)}</span></span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={totalItens === 0 || !clienteSelecionado}
                  className="px-4 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Salvar Orçamento
                </button>
                <button
                  disabled={totalItens === 0 || !clienteSelecionado}
                  className="px-4 py-1.5 text-xs font-bold rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Finalizar Venda
                </button>
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

      {/* Modais */}
      <ModalAdicionarItemRapido
        isOpen={addItemOpen}
        onClose={() => { setAddItemOpen(false); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItens}
        itensExistentes={itensGrid.map((i) => i.codprod)}
      />

      {zoomProduto ? (
        <ProductZoomModal
          open={!!zoomProduto}
          onOpenChange={(open) => { if (!open) { setZoomProduto(null); restaurarFocoGrid(); } }}
          productId={zoomProduto.codprod}
        />
      ) : null}

      {modalEquivalentes && produtoEquivalente ? (
        <ModalEquivalentes
          isOpen={modalEquivalentes}
          onClose={() => { setModalEquivalentes(false); setProdutoEquivalente(null); restaurarFocoGrid(); }}
          onAdicionarItens={handleAdicionarItens}
          itensExistentes={itensGrid.map((i) => i.codprod)}
          produto={produtoEquivalente}
        />
      ) : null}

      {modalHistProduto && produtoHist ? (
        <ModalHistoricoProduto
          isOpen={modalHistProduto}
          onClose={() => { setModalHistProduto(false); setProdutoHist(null); restaurarFocoGrid(); }}
          produto={produtoHist}
        />
      ) : null}
    </ContextMenu>
  );
};

export default NovaVendaV2;
