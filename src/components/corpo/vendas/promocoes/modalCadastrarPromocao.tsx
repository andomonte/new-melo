import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Promocao, insertPromocao, ItemPromocao } from '@/data/promocoes/promocoes';
import { promocaoSchema } from '@/data/promocoes/promocoesSchema';
import { AuthContext } from '@/contexts/authContexts';
import ModalAdicionarItemRapido from '../bloqueadas/ModalAdicionarItemRapido';
import ModalEquivalentes from '../bloqueadas/ModalEquivalentes';
import ModalHistoricoProduto from '../bloqueadas/ModalHistoricoProduto';
import InfoModal from '@/components/common/infoModal';
import { CircleCheckBig, X, Plus, Trash2, Download, Save, Eraser, FileDown, Keyboard, Eye, History } from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FormFooter from '@/components/common/FormFooter2';
import ProductZoomModal from '@/components/common/ProductZoomModal';
import api from '@/components/services/api';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { CellValueChangedEvent, GridReadyEvent, GridApi } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// ---------- helpers ----------
const dedupeByCodprod = (arr: ItemPromocao[]): ItemPromocao[] => {
  const seen = new Set<string>();
  return arr.filter((it) => {
    const key = String(it.codprod ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ---------- Cell Renderers ----------
const ProdutoCellRenderer = (props: any) => {
  const d = props.data;
  if (!d) return null;
  return (
    <div style={{ lineHeight: 1.4, padding: '4px 8px', width: '100%', textAlign: 'left' }}>
      <div title={d.descricao || ''} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>{d.descricao || '-'}</div>
      <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
        <img
          src={d.origem === 'N' ? '/images/brasil.png' : '/images/importado.png'}
          alt={d.origem === 'N' ? 'Nacional' : 'Importado'}
          style={{ width: 16, height: 11, objectFit: 'contain' }}
        />
      </div>
    </div>
  );
};

const PrecosCellRenderer = (props: any) => {
  const d = props.data;
  if (!d) return null;
  const tabela = Number(d._preco_tabela) || 0;
  const compra = Number(d.prcompra) || 0;
  return (
    <div style={{ lineHeight: 1.4, padding: '4px 0', textAlign: 'right' }}>
      <div style={{ fontSize: 13 }}>
        <span style={{ color: '#6b7280' }}>Tabela:</span> <b>R$ {tabela.toFixed(2)}</b>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>Compra: R$ {compra.toFixed(2)}</div>
    </div>
  );
};

// ---------- Interfaces ----------
interface ItemGrid extends ItemPromocao {
  _percentual_desconto: number;
  _valor_promocao: number;
  _preco_tabela: number;
  _margem_compra: number;
}

interface CadastrarPromocaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  promocaoToEdit?: Promocao;
  onSuccess?: (data: any) => void;
}

const CadastrarPromocaoModal: React.FC<CadastrarPromocaoModalProps> = ({
  isOpen,
  onClose,
  promocaoToEdit,
  onSuccess,
}) => {
  const { user } = useContext(AuthContext);
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const formatDateTimeLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const criarPromocaoVazia = useCallback((): Promocao => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      id_promocao: 0,
      nome_promocao: '',
      descricao_promocao: null,
      data_inicio: formatDateTimeLocal(now),
      data_fim: formatDateTimeLocal(future),
      tipo_promocao: 'PROD',
      valor_desconto: 0,
      tipo_desconto: 'PERC',
      qtde_minima_ativacao: 1,
      qtde_maxima_total: null,
      qtde_maxima_por_cliente: null,
      ativa: true,
      criado_por: user?.usuario || 'USUARIO_DESCONHECIDO',
      observacoes: null,
    };
  }, [user]);

  const [formTouched, setFormTouched] = useState(false);
  const [promocao, setPromocao] = useState<Promocao>(() => {
    if (promocaoToEdit) {
      return {
        ...promocaoToEdit,
        valor_desconto: parseFloat(Number(promocaoToEdit.valor_desconto).toFixed(2)) || 0,
        data_inicio: promocaoToEdit.data_inicio ? formatDateTimeLocal(new Date(promocaoToEdit.data_inicio)) : '',
        data_fim: promocaoToEdit.data_fim ? formatDateTimeLocal(new Date(promocaoToEdit.data_fim)) : '',
      };
    }
    return criarPromocaoVazia();
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isAddProductsModalOpen, setIsAddProductsModalOpen] = useState(false);
  const [rowData, setRowData] = useState<ItemGrid[]>([]);
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [infoModalIcon, setInfoModalIcon] = useState<React.ReactElement | null>(null);
  const [savedPromocaoData, setSavedPromocaoData] = useState<Promocao | null>(null);
  const [itemParaRemover, setItemParaRemover] = useState<string | null>(null);
  const [zoomProduto, setZoomProduto] = useState<any>(null);
  const [modalEquivalentes, setModalEquivalentes] = useState(false);
  const [produtoEquivalente, setProdutoEquivalente] = useState<any>(null);
  const [modalHistProduto, setModalHistProduto] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);
  const ultimaCelulaRef = useRef<any>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const modaisAbertosRef = useRef(false);

  // ---------- Clientes e Vendedores vinculados ----------
  const [clientesVinculados, setClientesVinculados] = useState<{ cod: string; nome: string }[]>([]);
  const [vendedoresVinculados, setVendedoresVinculados] = useState<{ cod: string; nome: string }[]>([]);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [buscaVendedor, setBuscaVendedor] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<any[]>([]);
  const [resultadosVendedor, setResultadosVendedor] = useState<any[]>([]);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [loadingVendedor, setLoadingVendedor] = useState(false);
  const [showDropCliente, setShowDropCliente] = useState(false);
  const [showDropVendedor, setShowDropVendedor] = useState(false);
  const dropClienteRef = useRef<HTMLDivElement>(null);
  const dropVendedorRef = useRef<HTMLDivElement>(null);

  // Buscar clientes
  const buscarClientes = useCallback(async (termo: string) => {
    if (termo.length < 2) { setResultadosCliente([]); setShowDropCliente(false); return; }
    setLoadingCliente(true);
    try {
      const r = await api.post('/api/vendas/postgresql/buscarCliente', {
        descricao: termo, pagina: 0, tamanhoPagina: 10,
      });
      const dados = r.data?.data || r.data || [];
      setResultadosCliente(Array.isArray(dados) ? dados : []);
      setShowDropCliente(true);
    } catch { setResultadosCliente([]); }
    finally { setLoadingCliente(false); }
  }, []);

  // Buscar vendedores
  const buscarVendedores = useCallback(async (termo: string) => {
    if (termo.length < 1) { setResultadosVendedor([]); return; }
    setLoadingVendedor(true);
    try {
      const r = await api.post('/api/vendas/postgresql/buscarVendedor');
      const dados = Array.isArray(r.data) ? r.data : [];
      const termoLower = termo.toLowerCase();
      setResultadosVendedor(dados.filter((v: any) =>
        String(v.CODVEND || v.codvend || '').includes(termoLower) ||
        String(v.NOME || v.nome || '').toLowerCase().includes(termoLower)
      ));
      setShowDropVendedor(true);
    } catch { setResultadosVendedor([]); }
    finally { setLoadingVendedor(false); }
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropClienteRef.current && !dropClienteRef.current.contains(e.target as Node)) setShowDropCliente(false);
      if (dropVendedorRef.current && !dropVendedorRef.current.contains(e.target as Node)) setShowDropVendedor(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Atalhos de teclado
  const atalhoRef = useRef<{ submit: () => void; clear: () => void; exportar: () => void; close: () => void }>({
    submit: () => {}, clear: () => {}, exportar: () => {}, close: () => {},
  });

  // Init clientes/vendedores vinculados ao editar
  useEffect(() => {
    if (promocaoToEdit) {
      const p = promocaoToEdit as any;
      if (p.clientes_vinculados && Array.isArray(p.clientes_vinculados)) {
        setClientesVinculados(p.clientes_vinculados);
      }
      if (p.vendedores_vinculados && Array.isArray(p.vendedores_vinculados)) {
        setVendedoresVinculados(p.vendedores_vinculados);
      }
    }
  }, [promocaoToEdit]);

  // ---------- Conversão item → grid ----------
  const itemToGrid = useCallback((item: ItemPromocao, descontoPadrao: number): ItemGrid => {
    const precoTabela = Number(item.preco) || 0;
    const descItem = Number(item.valor_desconto_item) || descontoPadrao;
    const precoPromo = Number(item.preco_promocao) || (precoTabela * (1 - descItem / 100));
    const prcompra = Number(item.prcompra) || 0;

    return {
      ...item,
      _preco_tabela: precoTabela,
      _percentual_desconto: descItem,
      _valor_promocao: Math.round(precoPromo * 100) / 100,
      _margem_compra: prcompra > 0 ? Math.round(((precoPromo / prcompra) - 1) * 10000) / 100 : 0,
      valor_desconto_item: descItem,
      qtd_total_item: Number(item.qtd_total_item) || null,
      qtde_minima_item: Number(item.qtde_minima_item) || null,
      qtde_maxima_item: Number(item.qtde_maxima_item) || null,
    };
  }, []);

  // ---------- Init ----------
  useEffect(() => {
    if (isOpen && !promocaoToEdit) {
      setPromocao(criarPromocaoVazia());
      setRowData([]);
      setErrors({});
      setIsFormValid(false);
      setFormTouched(false);
    }
  }, [isOpen, promocaoToEdit, criarPromocaoVazia]);

  useEffect(() => {
    if (promocaoToEdit?.itens_promocao) {
      const rows = promocaoToEdit.itens_promocao.map((item: any) => {
        const converted: ItemPromocao = {
          ...item,
          codprod: item.codigo ?? item.codprod ?? '',
          descricao: item.descricao ?? item.descr ?? '',
        };
        return itemToGrid(converted, Number(promocaoToEdit.valor_desconto) || 0);
      });
      setRowData(rows);
    } else if (!promocaoToEdit) {
      setRowData([]);
    }
  }, [promocaoToEdit, itemToGrid]);

  useEffect(() => {
    if (promocaoToEdit) setFormTouched(true);
  }, [promocaoToEdit]);

  // ---------- Validação ----------
  useEffect(() => {
    if (!formTouched && !promocaoToEdit) {
      setIsFormValid(false);
      return;
    }
    const result = promocaoSchema.safeParse(promocao);
    if (!result.success) {
      const fieldErrors: { [key: string]: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path?.length > 0) fieldErrors[err.path[0].toString()] = err.message;
      });
      setErrors(fieldErrors);
      setIsFormValid(false);
    } else {
      setErrors({});
      setIsFormValid(true);
    }
  }, [promocao, formTouched, promocaoToEdit]);

  const handlePromocaoChange = (fields: Partial<Promocao>) => {
    setFormTouched(true);
    setPromocao((prev) => ({ ...prev, ...fields }));
  };

  // ---------- AG Grid: recálculos ----------
  const recalcularDePreco = useCallback((row: ItemGrid, novoPreco: number): ItemGrid => {
    const precoTabela = row._preco_tabela;
    const prcompra = Number(row.prcompra) || 0;
    const perc = precoTabela > 0 ? Math.round(((1 - novoPreco / precoTabela) * 100) * 100) / 100 : 0;
    return {
      ...row,
      _valor_promocao: Math.round(novoPreco * 100) / 100,
      _percentual_desconto: perc,
      valor_desconto_item: perc,
      preco_promocao: Math.round(novoPreco * 100) / 100,
      _margem_compra: prcompra > 0 ? Math.round(((novoPreco / prcompra) - 1) * 10000) / 100 : 0,
    };
  }, []);

  const recalcularDePercentual = useCallback((row: ItemGrid, novoPerc: number): ItemGrid => {
    const novoPreco = row._preco_tabela * (1 - novoPerc / 100);
    const updated = recalcularDePreco(row, novoPreco);
    return { ...updated, _percentual_desconto: novoPerc, valor_desconto_item: novoPerc };
  }, [recalcularDePreco]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field;
    const rowIndex = event.rowIndex;
    if (rowIndex == null || !field) return;

    setRowData((prev) => {
      const novos = [...prev];
      let row = { ...novos[rowIndex] };
      if (field === '_percentual_desconto') {
        row = recalcularDePercentual(row, Number(event.newValue) || 0);
      } else if (field === '_valor_promocao') {
        row = recalcularDePreco(row, Number(event.newValue) || 0);
      } else if (field === '_margem_compra') {
        // Margem editada: precoPromo = prcompra * (1 + margem/100)
        const prcompra = Number(row.prcompra) || 0;
        const novaMargem = Number(event.newValue) || 0;
        if (prcompra > 0) {
          const novoPreco = prcompra * (1 + novaMargem / 100);
          row = recalcularDePreco(row, novoPreco);
          row._margem_compra = novaMargem;
        }
      } else {
        row = { ...row, [field]: event.newValue };
      }
      novos[rowIndex] = row;
      return novos;
    });
  }, [recalcularDePercentual, recalcularDePreco]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // ---------- Remover item ----------
  const handleRemoverItem = useCallback((codprod: string) => {
    setRowData((prev) => prev.filter((r) => r.codprod !== codprod));
    toast.success(`Item ${codprod} removido.`);
  }, []);

  // ---------- Adicionar itens ----------
  const handleConfirmSelectedProducts = useCallback((selectedItems: ItemPromocao[]) => {
    const descontoPadrao = Number(promocao.valor_desconto) || 0;
    setRowData((prev) => {
      const existentes = new Set(prev.map((r) => r.codprod));
      const novos = selectedItems
        .filter((item) => !existentes.has(item.codprod))
        .map((item) => itemToGrid(item, descontoPadrao));
      return [...novos, ...prev];
    });
    setIsAddProductsModalOpen(false);
  }, [promocao.valor_desconto, itemToGrid]);

  // Adapter: converte itens do ModalAdicionarItemRapido para formato da promoção
  const handleAdicionarItemRapido = useCallback((itensNovos: any[]) => {
    const descontoPadrao = Number(promocao.valor_desconto) || 0;
    const convertidos: ItemPromocao[] = itensNovos.map((item) => ({
      id_promocao_item: 0,
      id_promocao: promocao?.id_promocao || 0,
      codprod: item.codprod,
      codgpp: null,
      descricao: item.descr || '',
      ref: item.ref || '',
      marca: item.marca_nome || item.codmarca || '',
      qtddisponivel: 0,
      preco: item.prunit || 0,
      prcompra: item.prcompra || 0,
      prcustoatual: item.prcustoatual || 0,
      valor_desconto_item: descontoPadrao,
      tipo_desconto_item: 'PERC',
      preco_promocao: Math.round((item.prunit || 0) * (1 - descontoPadrao / 100) * 100) / 100,
      qtd_total_item: null,
      qtde_minima_item: null,
      qtde_maxima_item: null,
      qtdVendido: null,
      qtdFaturado: null,
      origem: item.origem || 'N',
    }));
    handleConfirmSelectedProducts(convertidos);
  }, [promocao.valor_desconto, promocao?.id_promocao, handleConfirmSelectedProducts]);

  // ---------- Exportar ----------
  const handleExportar = useCallback(() => {
    gridApi?.exportDataAsCsv({ fileName: 'itens_promocao.csv', columnSeparator: ';' });
  }, [gridApi]);

  // ---------- Salvar ----------
  const handleSubmit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setFormTouched(true);

    const combinedErrors: { [key: string]: string } = {};
    let formHasErrors = false;
    const result = promocaoSchema.safeParse(promocao);

    if (!result.success) {
      result.error.errors.forEach((err) => {
        if (err.path?.length > 0) combinedErrors[err.path[0].toString()] = err.message;
      });
      formHasErrors = true;
    }

    const itensParaSalvar = dedupeByCodprod(rowData.map((r) => {
      const { _percentual_desconto, _valor_promocao, _preco_tabela, _margem_compra, ...item } = r;
      return { ...item, tipo_desconto_item: 'PERC' as const, valor_desconto_item: _percentual_desconto, preco_promocao: _valor_promocao };
    }));

    if (itensParaSalvar.length === 0) {
      combinedErrors.itens_promocao = 'Adicione pelo menos um item.';
      formHasErrors = true;
    }

    if (formHasErrors) {
      setErrors(combinedErrors);
      setIsSaving(false);
      const errosList = Object.entries(combinedErrors).map(([k, v]) => `${k}: ${v}`).join('\n');
      toast.error(`Verifique os campos:\n${errosList}`, { duration: 5000 });
      return;
    }

    const validated = result.data!;
    const payload: Promocao = {
      id_promocao: validated.id_promocao || 0,
      nome_promocao: validated.nome_promocao || '',
      descricao_promocao: validated.descricao_promocao || null,
      data_inicio: validated.data_inicio || '',
      data_fim: validated.data_fim || '',
      tipo_promocao: validated.tipo_promocao || 'PROD',
      valor_desconto: validated.valor_desconto || 0,
      tipo_desconto: validated.tipo_desconto || 'PERC',
      qtde_minima_ativacao: validated.qtde_minima_ativacao || 0,
      qtde_maxima_total: validated.qtde_maxima_total || null,
      qtde_maxima_por_cliente: validated.qtde_maxima_por_cliente || null,
      ativa: validated.ativa ?? true,
      criado_por: validated.criado_por || user?.usuario || 'USUARIO_DESCONHECIDO',
      observacoes: validated.observacoes || null,
      criado_em: validated.criado_em,
      itens_promocao: itensParaSalvar,
    } as any;

    // Adicionar clientes e vendedores vinculados
    if (clientesVinculados.length > 0) payload.clientes_vinculados = clientesVinculados;
    if (vendedoresVinculados.length > 0) payload.vendedores_vinculados = vendedoresVinculados;

    try {
      const saved = await insertPromocao({ promocao: payload, itens: itensParaSalvar });
      setSavedPromocaoData(saved);
      setMensagemInfo('Promoção salva com sucesso!');
      setInfoModalIcon(<CircleCheckBig className="text-green-500 w-6 h-6" />);
      setOpenInfo(true);
    } catch (error) {
      console.error('❌ Erro ao salvar promoção:', error);
      toast.error(`Erro ao salvar: ${(error as Error).message}`, { duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = useCallback(() => {
    setPromocao(criarPromocaoVazia());
    setRowData([]);
    setErrors({});
    setIsFormValid(false);
    setFormTouched(false);
  }, [criarPromocaoVazia]);

  // Atualizar refs dos atalhos
  atalhoRef.current = { submit: handleSubmit, clear: handleClear, exportar: handleExportar, close: onClose };

  // ---------- AG Grid: colunas ----------
  const fmtMoeda = (v: any) => v != null ? `R$ ${Number(v).toFixed(2)}` : '-';
  const fmtPerc = (v: any) => v != null ? `${parseFloat(Number(v).toFixed(2))}%` : '-';

  const DeleteCellRenderer = useCallback((props: any) => {
    const codprod = props.data?.codprod;
    if (!codprod) return null;
    return (
      <button
        onClick={() => setItemParaRemover(codprod)}
        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
        title="Remover item"
      >
        <Trash2 size={15} />
      </button>
    );
  }, []);

  const columnDefs = useMemo((): any[] => [
    {
      headerName: '',
      field: '_delete',
      width: 40,
      maxWidth: 40,
      sortable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRendererSelector: () => ({ component: DeleteCellRenderer }),
    },
    {
      headerName: 'Referência',
      field: 'ref',
      width: 120,
      cellStyle: { fontWeight: 500 },
    },
    {
      headerName: 'Produto',
      field: 'descricao',
      minWidth: 140,
      flex: 3,
      autoHeight: true,
      cellStyle: { textAlign: 'left', justifyContent: 'flex-start' },
      cellRendererSelector: () => ({ component: ProdutoCellRenderer }),
    },
    {
      headerName: 'Marca',
      field: 'marca',
      width: 100,
      autoHeight: true,
      cellRenderer: (p: any) => {
        const val = p.value || '-';
        return (
          <div title={val} style={{ lineHeight: 1.3, padding: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12 }}>
            {val}
          </div>
        );
      },
    },
    {
      headerName: 'Estoque',
      field: 'qtddisponivel',
      flex: 1,
      minWidth: 60,
      type: 'numericColumn',
    },
    {
      headerName: 'Custo',
      field: 'prcompra',
      flex: 1.2,
      minWidth: 70,
      type: 'numericColumn',
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    {
      headerName: 'Pr. Tabela',
      field: '_preco_tabela',
      flex: 1.2,
      minWidth: 70,
      type: 'numericColumn',
      valueFormatter: (p: any) => fmtMoeda(p.value),
    },
    {
      headerName: '% Desc',
      field: '_percentual_desconto',
      flex: 1,
      minWidth: 70,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueFormatter: (p: any) => p.value != null ? `${parseFloat(Number(p.value).toFixed(2))}%` : '',
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('%', '').replace(',', '.').trim()) || 0,
    },
    {
      headerName: 'Vlr. Promo',
      field: '_valor_promocao',
      flex: 1.5,
      minWidth: 80,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe', fontWeight: 600 },
      valueFormatter: (p: any) => fmtMoeda(p.value),
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('R$', '').replace(',', '.').trim()) || 0,
    },
    {
      headerName: 'Margem',
      field: '_margem_compra',
      flex: 1,
      minWidth: 70,
      type: 'numericColumn',
      editable: true,
      valueFormatter: (p: any) => fmtPerc(p.value),
      valueParser: (p: any) => parseFloat(String(p.newValue).replace('%', '').replace(',', '.').trim()) || 0,
      cellStyle: (p: any) => {
        const margem = p.value ?? 0;
        const isImportado = p.data?.origem !== 'N';
        const limitePositivo = isImportado ? 40 : 20;
        return {
          color: margem < 0 ? '#dc2626' : margem < limitePositivo ? '#d97706' : '#16a34a',
          fontWeight: 600 as const,
          backgroundColor: '#dbeafe',
        };
      },
    },
    {
      headerName: 'Qtd',
      field: 'qtd_total_item',
      flex: 1,
      minWidth: 55,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dbeafe' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    {
      headerName: 'Qtd Mín',
      field: 'qtde_minima_item',
      flex: 1,
      minWidth: 55,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#dcfce7' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
    },
    {
      headerName: 'Qtd Máx',
      field: 'qtde_maxima_item',
      flex: 1,
      minWidth: 55,
      type: 'numericColumn',
      editable: true,
      cellStyle: { backgroundColor: '#fee2e2' },
      valueParser: (p: any) => parseInt(String(p.newValue)) || 0,
      hide: true,
    },
  ], [DeleteCellRenderer]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    cellStyle: { textAlign: 'center' },
    headerClass: 'ag-header-cell-center',
  }), []);

  const gridTheme = useMemo(() => themeQuartz.withParams({
    borderColor: '#d1d5db',
    wrapperBorder: true,
  }), []);

  modaisAbertosRef.current = isAddProductsModalOpen || !!zoomProduto || modalEquivalentes || modalHistProduto || !!itemParaRemover;

  const restaurarFocoGrid = useCallback(() => {
    setTimeout(() => {
      const api = gridRef.current?.api;
      if (!api) return;
      const fc = api.getFocusedCell();
      if (fc) {
        api.setFocusedCell(fc.rowIndex, fc.column?.getColId?.() || 'ref');
      } else if (ultimaCelulaRef.current) {
        const idx = rowData.findIndex((r: any) => r.codprod === ultimaCelulaRef.current.codprod);
        if (idx >= 0) api.setFocusedCell(idx, 'ref');
      }
    }, 100);
  }, [rowData]);

  // Registrar atalhos de teclado (após todas as funções serem definidas)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Setas cima/baixo dentro do grid
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
          return;
        }
        return;
      }

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        requestAnimationFrame(() => atalhoRef.current.submit());
      } else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        atalhoRef.current.clear();
      } else if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === 'Add')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsAddProductsModalOpen(true);
      } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        atalhoRef.current.exportar();
      } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && !modaisAbertosRef.current) {
        // Não interceptar em inputs (preserva undo nativo)
        const el = e.target as HTMLElement;
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        // Zoom: focado no grid OU ultimaCelulaRef
        let zoomItem: any = null;
        const focusedCell = gridRef.current?.api?.getFocusedCell();
        if (focusedCell) {
          const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(focusedCell.rowIndex);
          if (rowNode?.data) zoomItem = rowNode.data;
        }
        if (!zoomItem && ultimaCelulaRef.current) zoomItem = ultimaCelulaRef.current;
        if (zoomItem) {
          setZoomProduto({ codprod: zoomItem.codprod, ref: zoomItem.ref, descr: zoomItem.descricao || zoomItem.descr });
        } else {
          toast.error('Selecione um item na planilha');
        }
      } else if (e.key === 'F10' && !modaisAbertosRef.current) {
        const el = e.target as HTMLElement;
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT') return;
        e.preventDefault(); e.stopImmediatePropagation();
        const fc = gridRef.current?.api?.getFocusedCell();
        let item: any = null;
        if (fc) { const rn = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex); if (rn?.data) item = rn.data; }
        if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
        if (item) { setProdutoHist({ codprod: item.codprod, ref: item.ref, descr: item.descricao || item.descr }); setModalHistProduto(true); }
        else toast.error('Selecione um item na planilha');
      } else if (e.key === 'F9' && !modaisAbertosRef.current) {
        const el = e.target as HTMLElement;
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT') return;
        e.preventDefault(); e.stopImmediatePropagation();
        const fc = gridRef.current?.api?.getFocusedCell();
        let item: any = null;
        if (fc) {
          const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex);
          if (rowNode?.data) item = rowNode.data;
        }
        if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
        if (item) {
          const codgpe = (item.codgpe || '').trim();
          if (codgpe) {
            setProdutoEquivalente({ codprod: item.codprod, ref: item.ref, descr: item.descricao || item.descr, codgpe, origem: item.origem });
            setModalEquivalentes(true);
          } else {
            // Buscar codgpe do produto
            fetch(`/api/produtos/get/${item.codprod}`)
              .then(r => r.json())
              .then(data => {
                const gpe = (data.codgpe || '').trim();
                if (gpe) {
                  setProdutoEquivalente({ codprod: item.codprod, ref: item.ref, descr: item.descricao || item.descr, codgpe: gpe, origem: data.dolar || 'N' });
                  setModalEquivalentes(true);
                } else {
                  toast.error('Produto sem grupo de equivalência');
                }
              }).catch(() => toast.error('Erro ao buscar equivalência'));
          }
        } else {
          toast.error('Selecione um item na planilha');
        }
      } else if (e.key === 'Escape' && !modaisAbertosRef.current) {
        e.preventDefault();
        atalhoRef.current.close();
      }
    };
    // Click fora do grid limpa foco
    const clickHandler = (e: MouseEvent) => {
      if (modaisAbertosRef.current) return;
      const wrapper = gridWrapperRef.current;
      if (wrapper && !wrapper.contains(e.target as Node)) {
        gridRef.current?.api?.clearFocusedCell();
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

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-2">
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-1rem)] h-[calc(100vh-1rem)] flex flex-col overflow-hidden">
          {/* ===== CABEÇALHO ===== */}
          <div className="flex justify-between items-center px-4 py-2.5 border-b dark:border-gray-700">
            <h4 className="text-lg font-bold text-[#347AB6]">
              {promocaoToEdit ? 'Editar Promoção' : 'Nova Promoção'}
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none mr-2">
                <input type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 h-3.5 w-3.5"
                  checked={promocao.permite_balcao ?? false}
                  onChange={(e) => handlePromocaoChange({ permite_balcao: e.target.checked })}
                  disabled={isSaving} />
                Balcão
              </label>
              <FormFooter
                onSubmit={handleSubmit}
                onClear={handleClear}
                isSaving={isSaving}
                hasChanges={isFormValid || rowData.length > 0}
              />
              <button onClick={onClose} className="text-gray-500 hover:text-red-500 ml-2" disabled={isSaving}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ===== FORMULÁRIO CABEÇALHO ===== */}
          <div className="px-4 py-2 border-b dark:border-gray-700 bg-white dark:bg-zinc-700 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                if (target.tagName === 'TEXTAREA') return;
                if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
                  e.preventDefault();
                  const form = target.closest('[data-promo-form]');
                  if (!form) return;
                  const focusables = Array.from(form.querySelectorAll<HTMLElement>(
                    'input:not([disabled]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled])'
                  )).filter((el) => el.offsetParent !== null);
                  const idx = focusables.indexOf(target);
                  if (idx >= 0 && idx < focusables.length - 1) {
                    focusables[idx + 1]?.focus();
                  }
                }
              }
            }}
            data-promo-form>
            {/* Linha 1: Nome + % Desc + Qtds */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium">Nome <span className="text-red-500">*</span></label>
                <input type="text" autoComplete="off"
                  className="mt-0.5 w-full rounded-md shadow-sm px-2 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs"
                  autoFocus
                  value={promocao.nome_promocao || ''} onChange={(e) => handlePromocaoChange({ nome_promocao: e.target.value })}
                  disabled={isSaving} maxLength={100} placeholder="Nome da promoção..." />
                {errors.nome_promocao ? <p className="text-red-500 text-[10px] mt-0.5">{errors.nome_promocao}</p> : null}
              </div>
              <div className="w-14">
                <label className="text-xs font-medium">% Desc</label>
                <input type="text"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs text-center"
                  value={promocao.valor_desconto || ''} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); handlePromocaoChange({ valor_desconto: v ? parseFloat(v) : 0, tipo_desconto: 'PERC' }); }}
                  placeholder="0" disabled={isSaving} />
              </div>
              <div className="w-14">
                <label className="text-xs font-medium">Qtd Tot</label>
                <input type="text"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs text-center"
                  value={promocao.qtde_maxima_total ?? ''} onChange={(e) => handlePromocaoChange({ qtde_maxima_total: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : null })}
                  placeholder="-" disabled={isSaving} />
              </div>
              <div className="w-14">
                <label className="text-xs font-medium">Qtd/Cli</label>
                <input type="text"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs text-center"
                  value={promocao.qtde_maxima_por_cliente ?? ''} onChange={(e) => handlePromocaoChange({ qtde_maxima_por_cliente: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : null })}
                  placeholder="-" disabled={isSaving} />
              </div>
              <div className="w-14">
                <label className="text-xs font-medium">Mín Ativ</label>
                <input type="text"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs text-center"
                  value={promocao.qtde_minima_ativacao ?? ''} onChange={(e) => handlePromocaoChange({ qtde_minima_ativacao: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : undefined })}
                  placeholder="1" disabled={isSaving} />
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-medium">Início <span className="text-red-500">*</span></label>
                <input type="datetime-local"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1.5 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs"
                  value={promocao.data_inicio ? promocao.data_inicio.slice(0, 16) : ''} onChange={(e) => handlePromocaoChange({ data_inicio: e.target.value })}
                  disabled={isSaving} />
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-medium">Fim <span className="text-red-500">*</span></label>
                <input type="datetime-local"
                  className="mt-0.5 w-full rounded-md shadow-sm px-1.5 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs"
                  value={promocao.data_fim ? promocao.data_fim.slice(0, 16) : ''} onChange={(e) => handlePromocaoChange({ data_fim: e.target.value })}
                  disabled={isSaving} />
              </div>
            </div>

            {/* Linha 2: Descrição + Clientes + Vendedores */}
            <div className="flex gap-2">
              <div className="flex-[2]">
                <label className="text-xs font-medium">Descrição</label>
                <input type="text"
                  className="mt-0.5 w-full rounded-md shadow-sm px-2 py-1.5 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-xs"
                  value={promocao.descricao_promocao || ''} onChange={(e) => handlePromocaoChange({ descricao_promocao: e.target.value })}
                  disabled={isSaving} maxLength={255} placeholder="Descrição..." />
              </div>
              {/* Cliente */}
              <div className="flex-[1.5] relative" ref={dropClienteRef}>
                <label className="text-xs font-medium">Clientes (vazio = todos)</label>
                <div className="flex flex-wrap gap-1 mt-0.5 p-1 min-h-[30px] rounded-md border bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700">
                  {clientesVinculados.map((c) => (
                    <span key={c.cod} className="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded px-1.5 py-0.5 text-[10px]">
                      {c.cod}-{c.nome.substring(0, 20)}
                      <button type="button" onClick={() => setClientesVinculados((prev) => prev.filter((x) => x.cod !== c.cod))} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                    </span>
                  ))}
                  <input type="text"
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100"
                    value={buscaCliente} onChange={(e) => { setBuscaCliente(e.target.value); buscarClientes(e.target.value); }}
                    placeholder={clientesVinculados.length > 0 ? 'Adicionar...' : 'Buscar por código, nome ou CNPJ...'}
                    disabled={isSaving} />
                </div>
                {showDropCliente && resultadosCliente.length > 0 ? (
                  <div className="absolute z-50 left-0 right-0 mt-0.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {resultadosCliente.map((cli: any) => {
                      const cod = String(cli.codcli || cli.CODCLI || '');
                      const nome = String(cli.nome || cli.NOME || '');
                      const jaAdicionado = clientesVinculados.some((c) => c.cod === cod);
                      return (
                        <button key={cod} type="button" disabled={jaAdicionado}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-zinc-700 ${jaAdicionado ? 'opacity-40' : ''}`}
                          onClick={() => {
                            setClientesVinculados((prev) => [...prev, { cod, nome }]);
                            setBuscaCliente(''); setShowDropCliente(false); setResultadosCliente([]);
                          }}>
                          <span className="font-medium">{cod}</span> - {nome}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* Vendedor */}
              <div className="flex-[1.5] relative" ref={dropVendedorRef}>
                <label className="text-xs font-medium">Vendedores (vazio = todos)</label>
                <div className="flex flex-wrap gap-1 mt-0.5 p-1 min-h-[30px] rounded-md border bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700">
                  {vendedoresVinculados.map((v) => (
                    <span key={v.cod} className="inline-flex items-center gap-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded px-1.5 py-0.5 text-[10px]">
                      {v.cod}-{v.nome.substring(0, 20)}
                      <button type="button" onClick={() => setVendedoresVinculados((prev) => prev.filter((x) => x.cod !== v.cod))} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                    </span>
                  ))}
                  <input type="text"
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-xs text-gray-900 dark:text-gray-100"
                    value={buscaVendedor} onChange={(e) => { setBuscaVendedor(e.target.value); buscarVendedores(e.target.value); }}
                    placeholder={vendedoresVinculados.length > 0 ? 'Adicionar...' : 'Buscar por código ou nome...'}
                    disabled={isSaving} />
                </div>
                {showDropVendedor && resultadosVendedor.length > 0 ? (
                  <div className="absolute z-50 left-0 right-0 mt-0.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {resultadosVendedor.map((vend: any) => {
                      const cod = String(vend.CODVEND || vend.codvend || '');
                      const nome = String(vend.NOME || vend.nome || '');
                      const jaAdicionado = vendedoresVinculados.some((v) => v.cod === cod);
                      return (
                        <button key={cod} type="button" disabled={jaAdicionado}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-green-50 dark:hover:bg-zinc-700 ${jaAdicionado ? 'opacity-40' : ''}`}
                          onClick={() => {
                            setVendedoresVinculados((prev) => [...prev, { cod, nome }]);
                            setBuscaVendedor(''); setShowDropVendedor(false); setResultadosVendedor([]);
                          }}>
                          <span className="font-medium">{cod}</span> - {nome}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* ===== TOOLBAR GRID ===== */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-blue-50 dark:bg-zinc-800 border-b dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsAddProductsModalOpen(true)}
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                disabled={isSaving}
              >
                <Plus size={14} /> Adicionar Item
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportar} className="gap-1 h-7 text-xs">
                <Download size={14} /> Exportar
              </Button>
            </div>
            <span className="text-xs text-gray-500">{rowData.length} itens | Duplo clique edita | Ctrl+Z Zoom | F9 Equiv. | F10 Hist. | Ctrl++ Adicionar</span>
          </div>

          {/* ===== GRID AG GRID ===== */}
          <div className="flex-1 min-h-0">
            <style>{`
              .ag-promo-grid .ag-cell { border-right: 1px solid #d1d5db !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; }
              .ag-promo-grid .ag-cell[col-id="descricao"] { align-items: flex-start !important; justify-content: flex-start !important; padding: 0 !important; }
              .ag-promo-grid .ag-row { border-bottom: 1px solid #d1d5db !important; }
              .ag-promo-grid .ag-header-cell { border-right: 1px solid #d1d5db !important; }
              .ag-promo-grid .ag-header-cell-resize { width: 4px !important; cursor: col-resize !important; }
              .ag-promo-grid .ag-cell-value { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
              .ag-promo-grid .ag-header-cell-label { justify-content: center !important; font-size: 11px !important; text-align: center !important; }
              .ag-promo-grid .ag-input-field-input, .ag-promo-grid .ag-text-field-input { font-size: 13px !important; text-align: center !important; }
              .ag-promo-grid .ag-header-cell-text { text-align: center !important; width: 100% !important; }

              .ag-promo-grid .ag-row,
              .ag-promo-grid .ag-row-even,
              .ag-promo-grid .ag-row-odd,
              .ag-promo-grid .ag-row-hover,
              .ag-promo-grid .ag-row-selected,
              .ag-promo-grid .ag-row-hover.ag-row-selected { background-color: white !important; background: white !important; }
              .ag-promo-grid .ag-row .ag-cell,
              .ag-promo-grid .ag-row-selected .ag-cell { background-color: white !important; }
              .ag-promo-grid .ag-row .ag-cell[col-id="_percentual_desconto"],
              .ag-promo-grid .ag-row .ag-cell[col-id="_valor_promocao"],
              .ag-promo-grid .ag-row .ag-cell[col-id="_margem_compra"],
              .ag-promo-grid .ag-row .ag-cell[col-id="qtd_total_item"],
              .ag-promo-grid .ag-row .ag-cell[col-id="qtde_minima_item"],
              .ag-promo-grid .ag-row .ag-cell[col-id="qtde_maxima_item"] { background-color: #eff6ff !important; }
              .ag-promo-grid .ag-cell-focus { outline: 2px solid #a8a29e !important; outline-offset: -2px; background-color: rgba(0,0,0,0.05) !important; }
              .ag-promo-grid .ag-cell-range-selected,
              .ag-promo-grid .ag-cell-range-single-cell { background-color: rgba(0,0,0,0.05) !important; }

              .dark .ag-promo-grid .ag-root-wrapper { background-color: #18181b !important; }
              .dark .ag-promo-grid .ag-header { background-color: #27272a !important; border-color: #3f3f46 !important; }
              .dark .ag-promo-grid .ag-header-cell { border-color: #3f3f46 !important; color: #a1a1aa !important; }
              .dark .ag-promo-grid .ag-row,
              .dark .ag-promo-grid .ag-row-even,
              .dark .ag-promo-grid .ag-row-odd,
              .dark .ag-promo-grid .ag-row-hover,
              .dark .ag-promo-grid .ag-row-selected,
              .dark .ag-promo-grid .ag-row-hover.ag-row-selected { background-color: #18181b !important; background: #18181b !important; }
              .dark .ag-promo-grid .ag-row .ag-cell,
              .dark .ag-promo-grid .ag-row-selected .ag-cell { background-color: #18181b !important; color: #e4e4e7 !important; border-color: #3f3f46 !important; }
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="_percentual_desconto"],
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="_valor_promocao"],
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="_margem_compra"],
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="qtd_total_item"],
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="qtde_minima_item"],
              .dark .ag-promo-grid .ag-row .ag-cell[col-id="qtde_maxima_item"] { background-color: #1e2a3a !important; }
              .dark .ag-promo-grid .ag-cell-focus { outline: 2px solid #71717a !important; outline-offset: -2px; background-color: rgba(255,255,255,0.05) !important; }
              .dark .ag-promo-grid .ag-cell-range-selected,
              .dark .ag-promo-grid .ag-cell-range-single-cell { background-color: rgba(255,255,255,0.05) !important; }
              .dark .ag-promo-grid .ag-row { border-color: #3f3f46 !important; }
            `}</style>
            <div className="h-full ag-promo-grid" ref={gridWrapperRef}>
              <AgGridReact
                ref={gridRef}
                theme={gridTheme}
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onCellValueChanged={onCellValueChanged}
                onCellFocused={(e: any) => {
                  if (e.rowIndex != null) {
                    const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(e.rowIndex);
                    if (rowNode?.data) ultimaCelulaRef.current = rowNode.data;
                  }
                }}
                stopEditingWhenCellsLoseFocus={true}
                singleClickEdit={false}
                enterNavigatesVertically={true}
                enterNavigatesVerticallyAfterEdit={true}
                suppressHorizontalScroll={true}
                alwaysShowVerticalScroll={true}
                getRowId={(params) => `${params.data.codprod}-${params.data.id_promocao_item || 'new'}`}
                suppressRowHoverHighlight={true}
                onCellMouseOver={(e: any) => {
                  const cellEl = e.event?.target?.closest?.('.ag-cell');
                  if (cellEl) {
                    const isDark = document.documentElement.classList.contains('dark');
                    cellEl.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                  }
                }}
                onCellMouseOut={(e: any) => {
                  const cellEl = e.event?.target?.closest?.('.ag-cell');
                  if (cellEl) cellEl.style.backgroundColor = '';
                }}
                rowHeight={48}
              />
            </div>
          </div>

          {/* Erros */}
          {errors.itens_promocao ? (
            <div className="px-4 py-1 bg-red-50 text-red-600 text-xs border-t">{errors.itens_promocao}</div>
          ) : null}
        </div>
        </ContextMenuTrigger>
        <ContextMenuContent className={`w-52 ${modaisAbertosRef.current ? 'hidden' : ''}`}>
          <ContextMenuLabel className="text-xs text-gray-500">Ações</ContextMenuLabel>
          <ContextMenuItem onClick={handleSubmit} disabled={isSaving}>
            <Save size={14} className="mr-2" /> Salvar
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+S</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleClear}>
            <Eraser size={14} className="mr-2" /> Limpar
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+L</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setIsAddProductsModalOpen(true)} disabled={isSaving}>
            <Plus size={14} className="mr-2" /> Adicionar Item
            <span className="ml-auto text-[10px] text-gray-400">Ctrl++</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleExportar}>
            <FileDown size={14} className="mr-2" /> Exportar CSV
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+E</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const focusedCell = gridRef.current?.api?.getFocusedCell();
            if (focusedCell) {
              const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(focusedCell.rowIndex);
              if (rowNode?.data) setZoomProduto({ codprod: rowNode.data.codprod, ref: rowNode.data.ref, descr: rowNode.data.descricao });
            }
          }}>
            <Eye size={14} className="mr-2" /> Zoom Produto
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+Z</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const fc = gridRef.current?.api?.getFocusedCell();
            let item: any = null;
            if (fc) {
              const rowNode = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex);
              if (rowNode?.data) item = rowNode.data;
            }
            if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
            if (item) {
              fetch(`/api/produtos/get/${item.codprod}`)
                .then(r => r.json())
                .then(data => {
                  const gpe = (data.codgpe || '').trim();
                  if (gpe) {
                    setProdutoEquivalente({ codprod: item.codprod, ref: item.ref, descr: item.descricao || item.descr, codgpe: gpe, origem: data.dolar || 'N' });
                    setModalEquivalentes(true);
                  } else {
                    toast.error('Produto sem grupo de equivalência');
                  }
                }).catch(() => toast.error('Erro ao buscar equivalência'));
            } else {
              toast.error('Selecione um item na planilha');
            }
          }}>
            <Eye size={14} className="mr-2" /> Equivalentes
            <span className="ml-auto text-[10px] text-gray-400">F9</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const fc = gridRef.current?.api?.getFocusedCell();
            let item: any = null;
            if (fc) { const rn = gridRef.current?.api?.getDisplayedRowAtIndex(fc.rowIndex); if (rn?.data) item = rn.data; }
            if (!item && ultimaCelulaRef.current) item = ultimaCelulaRef.current;
            if (item) { setProdutoHist({ codprod: item.codprod, ref: item.ref, descr: item.descricao || item.descr }); setModalHistProduto(true); }
            else toast.error('Selecione um item na planilha');
          }}>
            <History size={14} className="mr-2" /> Histórico Produto
            <span className="ml-auto text-[10px] text-gray-400">F10</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>
            <X size={14} className="mr-2" /> Fechar
            <span className="ml-auto text-[10px] text-gray-400">Esc</span>
          </ContextMenuItem>
        </ContextMenuContent>
        </ContextMenu>
      </div>

      <ModalAdicionarItemRapido
        isOpen={isAddProductsModalOpen}
        onClose={() => { setIsAddProductsModalOpen(false); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItemRapido}
        itensExistentes={rowData.map((r) => r.codprod)}
      />

      <ModalEquivalentes
        isOpen={modalEquivalentes}
        onClose={() => { setModalEquivalentes(false); setProdutoEquivalente(null); restaurarFocoGrid(); }}
        onAdicionarItens={handleAdicionarItemRapido}
        itensExistentes={rowData.map((r) => r.codprod)}
        produto={produtoEquivalente}
      />

      <ModalHistoricoProduto
        isOpen={modalHistProduto}
        onClose={() => { setModalHistProduto(false); setProdutoHist(null); restaurarFocoGrid(); }}
        produto={produtoHist}
      />

      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          if (onSuccess && savedPromocaoData) onSuccess(savedPromocaoData);
          setSavedPromocaoData(null);
          onClose();
        }}
        title="INFORMAÇÃO"
        icon={infoModalIcon === null ? undefined : infoModalIcon}
        content={mensagemInfo}
      />

      <ProductZoomModal
        open={!!zoomProduto}
        onOpenChange={(open) => { if (!open) { setZoomProduto(null); restaurarFocoGrid(); } }}
        productId={zoomProduto?.codprod}
        product={zoomProduto}
      />

      <AlertDialog open={!!itemParaRemover} onOpenChange={(open) => { if (!open) setItemParaRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Item</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o item <b>{itemParaRemover}</b> da promoção?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (itemParaRemover) handleRemoverItem(itemParaRemover);
                setItemParaRemover(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  );
};

export default CadastrarPromocaoModal;
