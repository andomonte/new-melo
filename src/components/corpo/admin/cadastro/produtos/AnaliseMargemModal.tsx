import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Loader2, TrendingUp, Layers, FileSpreadsheet } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Produtos escolhidos na listagem (selecionados ou a linha atual — Ctrl+M). Quando
   *  informado, a análise fica restrita a eles, como no Delphi (grade carregada com os
   *  produtos da tela de produtos). */
  codprods?: string[];
  /** Sem `codprods`: abre buscando por este termo (filtro atual da listagem). */
  buscaInicial?: string;
}

interface ProdutoLista {
  codprod: string;
  descr: string;
  ref?: string;
  marca?: string;
  grupoproduto?: string;
  estoque?: number;
  aplic_extendida?: string;
  precos?: Record<string, number>;
}

interface LinhaPolitica {
  tipoPreco: number;
  tipoPrecoLabel: string;
  prcompra: number;
  margemLiquida: number;
  icmsDevol: number;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  dci: number;
  comissao: number;
  fatorDespesas: number;
  taxaCartao: number;
  precoVenda: number;
}

type Campo = 'MARGEM' | 'PRECO';

// Tabelas de preço (Delphi NAVEGA_TIPO_PRECO).
const TABELAS: { id: number; label: string }[] = [
  { id: 0, label: 'BALCÃO' },
  { id: 1, label: 'ZFM' },
  { id: 2, label: 'INTERIOR' },
  { id: 3, label: 'ALC' },
  { id: 4, label: 'AMAZ. OCIDENTAL' },
  { id: 5, label: 'FORA ESTADO' },
  { id: 6, label: 'FORA ESTADO VAREJO' },
  { id: 7, label: 'RORAIMA' },
];

const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const num2 = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (s: string) => {
  const t = String(s).trim();
  // aceita "1.234,56", "1234,56" e "1234.56"
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return parseFloat(norm);
};

/**
 * Análise de Margem de Preço dos Produtos (porte do Delphi uniMargemPrecoVendasNovo,
 * Ctrl+M na listagem de produtos). Mestre-detalhe: produtos em análise à esquerda; política
 * de preço por tabela à direita, editando Margem Líquida OU Preço de Venda (grava na hora).
 * Ações em lote sobre todos os produtos em análise: alterar margem e exportar tabela de preço.
 */
export default function AnaliseMargemModal({ isOpen, onClose, codprods, buscaInicial }: Props) {
  const modoFixo = !!codprods && codprods.length > 0;

  const [busca, setBusca] = useState('');
  const [debouncedBusca] = useDebounce(busca, 400);
  const [produtos, setProdutos] = useState<ProdutoLista[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  const [produtoSel, setProdutoSel] = useState<ProdutoLista | null>(null);
  const [politica, setPolitica] = useState<LinhaPolitica[]>([]);
  const [loadingPolitica, setLoadingPolitica] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Valor em edição por célula ("tipo|campo") — grava no blur/Enter.
  const [edit, setEdit] = useState<Record<string, string>>({});
  const pulaDebounceRef = useRef(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Painel de ação em lote (Delphi pnMargem): alterar margem ou exportar.
  const [painel, setPainel] = useState<null | 'MARGEM' | 'EXPORTAR'>(null);
  const [tabelaLote, setTabelaLote] = useState<string>('');
  const [margemLote, setMargemLote] = useState('');
  const [processandoLote, setProcessandoLote] = useState(false);

  const carregarPorBusca = useCallback(async (termo: string): Promise<ProdutoLista[]> => {
    setLoadingProdutos(true);
    try {
      const resp = await fetch(`/api/compras/produtos?search=${encodeURIComponent(termo)}&perPage=50&page=1`);
      const data = await resp.json();
      const lista: ProdutoLista[] = data?.data || [];
      setProdutos(lista);
      return lista;
    } catch {
      setProdutos([]);
      return [];
    } finally {
      setLoadingProdutos(false);
    }
  }, []);

  const carregarPorCodigos = useCallback(async (cods: string[]): Promise<ProdutoLista[]> => {
    setLoadingProdutos(true);
    try {
      const resp = await fetch('/api/produtos/politica-preco/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprods: cods }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Falha ao carregar os produtos.');
      const lista: ProdutoLista[] = data?.data || [];
      setProdutos(lista);
      return lista;
    } catch (e: any) {
      setErro(e?.message || 'Falha ao carregar os produtos.');
      setProdutos([]);
      return [];
    } finally {
      setLoadingProdutos(false);
    }
  }, []);

  const selecionarProduto = useCallback(async (prod: ProdutoLista) => {
    setProdutoSel(prod);
    setPolitica([]);
    setEdit({});
    setErro(null);
    setLoadingPolitica(true);
    try {
      const resp = await fetch(`/api/produtos/politica-preco/${encodeURIComponent(prod.codprod)}`);
      const data = await resp.json();
      if (data?.success) setPolitica(data.politica || []);
      else setErro(data?.error || 'Falha ao carregar a política de preço.');
    } catch {
      setErro('Falha ao carregar a política de preço.');
    } finally {
      setLoadingPolitica(false);
    }
  }, []);

  // Ao abrir: carrega os produtos (escolhidos ou do filtro) e seleciona o 1º.
  useEffect(() => {
    if (!isOpen) return;
    setErro(null);
    setAviso(null);
    setEdit({});
    setProdutoSel(null);
    setPolitica([]);
    setPainel(null);
    const termo = modoFixo ? '' : buscaInicial || '';
    setBusca(termo);
    pulaDebounceRef.current = true;
    (async () => {
      const lista = modoFixo ? await carregarPorCodigos(codprods!) : await carregarPorBusca(termo.trim());
      if (lista.length > 0) selecionarProduto(lista[0]);
    })();
    setTimeout(() => buscaRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, buscaInicial, codprods]);

  // Sem produtos fixos, digitar refaz a busca no servidor.
  useEffect(() => {
    if (!isOpen || modoFixo) return;
    if (pulaDebounceRef.current) {
      pulaDebounceRef.current = false;
      return;
    }
    carregarPorBusca(debouncedBusca.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBusca]);

  // Com produtos fixos, a busca só filtra a lista em análise.
  const produtosVisiveis = useMemo(() => {
    if (!modoFixo) return produtos;
    const termos = busca.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (termos.length === 0) return produtos;
    return produtos.filter((p) => {
      const txt = `${p.codprod} ${p.descr} ${p.ref || ''} ${p.marca || ''}`.toUpperCase();
      return termos.every((t) => txt.includes(t));
    });
  }, [produtos, busca, modoFixo]);

  const chave = (tp: number, campo: Campo) => `${tp}|${campo}`;
  const limparEdit = (k: string) =>
    setEdit((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });

  const salvarCelula = async (linha: LinhaPolitica, campo: Campo, valorStr: string) => {
    if (!produtoSel) return;
    const k = chave(linha.tipoPreco, campo);
    const novo = parseNum(valorStr);
    const atual = campo === 'MARGEM' ? linha.margemLiquida : linha.precoVenda;
    if (Number.isNaN(novo) || Math.abs(novo - atual) < 0.005) {
      limparEdit(k);
      return;
    }
    setSalvando(k);
    setErro(null);
    try {
      const resp = await fetch('/api/produtos/politica-preco/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprod: produtoSel.codprod, tipoPreco: linha.tipoPreco, modo: campo, valor: novo }),
      });
      const data = await resp.json();
      if (data?.success) {
        setPolitica((prev) =>
          prev.map((l) =>
            l.tipoPreco === linha.tipoPreco
              ? { ...l, margemLiquida: data.margemLiquida, precoVenda: data.precoVenda }
              : l,
          ),
        );
        setProdutos((prev) =>
          prev.map((p) =>
            p.codprod === produtoSel.codprod && p.precos
              ? { ...p, precos: { ...p.precos, [linha.tipoPreco]: data.precoVenda } }
              : p,
          ),
        );
      } else {
        setErro(data?.error || 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
      }
    } catch {
      setErro('NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
    } finally {
      setSalvando(null);
      limparEdit(k);
    }
  };

  const abrirPainel = (tipo: 'MARGEM' | 'EXPORTAR') => {
    setErro(null);
    setAviso(null);
    setTabelaLote('');
    setMargemLote('');
    setPainel(tipo);
  };

  const codigosEmAnalise = () => produtos.map((p) => p.codprod);

  const confirmarMargemLote = async () => {
    const cods = codigosEmAnalise();
    if (cods.length === 0) return setErro('Não há produtos para atualizar.');
    if (tabelaLote === '') return setErro('Informe a TABELA que deseja atualizar.');
    const margem = parseNum(margemLote);
    if (Number.isNaN(margem)) return setErro('Informe a margem.');
    const nomeTabela = tabelaLote === 'TODOS' ? 'todas as tabelas' : `a tabela ${TABELAS[Number(tabelaLote)].label}`;
    if (!window.confirm(`Aplicar margem de ${num2(margem)}% em ${nomeTabela} de ${cods.length} produto(s)?\nO preço de venda será recalculado e gravado.`)) return;
    setProcessandoLote(true);
    setErro(null);
    try {
      const resp = await fetch('/api/produtos/politica-preco/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprods: cods, tipoPreco: tabelaLote === 'TODOS' ? 'TODOS' : Number(tabelaLote), margem }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) throw new Error(data?.error || 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
      const sem = (data.semFaixa || []) as string[];
      setAviso(
        `Margem aplicada: ${data.faixasAtualizadas} faixa(s) atualizada(s) em ${data.produtos} produto(s).` +
          (sem.length ? ` ${sem.length} produto(s) sem essa tabela de preço: ${sem.slice(0, 10).join(', ')}${sem.length > 10 ? '…' : ''}.` : ''),
      );
      setPainel(null);
      if (modoFixo) await carregarPorCodigos(codprods!);
      if (produtoSel) selecionarProduto(produtoSel);
    } catch (e: any) {
      setErro(e?.message || 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
    } finally {
      setProcessandoLote(false);
    }
  };

  const confirmarExportar = async () => {
    const cods = codigosEmAnalise();
    if (cods.length === 0) return setErro('Não há produtos para exportar.');
    if (tabelaLote === '') return setErro('Informe a TABELA que deseja exportar.');
    setProcessandoLote(true);
    setErro(null);
    try {
      // Preços sempre frescos do banco (a lista da busca não traz as faixas).
      const resp = await fetch('/api/produtos/politica-preco/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprods: cods }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Falha ao carregar os preços.');
      const lista: ProdutoLista[] = data?.data || [];
      const base = (p: ProdutoLista) => ({
        GRUPO: p.grupoproduto || '',
        MARCA: p.marca || '',
        REF: p.ref || '',
        CODPROD: p.codprod,
        DESCRICAO: p.descr,
        APLIC_EXTENDIDA: p.aplic_extendida || '',
        ESTOQUE: Number(p.estoque || 0),
      });
      let linhas: Record<string, any>[];
      let nome: string;
      if (tabelaLote === 'TODOS') {
        linhas = lista.map((p) => ({
          ...base(p),
          ...Object.fromEntries(TABELAS.map((t) => [`PR_${t.label.replace(/[^A-Z]+/g, '_')}`, Number(p.precos?.[t.id] || 0)])),
        }));
        nome = 'tabela-preco-todas';
      } else {
        const t = TABELAS[Number(tabelaLote)];
        linhas = lista.map((p) => ({ ...base(p), TABELA: t.label, PRECOVENDA: Number(p.precos?.[t.id] || 0) }));
        nome = `tabela-preco-${t.label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
      }
      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Preço');
      XLSX.writeFile(wb, `${nome}.xlsx`);
      setPainel(null);
    } catch (e: any) {
      setErro(e?.message || 'Falha ao exportar.');
    } finally {
      setProcessandoLote(false);
    }
  };

  // Esc fecha o painel de lote; com o painel fechado, fecha a tela.
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLElement).dataset.celula) return;
      e.stopPropagation();
      if (painel) setPainel(null);
      else onClose();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [isOpen, painel, onClose]);

  if (!isOpen) return null;

  const celula = (l: LinhaPolitica, campo: Campo) => {
    const k = chave(l.tipoPreco, campo);
    const editando = edit[k] !== undefined;
    const atual = campo === 'MARGEM' ? l.margemLiquida : l.precoVenda;
    return (
      <div className="inline-flex items-center gap-1">
        <input
          data-celula="1"
          value={editando ? edit[k] : num2(atual)}
          onChange={(e) => setEdit((p) => ({ ...p, [k]: e.target.value }))}
          onFocus={(e) => {
            setEdit((p) => ({ ...p, [k]: num2(atual) }));
            e.currentTarget.select();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              e.stopPropagation();
              limparEdit(k);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={(e) => salvarCelula(l, campo, e.target.value)}
          disabled={salvando === k}
          inputMode="decimal"
          className={`${campo === 'PRECO' ? 'w-28 font-semibold text-emerald-700 dark:text-emerald-400' : 'w-20 text-gray-900 dark:text-white'} text-right px-2 py-1 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50`}
        />
        {salvando === k && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-7xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#347AB6]" />
            <h3 className="text-lg font-semibold text-[#347AB6]">Análise de Margem de Preço</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => abrirPainel('MARGEM')}
              disabled={produtos.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-[#347AB6] text-[#347AB6] hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40"
              title="Aplica a mesma margem a todos os produtos em análise"
            >
              <Layers size={15} /> Alterar margem em lote
            </button>
            <button
              onClick={() => abrirPainel('EXPORTAR')}
              disabled={produtos.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40"
              title="Exporta para Excel a tabela de preço dos produtos em análise"
            >
              <FileSpreadsheet size={15} /> Exportar tabela de preço
            </button>
            <button onClick={onClose} className="ml-2 text-gray-500 hover:text-red-500" title="Fechar (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {(erro || aviso) && (
          <div className="px-5 pt-2">
            {erro && <div className="text-xs text-red-600 dark:text-red-400 font-medium">{erro}</div>}
            {aviso && <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{aviso}</div>}
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          {/* Mestre: produtos em análise */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={modoFixo ? 'Filtrar os produtos em análise...' : 'Buscar produto (cód, descr, ref, marca)...'}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                {modoFixo ? 'Produtos escolhidos na listagem' : 'espaço = E · ; = OU · a marca entra na busca'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingProdutos ? (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : produtosVisiveis.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm px-3">Nenhum produto encontrado.</div>
              ) : (
                produtosVisiveis.map((prod) => (
                  <button
                    key={prod.codprod}
                    onClick={() => selecionarProduto(prod)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-zinc-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                      produtoSel?.codprod === prod.codprod ? 'bg-blue-100 dark:bg-blue-900/40' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{prod.descr}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {prod.codprod}
                      {prod.ref ? <> · Ref: <span className="font-semibold text-red-600 dark:text-red-400">{prod.ref}</span></> : null}
                      {prod.marca ? ` · ${prod.marca}` : ''}
                      {prod.estoque !== undefined ? ` · Est: ${prod.estoque}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Produtos em análise: <strong>{produtos.length}</strong>
              {!modoFixo && produtos.length >= 50 ? ' (primeiros 50 da busca)' : ''}
            </div>
          </div>

          {/* Detalhe: política de preço */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!produtoSel ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Selecione um produto para ver a política de preço.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {produtoSel.codprod} — {produtoSel.descr}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Custo base: <strong>{moeda(politica[0]?.prcompra ?? 0)}</strong>
                    <span className="ml-3 text-gray-400">
                      Edite a <strong>Margem (%)</strong> ou o <strong>Preço de Venda</strong> — o outro recalcula e grava na hora.
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-2">
                  {loadingPolitica ? (
                    <div className="flex items-center justify-center py-10 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
                    </div>
                  ) : politica.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      Este produto não possui política de preço cadastrada.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-zinc-800 sticky top-0">
                        <tr className="text-gray-600 dark:text-gray-300">
                          <th className="text-left p-2">Tipo Preço</th>
                          <th className="text-right p-2">C. Compra</th>
                          <th className="text-right p-2 text-[#347AB6]">M. Líquida (%)</th>
                          <th className="text-right p-2">ICMS Dev.</th>
                          <th className="text-right p-2">ICMS</th>
                          <th className="text-right p-2">IPI</th>
                          <th className="text-right p-2">PIS</th>
                          <th className="text-right p-2">COFINS</th>
                          <th className="text-right p-2">DCI</th>
                          <th className="text-right p-2">Comis.</th>
                          <th className="text-right p-2">F. Desp.</th>
                          <th className="text-right p-2 text-emerald-700 dark:text-emerald-400">Pr. Venda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {politica.map((l) => (
                          <tr key={l.tipoPreco} className="hover:bg-gray-50 dark:hover:bg-zinc-700/40">
                            <td className="p-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{l.tipoPrecoLabel}</td>
                            <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{moeda(l.prcompra)}</td>
                            <td className="p-2 text-right">{celula(l, 'MARGEM')}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.icmsDevol)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.icms)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.ipi)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.pis)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.cofins)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.dci)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.comissao)}</td>
                            <td className="p-2 text-right text-gray-500 dark:text-gray-400">{num2(l.fatorDespesas)}</td>
                            <td className="p-2 text-right">{celula(l, 'PRECO')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-[#347AB6] text-white hover:bg-[#2a5f8f]">
            Fechar
          </button>
        </div>

        {/* Painel de ação em lote (Delphi pnMargem) */}
        {painel && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
              <h4 className="text-base font-semibold text-[#347AB6]">
                {painel === 'MARGEM' ? 'Alterar margem do produto em lote' : 'Exportar tabela de preço'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {painel === 'MARGEM'
                  ? `Aplica a margem a ${produtos.length} produto(s) em análise e recalcula o preço de venda.`
                  : `Gera uma planilha com ${produtos.length} produto(s) em análise.`}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tabela *</label>
                <select
                  value={tabelaLote}
                  onChange={(e) => setTabelaLote(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {TABELAS.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.label}</option>
                  ))}
                  <option value="TODOS">TODOS</option>
                </select>
              </div>
              {painel === 'MARGEM' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Margem líquida (%) *</label>
                  <input
                    value={margemLote}
                    onChange={(e) => setMargemLote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmarMargemLote(); }}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm text-right rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPainel(null)}
                  disabled={processandoLote}
                  className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-100"
                >
                  Voltar
                </button>
                <button
                  onClick={painel === 'MARGEM' ? confirmarMargemLote : confirmarExportar}
                  disabled={processandoLote}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded-md bg-[#347AB6] text-white hover:bg-[#2a5f8f] disabled:opacity-50"
                >
                  {processandoLote && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
