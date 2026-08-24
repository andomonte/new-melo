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
import ModalAdicionarItemRapido from '../bloqueadas/ModalAdicionarItemRapido';
import ModalEquivalentes from '../bloqueadas/ModalEquivalentes';
import ModalHistoricoProduto from '../bloqueadas/ModalHistoricoProduto';
import ModalPrazoParcelas from '../novaVenda/prazo';
import { calcularIBSCBS as calcImposto } from '@/lib/calc_engine_ibs_cbs';
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

// Classes Material Input (label flutuante)
const MI_INPUT = 'peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 !pr-9 font-sans text-sm font-normal text-gray-900 dark:text-white outline outline-0 transition-all focus:border-blue-500 focus:border-2 dark:focus:border-blue-400 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400';
const MI_LABEL = 'text-gray-900 dark:text-white before:content-[" "] after:content-[" "] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-bold leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-600 dark:peer-placeholder-shown:text-gray-300 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-blue-600 dark:peer-focus:text-blue-400 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-blue-500 dark:peer-focus:before:border-blue-400 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-blue-500 dark:peer-focus:after:border-blue-400';
const MI_BTN = 'absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 hover:text-gray-900 z-10';

// ===================== Editor de Moeda (AG Grid v36 — reactiveCustomComponents) =====================
const CurrencyEditor = ({ value, onValueChange, stopEditing }: any) => {
  const [digits, setDigits] = React.useState('');
  const pristineRef = React.useRef(true);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!pristineRef.current) {
      onValueChange(parseInt(digits || '0', 10) / 100);
    }
  }, [digits, onValueChange]);

  React.useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const numVal = pristineRef.current ? (Number(value) || 0) : parseInt(digits || '0', 10) / 100;
  const display = numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <input ref={inputRef} value={display}
      onChange={() => {}}
      onKeyDown={(e) => {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault(); e.stopPropagation();
          if (pristineRef.current) { pristineRef.current = false; setDigits(e.key); }
          else { setDigits(prev => (prev + e.key).replace(/^0+/, '') || '0'); }
        } else if (e.key === 'Backspace') {
          e.preventDefault(); e.stopPropagation();
          if (pristineRef.current) { pristineRef.current = false; setDigits('0'); }
          else { setDigits(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault(); e.stopPropagation();
          stopEditing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          stopEditing(true);
        } else {
          e.preventDefault();
        }
      }}
      style={{ width: '100%', height: '100%', textAlign: 'center', fontSize: 13, fontWeight: 600, border: 0, outline: 'none', background: 'transparent' }}
    />
  );
};

// ===================== Componente Principal =====================
const NovaVendaV2 = ({ onSaved }: { onSaved?: () => void }) => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as AuthContextProps;

  // ---------- Persistência sessionStorage ----------
  const draftIdRef = useRef<string | null>(null);
  const SS_KEY = `novaVendaV2_draft_${user?.usuario || 'anon'}`;
  const saveDraftRef = useRef<any>(null);
  const draft = useRef<any>(null);
  if (draft.current === null) {
    try {
      sessionStorage.removeItem('novaVendaV2_draft');
      const raw = sessionStorage.getItem(SS_KEY);
      draft.current = raw ? JSON.parse(raw) : {};
      // Restaurar draftId se veio de um orçamento existente
      if (draft.current?.draftId) draftIdRef.current = draft.current.draftId;
    } catch { draft.current = {}; }
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

  // ---------- Backup para restaurar no Escape após double-click ----------
  const prevInputRef = useRef<{
    armazem?: any; cliente?: any; buscaCliente?: string;
    vendedor?: any; buscaVendedor?: string;
    operador?: any; buscaOperador?: string;
    prazo?: string; prazosArray?: any[];
    fPagamento?: string;
    transporteSel?: any;
  }>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  const startEdit = useCallback((field: string, backup: Record<string, any>) => {
    prevInputRef.current = { ...prevInputRef.current, ...backup };
    setEditingField(field);
  }, []);

  // Limpar editingField quando o valor é selecionado novamente
  useEffect(() => {
    if (!editingField) return;
    if (editingField === 'armazem' && selectedArmazem) setEditingField(null);
    if (editingField === 'cliente' && clienteSelecionado) setEditingField(null);
    if (editingField === 'vendedor' && vendedorSel.codigo) setEditingField(null);
    if (editingField === 'operador' && operadorSel.codigo) setEditingField(null);
    if (editingField === 'prazo' && prazo) setEditingField(null);
    if (editingField === 'fPagamento' && fPagamento) setEditingField(null);
    if (editingField === 'transportadora' && transporteSel.CODTPTRANSP) setEditingField(null);
  });

  const cancelEdit = useCallback(() => {
    const prev = prevInputRef.current;
    if (!editingField) return;
    if (editingField === 'armazem' && prev.armazem !== undefined) setSelectedArmazem(prev.armazem);
    if (editingField === 'cliente' && prev.cliente !== undefined) { setClienteSelecionado(prev.cliente); setBuscaCliente(prev.buscaCliente || ''); }
    if (editingField === 'vendedor' && prev.vendedor !== undefined) { setVendedorSel(prev.vendedor); setBuscaVendedor(prev.buscaVendedor || ''); }
    if (editingField === 'operador' && prev.operador !== undefined) { setOperadorSel(prev.operador); setBuscaOperador(prev.buscaOperador || ''); }
    if (editingField === 'prazo' && prev.prazo !== undefined) { setPrazo(prev.prazo); setPrazosArray(prev.prazosArray || []); }
    if (editingField === 'fPagamento' && prev.fPagamento !== undefined) setFPagamento(prev.fPagamento);
    if (editingField === 'transportadora' && prev.transporteSel !== undefined) setTransporteSel(prev.transporteSel);
    setEditingField(null);
  }, [editingField]);

  // ---------- Armazém ----------
  const armazens = useMemo(() => (user?.armazens || []).map((a: any) => ({ value: String(a.id_armazem ?? a.value ?? ''), label: String(a.nome ?? a.label ?? 'Sem armazém') })), [user]);
  const [selectedArmazem, setSelectedArmazem] = useState<{ value: string; label: string } | null>(() => draft.current?.selectedArmazem || null);

  // Auto-selecionar primeiro armazém
  useEffect(() => {
    if (!selectedArmazem && armazens.length > 0) setSelectedArmazem(armazens[0]);
  }, [armazens, selectedArmazem]);

  // ---------- Estados do grid ----------
  const [itensGrid, setItensGrid] = useState<any[]>(() => draft.current?.itensGrid || []);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [zoomProduto, setZoomProduto] = useState<any>(null);
  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);

  // ---------- Estados da finalização ----------
  const [documento, setDocumento] = useState<{ COD_OPERACAO: string; DESCR: string }>(() => draft.current?.documento || { COD_OPERACAO: '1', DESCR: 'VENDA' });
  const [tipoMovimentacao, setTipoMovimentacao] = useState(() => draft.current?.tipoMovimentacao || 'SAIDA');
  const [tipoOperacao, setTipoOperacao] = useState(() => draft.current?.tipoOperacao || 'VENDA');
  const [showTipoMov, setShowTipoMov] = useState(false);
  const [buscaTipoMov, setBuscaTipoMov] = useState('');
  const [tipoMovIdx, setTipoMovIdx] = useState(0);
  const [showTipoOp, setShowTipoOp] = useState(false);
  const [buscaTipoOp, setBuscaTipoOp] = useState('');
  const [tipoOpIdx, setTipoOpIdx] = useState(0);

  // Opções de movimentação (fixas — só SAIDA e ENTRADA)
  const OPCOES_TIPO_MOV = [
    { value: 'SAIDA', label: 'SAÍDA' },
    { value: 'ENTRADA', label: 'ENTRADA' },
  ];

  // Opções de operação carregadas do banco, filtradas por tipo de movimentação
  const [todasOperacoes, setTodasOperacoes] = useState<{ value: string; label: string; tipo_movimentacao: string }[]>([]);
  useEffect(() => {
    api.get('/api/tipoOperacaoFiscal?perPage=100').then(r => {
      const rows = r.data?.data || [];
      setTodasOperacoes(rows.filter((o: any) => o.ativo).map((o: any) => ({
        value: o.codigo,
        label: o.descricao,
        tipo_movimentacao: o.tipo_movimentacao,
      })));
    }).catch(() => {});
  }, []);

  const OPCOES_TIPO_OP = useMemo(() =>
    todasOperacoes.filter(o => o.tipo_movimentacao === tipoMovimentacao),
  [todasOperacoes, tipoMovimentacao]);

  const tipoMovFiltrados = useMemo(() => {
    if (!buscaTipoMov.trim()) return OPCOES_TIPO_MOV;
    const v = buscaTipoMov.toUpperCase();
    return OPCOES_TIPO_MOV.filter(o => o.label.toUpperCase().includes(v));
  }, [buscaTipoMov]);

  const tipoOpFiltrados = useMemo(() => {
    if (!buscaTipoOp.trim()) return OPCOES_TIPO_OP;
    const v = buscaTipoOp.toUpperCase();
    return OPCOES_TIPO_OP.filter(o => o.label.toUpperCase().includes(v) || o.value.toUpperCase().includes(v));
  }, [buscaTipoOp, OPCOES_TIPO_OP]);

  // Quando muda tipo de movimentação, resetar operação pro primeiro da lista
  useEffect(() => {
    if (OPCOES_TIPO_OP.length > 0 && !OPCOES_TIPO_OP.some(o => o.value === tipoOperacao)) {
      setTipoOperacao(OPCOES_TIPO_OP[0].value);
    }
  }, [OPCOES_TIPO_OP, tipoOperacao]);

  // Mapear tipoOperacao → COD_OPERACAO do documento automaticamente
  useEffect(() => {
    const cod = tipoOperacao === 'VENDA' ? '1' : tipoOperacao.charAt(0);
    const label = OPCOES_TIPO_OP.find(o => o.value === tipoOperacao)?.label || tipoOperacao;
    setDocumento({ COD_OPERACAO: cod, DESCR: label });
  }, [tipoOperacao, OPCOES_TIPO_OP]);
  const [dadosDocumento, setDadosDocumento] = useState<{ COD_OPERACAO: string; DESCR: string }[]>([]);
  const [buscaDoc, setBuscaDoc] = useState('');
  const [showDoc, setShowDoc] = useState(false);
  const [docIdx, setDocIdx] = useState(0);
  const [buscaTransp, setBuscaTransp] = useState('');
  const [showTransp, setShowTransp] = useState(false);
  const [transpIdx, setTranspIdx] = useState(0);
  const [buscaFP, setBuscaFP] = useState('');
  const [showFP, setShowFP] = useState(false);
  const [fpIdx, setFpIdx] = useState(0);
  const fpInputRef = useRef<HTMLInputElement>(null);
  const [prazo, setPrazo] = useState(() => draft.current?.prazo || '');
  const [prazosArray, setPrazosArray] = useState<{ id: number; dataVencimento: Date; dias: number }[]>(() => {
    const saved = draft.current?.prazosArray;
    if (Array.isArray(saved)) return saved.map((p: any) => ({ ...p, dataVencimento: new Date(p.dataVencimento) }));
    return [];
  });
  const [openModalPrazo, setOpenModalPrazo] = useState(false);
  const [opcoesPrazo, setOpcoesPrazo] = useState<{ prazo: string; dias: number[]; qtdParcelas: number }[]>([]);
  const [buscaPrazo, setBuscaPrazo] = useState('');
  const prazoOpcoesFiltradas = useMemo(() => {
    if (!buscaPrazo.trim()) return opcoesPrazo;
    const v = buscaPrazo.toUpperCase();
    return opcoesPrazo.filter(op => op.prazo.includes(v) || String(op.qtdParcelas).includes(v));
  }, [buscaPrazo, opcoesPrazo]);
  const [showPrazoDropdown, setShowPrazoDropdown] = useState(false);
  const [prazoIdx, setPrazoIdx] = useState(0);
  const [fPagamento, setFPagamento] = useState(() => draft.current?.fPagamento || '');
  const [opcoesFP, setOpcoesFP] = useState<{ id: string; descricao: string }[]>([]);
  const [parcelasCartao, setParcelasCartao] = useState<number>(() => draft.current?.parcelasCartao || 0);
  const [showParcelasDropdown, setShowParcelasDropdown] = useState(false);
  const [parcelasIdx, setParcelasIdx] = useState(0);
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

  const prefsCarregadasRef = useRef(false);
  const restaurarPrefsGrid = useCallback(() => {
    if (!user?.usuario || prefsCarregadasRef.current) return;
    fetch(`/api/userPreferences?user=${encodeURIComponent(user.usuario)}&screen=${encodeURIComponent(SCREEN_KEY)}`)
      .then(r => r.json())
      .then(data => {
        const prefs = data?.preferences;
        if (!prefs) return;
        const a = gridRef.current?.api;
        if (!a) return;
        prefsCarregadasRef.current = true;

        // Restaurar ordem das colunas
        if (Array.isArray(prefs.colOrder) && prefs.colOrder.length > 0) {
          try { a.moveColumns(prefs.colOrder, 0); } catch {}
        }

        // Restaurar larguras
        if (prefs.colWidths && typeof prefs.colWidths === 'object') {
          Object.entries(prefs.colWidths).forEach(([colId, width]) => {
            try { a.setColumnWidths([{ key: colId, newWidth: width as number }]); } catch {}
          });
        }
      })
      .catch(() => {});
  }, [user]);

  const onGridReady = useCallback(() => {
    setTimeout(() => restaurarPrefsGrid(), 300);
  }, [restaurarPrefsGrid]);

  // Reaplicar larguras quando columnDefs mudam (ex: troca de cliente muda header)
  useEffect(() => {
    if (prefsCarregadasRef.current) {
      prefsCarregadasRef.current = false;
      setTimeout(() => restaurarPrefsGrid(), 300);
    }
  }, [clienteSelecionado?.tipoPreco, restaurarPrefsGrid]);

  // ---------- Carregar dados de finalização ----------
  useEffect(() => {
    // Parâmetros
    api.get('/api/parametros/get?chave=prazo_validade_orcamento').then(r => {
      if (r.data?.valor) setPrazoValidadeMax(Number(r.data.valor) || 10);
    }).catch(() => {});
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
      const fp = r.data?.data || r.data;
      if (Array.isArray(fp)) setOpcoesFP(fp);
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

  // (isAvista, opcoesFPFiltradas, fpFiltradosPorBusca movidos para depois de totalVenda)

  // ---------- Persistir draft no sessionStorage ----------
  const vendaSalvaRef = useRef(false);
  useEffect(() => {
    if (vendaSalvaRef.current) return; // Não persistir após salvar/finalizar
    if (saveDraftRef.current) clearTimeout(saveDraftRef.current);
    saveDraftRef.current = setTimeout(() => {
      if (vendaSalvaRef.current) return;
      try {
        sessionStorage.setItem(SS_KEY, JSON.stringify({
          selectedArmazem, clienteSelecionado, buscaCliente,
          vendedorSel, buscaVendedor,
          operadorSel, buscaOperador,
          itensGrid,
          documento, prazo, prazosArray, fPagamento,
          transporteSel, valTransp, valTranspDec,
          obsFat, pedido, obs, requisicao,
          tipoMovimentacao, tipoOperacao, parcelasCartao,
        }));
      } catch {}
    }, 500);
  }, [selectedArmazem, clienteSelecionado, buscaCliente, vendedorSel, buscaVendedor, operadorSel, buscaOperador, itensGrid, documento, prazo, prazosArray, fPagamento, transporteSel, valTransp, valTranspDec, obsFat, pedido, obs, requisicao, tipoMovimentacao, tipoOperacao, parcelasCartao]);

  // ---------- Completar dados do cliente se veio do draft ----------
  useEffect(() => {
    if (clienteSelecionado?.codcli && !clienteSelecionado.cpfcgc) {
      // Cliente veio do draft sem dados completos — buscar
      api.post('/api/vendas/postgresql/buscarCliente', { descricao: clienteSelecionado.codcli, pagina: 0, tamanhoPagina: 1 })
        .then(res => {
          const data = res.data?.data || [];
          if (data.length > 0) {
            const cli = data[0];
            setClienteSelecionado((prev: any) => ({
              ...prev,
              cpfcgc: cli.CPFCGC || cli.cpfcgc || '',
              tipo: cli.TIPO || cli.tipo || '',
              limite: Number(cli.LIMITE_TOTAL || cli.LIMITE || cli.limite || 0),
              debito: Number(cli.DEBITO_ATUAL || cli.DEBITO || cli.debito || 0),
              saldo: Number(cli.LIMITE_DISPONIVEL || cli.limite_disponivel || 0),
              tipoPreco: (['BALCÃO','ZFM','INTERIOR','ALC','AMAZ. OCIDENTAL','FORA ESTADO','FORA ESTADO VAREJO','RORAIMA'][Number(cli.PRVENDA || cli.prvenda || 0)] || ''),
              codvend: cli.CODVEND || cli.codvend || prev?.codvend || '',
              diasAtrasado: 0,
              limiteAtraso: Number(cli.ATRASO || cli.atraso || 0),
              kickback: cli.KICKBACK || cli.kickback || false,
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  // ---------- Foco inicial no input cliente ----------
  useEffect(() => {
    setTimeout(() => clienteInputRef.current?.focus(), 200);
  }, []);

  // ---------- Permissão EV (trocar vendedor) ----------
  const temPVO = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'PVO');
  }, [user]);
  const [prazoValidadeMax, setPrazoValidadeMax] = useState(10);

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
  const temTMO = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'TMO');
  }, [user]);
  const temRIV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'RIV');
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

  // ---------- Buscar vendedor/operador (mesma API, com debounce) ----------
  const buscaVendOpRef = useRef<any>(null);
  const buscarVendedorOperador = useCallback((termo: string, tipo: 'vendedor' | 'operador') => {
    if (buscaVendOpRef.current) clearTimeout(buscaVendOpRef.current);
    buscaVendOpRef.current = setTimeout(() => buscarVendedorOperadorExec(termo, tipo), 300);
  }, []);
  const buscarVendedorOperadorExec = useCallback(async (termo: string, tipo: 'vendedor' | 'operador') => {
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
  modaisAbertosRef.current = addItemOpen || !!zoomProduto || modalEquivalentes || modalHistProduto || confirmDeleteAll;

  // Refs para dropdowns (evitar stale closures no handler global)
  const dropdownAbertoRef = useRef(false);
  dropdownAbertoRef.current = showResultadosCliente || showResultadosVendedor || showResultadosOperador || showDoc || showTransp || showPrazoDropdown || showFP || showTipoMov || showTipoOp || showParcelasDropdown;

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
      tipoPreco: (['BALCÃO','ZFM','INTERIOR','ALC','AMAZ. OCIDENTAL','FORA ESTADO','FORA ESTADO VAREJO','RORAIMA'][Number(cli.PRVENDA || cli.prvenda || 0)] || ''),
      prvenda: String(cli.PRVENDA || cli.prvenda || '0'),
      codvend: cli.CODVEND || cli.codvend || '',
      claspgto: cli.CLASPGTO || cli.claspgto || '',
      statusCli: cli.STATUS || cli.status || '1',
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

    // Atualizar preços dos itens do carrinho para o tipo de preço do novo cliente
    const prvenda = cli.PRVENDA || cli.prvenda || '0';
    atualizarPrecosCarrinho(prvenda);

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

  // ---------- Salvar Orçamento ----------
  const [salvarOpen, setSalvarOpen] = useState(false);
  const [salvarStep, setSalvarStep] = useState<'validade' | 'montando' | 'enviando' | 'ok' | 'erro'>('validade');
  const [salvarMsg, setSalvarMsg] = useState('');
  const [salvarResp, setSalvarResp] = useState<any>(null);
  const [diasValidade, setDiasValidade] = useState('10');

  const handleSalvarOrcamento = useCallback(async () => {
    if (temPVO) {
      // Com permissão PVO: mostra modal para definir prazo
      setSalvarOpen(true);
      setSalvarStep('validade');
      setDiasValidade(String(prazoValidadeMax));
      setSalvarMsg('');
    } else {
      // Sem PVO: salva direto com prazo padrão da tabela
      setDiasValidade(String(prazoValidadeMax));
      setSalvarOpen(true);
      executarSalvarOrcamento();
    }
  }, [temPVO, prazoValidadeMax]);

  const executarSalvarOrcamento = useCallback(async () => {
    setSalvarStep('montando');
    setSalvarMsg('Preparando os dados do orçamento...');

    const codcliSalvar = clienteSelecionado?.codcli || clienteSelecionado?.CODCLI || '';
    if (!codcliSalvar) { setSalvarStep('erro'); setSalvarMsg('Selecione pelo menos um cliente.'); console.error('[SalvarOrc] clienteSelecionado:', clienteSelecionado); return; }
    if (itensGrid.length === 0) { setSalvarStep('erro'); setSalvarMsg('Carrinho vazio.'); return; }

    try {
      const prazosPayload = prazosArray.map((p: any) => ({ data: p.dataVencimento, dia: Number(p.dias) }));
      const armId = Number(selectedArmazem?.value) || 1;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Math.min(Math.max(parseInt(diasValidade) || prazoValidadeMax, 1), prazoValidadeMax));

      const payload = {
        draft_id: draftIdRef.current || undefined,
        expires_at: expiresAt.toISOString(),
        header: {
          operacao: Number(documento?.COD_OPERACAO) || 1,
          codcli: String(clienteSelecionado?.codcli || clienteSelecionado?.CODCLI || ''),
          codusr: Number(user?.codusr) || 0,
          pedido: pedido || '',
          tipo: 'P',
          tele: operadorSel?.nome ? 'S' : 'N',
          transp: transporteSel?.DESCR || '',
          codtptransp: transporteSel?.CODTPTRANSP ? Number(transporteSel.CODTPTRANSP) : null,
          vlrfrete: valTranspDec || 0,
          prazo: prazo || '',
          obs: obs || '',
          obsfat: obsfatTexto || obsFat || '',
          bloqueada: '0',
          estoque_virtual: 'N',
          uName: user?.usuario || '',
          nomecf: clienteSelecionado.nomefant || clienteSelecionado.nome || null,
          vendedor: vendedorSel?.codigo || null,
          vendedorNome: vendedorSel?.nome || null,
          operador: operadorSel?.codigo || null,
          operadorNome: operadorSel?.nome || null,
          arm_id: armId,
          formaPagamento: fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || fPagamento) : null,
          parcelasCartao: isCartaoCredito ? (parcelasCartao > 0 ? parcelasCartao : 1) : null,
          avista: isAvista,
          avistaMotivo: isAvista ? avistaMotivo : null,
          requisicao: requisicao || '',
          statusVenda: 'VENDA LIBERADA',
          draft_id: draftIdRef.current || undefined,
        },
        itens: itensGrid.map((it: any) => ({
          codprod: it.codprod, ref: it.ref, descr: it.descr,
          qtd: it.qtd, quantidade: it.qtd, prunit: it.prunit, precoItemEditado: it.prunit,
          prvenda_original: it.prvenda_original, desconto: it.desconto_percentual || 0,
          total_item: it.total_item, prcompra: it.prcompra || 0,
          codmarca: it.codmarca || '', marca_nome: it.marca_nome || '', origem: it.origem || 'N',
          estoque: it.estoque || 0, arm_id: armId, ...(it.campos_fiscais || {}),
        })),
        prazos: prazosPayload,
      };

      setSalvarStep('enviando');
      setSalvarMsg('Salvando orçamento...');

      const resp = await fetch('/api/vendas/salvar-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (!resp.ok) { setSalvarStep('erro'); setSalvarMsg(data?.error || 'Falha ao salvar.'); return; }

      if (data?.draft_id) draftIdRef.current = data.draft_id;
      setSalvarResp(data);
      setSalvarStep('ok');
      setSalvarMsg('');
    } catch (err: any) {
      setSalvarStep('erro');
      setSalvarMsg(err?.message || 'Erro ao salvar orçamento');
    }
  }, [clienteSelecionado, itensGrid, prazosArray, documento, user, pedido, transporteSel, valTranspDec, prazo, obs, obsFat, vendedorSel, operadorSel, fPagamento, requisicao, diasValidade]);

  // ---------- Finalizar Venda ----------
  const [envioOpen, setEnvioOpen] = useState(false);
  const [envioStep, setEnvioStep] = useState<'montando' | 'enviando' | 'ok' | 'erro'>('montando');
  const [envioMsg, setEnvioMsg] = useState('');
  const [envioResp, setEnvioResp] = useState<any>(null);

  const handleFinalizarVenda = useCallback(async () => {
    setEnvioOpen(true);
    setEnvioStep('montando');
    setEnvioMsg('Preparando os dados para envio...');

    if (!(clienteSelecionado?.codcli || clienteSelecionado?.CODCLI)) { setEnvioStep('erro'); setEnvioMsg('INFORME O CLIENTE'); return; }
    if (clienteBloqueado) { setEnvioStep('erro'); setEnvioMsg('O CLIENTE ESTÁ BLOQUEADO, CONSULTE O SETOR DE COBRANÇA.'); return; }
    if (itensGrid.length === 0) { setEnvioStep('erro'); setEnvioMsg('ESCOLHA PRODUTOS!'); return; }
    if (itensGrid.length > 500) { setEnvioStep('erro'); setEnvioMsg('JÁ EXISTEM 500 ITENS SELECIONADOS PARA ESTA VENDA'); return; }
    // Se cartão e parcelas não definida, auto-setar 1x (timing do useEffect pode não ter executado)
    const parcelasEfetivas = isCartaoCredito ? (parcelasCartao > 0 ? parcelasCartao : 1) : 0;
    if (isCartaoCredito && parcelasEfetivas <= 0) { setEnvioStep('erro'); setEnvioMsg('INFORME O PARCELAMENTO DO CARTÃO'); return; }
    if (isClienteBalcao && totalVenda > 10000) { setEnvioStep('erro'); setEnvioMsg('CLIENTE BALCÃO. LIMITE DE 10.000,00 EXCEDIDO.'); return; }
    if (isClienteBalcao && !isAvista && !isCartaoCredito) { setEnvioStep('erro'); setEnvioMsg('CLIENTE BALCÃO. PAGAMENTO SOMENTE À VISTA OU C. CRÉDITO.'); return; }

    try {
      const prazosPayload = prazosArray.map((p: any) => ({ data: p.dataVencimento, dia: Number(p.dias) }));
      const armId = Number(selectedArmazem?.value) || 1;
      const temPrecoAbaixo = !temBPV && !temMPV && itensGrid.some(i => { const p = Number(i.prunit) || 0; const o = Number(i.prvenda_original) || 0; return o > 0 && p < o - 0.01; });
      const bloqueada = temPrecoAbaixo ? 'S' : '0';

      const payload = {
        header: {
          operacao: Number(documento?.COD_OPERACAO) || 1,
          codcli: String(clienteSelecionado?.codcli || clienteSelecionado?.CODCLI || ''),
          codusr: Number(user?.codusr) || 0,
          pedido: pedido || '',
          tipo: 'P',
          tele: operadorSel?.nome ? 'S' : 'N',
          transp: transporteSel?.DESCR || '',
          codtptransp: transporteSel?.CODTPTRANSP ? Number(transporteSel.CODTPTRANSP) : null,
          vlrfrete: valTranspDec || 0,
          prazo: prazo || '',
          obs: obs || '',
          obsfat: obsfatTexto || obsFat || '',
          bloqueada,
          estoque_virtual: 'N',
          uName: user?.usuario || '',
          nomecf: clienteSelecionado.nomefant || clienteSelecionado.nome || null,
          vendedor: vendedorSel?.codigo || null,
          operador: operadorSel?.codigo || null,
          formaPagamento: fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || fPagamento) : null,
          parcelasCartao: isCartaoCredito ? (parcelasCartao > 0 ? parcelasCartao : 1) : null,
          avista: isAvista,
          avistaMotivo: isAvista ? avistaMotivo : null,
          requisicao: requisicao || '',
          tipo_movimentacao: tipoMovimentacao,
          tipo_operacao: tipoOperacao,
        },
        itens: itensGrid.map((it: any, idx: number) => ({
          codprod: it.codprod,
          qtd: it.qtd,
          prunit: it.prunit,
          arm_id: armId,
          ref: it.ref || '',
          descr: it.descr || '',
          desconto: it.desconto_percentual || 0,
          codvend: vendedorSel?.codigo || null,
          codoperador: operadorSel?.codigo || null,
          nritem: it.nritem || String(idx + 1),
          nrequis: it.nrequis || '',
          demanda: it.demanda || 'S',
          qtdpnd: it.qtdpnd || 0,
          ...(it.promoAtiva && it.promocao ? {
            id_promocao_item: it.promocao.id_promocao_item,
            promocao_id: it.promocao.id_promocao,
            promoQty: it.qtd,
            quantidade_promocional: it.qtd,
          } : {}),
          ...(it.campos_fiscais || {}),
        })),
        prazos: prazosPayload,
      };

      // Validações
      if (payload.itens.some((i: any) => !i.arm_id || i.arm_id <= 0)) {
        setEnvioStep('erro'); setEnvioMsg('Defina o armazém de todos os itens.'); return;
      }
      if (payload.itens.some((i: any) => i.qtd <= 0 || i.prunit <= 0)) {
        setEnvioStep('erro'); setEnvioMsg('Quantidade e preço unitário devem ser > 0.'); return;
      }

      setEnvioStep('enviando');
      setEnvioMsg('Enviando venda para o servidor...');

      const resp = await api.post('/api/vendas/postgresql/finalizarVenda', payload);
      const data = resp.data;

      if (data?.ok) {
        setEnvioStep('ok');
        setEnvioResp(data);
        setEnvioMsg(`Venda salva: Nº ${data.nrovenda} (status ${data.status}).`);
        // Limpar draft
        try { Object.keys(sessionStorage).forEach(k => { if (k.startsWith('novaVendaV2_draft')) sessionStorage.removeItem(k); }); } catch {}
        if (draftIdRef.current) draftIdRef.current = null;
      } else {
        setEnvioStep('erro');
        setEnvioMsg(data?.error || 'Falha ao finalizar venda.');
      }
    } catch (err: any) {
      setEnvioStep('erro');
      setEnvioMsg(err?.response?.data?.error || err?.message || 'Erro ao finalizar venda');
    }
  }, [clienteSelecionado, itensGrid, prazosArray, documento, user, pedido, transporteSel, valTranspDec, prazo, obs, obsFat, vendedorSel, operadorSel, fPagamento, requisicao, temBPV, temMPV]);

  // ---------- Calcular impostos de um item ----------
  const calcularImpostoItem = useCallback(async (item: any) => {
    const codcli = clienteSelecionado?.codcli || '';
    if (!codcli || !item.codprod) return item;
    try {
      const result = await calcImposto({
        codProd: item.codprod,
        codCli: codcli,
        quantidade: item.qtd,
        valorUnitario: item.prunit,
        tipoMovimentacao: tipoMovimentacao,
        tipoOperacao: tipoOperacao,
        tipoFatura: 'NOTA_FISCAL',
        zerarSubstituicao: 'N',
        usarAuto: true,
      });
      return {
        ...item,
        impostos: result.impostosRs,
        total_com_impostos: result.impostosRs?.totalComImpostos || item.total_item,
        campos_fiscais: result.raw?.campos || {},
      };
    } catch {
      return item;
    }
  }, [clienteSelecionado]);

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
            const descAtVista = novos[idx].desconto_percentual || 0;
            novos[idx] = {
              ...novos[idx],
              qtd: item.qtd,
              prunit: item.prunit,
              prvenda_original: item.prvenda_original ?? novos[idx].prvenda_original,
              desconto_percentual: descAtVista,
              total_item: item.qtd * item.prunit * (1 - descAtVista / 100),
              demanda: item.demanda ?? novos[idx].demanda ?? 'S',
              qtdpnd: item.qtdpnd ?? novos[idx].qtdpnd ?? 0,
              promocao: item.promocao ?? novos[idx].promocao ?? null,
              promoAtiva: item.promoAtiva ?? novos[idx].promoAtiva ?? false,
            };
            return novos;
          }
          return [{ ...item, _novo: true, desconto_percentual: 0, demanda: item.demanda ?? 'S', qtdpnd: item.qtdpnd ?? 0, promocao: item.promocao ?? null, promoAtiva: item.promoAtiva ?? false }, ...prev];
        });
        // Calcular impostos em background
        if (clienteSelecionado?.codcli) {
          calcularImpostoItem(item).then(itemComImposto => {
            setItensGrid((prev) => prev.map(r => r.codprod === item.codprod ? { ...r, impostos: itemComImposto.impostos, total_com_impostos: itemComImposto.total_com_impostos, campos_fiscais: itemComImposto.campos_fiscais } : r));
          });
        }
      }
    });
  }, [clienteSelecionado, calcularImpostoItem]);

  // Atualizar preços dos itens do carrinho por tipo de preço + recalcular impostos
  const atualizarPrecosCarrinho = useCallback((tipoPreco: string) => {
    setItensGrid((prev) => {
      if (prev.length === 0) return prev;
      const codprods = prev.map(i => i.codprod);
      api.post('/api/vendas/postgresql/atualizarPrecos', { codprods, tipoPreco })
        .then(res => {
          const precos = res.data?.precos || {};
          setItensGrid(p => {
            const atualizados = p.map(item => {
              const novoPreco = Number(precos[item.codprod]) || 0;
              if (novoPreco > 0) {
                const desc = Number(item.desconto_percentual) || 0;
                return { ...item, prvenda_original: novoPreco, prunit: novoPreco, total_item: item.qtd * novoPreco * (1 - desc / 100) };
              }
              return item;
            });
            // Recalcular impostos com os novos preços
            atualizados.forEach(item => {
              calcularImpostoItem(item).then(imp => {
                setItensGrid(pr => pr.map(r => r.codprod === item.codprod ? { ...r, impostos: imp.impostos, total_com_impostos: imp.total_com_impostos, campos_fiscais: imp.campos_fiscais } : r));
              });
            });
            return atualizados;
          });
        })
        .catch(() => {});
      return prev;
    });
  }, [calcularImpostoItem]);

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
        let novoPreco = Number(event.newValue) || 0;
        // Nunca negativo
        if (novoPreco < 0) novoPreco = 0;
        // Regra de margem: sem MPV, corrige para o mínimo da margem
        if (!temMPV) {
          const prcompra = Number(row.prcompra) || 0;
          const isImp = row.origem !== 'N';
          const margemPerc = isImp ? 40 : 20;
          const precoMinimo = prcompra > 0 ? prcompra * (1 + margemPerc / 100) : Number(row.prvenda_original) || 0;
          if (precoMinimo > 0 && novoPreco < precoMinimo) {
            novoPreco = precoMinimo;
          }
        }
        row.prunit = novoPreco;
      } else if (field === 'desconto_percentual') {
        row.desconto_percentual = Math.min(Math.max(Number(event.newValue) || 0, 0), 2);
      }

      // Promoção e desconto à vista são mutuamente exclusivos
      if (row.promoAtiva && row.promocao) {
        if (field === 'desconto_percentual') {
          // Aplicou desconto → desativa promo e volta preço original
          row.promoAtiva = false;
          row.prunit = Number(row.prvenda_original) || row.prunit;
        } else if (field === 'prunit') {
          // Editou preço → desativa promo (preço já é o novo digitado)
          row.promoAtiva = false;
        }
      }
      if (row.desconto_percentual > 0 && row.promoAtiva) {
        // Segurança: nunca ter os dois ativos ao mesmo tempo
        row.promoAtiva = false;
        row.prunit = Number(row.prvenda_original) || row.prunit;
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
    // Recalcular impostos em background após edição de qtd ou preço
    if ((field === 'qtd' || field === 'prunit') && clienteSelecionado?.codcli) {
      const rowData = event.data;
      if (rowData) {
        const qtd = field === 'qtd' ? (Number(event.newValue) || 0) : rowData.qtd;
        const prunit = field === 'prunit' ? (Number(event.newValue) || 0) : rowData.prunit;
        calcularImpostoItem({ ...rowData, qtd, prunit }).then(itemComImposto => {
          setItensGrid(prev => prev.map(r => r.codprod === rowData.codprod ? { ...r, impostos: itemComImposto.impostos, total_com_impostos: itemComImposto.total_com_impostos, campos_fiscais: itemComImposto.campos_fiscais } : r));
        });
      }
    }
  }, [temMPV, clienteSelecionado, calcularImpostoItem]);

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
      headerComponent: () => (
        <button onClick={() => { if (itensGrid.length > 0) setConfirmDeleteAll(true); }}
          className="p-0.5 text-red-400 hover:text-red-600" title="Remover todos os itens">
          <Trash2 size={14} />
        </button>
      ),
    },
    { headerName: 'Ref', field: 'ref', width: 100, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
    },
    { headerName: 'Promo', field: 'promoAtiva', width: 65, minWidth: 50, sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
      cellRenderer: (p: any) => {
        if (!p.data?.promocao) return null;
        const ativa = p.data?.promoAtiva;
        return (
          <span title={ativa ? `${p.data.promocao.nome_promocao || 'Promoção'} — clique para desativar` : 'Promoção desativada — clique para ativar'}
            className={`inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold rounded-full ${ativa ? 'text-white bg-green-500' : 'text-gray-400 bg-gray-200 dark:bg-zinc-700'}`}>
            P
          </span>
        );
      },
    },
    { headerName: 'Produto', field: 'descr', flex: 2, minWidth: 150, autoHeight: true,
      editable: temRIV,
      cellStyle: temRIV
        ? { textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 0, backgroundColor: '#dbeafe' }
        : { textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 0 },
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
    { headerName: 'Preço Tabela', field: 'prvenda_original', width: 100, valueFormatter: (p: any) => (Number(p.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { headerName: clienteSelecionado?.tipoPreco ? `Preço ${clienteSelecionado.tipoPreco}` : 'Preço Vendido', field: 'prunit', width: 110, editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      cellEditor: CurrencyEditor,
      cellRenderer: (p: any) => {
        const prunit = Number(p.value) || 0;
        const original = Number(p.data?.prvenda_original) || 0;
        const editado = original > 0 && Math.abs(prunit - original) > 0.01;
        const abaixo = prunit < original;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {prunit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
      cellRenderer: (p: any) => {
        const d = p.data;
        if (!d) return '-';
        const imp = d.impostos;
        const val = Number(d.total_com_impostos || d.total_item || 0);
        const title = imp ? `ICMS: R$ ${(imp.valorICMS || 0).toFixed(2)}\nIPI: R$ ${(imp.valorIPI || 0).toFixed(2)}\nST: R$ ${(imp.valorICMS_Subst || 0).toFixed(2)}\nPIS: R$ ${(imp.valorPIS || 0).toFixed(2)}\nCOFINS: R$ ${(imp.valorCOFINS || 0).toFixed(2)}\nTotal Imp: R$ ${(imp.valorImpostos || 0).toFixed(2)}` : '';
        return <span title={title} style={{ cursor: imp ? 'help' : 'default' }}>{fmtMoeda(val)}</span>;
      },
    },
    { headerName: 'Subtotal', field: 'total_item', width: 100,
      cellStyle: { fontWeight: 700, color: '#16a34a' },
      valueFormatter: (p: any) => (Number(p.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    },
  ], [clienteSelecionado?.tipoPreco, temRIV]);

  // ---------- Cálculos ----------
  const totalVenda = itensGrid.reduce((acc, i) => acc + (Number(i.total_item) || 0), 0);
  const totalItens = itensGrid.length;

  // Desconto à vista ativo em algum item → força "À VISTA"
  const temDescontoAvista = useMemo(() => itensGrid.some(i => (Number(i.desconto_percentual) || 0) > 0), [itensGrid]);
  const todosDescontoAvista = useMemo(() => itensGrid.length > 0 && itensGrid.every(i => (Number(i.desconto_percentual) || 0) > 0), [itensGrid]);

  // Buscar opções de prazo quando totalVenda muda
  const prazoFetchRef = useRef<any>(null);
  useEffect(() => {
    if (prazoFetchRef.current) clearTimeout(prazoFetchRef.current);
    if (totalVenda <= 0) { setOpcoesPrazo([]); return; }
    prazoFetchRef.current = setTimeout(() => {
      api.post('/api/vendas/tabelaPrazos', { valor: totalVenda })
        .then(r => { if (r.data?.opcoes) setOpcoesPrazo(r.data.opcoes); })
        .catch(() => {});
    }, 500);
  }, [totalVenda]);

  // Classe de pagamento do cliente (V, D, Z = forçar à vista)
  const claspgto = useMemo(() => String(clienteSelecionado?.claspgto || '').trim().toUpperCase(), [clienteSelecionado]);
  // Validação financeira via API (equivalente REGRAS_VENDAS.SUBMETER_REGRA do Oracle)
  const [restricaoFinanceira, setRestricaoFinanceira] = useState<{ passou: string; mensagem: string; status?: string } | null>(null);
  const validarCreditoRef = useRef<any>(null);
  const clienteAnteriorRef = useRef<string | null>(null);
  useEffect(() => {
    if (validarCreditoRef.current) clearTimeout(validarCreditoRef.current);
    const codcliAtual = clienteSelecionado?.codcli || clienteSelecionado?.CODCLI || null;
    if (!codcliAtual) { setRestricaoFinanceira(null); clienteAnteriorRef.current = null; return; }
    // Só limpa imediatamente quando TROCA de cliente, não quando muda valor/forma
    if (codcliAtual !== clienteAnteriorRef.current) {
      setRestricaoFinanceira(null);
      clienteAnteriorRef.current = codcliAtual;
    }
    validarCreditoRef.current = setTimeout(() => {
      const codcli = clienteSelecionado.codcli || clienteSelecionado.CODCLI;
      api.post('/api/vendas/postgresql/validarCredito', {
        codcli,
        valorSolicitado: totalVenda,
        formaPagamento: fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || fPagamento) : '',
      }).then(r => {
        setRestricaoFinanceira(r.data);
      }).catch(() => setRestricaoFinanceira(null));
    }, 300);
  }, [clienteSelecionado, totalVenda, fPagamento]);

  const clienteBloqueado = restricaoFinanceira?.passou === 'NOK';
  const clienteTempAvista = useMemo(() => String(clienteSelecionado?.statusCli || '').trim() === '4', [clienteSelecionado]);
  const isClienteBalcao = useMemo(() => String(clienteSelecionado?.codcli || '').trim() === '99999', [clienteSelecionado]);

  // À vista forçado: classe V/D, desconto à vista
  // Z = cobrança judicial (bloqueia, não força à vista)
  // I = inativo (bloqueia, não força à vista)
  const avistaForcado = useMemo(() => {
    if (!clienteSelecionado) return false;
    if (temDescontoAvista) return true;
    if (['V', 'D'].includes(claspgto)) return true;
    if (clienteTempAvista) return true;
    return false;
  }, [temDescontoAvista, clienteSelecionado, claspgto, clienteTempAvista]);

  // Motivo do à vista forçado (para montar obsfat no padrão Delphi)
  const avistaMotivo = useMemo(() => {
    if (!clienteSelecionado) return '';
    if (claspgto === 'Z') return 'Z';
    if (claspgto === 'V') return 'V';
    if (claspgto === 'D') return 'D';
    if (clienteTempAvista) return 'V'; // status 4 = temp à vista, usa (V)
    return 'VE'; // vendedor escolheu
  }, [clienteSelecionado, claspgto, clienteTempAvista]);

  // À vista determinado pela FORMA DE PAGAMENTO (não pelo prazo)
  const isAvista = useMemo(() => {
    if (avistaForcado) return true;
    if (!fPagamento) return false;
    const desc = (opcoesFP.find(f => f.id === fPagamento)?.descricao || '').toUpperCase();
    return desc.includes('DINHEIRO') || desc.includes('PIX') || desc.includes('DEBITO') || desc.includes('DÉBITO');
  }, [avistaForcado, fPagamento, opcoesFP]);

  // Auto-set transportadora "CLIENTE RETIRA" para classe V (sem status 4)
  useEffect(() => {
    if (claspgto === 'V' && !clienteTempAvista) {
      setTransporteSel({ CODTPTRANSP: '001', DESCR: 'CLIENTE RETIRA' });
    }
  }, [claspgto, clienteTempAvista]);

  // ---------- Cartão de crédito ----------
  const isCartaoCredito = useMemo(() => {
    if (!fPagamento) return false;
    const desc = (opcoesFP.find(f => f.id === fPagamento)?.descricao || '').toUpperCase();
    return desc.includes('CREDITO') || desc.includes('CRÉDITO');
  }, [fPagamento, opcoesFP]);

  // ---------- Boleto ----------
  const isBoleto = useMemo(() => {
    if (!fPagamento) return false;
    const desc = (opcoesFP.find(f => f.id === fPagamento)?.descricao || '').toUpperCase();
    return desc.includes('BOLETO');
  }, [fPagamento, opcoesFP]);

  // Prazo bloqueado por regra do cliente — independente da forma de pagamento
  // Usa dados do cliente direto, não a resposta da API (que varia conforme forma)
  const saldoCliente = useMemo(() => {
    if (!clienteSelecionado) return 0;
    return Number(clienteSelecionado.saldo || 0);
  }, [clienteSelecionado]);

  const prazoBloqueado = useMemo(() => {
    if (!clienteSelecionado) return false;
    if (avistaForcado) return true; // classe V/D, desconto à vista
    if (totalVenda > 0 && saldoCliente < totalVenda) return true; // sem crédito pra prazo
    return false;
  }, [clienteSelecionado, avistaForcado, totalVenda, saldoCliente]);

  const prazoBloqueadoMsg = useMemo(() => {
    if (!clienteSelecionado) return '';
    if (['V', 'D'].includes(claspgto)) return `Cliente à vista obrigatório (${claspgto})`;
    if (temDescontoAvista) return 'Desconto à vista aplicado';
    if (totalVenda > 0 && saldoCliente < totalVenda) return 'Sem crédito para prazo';
    return '';
  }, [clienteSelecionado, claspgto, temDescontoAvista, restricaoFinanceira]);

  // Prazo desabilitado: por regra, por fechamento na semana, ou por forma que não é boleto
  const prazoDesabilitado = useMemo(() => {
    if (prazoBloqueado) return true;
    if (prazo === 'FECHAMENTO NA SEMANA') return true;
    // Se tem forma selecionada e NÃO é boleto → prazo desabilitado (à vista)
    if (fPagamento && !isBoleto) return true;
    return false;
  }, [prazoBloqueado, prazo, fPagamento, isBoleto]);

  // Forma de pagamento controla o prazo:
  // - Boleto → ativa prazo (usuário escolhe)
  // - Qualquer outra (dinheiro, pix, débito, crédito) → prazo = "À VISTA", limpa prazos
  // - Fechamento na semana → limpa forma de pagamento
  useEffect(() => {
    if (!fPagamento) return;
    if (isBoleto) {
      // Boleto: prazo fica livre para o usuário escolher
      return;
    }
    // Qualquer outra forma: limpa prazo (é à vista)
    if (prazo && prazo !== 'FECHAMENTO NA SEMANA') {
      setPrazo(''); setPrazosArray([]);
    }
  }, [fPagamento, isBoleto]);

  // Cliente precisa solicitar crédito (saldo insuficiente + prazo não é à vista + NÃO é cartão)
  const precisaCreditoExtra = useMemo(() => {
    if (!clienteSelecionado || totalVenda <= 0) return false;
    if (isCartaoCredito) return false; // cartão não consome limite de crédito
    return Number(clienteSelecionado.saldo || 0) - totalVenda < 0 && !isAvista;
  }, [clienteSelecionado, totalVenda, isAvista, isCartaoCredito]);

  // Formas de pagamento visíveis: DINHEIRO, PIX, DÉBITO, CRÉDITO + BOLETO (só se cliente tem crédito para prazo)
  const opcoesFPFiltradas = useMemo(() => {
    if (!opcoesFP.length) return [];
    return opcoesFP.filter(fp => {
      const d = (fp.descricao || '').toUpperCase();
      if (d.includes('BOLETO')) return !prazoBloqueado; // Boleto só para quem pode comprar a prazo
      return d.includes('DINHEIRO') || d === 'PIX' || d.includes('DEBITO') || d.includes('DÉBITO') || d.includes('CREDITO') || d.includes('CRÉDITO');
    });
  }, [opcoesFP, prazoBloqueado]);

  // Forma de pagamento travada quando já tem prazo definido (não pode mudar FP depois de definir prazo)
  const fpTravadoBoleto = useMemo(() => {
    if (!prazo || prazo === 'FECHAMENTO NA SEMANA') return false;
    return isBoleto && prazosArray.length > 0;
  }, [prazo, isBoleto, prazosArray]);

  const fpFiltradosPorBusca = useMemo(() => {
    if (!buscaFP.trim()) return opcoesFPFiltradas;
    const v = buscaFP.toUpperCase();
    return opcoesFPFiltradas.filter(fp => (fp.descricao || '').toUpperCase().includes(v));
  }, [opcoesFPFiltradas, buscaFP]);

  // ---------- Cartão de crédito ----------

  const maxParcelasCartao = useMemo(() => {
    if (!isCartaoCredito || totalVenda <= 0) return 1;
    return Math.max(1, Math.min(10, Math.floor(totalVenda / 100)));
  }, [isCartaoCredito, totalVenda]);

  // Reset parcelas quando muda forma de pagamento ou excede max
  useEffect(() => {
    if (!isCartaoCredito) { setParcelasCartao(0); return; }
    if (parcelasCartao === 0) setParcelasCartao(1);
    if (parcelasCartao > maxParcelasCartao) setParcelasCartao(maxParcelasCartao);
  }, [isCartaoCredito, maxParcelasCartao]);

  const totalComAcrescimo = totalVenda;

  // Texto do obsfat montado automaticamente (mesmo padrão Delphi)
  const obsfatTexto = useMemo(() => {
    const fpDesc = fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || '') : '';
    const fpUpper = fpDesc.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (isCartaoCredito && parcelasCartao > 0) {
      return `CARTAO DE CREDITO ${String(parcelasCartao).padStart(2, '0')}x`;
    }
    if (isAvista) {
      const motivo = avistaMotivo || 'VE';
      if (motivo === 'Z') return 'A VISTA (Z) - DINHEIRO';
      return `A VISTA (${motivo})`;
    }
    if (prazo === 'FECHAMENTO NA SEMANA') return 'FECHAMENTO NA SEMANA';
    if (isBoleto && prazo) return `BOLETO ${prazo}`;
    if (isBoleto) return 'BOLETO';
    if (fpDesc) return fpDesc;
    return '';
  }, [fPagamento, opcoesFP, isCartaoCredito, parcelasCartao, isAvista, avistaMotivo, isBoleto, prazo]);

  // ---------- Status da venda ----------
  const statusVenda = useMemo(() => {
    if (!clienteSelecionado || totalItens === 0) return 'RASCUNHO';

    // Bloqueio financeiro: cliente com atraso ou sem crédito (cartão isenta)
    if (!isCartaoCredito) {
      const diasAtraso = Number(clienteSelecionado.diasAtrasado || 0);
      const limAtraso = Number(clienteSelecionado.limiteAtraso || 0);
      if (diasAtraso > 0 && diasAtraso > limAtraso) return 'BLOQUEIO_FINANCEIRO';
    }

    // Bloqueio por preço: sem BPV e sem MPV, algum item com preço abaixo da tabela
    if (!temBPV && !temMPV) {
      const temPrecoEditado = itensGrid.some(i => {
        const prunit = Number(i.prunit) || 0;
        const original = Number(i.prvenda_original) || 0;
        return original > 0 && prunit < original - 0.01;
      });
      if (temPrecoEditado) return 'BLOQUEIO_PRECO';
    }

    return 'LIBERADA';
  }, [clienteSelecionado, totalItens, itensGrid, temBPV, temMPV]);

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

  // Toggle promoção: ativa → aplica desconto (zera desc à vista), desativa → volta preço original
  const togglePromo = (e: any) => {
    const novoEstado = !e.data.promoAtiva;
    const promo = e.data.promocao;
    const precoOriginal = Number(e.data.prvenda_original) || Number(e.data.prunit);
    let novoPreco = precoOriginal;
    let novoDesconto = Number(e.data.desconto_percentual) || 0;

    if (novoEstado && promo) {
      // Ativando promoção: aplica desconto da promoção + zera desconto à vista
      const tipo = (promo.tipo_desconto_item || promo.tipo_desconto || '').toUpperCase();
      const valor = Number(promo.valor_desconto_item ?? promo.valor_desconto) || 0;
      if (tipo.includes('PERC')) {
        novoPreco = precoOriginal * (1 - valor / 100);
      } else {
        novoPreco = Math.max(precoOriginal - valor, 0);
      }
      novoDesconto = 0; // Promoção e desconto à vista são mutuamente exclusivos
    }

    const totalItem = (Number(e.data.qtd) || 0) * novoPreco * (1 - novoDesconto / 100);
    const updated = { ...e.data, promoAtiva: novoEstado, prunit: novoPreco, desconto_percentual: novoDesconto, total_item: totalItem };
    e.node.setData(updated);
    setItensGrid((prev: any[]) => prev.map((r, i) => i === e.rowIndex ? { ...r, ...updated } : r));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="nova-venda-v2 h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
          {/* Mensagem de status */}
          {statusVenda === 'BLOQUEIO_PRECO' ? (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">Venda bloqueada por preço — O preço de um ou mais itens foi alterado abaixo da tabela. A venda será enviada para análise de desbloqueio.</span>
            </div>
          ) : statusVenda === 'BLOQUEIO_FINANCEIRO' ? (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span className="text-sm font-semibold text-red-800 dark:text-red-200">Cliente com restrição financeira — O cliente possui atraso acima do limite permitido. A venda será salva como orçamento com solicitação de crédito.</span>
            </div>
          ) : null}

          {/* Cabeçalho */}
          <div className="px-3 py-3 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-slate-900">
            {/* Linha do armazém + cliente + vendedor + operador */}
            <div ref={cabecalhoRef} className="flex items-start gap-3">
              {/* Armazém */}
              <div className="w-[15%] relative min-w-[100px]">
                  {!selectedArmazem ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input type="text" readOnly tabIndex={0}
                    value={selectedArmazem ? selectedArmazem.label : ''}
                    onFocus={() => { if (!selectedArmazem && armazens.length === 1) { setSelectedArmazem(armazens[0]); } }}
                    onDoubleClick={() => { if (selectedArmazem) { startEdit('armazem', { armazem: selectedArmazem }); setSelectedArmazem(null); } }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingField === 'armazem') { e.preventDefault(); cancelEdit(); return; }
                      if (selectedArmazem) { if (e.key === 'Enter') { e.preventDefault(); startEdit('armazem', { armazem: selectedArmazem }); setSelectedArmazem(null); } else navegarFocavel('next'); return; }
                      if (e.key === 'ArrowDown' && armazens.length > 0) {
                        e.preventDefault();
                        setSelectedArmazem(armazens[0]);
                      }
                      if (e.key === 'Enter' && armazens.length > 0) {
                        e.preventDefault();
                        setSelectedArmazem(armazens[0]);
                        setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
                      }
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${selectedArmazem ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : 'cursor-pointer'}`}
                  />
                  <label className={MI_LABEL}>Armazém</label>
              </div>

              {/* Busca cliente */}
              <div className="flex-1 relative min-w-[200px]">
                  {!clienteSelecionado ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input ref={clienteInputRef} tabIndex={0} type="text"
                    value={buscaCliente} readOnly={!!clienteSelecionado}
                    onChange={(e) => { if (!clienteSelecionado) { setBuscaCliente(e.target.value); setShowResultadosCliente(false); setResultadosCliente([]); } }}
                    onDoubleClick={() => { if (clienteSelecionado) { startEdit('cliente', { cliente: clienteSelecionado, buscaCliente, vendedor: vendedorSel, buscaVendedor }); setClienteSelecionado(null); setBuscaCliente(''); setVendedorSel({ codigo: '', nome: '' }); setBuscaVendedor(''); atualizarPrecosCarrinho('0'); } }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingField === 'cliente') { e.preventDefault(); cancelEdit(); return; }
                      if (e.key === 'Enter') {
                        if (clienteSelecionado) { e.preventDefault(); startEdit('cliente', { cliente: clienteSelecionado, buscaCliente, vendedor: vendedorSel, buscaVendedor }); setClienteSelecionado(null); setBuscaCliente(''); setVendedorSel({ codigo: '', nome: '' }); setBuscaVendedor(''); atualizarPrecosCarrinho('0'); return; }
                        if (showResultadosCliente && clienteIdx >= 0 && resultadosCliente[clienteIdx]) { e.preventDefault(); selecionarCliente(resultadosCliente[clienteIdx]); return; }
                        if (buscaCliente.trim().length >= 1) buscarCliente(buscaCliente);
                        return;
                      }
                      if (e.key === 'ArrowDown' && showResultadosCliente && resultadosCliente.length > 0) { e.preventDefault(); setClienteIdx((prev) => Math.min(prev + 1, resultadosCliente.length - 1)); }
                      if (e.key === 'ArrowUp' && showResultadosCliente) { e.preventDefault(); setClienteIdx((prev) => Math.max(prev - 1, 0)); }
                      if (e.key === 'Escape') setShowResultadosCliente(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${clienteSelecionado ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                  />
                  <label className={MI_LABEL}>Cliente</label>
                  {loadingCliente ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" /> : null}
                  {showResultadosCliente && resultadosCliente.length > 0 ? (
                    <div ref={resultadosRef} className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {resultadosCliente.map((cli, idx) => {
                        const nome = cli.NOMEFANT || cli.NOME || '';
                        const razao = cli.NOMEFANT && cli.NOME && cli.NOMEFANT.toUpperCase() !== cli.NOME.toUpperCase() ? cli.NOME : '';
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
                            <div className="flex items-center gap-3 text-xs text-gray-800 dark:text-gray-200">
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

              {/* Busca vendedor */}
              <div className="w-[22%] relative min-w-[150px]">
                  {!vendedorSel.codigo ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input ref={vendedorInputRef} tabIndex={0} type="text"
                    value={buscaVendedor}
                    onChange={(e) => { if (temEV && !vendedorSel.codigo) { setBuscaVendedor(e.target.value); if (e.target.value.trim().length >= 3) buscarVendedorOperador(e.target.value, 'vendedor'); else { setResultadosVendedor([]); setShowResultadosVendedor(false); } } }}
                    readOnly={!temEV || !!vendedorSel.codigo}
                    onDoubleClick={() => { if (temEV && vendedorSel.codigo) { startEdit('vendedor', { vendedor: vendedorSel, buscaVendedor }); setVendedorSel({ codigo: '', nome: '' }); setBuscaVendedor(''); } }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingField === 'vendedor') { e.preventDefault(); cancelEdit(); return; }
                      if (vendedorSel.codigo) { if (e.key === 'Enter' && temEV) { e.preventDefault(); startEdit('vendedor', { vendedor: vendedorSel, buscaVendedor }); setVendedorSel({ codigo: '', nome: '' }); setBuscaVendedor(''); } return; }
                      if (!temEV) return;
                      if (e.key === 'Enter') {
                        if (showResultadosVendedor && vendedorIdx >= 0 && resultadosVendedor[vendedorIdx]) { e.preventDefault(); selecionarVendedor(resultadosVendedor[vendedorIdx]); return; }
                        if (buscaVendedor.trim().length >= 3) buscarVendedorOperador(buscaVendedor, 'vendedor');
                        return;
                      }
                      if (e.key === 'ArrowDown' && showResultadosVendedor) { e.preventDefault(); setVendedorIdx(p => Math.min(p + 1, resultadosVendedor.length - 1)); }
                      if (e.key === 'ArrowUp' && showResultadosVendedor) { e.preventDefault(); setVendedorIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowResultadosVendedor(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${!temEV || vendedorSel.codigo ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                  />
                  <label className={MI_LABEL}>Vendedor</label>
                  {loadingVendedor ? <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-indigo-500 z-10" /> : null}
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

              {/* Busca operador */}
              <div className="w-[22%] relative min-w-[150px]">
                  {!operadorSel.codigo ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input ref={operadorInputRef} tabIndex={0} type="text"
                    value={buscaOperador} readOnly={!!operadorSel.codigo}
                    onDoubleClick={() => { if (operadorSel.codigo) { startEdit('operador', { operador: operadorSel, buscaOperador }); setOperadorSel({ codigo: '', nome: '' }); setBuscaOperador(''); } }}
                    onChange={(e) => { if (!operadorSel.codigo) { setBuscaOperador(e.target.value); if (e.target.value.trim().length >= 3) buscarVendedorOperador(e.target.value, 'operador'); else { setResultadosOperador([]); setShowResultadosOperador(false); } } }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingField === 'operador') { e.preventDefault(); cancelEdit(); return; }
                      if (operadorSel.codigo) { if (e.key === 'Enter') { e.preventDefault(); startEdit('operador', { operador: operadorSel, buscaOperador }); setOperadorSel({ codigo: '', nome: '' }); setBuscaOperador(''); } return; }
                      if (e.key === 'Enter') {
                        if (showResultadosOperador && operadorIdx >= 0 && resultadosOperador[operadorIdx]) { e.preventDefault(); selecionarOperador(resultadosOperador[operadorIdx]); return; }
                        if (buscaOperador.trim().length >= 3) buscarVendedorOperador(buscaOperador, 'operador');
                        return;
                      }
                      if (e.key === 'ArrowDown' && showResultadosOperador) { e.preventDefault(); setOperadorIdx(p => Math.min(p + 1, resultadosOperador.length - 1)); }
                      if (e.key === 'ArrowUp' && showResultadosOperador) { e.preventDefault(); setOperadorIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowResultadosOperador(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${operadorSel.codigo ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                  />
                  <label className={MI_LABEL}>Operador</label>
                  {loadingOperador ? <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-lime-500 z-10" /> : null}
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

            {/* Info do cliente selecionado + alerta financeiro */}
            {clienteSelecionado ? (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-4 text-xs text-gray-800 dark:text-gray-200">
                  <span><span className="font-semibold">Saldo:</span> <span className={`font-bold ${Number(clienteSelecionado.saldo || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Number(clienteSelecionado.saldo || 0))}</span></span>
                  <span className="text-gray-300 dark:text-zinc-600">|</span>
                  <span><span className="font-semibold">Limite:</span> <span className="font-medium">{formatCurrency(Number(clienteSelecionado.limite || 0))}</span></span>
                  <span className="text-gray-300 dark:text-zinc-600">|</span>
                  <span><span className="font-semibold">CNPJ/CPF:</span> <span className="font-medium">{clienteSelecionado.cpfcgc || '-'}</span></span>
                  <span className="text-gray-300 dark:text-zinc-600">|</span>
                  <span><span className="font-semibold">Tipo:</span> <span className="font-medium">{clienteSelecionado.tipo || '-'}</span></span>
                </div>
                {/* Status financeiro — só da API validarCredito */}
                {restricaoFinanceira ? (() => {
                  // Badge baseado no STATUS REAL do cliente (não muda com forma de pagamento)
                  const clienteInativoOuJudicial = restricaoFinanceira.passou === 'NOK' && !restricaoFinanceira.mensagem?.includes('CRÉDITO INSUFICIENTE');
                  const semCreditoPrazo = totalVenda > 0 && saldoCliente < totalVenda && !avistaForcado;
                  const isNOK = clienteInativoOuJudicial;
                  const isAlerta = semCreditoPrazo && !isNOK;
                  const msg = isNOK ? restricaoFinanceira.mensagem
                    : isAlerta ? `Crédito insuficiente para prazo. Disponível: R$ ${saldoCliente.toFixed(2)}`
                    : avistaForcado ? `Somente à vista (${claspgto})`
                    : `Liberado — Disponível: R$ ${saldoCliente.toFixed(2)}`;
                  const cor = isNOK ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : isAlerta ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
                  const textCor = isNOK ? 'text-red-700 dark:text-red-300'
                    : isAlerta ? 'text-amber-700 dark:text-amber-300'
                    : 'text-blue-700 dark:text-blue-300';
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs border ${cor}`}>
                      {(isNOK || isAlerta) ? <AlertTriangle size={13} className={isNOK ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} /> : null}
                      <span className={`font-semibold ${textCor}`}>{msg}</span>
                    </div>
                  );
                })() : null}
              </div>
            ) : null}
          </div>

          {/* Grid de itens */}
          <div className="flex-1 flex flex-col px-3 py-2 overflow-hidden">
            {/* Toolbar */}
            <div ref={toolbarRef} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <button onClick={() => setAddItemOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${todosDescontoAvista ? 'bg-purple-600 hover:bg-purple-700 text-white' : temDescontoAvista ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-gray-300 dark:border-zinc-600'}`}
                  title="Ativar/desativar 2% desc. à vista em todos (Ctrl+D)"
                >
                  % Desc. à Vista
                </button>
                <span className="text-gray-300 dark:text-zinc-600 mx-0.5">|</span>
                <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{totalItens} itens</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Duplo clique edita &middot; Botão direito para mais opções</span>
              </div>
              <div className="flex items-center">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Keyboard size={10} />
                  Ctrl+Z Zoom | Ctrl+D Desc. | F3 Vend. | F4 Oper. | F9 Equiv. | F10 Hist. | Ctrl++ Adicionar
                </span>
              </div>
            </div>

            {/* Placeholder forte */}
            <style>{`
              .nova-venda-v2 input::placeholder, .nova-venda-v2 select::placeholder { color: #4b5563 !important; opacity: 1 !important; }
              .dark .nova-venda-v2 input::placeholder, .dark .nova-venda-v2 select::placeholder { color: #d1d5db !important; opacity: 1 !important; }
            `}</style>

            {/* AG Grid */}
            <style>{`
              .venda-grid .ag-cell { border-right: 1px solid #d1d5db !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; }
              .venda-grid .ag-cell[col-id="descr"] { align-items: flex-start !important; justify-content: flex-start !important; padding: 0 !important; }
              .venda-grid .ag-row { border-bottom: 1px solid #d1d5db !important; background-color: white !important; }
              .venda-grid .ag-row-hover,
              .venda-grid .ag-row-selected { background-color: white !important; }
              .venda-grid .ag-row .ag-cell { background-color: white !important; }
              .venda-grid .ag-row .ag-cell[col-id="ref"],
              .venda-grid .ag-row .ag-cell[col-id="descr"],
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
              .dark .venda-grid .ag-row .ag-cell[col-id="ref"],
              .dark .venda-grid .ag-row .ag-cell[col-id="descr"],
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
                  // Clique único entra em edição na célula de preço e quantidade
                  const col = e.column?.getColId();
                  if ((col === 'prunit' || col === 'qtd') && e.rowIndex != null) {
                    e.api.startEditingCell({ rowIndex: e.rowIndex, colKey: col });
                    return;
                  }
                  if (col === 'promoAtiva' && e.data?.promocao) {
                    togglePromo(e);
                  }
                  if (col === 'desconto_percentual' && e.data) {
                    const descAtual = Number(e.data.desconto_percentual) || 0;
                    const novoDesc = descAtual === 0 ? 2 : 0;
                    const rowIdx = e.rowIndex;
                    // Se ativar desconto à vista e tem promoção → desativa promoção e volta preço original
                    let novoPreco = e.data.prunit;
                    let promoAtiva = e.data.promoAtiva;
                    let promocao = e.data.promocao;
                    if (novoDesc > 0 && promoAtiva && promocao) {
                      promoAtiva = false;
                      novoPreco = Number(e.data.prvenda_original) || novoPreco;
                    }
                    const totalItem = e.data.qtd * novoPreco * (1 - novoDesc / 100);
                    e.node.setData({ ...e.data, desconto_percentual: novoDesc, prunit: novoPreco, promoAtiva, total_item: totalItem });
                    setItensGrid((prev) => {
                      const novos = [...prev];
                      novos[rowIdx] = { ...novos[rowIdx], desconto_percentual: novoDesc, prunit: novoPreco, promoAtiva, total_item: totalItem };
                      return novos;
                    });
                  }
                }}
                onCellKeyDown={(e: any) => {
                  if (e.column?.getColId() === 'promoAtiva' && e.data?.promocao && (e.event?.key === 'Enter' || e.event?.key === ' ')) {
                    e.event?.preventDefault();
                    e.event?.stopImmediatePropagation?.();
                    togglePromo(e);
                  }
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
            {/* Linha 1: (TMO) + Forma Pagamento + (Parcelas cartão) + Prazo */}
            <div className={`grid gap-3`} style={{ gridTemplateColumns: `${temTMO ? '1fr 1fr ' : ''}1fr${isCartaoCredito ? ' 120px' : ''} 1fr` }}>

              {temTMO ? (
                <>
                  {/* Tipo Movimentação — mesmo padrão Forma Pagamento */}
                  <div className="relative min-w-[120px]">
                    <input type="text" tabIndex={0}
                      readOnly={!!tipoMovimentacao && !showTipoMov}
                      value={tipoMovimentacao && !showTipoMov ? (OPCOES_TIPO_MOV.find(o => o.value === tipoMovimentacao)?.label || tipoMovimentacao) : buscaTipoMov}
                      onChange={(e) => { setBuscaTipoMov(e.target.value); setShowTipoMov(true); setTipoMovIdx(0); }}
                      onClick={() => { if (!showTipoMov) { setBuscaTipoMov(''); setShowTipoMov(true); setTipoMovIdx(0); } }}
                      onFocus={() => {}}
                      onBlur={() => setTimeout(() => { setShowTipoMov(false); setBuscaTipoMov(''); }, 150)}

                      onDoubleClick={() => { setBuscaTipoMov(''); setShowTipoMov(true); setTipoMovIdx(0); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && showTipoMov && tipoMovFiltrados[tipoMovIdx]) { e.preventDefault(); setTipoMovimentacao(tipoMovFiltrados[tipoMovIdx].value); setShowTipoMov(false); setBuscaTipoMov(''); setTimeout(() => navegarFocavel('next'), 50); }
                        else if (e.key === 'Enter' && !showTipoMov) { e.preventDefault(); setBuscaTipoMov(''); setShowTipoMov(true); setTipoMovIdx(0); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); if (!showTipoMov) { setBuscaTipoMov(''); setShowTipoMov(true); setTipoMovIdx(0); } else { setTipoMovIdx(p => Math.min(p + 1, tipoMovFiltrados.length - 1)); } }
                        if (e.key === 'ArrowUp' && showTipoMov) { e.preventDefault(); setTipoMovIdx(p => Math.max(p - 1, 0)); }
                        if (e.key === 'Escape') { setShowTipoMov(false); setBuscaTipoMov(''); }
                      }}
                      placeholder=" "
                      className={`${MI_INPUT} ${tipoMovimentacao && !showTipoMov ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                    />
                    <label className={MI_LABEL}>Tipo Movimentação</label>
                    {showTipoMov && tipoMovFiltrados.length > 0 ? (
                      <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                        {tipoMovFiltrados.map((op, idx) => (
                          <div key={op.value} className={`px-3 py-1.5 cursor-pointer text-sm ${idx === tipoMovIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                            onMouseDown={(ev) => { ev.preventDefault(); setTipoMovimentacao(op.value); setShowTipoMov(false); setBuscaTipoMov(''); setTimeout(() => navegarFocavel('next'), 50); }}
                          >{op.label}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {/* Tipo Operação — mesmo padrão Forma Pagamento */}
                  <div className="relative min-w-[120px]">
                    <input type="text" tabIndex={0}
                      readOnly={!!tipoOperacao && !showTipoOp}
                      value={tipoOperacao && !showTipoOp ? (OPCOES_TIPO_OP.find(o => o.value === tipoOperacao)?.label || tipoOperacao) : buscaTipoOp}
                      onChange={(e) => { setBuscaTipoOp(e.target.value); setShowTipoOp(true); setTipoOpIdx(0); }}
                      onClick={() => { if (!showTipoOp) { setBuscaTipoOp(''); setShowTipoOp(true); setTipoOpIdx(0); } }}
                      onFocus={() => {}}
                      onBlur={() => setTimeout(() => { setShowTipoOp(false); setBuscaTipoOp(''); }, 150)}
                      onDoubleClick={() => { setBuscaTipoOp(''); setShowTipoOp(true); setTipoOpIdx(0); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && showTipoOp && tipoOpFiltrados[tipoOpIdx]) { e.preventDefault(); setTipoOperacao(tipoOpFiltrados[tipoOpIdx].value); setShowTipoOp(false); setBuscaTipoOp(''); setTimeout(() => navegarFocavel('next'), 50); }
                        else if (e.key === 'Enter' && !showTipoOp) { e.preventDefault(); setBuscaTipoOp(''); setShowTipoOp(true); setTipoOpIdx(0); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); if (!showTipoOp) { setBuscaTipoOp(''); setShowTipoOp(true); setTipoOpIdx(0); } else { setTipoOpIdx(p => Math.min(p + 1, tipoOpFiltrados.length - 1)); } }
                        if (e.key === 'ArrowUp' && showTipoOp) { e.preventDefault(); setTipoOpIdx(p => Math.max(p - 1, 0)); }
                        if (e.key === 'Escape') { setShowTipoOp(false); setBuscaTipoOp(''); }
                      }}
                      placeholder=" "
                      className={`${MI_INPUT} ${tipoOperacao && !showTipoOp ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                    />
                    <label className={MI_LABEL}>Tipo Operação</label>
                    {showTipoOp && tipoOpFiltrados.length > 0 ? (
                      <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                        {tipoOpFiltrados.map((op, idx) => (
                          <div key={op.value} className={`px-3 py-1.5 cursor-pointer text-sm ${idx === tipoOpIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                            onMouseDown={(ev) => { ev.preventDefault(); setTipoOperacao(op.value); setShowTipoOp(false); setBuscaTipoOp(''); setTimeout(() => navegarFocavel('next'), 50); }}
                          >{op.label}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              {/* Forma de Pagamento (ANTES do prazo — como Delphi) */}
              <div className="flex-1 relative min-w-[200px]">
                  {!fPagamento && !fpTravadoBoleto ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input type="text" ref={fpInputRef} tabIndex={fpTravadoBoleto ? -1 : 0}
                    readOnly={!!fPagamento || fpTravadoBoleto}
                    value={fpTravadoBoleto ? 'BOLETO' : fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || fPagamento) : buscaFP}
                    onChange={(e) => { if (!fpTravadoBoleto) { setBuscaFP(e.target.value); setShowFP(true); setFpIdx(0); } }}
                    onClick={() => {
                      if (fpTravadoBoleto) { setPrazo(''); setPrazosArray([]); setFPagamento(''); setBuscaFP(''); setShowFP(true); setFpIdx(0); return; }
                      if (!fPagamento) { setShowFP(true); setFpIdx(0); }
                    }}
                    onFocus={() => {}}
                    onBlur={() => setTimeout(() => { setShowFP(false); setBuscaFP(''); if (editingField === 'fPagamento') cancelEdit(); }, 150)}
                    onDoubleClick={() => { if (fPagamento && !fpTravadoBoleto) { startEdit('fPagamento', { fPagamento }); setFPagamento(''); setBuscaFP(''); setShowFP(true); } }}
                    onKeyDown={(e) => {
                      if (fpTravadoBoleto) { if (e.key === 'Enter') { e.preventDefault(); setPrazo(''); setPrazosArray([]); setFPagamento(''); setBuscaFP(''); setShowFP(true); setFpIdx(0); } return; }
                      if (e.key === 'Escape' && editingField === 'fPagamento') { e.preventDefault(); cancelEdit(); setShowFP(false); return; }
                      if (fPagamento) {
                        if (e.key === 'Enter') { e.preventDefault(); startEdit('fPagamento', { fPagamento }); setFPagamento(''); setBuscaFP(''); setShowFP(true); setFpIdx(0); }
                        return;
                      }
                      if (e.key === 'Enter' && showFP && fpFiltradosPorBusca[fpIdx]) {
                        e.preventDefault(); setFPagamento(fpFiltradosPorBusca[fpIdx].id); setBuscaFP(''); setShowFP(false);
                        setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
                      } else if (e.key === 'Enter' && !showFP) { e.preventDefault(); setShowFP(true); setFpIdx(0); }
                      else if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); if (!showFP) { setShowFP(true); setFpIdx(0); } else { setFpIdx(p => Math.min(p + 1, fpFiltradosPorBusca.length - 1)); } }
                      if (e.key === 'ArrowUp' && showFP) { e.preventDefault(); setFpIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowFP(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${fpTravadoBoleto ? 'bg-gray-100 dark:bg-zinc-900 cursor-default opacity-70' : fPagamento ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                  />
                  <label className={MI_LABEL}>Forma Pagamento</label>
                  {showFP && !fPagamento && fpFiltradosPorBusca.length > 0 ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {fpFiltradosPorBusca.map((fp, idx) => (
                        <div key={fp.id} className={`px-3 py-1.5 cursor-pointer text-sm ${idx === fpIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onMouseDown={(ev) => { ev.preventDefault(); setFPagamento(fp.id); setBuscaFP(''); setShowFP(false); setTimeout(() => navegarFocalvelRef.current?.('next'), 50); }}
                        >{fp.descricao}</div>
                      ))}
                    </div>
                  ) : null}
              </div>

              {/* Parcelas cartão */}
              {isCartaoCredito ? (
                <div className="relative min-w-[100px]">
                  <input type="text" readOnly tabIndex={0}
                    value={parcelasCartao > 0 ? `${parcelasCartao}x` : ''}
                    onClick={() => { setShowParcelasDropdown(true); setParcelasIdx(parcelasCartao > 0 ? parcelasCartao - 1 : 0); }}
                    onFocus={() => {}}
                    onBlur={() => setTimeout(() => setShowParcelasDropdown(false), 150)}
                    onDoubleClick={() => { setShowParcelasDropdown(true); setParcelasIdx(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && showParcelasDropdown) { e.preventDefault(); setParcelasCartao(parcelasIdx + 1); setShowParcelasDropdown(false); setTimeout(() => navegarFocavel('next'), 50); }
                      else if (e.key === 'Enter') { e.preventDefault(); setShowParcelasDropdown(true); setParcelasIdx(parcelasCartao > 0 ? parcelasCartao - 1 : 0); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); if (!showParcelasDropdown) { setShowParcelasDropdown(true); setParcelasIdx(0); } else { setParcelasIdx(p => Math.min(p + 1, maxParcelasCartao - 1)); } }
                      if (e.key === 'ArrowUp' && showParcelasDropdown) { e.preventDefault(); setParcelasIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowParcelasDropdown(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} cursor-pointer bg-gray-100 dark:bg-zinc-900`}
                  />
                  <label className={MI_LABEL}>Parcelas</label>
                  {showParcelasDropdown ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {Array.from({ length: maxParcelasCartao }, (_, i) => i + 1).map((n) => {
                        return (
                          <div key={n} className={`px-3 py-1.5 cursor-pointer text-sm flex justify-between ${n - 1 === parcelasIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                            onMouseDown={(ev) => { ev.preventDefault(); setParcelasCartao(n); setShowParcelasDropdown(false); setTimeout(() => navegarFocavel('next'), 50); }}
                          >
                            <span className="font-bold">{n}x</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Prazo */}
              <div className="flex-1 relative min-w-[200px]">
                  <input type="text" tabIndex={prazoDesabilitado ? -1 : 0}
                    readOnly={prazoDesabilitado || (!!prazo && !showPrazoDropdown)}
                    value={prazoBloqueado ? prazoBloqueadoMsg : (prazoDesabilitado && fPagamento && !isBoleto ? 'À VISTA' : (prazo && !showPrazoDropdown ? prazo : buscaPrazo))}
                    onChange={(e) => { if (!prazoBloqueado) { setBuscaPrazo(e.target.value); setShowPrazoDropdown(true); setPrazoIdx(0); } }}
                    onClick={() => {
                      if (prazoDesabilitado) return;
                      if (!showPrazoDropdown) { setBuscaPrazo(''); setShowPrazoDropdown(true); setPrazoIdx(0); }
                    }}
                    onFocus={() => {}}
                    onDoubleClick={() => { if (!prazoBloqueado && prazo) { startEdit('prazo', { prazo, prazosArray }); setPrazo(''); setPrazosArray([]); setBuscaPrazo(''); setShowPrazoDropdown(true); setPrazoIdx(0); } }}
                    onBlur={() => setTimeout(() => { setShowPrazoDropdown(false); setBuscaPrazo(''); if (editingField === 'prazo') cancelEdit(); }, 150)}
                    onKeyDown={(e) => {
                      if (prazoBloqueado) { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } return; }
                      if (prazoDesabilitado) { if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); } return; }
                      if (e.key === 'Escape' && editingField === 'prazo') { e.preventDefault(); cancelEdit(); setShowPrazoDropdown(false); setBuscaPrazo(''); return; }
                      if (prazo && !showPrazoDropdown) { if (e.key === 'Enter') { e.preventDefault(); startEdit('prazo', { prazo, prazosArray }); setPrazo(''); setPrazosArray([]); setBuscaPrazo(''); setShowPrazoDropdown(true); setPrazoIdx(0); } return; }
                      // Índices: 0=Fechamento, 1=Personalizar, 2..N+1=opções tabela filtradas
                      if (e.key === 'Enter' && showPrazoDropdown) {
                        e.preventDefault();
                        if (prazoIdx === 0) {
                          setPrazo('FECHAMENTO NA SEMANA'); setPrazosArray([]); setShowPrazoDropdown(false); setBuscaPrazo(''); setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
                        } else if (prazoIdx === 1) {
                          setShowPrazoDropdown(false); setBuscaPrazo(''); setOpenModalPrazo(true);
                        } else if (prazoOpcoesFiltradas[prazoIdx - 2]) {
                          const op = prazoOpcoesFiltradas[prazoIdx - 2]; setPrazo(op.prazo.replace(/\//g, ' '));
                          const hoje = new Date(); setPrazosArray(op.dias.map((d, i) => { const dt = new Date(hoje); dt.setDate(dt.getDate() + d); return { id: i + 1, dataVencimento: dt, dias: d }; }));
                          setShowPrazoDropdown(false); setBuscaPrazo(''); setTimeout(() => navegarFocalvelRef.current?.('next'), 50);
                        }
                      } else if (e.key === 'Enter' && !showPrazoDropdown) { e.preventDefault(); setBuscaPrazo(''); setShowPrazoDropdown(true); setPrazoIdx(0); }
                      if (e.key === 'ArrowDown' && showPrazoDropdown) { e.preventDefault(); setPrazoIdx(p => Math.min(p + 1, prazoOpcoesFiltradas.length + 1)); }
                      if (e.key === 'ArrowUp' && showPrazoDropdown) { e.preventDefault(); setPrazoIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') { setShowPrazoDropdown(false); setBuscaPrazo(''); }
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${prazoBloqueado ? 'bg-gray-100 dark:bg-zinc-900 cursor-not-allowed opacity-50 text-red-500 text-xs italic' : prazoDesabilitado ? 'bg-gray-100 dark:bg-zinc-900 cursor-not-allowed opacity-70' : prazo && !showPrazoDropdown ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''} ${prazo === 'FECHAMENTO NA SEMANA' ? 'text-purple-600 font-semibold' : ''}`}
                  />
                  <label className={MI_LABEL}>Prazo</label>
                  {showPrazoDropdown && !prazoDesabilitado ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {/* Opções fixas no topo */}
                      <div className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-200 dark:border-zinc-600 ${prazoIdx === 0 ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                        onMouseDown={(ev) => { ev.preventDefault(); setPrazo('FECHAMENTO NA SEMANA'); setPrazosArray([]); setShowPrazoDropdown(false); setBuscaPrazo(''); setTimeout(() => navegarFocalvelRef.current?.('next'), 50); }}>
                        <span className="font-semibold text-purple-600">Fechamento na Semana</span>
                      </div>
                      <div className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-200 dark:border-zinc-600 ${prazoIdx === 1 ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                        onMouseDown={(ev) => { ev.preventDefault(); setShowPrazoDropdown(false); setBuscaPrazo(''); setOpenModalPrazo(true); }}>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Personalizar...</span>
                      </div>
                      {/* Opções da tabela de prazos (filtradas) */}
                      {prazoOpcoesFiltradas.map((op, idx) => (
                        <div key={op.prazo} className={`px-3 py-2 cursor-pointer text-sm ${(idx + 2) === prazoIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onMouseDown={(ev) => { ev.preventDefault(); setPrazo(op.prazo.replace(/\//g, ' ')); const hoje = new Date(); setPrazosArray(op.dias.map((d, i) => { const dt = new Date(hoje); dt.setDate(dt.getDate() + d); return { id: i + 1, dataVencimento: dt, dias: d }; })); setShowPrazoDropdown(false); setBuscaPrazo(''); setTimeout(() => navegarFocalvelRef.current?.('next'), 50); }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-white">{op.prazo.replace(/\//g, ' / ')}</span>
                            <span className="text-xs text-gray-700 dark:text-gray-200">{op.qtdParcelas}x</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
              </div>

              {/* Total da Venda */}
              <div className="relative min-w-[160px]">
                <div className={`${MI_INPUT} bg-gray-100 dark:bg-zinc-900 cursor-default text-right font-bold text-lg ${totalVenda > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                  {totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <label className={MI_LABEL}>Total da Venda</label>
              </div>
            </div>

            {/* Linha 2: Transportadora, Valor Transporte, Obs Fat, Pedido */}
            <div className="grid grid-cols-4 gap-3 mt-2">
              {/* Transportadora */}
              <div className="flex-1 relative min-w-[200px]">
                  {!transporteSel.CODTPTRANSP ? (
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 z-10 pointer-events-none" />
                  ) : null}
                  <input type="text" ref={transpInputRef} tabIndex={0}
                    readOnly={!!transporteSel.CODTPTRANSP}
                    onDoubleClick={() => { if (transporteSel.CODTPTRANSP) { startEdit('transportadora', { transporteSel }); setTransporteSel({ CODTPTRANSP: '', DESCR: '' }); setBuscaTransp(''); setShowTransp(true); } }}
                    value={transporteSel.CODTPTRANSP ? `${transporteSel.CODTPTRANSP} - ${transporteSel.DESCR}` : buscaTransp}
                    onChange={(e) => { setBuscaTransp(e.target.value); setShowTransp(true); setTranspIdx(0); }}
                    onClick={() => { if (!transporteSel.CODTPTRANSP) { setShowTransp(true); setTranspIdx(0); } }}
                    onFocus={() => {}}
                    onBlur={() => setTimeout(() => { setShowTransp(false); setBuscaTransp(''); if (editingField === 'transportadora') cancelEdit(); }, 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingField === 'transportadora') { e.preventDefault(); cancelEdit(); setShowTransp(false); return; }
                      if (transporteSel.CODTPTRANSP) {
                        if (e.key === 'Enter') { e.preventDefault(); startEdit('transportadora', { transporteSel }); setTransporteSel({ CODTPTRANSP: '', DESCR: '' }); setBuscaTransp(''); setShowTransp(true); setTranspIdx(0); }
                        return;
                      }
                      if (e.key === 'Enter' && showTransp && transpFiltrados.length > 0) { e.preventDefault(); setTransporteSel(transpFiltrados[transpIdx]); setBuscaTransp(''); setShowTransp(false); setTimeout(() => navegarFocavel('next'), 50); }
                      else if (e.key === 'Enter' && !showTransp) { e.preventDefault(); setShowTransp(true); setTranspIdx(0); }
                      else if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); if (!showTransp) { setShowTransp(true); setTranspIdx(0); } else { setTranspIdx(p => Math.min(p + 1, transpFiltrados.length - 1)); } }
                      if (e.key === 'ArrowUp' && showTransp) { e.preventDefault(); setTranspIdx(p => Math.max(p - 1, 0)); }
                      if (e.key === 'Escape') setShowTransp(false);
                    }}
                    placeholder=" "
                    className={`${MI_INPUT} ${transporteSel.CODTPTRANSP ? 'bg-gray-100 dark:bg-zinc-900 cursor-default' : ''}`}
                  />
                  <label className={MI_LABEL}>Transportadora</label>
                  {showTransp && !transporteSel.CODTPTRANSP && transpFiltrados.length > 0 ? (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-auto bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-xl">
                      {transpFiltrados.map((t, idx) => (
                        <div key={t.CODTPTRANSP} className={`px-3 py-1.5 cursor-pointer text-sm ${idx === transpIdx ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
                          onMouseDown={(ev) => { ev.preventDefault(); setTransporteSel(t); setBuscaTransp(''); setShowTransp(false); setTimeout(() => navegarFocavel('next'), 50); }}
                        >{t.CODTPTRANSP} - {t.DESCR}</div>
                      ))}
                    </div>
                  ) : null}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                    const el = e.target as HTMLInputElement;
                    if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) { e.preventDefault(); navegarFocavel('next'); }
                    if (e.key === 'ArrowLeft' && el.selectionStart === 0) { e.preventDefault(); navegarFocavel('prev'); }
                  }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-700 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-700 dark:peer-placeholder-shown:text-gray-800 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Valor Transporte</label>
              </div>

              {/* Obs. Faturamento (read-only — montado automaticamente pelas regras) */}
              <div className="relative h-full min-w-[200px]">
                <input type="text" readOnly tabIndex={0}
                  value={obsfatTexto}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                  }}
                  placeholder=" "
                  className={`${MI_INPUT} bg-gray-100 dark:bg-zinc-900 cursor-default ${obsfatTexto ? 'font-semibold' : ''}`}
                />
                <label className={MI_LABEL}>Obs. Faturamento</label>
              </div>

              {/* Pedido */}
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={pedido} onChange={(e) => setPedido(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                    const el = e.target as HTMLInputElement;
                    if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) { e.preventDefault(); navegarFocavel('next'); }
                    if (e.key === 'ArrowLeft' && el.selectionStart === 0) { e.preventDefault(); navegarFocavel('prev'); }
                  }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-700 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-700 dark:peer-placeholder-shown:text-gray-800 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Pedido</label>
              </div>
            </div>

            {/* Linha 3: Obs + Alerta operação */}
            <div className={`grid gap-3 mt-2`} style={{ gridTemplateColumns: (() => {
              let msg = '';
              if (!clienteSelecionado) msg = 'INFORME O CLIENTE';
              else if (totalItens === 0) msg = 'ESCOLHA PRODUTOS!';
              else if (totalVenda > 0 && totalVenda < 30) msg = 'x';
              else if (isClienteBalcao && totalVenda > 10000) msg = 'x';
              else if (isClienteBalcao && !isAvista && !isCartaoCredito) msg = 'x';
              else if (isCartaoCredito && parcelasCartao <= 0) msg = 'x';
              else if (statusVenda === 'BLOQUEIO_PRECO') msg = 'x';
              return msg ? '1fr 1fr' : '1fr';
            })() }}>
              <div className="relative h-full min-w-[200px]">
                <input type="text" value={obs} onChange={(e) => setObs(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); navegarFocavel('next'); }
                    const el = e.target as HTMLInputElement;
                    if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) { e.preventDefault(); navegarFocavel('next'); }
                    if (e.key === 'ArrowLeft' && el.selectionStart === 0) { e.preventDefault(); navegarFocavel('prev'); }
                  }}
                  placeholder=" "
                  className="peer h-full w-full rounded-[7px] border border-gray-300 dark:border-gray-400 bg-transparent px-3 py-2.5 font-sans text-sm font-normal outline outline-0 transition-all focus:border-gray-600 dark:focus:border-gray-200 focus:border-t-transparent dark:focus:border-t-transparent dark:border-t-transparent border-t-transparent placeholder-shown:border-t placeholder-shown:border-gray-300 dark:placeholder-shown:border-gray-400" />
                <label className="text-gray-700 before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-300 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-300 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-gray-700 dark:peer-placeholder-shown:text-gray-800 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-600 dark:peer-focus:text-gray-200 peer-focus:before:border-t-1 peer-focus:before:border-l-2 peer-focus:before:border-gray-600 dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1 peer-focus:after:border-r-2 peer-focus:after:border-gray-600 dark:peer-focus:after:border-gray-200">Observação</label>
              </div>
              {/* Alerta de operação */}
              {(() => {
                let msg = '';
                if (!clienteSelecionado) msg = 'INFORME O CLIENTE';
                else if (totalItens === 0) msg = 'ESCOLHA PRODUTOS!';
                else if (totalVenda > 0 && totalVenda < 30) msg = 'VENDA MÍNIMA DE R$ 30,00';
                else if (isClienteBalcao && totalVenda > 10000) msg = 'CLIENTE BALCÃO. LIMITE DE 10.000,00 EXCEDIDO.';
                else if (isClienteBalcao && !isAvista && !isCartaoCredito) msg = 'CLIENTE BALCÃO. PAGAMENTO SOMENTE À VISTA OU C. CRÉDITO.';
                else if (isCartaoCredito && parcelasCartao <= 0) msg = 'INFORME O PARCELAMENTO DO CARTÃO';
                else if (statusVenda === 'BLOQUEIO_PRECO') msg = 'ESSA VENDA ESTÁ BLOQUEADA — preço abaixo da tabela.';
                if (!msg) return null;
                return (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs">
                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    <span className="font-semibold text-amber-700 dark:text-amber-300">{msg}</span>
                  </div>
                );
              })()}
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
                <span className="text-sm font-semibold text-gray-800">{totalItens} itens</span>
                <span className="font-bold text-xl text-blue-600">Total: {formatCurrency(totalVenda)}</span>
                {isCartaoCredito && parcelasCartao > 0 ? (
                  <span className="text-sm font-bold text-orange-600">Cartão {parcelasCartao}x</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={totalItens === 0 || !clienteSelecionado}
                  onClick={handleSalvarOrcamento}
                  className="px-4 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Salvar Orçamento
                </button>
                {statusVenda === 'BLOQUEIO_PRECO' ? (
                  <button
                    disabled={totalItens === 0 || !clienteSelecionado || totalVenda < 30}
                    onClick={async () => {
                      setEnvioOpen(true);
                      setEnvioStep('montando');
                      setEnvioMsg('Esta venda possui itens com preço abaixo da tabela.\nEla será salva como BLOQUEADA e enviada para análise do setor responsável.');

                      try {
                        const prazosPayload = prazosArray.map((p: any) => ({ data: p.dataVencimento, dia: Number(p.dias) }));
                        const armId = Number(selectedArmazem?.value) || 1;

                        const payload = {
                          header: {
                            operacao: Number(documento?.COD_OPERACAO) || 1,
                            codcli: String(clienteSelecionado?.codcli || clienteSelecionado?.CODCLI || ''),
                            codusr: Number(user?.codusr) || 0,
                            pedido: pedido || '', tipo: 'P',
                            tele: operadorSel?.nome ? 'S' : 'N',
                            transp: transporteSel?.DESCR || '',
                            codtptransp: transporteSel?.CODTPTRANSP ? Number(transporteSel.CODTPTRANSP) : null,
                            vlrfrete: valTranspDec || 0, prazo: prazo || '',
                            obs: obs || '', obsfat: obsfatTexto || obsFat || '',
                            bloqueada: 'S',
                            estoque_virtual: 'N', uName: user?.usuario || '',
                            nomecf: clienteSelecionado.nomefant || clienteSelecionado.nome || null,
                            vendedor: vendedorSel?.codigo || null, operador: operadorSel?.codigo || null,
                            formaPagamento: fPagamento ? (opcoesFP.find(f => f.id === fPagamento)?.descricao || fPagamento) : null,
          parcelasCartao: isCartaoCredito ? (parcelasCartao > 0 ? parcelasCartao : 1) : null,
                            avista: isAvista,
          avistaMotivo: isAvista ? avistaMotivo : null,
                            requisicao: requisicao || '',
                            tipo_movimentacao: 'SAIDA', tipo_operacao: 'VENDA',
                          },
                          itens: itensGrid.map((it: any, idx: number) => ({
                            codprod: it.codprod, qtd: it.qtd, prunit: it.prunit, arm_id: armId,
                            ref: it.ref || '', descr: it.descr || '', desconto: it.desconto_percentual || 0,
                            codvend: vendedorSel?.codigo || null, codoperador: operadorSel?.codigo || null,
                            nritem: it.nritem || String(idx + 1), nrequis: it.nrequis || '', demanda: it.demanda || 'S', qtdpnd: it.qtdpnd || 0,
                            ...(it.promoAtiva && it.promocao ? { id_promocao_item: it.promocao.id_promocao_item, promocao_id: it.promocao.id_promocao, promoQty: it.qtd, quantidade_promocional: it.qtd } : {}),
                            ...(it.campos_fiscais || {}),
                          })),
                          prazos: prazosPayload,
                        };

                        setEnvioStep('enviando');
                        setEnvioMsg('Salvando venda bloqueada...');

                        const resp = await api.post('/api/vendas/postgresql/finalizarVenda', payload);
                        const data = resp.data;

                        if (data?.ok) {
                          setEnvioStep('ok');
                          setEnvioResp(data);
                          setEnvioMsg(`Venda Nº ${data.nrovenda} salva como BLOQUEADA.\nO setor de análise irá avaliar os preços e liberar ou ajustar a venda.`);
                          vendaSalvaRef.current = true; try { Object.keys(sessionStorage).forEach(k => { if (k.startsWith('novaVendaV2_draft')) sessionStorage.removeItem(k); }); } catch {}
                          if (draftIdRef.current) draftIdRef.current = null;
                        } else {
                          setEnvioStep('erro');
                          setEnvioMsg(data?.error || 'Falha ao salvar venda bloqueada.');
                        }
                      } catch (err: any) {
                        setEnvioStep('erro');
                        setEnvioMsg(err?.response?.data?.error || err?.message || 'Erro ao salvar');
                      }
                    }}
                    className="px-4 py-1.5 text-xs font-bold rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Solicitar Desbloqueio
                  </button>
                ) : (
                  <button
                    disabled={totalItens === 0 || !clienteSelecionado || clienteBloqueado || totalVenda < 30 || (isClienteBalcao && totalVenda > 10000) || (isClienteBalcao && !isAvista && !isCartaoCredito)}
                    title=""
                    onClick={handleFinalizarVenda}
                    className="px-4 py-1.5 text-xs font-bold rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Finalizar Venda
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="text-xs text-gray-800">
          {ultimaCelulaRef.current ? `${ultimaCelulaRef.current.ref || ultimaCelulaRef.current.codprod}` : 'Nenhum item selecionado'}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setAddItemOpen(true)}>
          <Plus size={14} className="mr-2" /> Adicionar Item
          <span className="ml-auto text-[10px] text-gray-700">Ctrl++</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const item = ultimaCelulaRef.current;
          if (item) setZoomProduto({ codprod: item.codprod, ref: item.ref, descr: item.descr });
        }}>
          <ShoppingCart size={14} className="mr-2" /> Zoom Produto
          <span className="ml-auto text-[10px] text-gray-700">Ctrl+Z</span>
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
          <span className="ml-auto text-[10px] text-gray-700">F9</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const item = ultimaCelulaRef.current;
          if (item) { setProdutoHist(item); setModalHistProduto(true); }
        }}>
          Histórico Produto
          <span className="ml-auto text-[10px] text-gray-700">F10</span>
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Modal Salvar Orçamento */}
      {salvarOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (salvarStep === 'validade' || salvarStep === 'ok' || salvarStep === 'erro') { setSalvarOpen(false); setSalvarResp(null); setSalvarMsg(''); setSalvarStep('validade'); } }} />
          <div className="relative z-10 w-[92%] max-w-md rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-xl border border-slate-200 dark:border-zinc-700">

            {salvarStep === 'validade' ? (
              <>
                <div className="font-semibold text-gray-900 dark:text-white text-lg mb-3">Salvar Orçamento</div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">Defina o prazo de validade do orçamento (máximo {prazoValidadeMax} dias):</div>
                <div className="flex items-center gap-3 mb-4">
                  <input type="number" min="1" max={prazoValidadeMax} value={diasValidade}
                    onChange={(e) => { const v = Math.min(Math.max(parseInt(e.target.value) || 1, 1), prazoValidadeMax); setDiasValidade(String(v)); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); executarSalvarOrcamento(); } }}
                    className="w-20 h-10 text-center text-lg font-bold border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">dias</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 rounded-md bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 text-sm font-semibold hover:bg-gray-300"
                    onClick={() => { setSalvarOpen(false); }}>
                    Cancelar
                  </button>
                  <button className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    onClick={executarSalvarOrcamento}>
                    Salvar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {salvarStep === 'enviando' || salvarStep === 'montando' ? (
                    <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                  ) : salvarStep === 'ok' ? (
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">✓</div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">!</div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {salvarStep === 'montando' ? 'Montando dados' : salvarStep === 'enviando' ? 'Salvando orçamento' : salvarStep === 'ok' ? 'Orçamento salvo' : 'Falha ao salvar'}
                    </div>
                    {salvarStep === 'erro' ? <div className="text-sm text-red-600 mt-0.5">{salvarMsg}</div> : null}
                  </div>
                </div>

                {salvarStep === 'ok' && salvarResp ? (
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 text-center">
                    <div><span className="text-gray-500">ID:</span> {salvarResp?.draft_id || salvarResp?.id || '-'}</div>
                    <div className="text-xs mt-1 text-gray-500">Válido por {diasValidade} dia(s)</div>
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-2">
                  {salvarStep === 'ok' ? (
                    <button className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                      onClick={() => {
                        setSalvarOpen(false); setSalvarResp(null); setSalvarStep('validade');
                        vendaSalvaRef.current = true; try { Object.keys(sessionStorage).forEach(k => { if (k.startsWith('novaVendaV2_draft')) sessionStorage.removeItem(k); }); } catch {}
                        sessionStorage.removeItem('centralV2_modalAberto');
                        if (onSaved) onSaved();
                      }}>
                      OK
                    </button>
                  ) : salvarStep === 'erro' ? (
                    <button className="px-4 py-2 rounded-md bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 text-sm font-semibold hover:bg-gray-300"
                      onClick={() => { setSalvarOpen(false); setSalvarResp(null); setSalvarMsg(''); setSalvarStep('validade'); }}>
                      Fechar
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Modal Finalizar Venda */}
      {envioOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (envioStep === 'ok' || envioStep === 'erro') { setEnvioOpen(false); setEnvioResp(null); setEnvioMsg(''); } }} />
          <div className="relative z-10 w-[92%] max-w-md rounded-xl bg-white dark:bg-zinc-800 p-5 shadow-xl border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              {envioStep === 'enviando' || envioStep === 'montando' ? (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
              ) : envioStep === 'ok' ? (
                <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">✓</div>
              ) : (
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">!</div>
              )}
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {envioStep === 'montando' ? 'Montando dados' : envioStep === 'enviando' ? 'Finalizando venda' : envioStep === 'ok' ? 'Venda finalizada' : 'Falha ao finalizar'}
                </div>
                {envioMsg ? <div className={`text-sm mt-0.5 ${envioStep === 'erro' ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{envioMsg}</div> : null}
              </div>
            </div>

            {envioStep === 'ok' && envioResp ? (
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 text-center">
                <div className="text-lg font-bold text-green-600">Nº {envioResp.nrovenda}</div>
                <div className="text-xs mt-1 text-gray-500">Status: {envioResp.status}</div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              {envioStep === 'ok' ? (
                <button className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                  onClick={() => {
                    setEnvioOpen(false); setEnvioResp(null); setEnvioMsg('');
                    sessionStorage.removeItem('centralV2_modalAberto');
                    if (onSaved) onSaved();
                  }}>
                  OK
                </button>
              ) : envioStep === 'erro' ? (
                <button className="px-4 py-2 rounded-md bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 text-sm font-semibold hover:bg-gray-300"
                  onClick={() => { setEnvioOpen(false); setEnvioResp(null); setEnvioMsg(''); }}>
                  Fechar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmação deletar todos */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover todos os itens</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover todos os {totalItens} itens do carrinho? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { setItensGrid([]); toast({ title: 'Todos os itens foram removidos' }); }}>
              Remover Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modais */}
      <ModalAdicionarItemRapido
        isOpen={addItemOpen}
        onClose={() => { setAddItemOpen(false); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItens}
        itensExistentes={itensGrid.map((i) => i.codprod)}
        armId={selectedArmazem?.value}
        tipoPreco={clienteSelecionado?.prvenda || '0'}
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
