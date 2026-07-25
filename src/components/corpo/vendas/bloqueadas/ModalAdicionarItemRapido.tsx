'use client';

import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { X, Loader2, Search, ArrowLeftRight, History } from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { getProdutos } from '@/data/produtos/produtos';
import { AuthContext } from '@/contexts/authContexts';
import { useToast } from '@/hooks/use-toast';
import api from '@/components/services/api';
import ModalEquivalentes from './ModalEquivalentes';
import ModalHistoricoProduto from './ModalHistoricoProduto';

interface ItemAdicionado {
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
  _novo: boolean;
}

interface ModalAdicionarItemRapidoProps {
  isOpen: boolean;
  onClose: () => void;
  onAdicionarItens: (itens: ItemAdicionado[]) => void;
  itensExistentes: string[];
}

const BATCH_SIZE = 50;

const ModalAdicionarItemRapido: React.FC<ModalAdicionarItemRapidoProps> = ({
  isOpen,
  onClose,
  onAdicionarItens,
  itensExistentes,
}) => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext) as any;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listaProd, setListaProd] = useState<any[]>([]);
  const [totalProd, setTotalProd] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [currentSearch, setCurrentSearch] = useState('');
  const [linhaSelecionada, setLinhaSelecionada] = useState(-1);
  const [adicionados, setAdicionados] = useState<Map<string, number>>(new Map());
  const [pedindoQtd, setPedindoQtd] = useState(-1);
  const [qtdInput, setQtdInput] = useState('1');
  const [sortBy, setSortBy] = useState('descr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalEquiv, setModalEquiv] = useState(false);
  const [produtoEquiv, setProdutoEquiv] = useState<any>(null);
  const [modalHist, setModalHist] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);
  const [pageLoaded, setPageLoaded] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qtdInputRef = useRef<HTMLInputElement>(null);
  const linhaSelecionadaRef = useRef(-1);
  linhaSelecionadaRef.current = linhaSelecionada;
  const listaProdRef = useRef<any[]>([]);
  listaProdRef.current = listaProd;
  const buscandoRef = useRef(false);
  const SCREEN_KEY = 'analise-adicionar-itens';
  const prefsCarregadasRef = useRef(false);

  // Carregar preferências do banco ao abrir
  useEffect(() => {
    if (isOpen && user?.usuario && !prefsCarregadasRef.current) {
      prefsCarregadasRef.current = true;
      api.get(`/api/userPreferences?user=${user.usuario}&screen=${SCREEN_KEY}`)
        .then((res) => {
          const prefs = res.data?.preferences;
          if (prefs?.sortBy) setSortBy(prefs.sortBy);
          if (prefs?.sortDir) setSortDir(prefs.sortDir);
        })
        .catch(() => {});
    }
    if (!isOpen) prefsCarregadasRef.current = false;
  }, [isOpen, user?.usuario]);

  // Salvar preferências no banco
  const salvarPreferencias = useCallback((sBy: string, sDir: string) => {
    if (!user?.usuario) return;
    api.put('/api/userPreferences', {
      user: user.usuario,
      screen: SCREEN_KEY,
      preferences: { sortBy: sBy, sortDir: sDir },
    }).catch(() => {});
  }, [user?.usuario]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setListaProd([]);
      setTotalProd(0);
      setSearchInput('');
      setCurrentSearch('');
      setLinhaSelecionada(-1);
      setAdicionados(new Map());
      setPedindoQtd(-1);
      setQtdInput('1');
      setPageLoaded(0);
      setTimeout(() => {
        const input = modalRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Focar no input de qtd
  useEffect(() => {
    if (pedindoQtd >= 0) {
      setTimeout(() => { qtdInputRef.current?.focus(); qtdInputRef.current?.select(); }, 50);
    }
  }, [pedindoQtd]);

  // Buscar produtos (primeira página ou próxima)
  const fetchProdutos = useCallback(async (search: string, page: number, append: boolean) => {
    if (buscandoRef.current) return;
    if (search.trim().length < 2) { setListaProd([]); setTotalProd(0); return; }
    buscandoRef.current = true;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const data = await getProdutos({ page, perPage: BATCH_SIZE, search: search.trim(), sortBy, sortDir });
      if (data?.data?.length > 0) {
        setListaProd((prev) => append ? [...prev, ...data.data] : data.data);
        setTotalProd(data.meta?.total || 0);
        setPageLoaded(page);
        if (!append) {
          setLinhaSelecionada(0);
          setTimeout(() => { (document.activeElement as HTMLElement)?.blur(); }, 100);
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }
      } else if (!append) {
        setListaProd([]);
        setTotalProd(0);
        setLinhaSelecionada(-1);
      }
    } catch {
      if (!append) setListaProd([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      buscandoRef.current = false;
    }
  }, [sortBy, sortDir]);

  // Executar busca
  const executarBusca = useCallback((value: string) => {
    setCurrentSearch(value);
    setPedindoQtd(-1);
    fetchProdutos(value, 1, false);
  }, [fetchProdutos]);

  // Carregar mais ao chegar perto do final
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || loading) return;
    if (listaProd.length >= totalProd) return; // já carregou tudo
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      fetchProdutos(currentSearch, pageLoaded + 1, true);
    }
  }, [loadingMore, loading, listaProd.length, totalProd, currentSearch, pageLoaded, fetchProdutos]);

  // Scroll para linha selecionada
  useEffect(() => {
    if (linhaSelecionada < 0 || !scrollRef.current) return;
    setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      const tbody = container.querySelector('tbody');
      if (!tbody) return;
      const row = tbody.children[linhaSelecionada] as HTMLElement;
      if (!row) return;
      const thead = container.querySelector('thead');
      const headerH = thead ? thead.getBoundingClientRect().height : 0;
      const rowRect = row.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const topLimit = containerRect.top + headerH;
      if (rowRect.top < topLimit) {
        container.scrollTop -= (topLimit - rowRect.top);
      } else if (rowRect.bottom > containerRect.bottom) {
        container.scrollTop += (rowRect.bottom - containerRect.bottom);
      }
    }, 20);
  }, [linhaSelecionada]);

  // Verificar se pode adicionar/editar
  const podeAdicionar = useCallback((produto: any) => {
    if (!produto) return false;
    if ((Number(produto.estoque_disponivel) || 0) <= 0) return false;
    // Já existia na venda original (não pode editar por aqui)
    if (itensExistentes.includes(produto.codprod)) return false;
    return true;
  }, [itensExistentes]);

  // Abrir input de quantidade
  const abrirQtd = useCallback((idx: number) => {
    const produto = listaProd[idx];
    if (!podeAdicionar(produto)) {
      if ((Number(produto?.estoque_disponivel) || 0) <= 0) {
        toast({ title: 'Produto sem estoque disponível' });
      } else if (itensExistentes.includes(produto?.codprod)) {
        toast({ title: `Item ${produto?.codprod} já está na venda original` });
      }
      return;
    }
    setLinhaSelecionada(idx);
    setPedindoQtd(idx);
    // Pré-preencher com qtd já adicionada ou 1
    const qtdAtual = adicionados.get(produto.codprod);
    setQtdInput(String(qtdAtual || 1));
  }, [listaProd, podeAdicionar, itensExistentes, adicionados, toast]);

  // Confirmar adição
  const confirmarAdicao = useCallback(() => {
    const produto = listaProd[pedindoQtd];
    if (!produto) return;
    const qtd = parseInt(qtdInput) || 1;
    const estoque = Number(produto.estoque_disponivel) || 0;
    if (qtd > estoque) {
      toast({ title: `Quantidade maior que estoque (${estoque})`, variant: 'destructive' });
      return;
    }
    const prunit = Number(produto.prvenda) || 0;
    const prcompra = Number(produto.prcompra) || 0;
    const margem = prcompra > 0 ? ((prunit / prcompra) - 1) * 100 : 0;

    const item: ItemAdicionado = {
      codprod: produto.codprod,
      ref: produto.ref || '',
      descr: produto.aplic_extendida || produto.descr || '',
      qtd,
      prunit,
      prvenda_original: prunit,
      desconto_valor: 0,
      desconto_percentual: 0,
      total_item: prunit * qtd,
      prcompra,
      prcustoatual: Number(produto.prcustoatual) || 0,
      margem: Math.round(margem * 100) / 100,
      codmarca: produto.codmarca || '',
      marca_nome: produto.marca_nome || produto.codmarca || '',
      origem: produto.dolar || 'N',
      _novo: true,
    };

    onAdicionarItens([item]);
    setAdicionados((prev) => { const m = new Map(prev); m.set(produto.codprod, qtd); return m; });
    setPedindoQtd(-1);
    toast({ title: `${produto.ref || produto.codprod} ${adicionados.has(produto.codprod) ? 'atualizado' : 'adicionado'} (qtd: ${qtd})` });
  }, [listaProd, pedindoQtd, qtdInput, onAdicionarItens, toast]);

  // Abrir equivalentes do item selecionado
  const abrirEquivalentes = useCallback(() => {
    if (linhaSelecionadaRef.current < 0 || !listaProdRef.current[linhaSelecionadaRef.current]) {
      toast({ title: 'Selecione um item na lista' });
      return;
    }
    const produto = listaProdRef.current[linhaSelecionadaRef.current];
    const codgpe = (produto.codgpe || '').trim();
    if (codgpe) {
      setProdutoEquiv({ codprod: produto.codprod, ref: produto.ref || '', descr: produto.aplic_extendida || produto.descr || '', codgpe, origem: produto.dolar || 'N' });
      setModalEquiv(true);
    } else {
      fetch(`/api/produtos/get/${produto.codprod}`)
        .then(r => r.json())
        .then(data => {
          const gpe = (data.codgpe || '').trim();
          if (gpe) {
            setProdutoEquiv({ codprod: produto.codprod, ref: produto.ref || '', descr: produto.aplic_extendida || produto.descr || '', codgpe: gpe, origem: data.dolar || 'N' });
            setModalEquiv(true);
          } else {
            toast({ title: 'Produto sem grupo de equivalência' });
          }
        })
        .catch(() => toast({ title: 'Erro ao buscar equivalência' }));
    }
  }, [toast]);

  const abrirHistorico = useCallback(() => {
    if (linhaSelecionadaRef.current < 0 || !listaProdRef.current[linhaSelecionadaRef.current]) {
      toast({ title: 'Selecione um item na lista' });
      return;
    }
    const produto = listaProdRef.current[linhaSelecionadaRef.current];
    setProdutoHist({ codprod: produto.codprod, ref: produto.ref || '', descr: produto.aplic_extendida || produto.descr || '' });
    setModalHist(true);
  }, [toast]);

  // Atalhos de teclado
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const noQtdInput = qtdInputRef.current === document.activeElement;

      if (e.key === 'Enter' && noQtdInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        confirmarAdicao();
        return;
      }
      if (e.key === 'Escape' && noQtdInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        setPedindoQtd(-1);
        return;
      }
      if (pedindoQtd >= 0) return;

      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!emInput) {
          // Fora do input: volta pro input e limpa busca
          const input = modalRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
          if (input) {
            setSearchInput('');
            setCurrentSearch('');
            setListaProd([]);
            setTotalProd(0);
            setLinhaSelecionada(-1);
            setPageLoaded(0);
            input.focus();
            return;
          }
        }
        // No input: fechar direto (itens já foram adicionados em tempo real)
        onClose();
        return;
      }

      // Setas
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (listaProd.length > 0) {
          // No input: só seta baixo sai do input, seta cima não faz nada
          if (emInput) {
            if (e.key === 'ArrowDown') {
              e.preventDefault(); e.stopImmediatePropagation();
              (document.activeElement as HTMLElement)?.blur();
              setLinhaSelecionada(0);
            }
            return;
          }
          e.preventDefault(); e.stopImmediatePropagation();
          {
            if (e.key === 'ArrowDown') {
              setLinhaSelecionada((prev) => {
                const next = Math.min(prev + 1, listaProd.length - 1);
                // Se chegou perto do final, carregar mais
                if (next >= listaProd.length - 5 && listaProd.length < totalProd && !buscandoRef.current) {
                  fetchProdutos(currentSearch, pageLoaded + 1, true);
                }
                return next;
              });
            } else {
              setLinhaSelecionada((prev) => {
                if (prev < 0) return -1;
                if (prev === 0) {
                  setSearchInput('');
                  setCurrentSearch('');
                  setListaProd([]);
                  setTotalProd(0);
                  setPageLoaded(0);
                  const input = modalRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
                  if (input) input.focus();
                  return -1;
                }
                return prev - 1;
              });
            }
          }
        }
        return;
      }

      // F10: histórico do item selecionado
      if (e.key === 'F10' && !emInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirHistorico();
        return;
      }

      // F9: equivalentes do item selecionado
      if (e.key === 'F9' && !emInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirEquivalentes();
        return;
      }

      // Enter fora do input: abrir qtd
      if (e.key === 'Enter' && !emInput && linhaSelecionadaRef.current >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirQtd(linhaSelecionadaRef.current);
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, listaProd, totalProd, currentSearch, pageLoaded, pedindoQtd, confirmarAdicao, abrirQtd, abrirEquivalentes, abrirHistorico, fetchProdutos, onClose]);

  // Ordenação
  const handleSort = useCallback((col: string) => {
    const newDir = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(col);
    setSortDir(newDir);
    setLinhaSelecionada(-1);
    setPedindoQtd(-1);
    salvarPreferencias(col, newDir);
    // Re-buscar com nova ordenação
    if (currentSearch.trim().length >= 2) {
      buscandoRef.current = false; // permitir nova busca
      setListaProd([]);
      setPageLoaded(0);
      // Buscar direto passando os novos valores (não depender do state)
      setTimeout(() => {
        getProdutos({ page: 1, perPage: BATCH_SIZE, search: currentSearch.trim(), sortBy: col, sortDir: newDir })
          .then((data) => {
            if (data?.data?.length > 0) {
              setListaProd(data.data);
              setTotalProd(data.meta?.total || 0);
              setPageLoaded(1);
              setLinhaSelecionada(0);
            } else {
              setListaProd([]);
              setTotalProd(0);
            }
          })
          .catch(() => setListaProd([]));
      }, 0);
    }
  }, [sortBy, sortDir, currentSearch, salvarPreferencias]);

  if (!isOpen) return null;

  const fmtMoeda = (v: number) => `R$ ${v.toFixed(2)}`;
  const sortIcon = (col: string) => {
    if (sortBy !== col) return null;
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const columns = [
    { key: 'ref', label: 'Referência', w: 'w-[90px]', sortable: true },
    { key: 'descr', label: 'Produto', w: 'flex-1', sortable: true },
    { key: 'codmarca', label: 'Marca', w: 'w-[100px]', sortable: true },
    { key: 'estoque_disponivel', label: 'Estoque', w: 'w-[70px]', sortable: true },
    { key: 'prvenda', label: 'Preço', w: 'w-[80px]', sortable: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={modalRef} className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-[90vw] h-[85vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#347AB6]">Adicionar Itens à Venda</h2>
            {adicionados.size > 0 ? (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-2 py-1 rounded-full font-medium">
                {adicionados.size} adicionado(s)
              </span>
            ) : null}
            {totalProd > 0 ? (
              <span className="text-[10px] text-gray-400">
                {listaProd.length} de {totalProd} carregados
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">
              Enter buscar | ↑↓ navegar | Enter selecionar | F9 Equiv. | F10 Hist. | Esc voltar/fechar
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-700">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') executarBusca(searchInput); }}
              placeholder="Digite e pressione Enter para buscar..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {loading ? <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" /> : null}
          </div>
        </div>

        {/* Tabela com scroll */}
        <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.w} px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-zinc-700 ${col.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaProd.length === 0 && !loading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-gray-400 text-sm">
                    {currentSearch.length >= 2 ? 'Nenhum produto encontrado.' : 'Digite pelo menos 2 caracteres e pressione Enter para buscar...'}
                  </td>
                </tr>
              ) : null}
              {listaProd.map((produto, idx) => {
                const jaExistente = itensExistentes.includes(produto.codprod);
                const jaAdicionado = adicionados.has(produto.codprod);
                const semEstoque = (Number(produto.estoque_disponivel) || 0) <= 0;
                const isSelecionado = idx === linhaSelecionada;
                const texto = produto.aplic_extendida || produto.descr || '';
                const origem = produto.dolar || 'N';

                return (
                  <tr
                    key={produto.codprod}
                    className={`border-b border-gray-100 dark:border-zinc-800 transition-colors cursor-pointer
                      ${jaExistente ? 'opacity-40' : ''}
                      ${semEstoque && !jaExistente ? 'opacity-50' : ''}
                      ${isSelecionado ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
                    `}
                    onClick={() => abrirQtd(idx)}
                  >
                    {/* Referência */}
                    <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 w-[90px]">
                      {produto.ref || produto.codprod}
                    </td>
                    {/* Produto */}
                    <td className="px-3 py-1">
                      <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                        <div title={texto} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {texto}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <img src={origem === 'N' ? '/images/brasil.png' : '/images/importado.png'} alt={origem === 'N' ? 'Nacional' : 'Importado'} style={{ width: 16, height: 11, objectFit: 'contain' }} />
                          {jaAdicionado && !jaExistente ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded ml-2">
                              Qtd: {adicionados.get(produto.codprod)}
                            </span>
                          ) : null}
                          {jaExistente ? <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded ml-2">Na venda</span> : null}
                          {semEstoque && !jaAdicionado ? <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded ml-2">S/ EST.</span> : null}
                          {idx === pedindoQtd ? (
                            <div className="flex items-center gap-1 ml-3" onClick={(ev) => ev.stopPropagation()}>
                              <span className="text-[10px] text-gray-500">Qtd:</span>
                              <input ref={qtdInputRef} type="number" min="1" max={Number(produto.estoque_disponivel) || 999} value={qtdInput} onChange={(ev) => setQtdInput(ev.target.value)}
                                className="w-14 h-6 text-center text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              <button onClick={() => confirmarAdicao()} className="h-6 px-2 text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded">OK</button>
                              {adicionados.has(produto.codprod) ? (
                                <button onClick={() => {
                                  onAdicionarItens([{ codprod: produto.codprod, qtd: 0 } as any]);
                                  setAdicionados((prev) => { const m = new Map(prev); m.delete(produto.codprod); return m; });
                                  setPedindoQtd(-1);
                                  toast({ title: `${produto.ref || produto.codprod} removido` });
                                }} className="h-6 px-2 text-[10px] font-semibold bg-red-500 hover:bg-red-600 text-white rounded">Limpar</button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {/* Marca */}
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 w-[100px]">
                      <div title={produto.codmarca || ''} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                        {produto.codmarca || ''}
                      </div>
                    </td>
                    {/* Estoque */}
                    <td className={`px-3 py-2 text-xs text-center w-[70px] ${semEstoque ? 'text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                      {Number(produto.estoque_disponivel) || 0}
                    </td>
                    {/* Preço */}
                    <td className="px-3 py-2 text-xs text-right text-blue-600 dark:text-blue-400 font-medium w-[80px]">
                      {fmtMoeda(Number(produto.prvenda) || 0)}
                    </td>
                  </tr>
                );
              })}
              {loadingMore ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-4">
                    <Loader2 size={16} className="inline animate-spin text-blue-500 mr-2" />
                    <span className="text-xs text-gray-400">Carregando mais...</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="text-xs text-gray-500">
            {linhaSelecionadaRef.current >= 0 && listaProd[linhaSelecionadaRef.current]
              ? `${listaProd[linhaSelecionadaRef.current].ref || listaProd[linhaSelecionadaRef.current].codprod}`
              : 'Nenhum item selecionado'}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => { if (linhaSelecionadaRef.current >= 0) abrirQtd(linhaSelecionadaRef.current); }}>
            Adicionar Item
            <span className="ml-auto text-[10px] text-gray-400">Enter</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={abrirEquivalentes}>
            <ArrowLeftRight size={14} className="mr-2" /> Equivalentes
            <span className="ml-auto text-[10px] text-gray-400">F9</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={abrirHistorico}>
            <History size={14} className="mr-2" /> Histórico Produto
            <span className="ml-auto text-[10px] text-gray-400">F10</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>
            Fechar
            <span className="ml-auto text-[10px] text-gray-400">Esc</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Modal Histórico */}
      <ModalHistoricoProduto
        isOpen={modalHist}
        onClose={() => { setModalHist(false); setProdutoHist(null); }}
        produto={produtoHist}
      />

      {/* Modal Equivalentes */}
      <ModalEquivalentes
        isOpen={modalEquiv}
        onClose={() => { setModalEquiv(false); setProdutoEquiv(null); }}
        onAdicionarItens={onAdicionarItens}
        itensExistentes={itensExistentes}
        produto={produtoEquiv}
      />
    </div>
  );
};

export default ModalAdicionarItemRapido;
