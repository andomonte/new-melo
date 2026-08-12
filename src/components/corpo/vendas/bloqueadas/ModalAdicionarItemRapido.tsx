'use client';

import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { X, Loader2, Search, ArrowLeftRight, History, Filter } from 'lucide-react';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { getProdutos, buscaProdutosComFiltro } from '@/data/produtos/produtos';
import { AuthContext } from '@/contexts/authContexts';
import FiltroDinamicoDeClientes from '@/components/common/FiltroDinamico';
import { useToast } from '@/hooks/use-toast';
import api from '@/components/services/api';
import ModalEquivalentes from './ModalEquivalentes';
import ModalHistoricoProduto from './ModalHistoricoProduto';
import Carregamento from '@/utils/carregamento';

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
  estoque?: number;
  demanda: string;
  qtdpnd: number;
  nrequis: string;
  nritem: string;
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
  const hasMPV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'MPV');
  }, [user]);
  const hasBPV = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'BPV');
  }, [user]);
  const hasVDM = useMemo(() => {
    if (!user?.funcoes) return false;
    return user.funcoes.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'VDM');
  }, [user]);
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
  const [precoInput, setPrecoInput] = useState('');
  const [avisoInline, setAvisoInline] = useState('');
  const [naoGerarDemanda, setNaoGerarDemanda] = useState(false);
  const [qtdPendInput, setQtdPendInput] = useState('0');
  const [refInput, setRefInput] = useState('');
  const [descrInput, setDescrInput] = useState('');
  const [chkRequisicao, setChkRequisicao] = useState(false);
  const [nrequisInput, setNrequisInput] = useState('');
  const [nritemInput, setNritemInput] = useState('');
  const [historicoRequisicoes, setHistoricoRequisicoes] = useState<string[]>([]);
  const [precoDigits, setPrecoDigits] = useState('');
  const precoPristineRef = useRef(true);
  const [searchField, setSearchField] = useState<'ref' | 'aplicacao'>('aplicacao');
  const [sortBy, setSortBy] = useState('descr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalEquiv, setModalEquiv] = useState(false);
  const [produtoEquiv, setProdutoEquiv] = useState<any>(null);
  const [modalHist, setModalHist] = useState(false);
  const [produtoHist, setProdutoHist] = useState<any>(null);
  const [mostrarFiltroAvancado, setMostrarFiltroAvancado] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<{ campo: string; tipo: string; valor: string }[]>([]);
  const [equivalentes, setEquivalentes] = useState<any[]>([]);
  const [loadingEquiv, setLoadingEquiv] = useState(false);
  const ultimoCodgpeRef = useRef('');
  const [pageLoaded, setPageLoaded] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qtdInputRef = useRef<HTMLInputElement>(null);
  const linhaSelecionadaRef = useRef(-1);
  linhaSelecionadaRef.current = linhaSelecionada;
  const listaProdRef = useRef<any[]>([]);
  listaProdRef.current = listaProd;
  const pedindoQtdRef = useRef(-1);
  pedindoQtdRef.current = pedindoQtd;
  const mostrarFiltroAvancadoRef = useRef(false);
  mostrarFiltroAvancadoRef.current = mostrarFiltroAvancado;
  const buscandoRef = useRef(false);
  const confirmarAdicaoRef = useRef<() => void>(() => {});
  const abrirQtdRef = useRef<(idx: number) => void>(() => {});
  const abrirEquivalentesRef = useRef<() => void>(() => {});
  const abrirHistoricoRef = useRef<() => void>(() => {});
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
          if (prefs?.searchField === 'ref' || prefs?.searchField === 'aplicacao') setSearchField(prefs.searchField);
        })
        .catch(() => {});
    }
    if (!isOpen) prefsCarregadasRef.current = false;
  }, [isOpen, user?.usuario]);

  // Salvar preferências no banco
  const salvarPreferencias = useCallback((sBy: string, sDir: string, sField?: string) => {
    if (!user?.usuario) return;
    const prefs: any = { sortBy: sBy, sortDir: sDir };
    if (sField) prefs.searchField = sField;
    api.put('/api/userPreferences', {
      user: user.usuario,
      screen: SCREEN_KEY,
      preferences: prefs,
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
      setFiltrosAvancados([]);
      setMostrarFiltroAvancado(false);
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

  // Scroll para linha selecionada e manter foco no modal
  useEffect(() => {
    if (linhaSelecionada >= 0 && scrollRef.current) {
      const row = scrollRef.current.querySelector(`tr:nth-child(${linhaSelecionada + 1})`) as HTMLElement;
      if (row) row.scrollIntoView({ block: 'nearest' });
      // Sempre focar no modal para capturar setas
      setTimeout(() => modalRef.current?.focus(), 10);
    }
  }, [linhaSelecionada]);

  // Buscar equivalentes automaticamente ao navegar nas linhas (com debounce)
  const equivTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (equivTimeoutRef.current) clearTimeout(equivTimeoutRef.current);

    if (linhaSelecionada < 0 || !listaProd[linhaSelecionada]) {
      setEquivalentes([]);
      return;
    }

    equivTimeoutRef.current = setTimeout(() => {
      const produto = listaProd[linhaSelecionada];
      const codgpe = (produto.codgpe || '').trim();

      const buscarEquiv = (gpe: string) => {
        if (gpe === ultimoCodgpeRef.current) return;
        ultimoCodgpeRef.current = gpe;
        setLoadingEquiv(true);
        api.post('/api/vendas/postgresql/produtoEquival', { CODGPE: gpe, PRVENDA: '0' })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setEquivalentes(data.filter((e: any) => (e.CODPROD || e.codprod) !== produto.codprod));
          })
          .catch(() => setEquivalentes([]))
          .finally(() => setLoadingEquiv(false));
      };

      if (!codgpe) {
        fetch(`/api/produtos/get/${produto.codprod}`)
          .then(r => r.json())
          .then(data => {
            const gpe = (data.codgpe || '').trim();
            if (gpe) buscarEquiv(gpe);
            else { setEquivalentes([]); ultimoCodgpeRef.current = ''; }
          })
          .catch(() => { setEquivalentes([]); ultimoCodgpeRef.current = ''; });
        return;
      }

      buscarEquiv(codgpe);
    }, 400);

    return () => { if (equivTimeoutRef.current) clearTimeout(equivTimeoutRef.current); };
  }, [linhaSelecionada, listaProd]);

  // Ref dos filtros avançados para uso dentro de callbacks sem stale closure
  const filtrosAvancadosRef = useRef(filtrosAvancados);
  filtrosAvancadosRef.current = filtrosAvancados;

  // Buscar produtos (primeira página ou próxima)
  const fetchProdutos = useCallback(async (search: string, page: number, append: boolean, filtrosOverride?: { campo: string; tipo: string; valor: string }[]) => {
    if (buscandoRef.current) return;
    const filtrosAtivos = filtrosOverride ?? filtrosAvancadosRef.current;
    const temFiltros = filtrosAtivos.length > 0;
    if (!temFiltros && search.trim().length < 2) { setListaProd([]); setTotalProd(0); return; }
    buscandoRef.current = true;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      let data: any;
      if (temFiltros) {
        data = await buscaProdutosComFiltro({
          page, perPage: BATCH_SIZE,
          productSearch: search.trim(),
          filtros: filtrosAtivos,
        });
      } else {
        data = await getProdutos({ page, perPage: BATCH_SIZE, search: search.trim(), sortBy, sortDir, searchField });
      }
      if (data?.data?.length > 0) {
        setListaProd((prev) => append ? [...prev, ...data.data] : data.data);
        setTotalProd(data.meta?.total || 0);
        setPageLoaded(page);
        if (!append) {
          setLinhaSelecionada(0);
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
          setTimeout(() => modalRef.current?.focus(), 50);
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
  }, [sortBy, sortDir, searchField]);

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

  // Abrir input de quantidade
  const abrirQtd = useCallback((idx: number) => {
    const produto = listaProd[idx];
    if (!produto) return;
    setLinhaSelecionada(idx);
    setPedindoQtd(idx);
    setAvisoInline('');
    setQtdPendInput('0');
    setRefInput(produto.ref || produto.codprod || '');
    setDescrInput(produto.aplic_extendida || produto.descr || '');
    // Pré-preencher com qtd já adicionada ou 1
    const qtdAtual = adicionados.get(produto.codprod);
    setQtdInput(String(qtdAtual || 1));
    // Pré-preencher preço da tabela (ou preço já editado)
    const prv = Number(produto.prvenda) || 0;
    setPrecoInput(String(prv));
    setPrecoDigits(String(Math.round(prv * 100)));
    precoPristineRef.current = true;
  }, [listaProd, adicionados]);

  // Confirmar adição
  const confirmarAdicao = useCallback(() => {
    const produto = listaProd[pedindoQtd];
    if (!produto) return;
    const estoque = Number(produto.estoque_disponivel) || 0;
    let qtd = parseInt(qtdInput) || 0;
    let qtdpnd = parseInt(qtdPendInput) || 0;

    // Se qtd > estoque, ajustar: vende o que tem, resto vai pra pendência
    if (qtd > estoque && estoque > 0) {
      qtdpnd = qtd - estoque;
      qtd = estoque;
    }

    // Se não tem estoque e não tem pendência, bloquear
    if (qtd === 0 && qtdpnd === 0) {
      setAvisoInline('INFORME A QUANTIDADE OU A QUANTIDADE DE PENDÊNCIA DO PRODUTO.');
      return;
    }

    // Validação requisição (como Delphi chkNroReq)
    if (chkRequisicao) {
      if (!nrequisInput.trim()) {
        setAvisoInline('INFORME O Nº DA REQUISIÇÃO DO CLIENTE.');
        return;
      }
      if (!nritemInput.trim()) {
        setAvisoInline('INFORME O Nº DO ITEM NA REQUISIÇÃO DO CLIENTE.');
        return;
      }
    }

    const precoTabela = Number(produto.prvenda) || 0;
    let precoDigitado = precoPristineRef.current ? precoTabela : (parseInt(precoDigits || '0', 10) / 100) || precoTabela;
    const prcompraVal = Number(produto.prcompra) || 0;
    const isImportado = (produto.dolar || 'N') !== 'N';
    const margemMinPerc = isImportado ? 40 : 20;
    const precoMinimo = prcompraVal > 0 ? prcompraVal * (1 + margemMinPerc / 100) : 0;

    if (!hasMPV && precoMinimo > 0 && precoDigitado < precoMinimo) {
      precoDigitado = precoMinimo;
      setAvisoInline(`Preço ajustado p/ margem ${margemMinPerc}%: R$ ${precoMinimo.toFixed(2)}`);
    }

    const prunit = precoDigitado;
    const prcompra = Number(produto.prcompra) || 0;
    const margem = prcompra > 0 ? ((prunit / prcompra) - 1) * 100 : 0;
    const descPerc = precoTabela > 0 ? ((precoTabela - prunit) / precoTabela) * 100 : 0;

    const item: ItemAdicionado = {
      codprod: produto.codprod,
      ref: refInput || produto.ref || '',
      descr: descrInput || produto.aplic_extendida || produto.descr || '',
      qtd,
      prunit,
      prvenda_original: precoTabela,
      desconto_valor: (precoTabela - prunit) * qtd,
      desconto_percentual: Math.round(descPerc * 100) / 100,
      total_item: prunit * qtd,
      prcompra,
      prcustoatual: Number(produto.prcustoatual) || 0,
      margem: Math.round(margem * 100) / 100,
      codmarca: produto.codmarca || '',
      marca_nome: produto.marca_nome || produto.codmarca || '',
      origem: produto.dolar || 'N',
      estoque: Number(produto.estoque_disponivel) || 0,
      demanda: naoGerarDemanda ? 'N' : 'S',
      qtdpnd,
      nrequis: chkRequisicao ? nrequisInput.trim().padStart(15, '0') : '',
      nritem: chkRequisicao ? nritemInput.trim().padStart(6, '0') : '',
      _novo: true,
    };

    onAdicionarItens([item]);
    setAdicionados((prev) => { const m = new Map(prev); m.set(produto.codprod, qtd + qtdpnd); return m; });
    // Guardar requisição no histórico pra reusar
    if (chkRequisicao && nrequisInput.trim()) {
      setHistoricoRequisicoes(prev => {
        const nr = nrequisInput.trim().padStart(15, '0');
        return prev.includes(nr) ? prev : [...prev, nr];
      });
    }
    const nextIdx = pedindoQtd + 1;
    setPedindoQtd(-1);
    const pendLabel = qtdpnd > 0 ? `, pend: ${qtdpnd}` : '';
    toast({ title: `${produto.ref || produto.codprod} ${adicionados.has(produto.codprod) ? 'atualizado' : 'adicionado'} (qtd: ${qtd}${pendLabel})` });
    // Mover para próxima linha e focar no modal
    if (nextIdx < listaProd.length) {
      setLinhaSelecionada(nextIdx);
    }
    setTimeout(() => modalRef.current?.focus(), 100);
  }, [listaProd, pedindoQtd, qtdInput, qtdPendInput, precoInput, hasMPV, naoGerarDemanda, onAdicionarItens, toast]);

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

  // Sync refs das funções
  confirmarAdicaoRef.current = confirmarAdicao;
  abrirQtdRef.current = abrirQtd;
  abrirEquivalentesRef.current = abrirEquivalentes;
  abrirHistoricoRef.current = abrirHistorico;

  // Atalhos de teclado
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const emInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      // Se o filtro avançado está aberto, só responder Escape e F8
      if (mostrarFiltroAvancadoRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopImmediatePropagation();
          setMostrarFiltroAvancado(false);
        }
        return;
      }

      // Quando pedindoQtd ativo — só tratar Escape, deixar o resto para os onKeyDown dos campos inline
      if (pedindoQtdRef.current >= 0) {
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopImmediatePropagation();
          setPedindoQtd(-1);
          modalRef.current?.focus();
        }
        return;
      }

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
        const prods = listaProdRef.current;
        if (prods.length > 0) {
          if (emInput) {
            if (e.key === 'ArrowDown') {
              e.preventDefault(); e.stopImmediatePropagation();
              modalRef.current?.focus();
              setLinhaSelecionada(0);
              linhaSelecionadaRef.current = 0;
            }
            return;
          }
          e.preventDefault(); e.stopImmediatePropagation();
          const cur = linhaSelecionadaRef.current;
          if (e.key === 'ArrowDown') {
            const next = Math.min(cur + 1, prods.length - 1);
            linhaSelecionadaRef.current = next;
            setLinhaSelecionada(next);
          } else {
            if (cur <= 0) {
              const input = modalRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
              if (input) input.focus();
              linhaSelecionadaRef.current = -1;
              setLinhaSelecionada(-1);
            } else {
              linhaSelecionadaRef.current = cur - 1;
              setLinhaSelecionada(cur - 1);
            }
          }
        }
        return;
      }

      // Ctrl+F: filtro avançado (mesmo atalho do Delphi)
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        setMostrarFiltroAvancado((prev) => !prev);
        return;
      }

      // F10: histórico do item selecionado
      if (e.key === 'F10' && !emInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirHistoricoRef.current();
        return;
      }

      // F9 desabilitado — equivalentes já aparecem inline na parte inferior da tela

      // Enter fora do input: abrir qtd
      if (e.key === 'Enter' && !emInput && linhaSelecionadaRef.current >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirQtdRef.current(linhaSelecionadaRef.current);
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handler do filtro avançado
  const handleFiltroAvancado = useCallback((filtros: { campo: string; tipo: string; valor: string }[]) => {
    setFiltrosAvancados(filtros);
    setMostrarFiltroAvancado(false);
    setPedindoQtd(-1);
    setLinhaSelecionada(-1);
    setListaProd([]);
    setPageLoaded(0);
    // Re-buscar com filtros (passando os filtros diretamente pois o state ainda não atualizou)
    buscandoRef.current = false;
    if (filtros.length > 0 || currentSearch.trim().length >= 2) {
      setTimeout(() => fetchProdutos(currentSearch, 1, false, filtros), 0);
    }
  }, [currentSearch, fetchProdutos]);

  // Ordenação
  const handleSort = useCallback((col: string) => {
    const newDir = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(col);
    setSortDir(newDir);
    setLinhaSelecionada(-1);
    setPedindoQtd(-1);
    salvarPreferencias(col, newDir);
    // Re-buscar com nova ordenação
    const temFiltros = filtrosAvancadosRef.current.length > 0;
    if (temFiltros || currentSearch.trim().length >= 2) {
      buscandoRef.current = false;
      setListaProd([]);
      setPageLoaded(0);
      setTimeout(() => {
        if (temFiltros) {
          buscaProdutosComFiltro({
            page: 1, perPage: BATCH_SIZE,
            productSearch: currentSearch.trim(),
            filtros: filtrosAvancadosRef.current,
          }).then((data) => {
            if (data?.data?.length > 0) {
              setListaProd(data.data);
              setTotalProd(data.meta?.total || 0);
              setPageLoaded(1);
              setLinhaSelecionada(0);
            } else {
              setListaProd([]);
              setTotalProd(0);
            }
          }).catch(() => setListaProd([]));
        } else {
          getProdutos({ page: 1, perPage: BATCH_SIZE, search: currentSearch.trim(), sortBy: col, sortDir: newDir, searchField })
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
        }
      }, 0);
    }
  }, [sortBy, sortDir, currentSearch, salvarPreferencias, searchField]);

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
          <div ref={modalRef} tabIndex={-1} className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-[90vw] h-[85vh] flex flex-col outline-none">
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
              <span className="text-[10px] text-gray-700 dark:text-gray-200">
                {listaProd.length} de {totalProd} carregados
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-700 dark:text-gray-200">
              Enter buscar | ↑↓ navegar | Enter selecionar | Ctrl+F Filtros | F10 Hist. | Esc voltar/fechar
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Busca + Filtro Avançado */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') executarBusca(searchInput); }}
                placeholder={searchField === 'ref' ? 'Buscar por referência...' : 'Buscar por aplicação...'}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="searchField"
                  checked={searchField === 'ref'}
                  onChange={() => { setSearchField('ref'); salvarPreferencias(sortBy, sortDir, 'ref'); }}
                  className="w-3.5 h-3.5 text-blue-600 accent-blue-600"
                />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Referência</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="searchField"
                  checked={searchField === 'aplicacao'}
                  onChange={() => { setSearchField('aplicacao'); salvarPreferencias(sortBy, sortDir, 'aplicacao'); }}
                  className="w-3.5 h-3.5 text-blue-600 accent-blue-600"
                />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Aplicação</span>
              </label>
            </div>
            <button
              onClick={() => setMostrarFiltroAvancado(!mostrarFiltroAvancado)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                filtrosAvancados.length > 0
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
              }`}
              title="Filtros avançados (Ctrl+F)"
            >
              <Filter size={14} />
              <span>Filtros</span>
              {filtrosAvancados.length > 0 ? (
                <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {filtrosAvancados.length}
                </span>
              ) : null}
            </button>
            {filtrosAvancados.length > 0 ? (
              <button
                onClick={() => handleFiltroAvancado([])}
                className="px-2 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Limpar filtros"
              >
                <X size={14} />
              </button>
            ) : null}
            <label className="flex items-center gap-1.5 cursor-pointer select-none ml-2">
              <input type="checkbox" checked={chkRequisicao} onChange={(e) => setChkRequisicao(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Nº Requisição</span>
            </label>
          </div>
          {/* Chips dos filtros ativos */}
          {filtrosAvancados.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filtrosAvancados.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-medium rounded-full border border-blue-200 dark:border-blue-700">
                  <strong>{f.campo}</strong> {f.tipo} {f.valor || 'NULO'}
                  <button onClick={() => {
                    const novosFiltros = filtrosAvancados.filter((_, idx) => idx !== i);
                    handleFiltroAvancado(novosFiltros);
                  }} className="ml-0.5 hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Tabela com scroll */}
        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Lista de produtos */}
        <div ref={scrollRef} className="h-[60%] overflow-auto" onScroll={handleScroll}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.w} px-3 py-2 text-left text-[11px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700 ${col.sortable ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 select-none' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="py-8">
                    <Carregamento texto="Buscando produtos..." />
                  </td>
                </tr>
              ) : listaProd.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-gray-700 dark:text-gray-200 text-sm font-medium">
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
                    key={`${produto.codprod}-${idx}`}
                    className={`border-b border-gray-100 dark:border-zinc-800 transition-colors cursor-pointer
                      ${jaExistente ? 'opacity-40' : ''}
                      ${semEstoque && !jaExistente ? 'opacity-50' : ''}
                      ${isSelecionado ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
                    `}
                    onClick={() => { setLinhaSelecionada(idx); linhaSelecionadaRef.current = idx; if (pedindoQtd >= 0 && pedindoQtd !== idx) setPedindoQtd(-1); }}
                    onDoubleClick={() => abrirQtd(idx)}
                  >
                    {/* Referência */}
                    <td className="px-3 py-2 text-xs font-bold text-gray-900 dark:text-white w-[90px]">
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
                            <div data-inline-fields className="flex items-center gap-1 ml-3 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
                              <span className="text-[10px] text-gray-500">Ref:</span>
                              <input type="text" data-field="ref" value={refInput} onChange={(ev) => setRefInput(ev.target.value.toUpperCase())}
                                tabIndex={-1}
                                onFocus={(ev) => ev.target.select()}
                                onKeyDown={(ev) => {
                                  const el = ev.target as HTMLInputElement;
                                  const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                  const i = all.indexOf(el);
                                  if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                  if (ev.key === 'ArrowRight') { ev.nativeEvent.stopImmediatePropagation(); if (el.selectionStart === el.value.length) { ev.preventDefault(); if (i < all.length - 1) all[i + 1].focus(); } }
                                  if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); }
                                  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setPedindoQtd(-1); const prods = listaProdRef.current; const cur = linhaSelecionadaRef.current; const next = ev.key === 'ArrowDown' ? Math.min(cur + 1, prods.length - 1) : Math.max(cur - 1, 0); linhaSelecionadaRef.current = next; setLinhaSelecionada(next); modalRef.current?.focus(); }
                                }}
                                className="w-24 h-6 text-center text-xs border border-gray-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-500 uppercase" />
                              <span className="text-[10px] text-gray-500">Descr:</span>
                              <input type="text" data-field="descr" value={descrInput} onChange={(ev) => setDescrInput(ev.target.value)}
                                tabIndex={-1}
                                onFocus={(ev) => ev.target.select()}
                                onKeyDown={(ev) => {
                                  const el = ev.target as HTMLInputElement;
                                  const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                  const i = all.indexOf(el);
                                  if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); }
                                  if (ev.key === 'ArrowRight') { ev.nativeEvent.stopImmediatePropagation(); if (el.selectionStart === el.value.length) { ev.preventDefault(); if (i < all.length - 1) all[i + 1].focus(); } }
                                  if (ev.key === 'ArrowLeft') { ev.nativeEvent.stopImmediatePropagation(); if (el.selectionStart === 0) { ev.preventDefault(); if (i > 0) all[i - 1].focus(); } }
                                  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setPedindoQtd(-1); const prods = listaProdRef.current; const cur = linhaSelecionadaRef.current; const next = ev.key === 'ArrowDown' ? Math.min(cur + 1, prods.length - 1) : Math.max(cur - 1, 0); linhaSelecionadaRef.current = next; setLinhaSelecionada(next); modalRef.current?.focus(); }
                                }}
                                className="w-40 h-6 text-xs px-1 border border-gray-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-500" />
                              <span className="text-[10px] text-gray-500">Qtd:</span>
                              <input ref={qtdInputRef} type="number" min="0" value={qtdInput} data-field="qtd"
                                onFocus={(ev) => (ev.target as HTMLInputElement).select()}
                                onChange={(ev) => {
                                  const val = ev.target.value;
                                  setQtdInput(val);
                                  const dig = parseInt(val) || 0;
                                  const est = Number(produto.estoque_disponivel) || 0;
                                  if (dig > est && est > 0) {
                                    setQtdPendInput(String(dig - est));
                                    setAvisoInline(`QUANTIDADE SUPERIOR AO ESTOQUE (${est}). Pendência: ${dig - est}`);
                                  } else if (parseInt(qtdPendInput) > 0 && dig <= est) {
                                    setQtdPendInput('0');
                                    setAvisoInline('');
                                  }
                                }}
                                onKeyDown={(ev) => {
                                  const el = ev.target as HTMLInputElement;
                                  const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                  const i = all.indexOf(el);
                                  if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setTimeout(() => { const a2 = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []); const i2 = a2.indexOf(el); if (i2 < a2.length - 1) a2[i2 + 1].focus(); }, 50); }
                                  if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                  if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i > 0) all[i - 1].focus(); }
                                }}
                                className="w-14 h-6 text-center text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              {((Number(produto.estoque_disponivel) || 0) <= 0 || parseInt(qtdPendInput) > 0) ? (
                                <>
                                  <span className="text-[10px] text-gray-500">Pend:</span>
                                  <input type="number" min="0" value={qtdPendInput} data-field="pend"
                                    onFocus={(ev) => (ev.target as HTMLInputElement).select()}
                                    onChange={(ev) => setQtdPendInput(ev.target.value)}
                                    onKeyDown={(ev) => {
                                      const el = ev.target as HTMLInputElement;
                                      const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                      const i = all.indexOf(el);
                                      if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i > 0) all[i - 1].focus(); }
                                    }}
                                    className="w-14 h-6 text-center text-xs border border-orange-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                                </>
                              ) : null}
                              <span className="text-[10px] text-gray-500">R$:</span>
                              {(() => {
                                const pt = Number(produto.prvenda) || 0;
                                const pc = Number(produto.prcompra) || 0;
                                const isImp = (produto.dolar || 'N') !== 'N';
                                const mmPerc = isImp ? 40 : 20;
                                const pm = pc > 0 ? pc * (1 + mmPerc / 100) : 0;
                                const dig = parseFloat(String(precoInput).replace(',', '.')) || pt;
                                const abaixoMin = pm > 0 && dig < pm;
                                const abaixoTabela = dig < pt;
                                const borderClass = abaixoMin
                                  ? (hasMPV ? 'border-emerald-400 focus:ring-emerald-500' : 'border-red-400 focus:ring-red-500')
                                  : abaixoTabela ? 'border-amber-400 focus:ring-amber-500'
                                  : 'border-blue-400 focus:ring-blue-500';
                                const precoNum = precoPristineRef.current ? pt : parseInt(precoDigits || '0', 10) / 100;
                                const precoDisplay = precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                const precoAbaixoMin = pm > 0 && precoNum < pm;
                                const precoAbaixoTabela = precoNum < pt;
                                const borderClassFinal = precoAbaixoMin
                                  ? (hasMPV ? 'border-emerald-400 focus:ring-emerald-500' : 'border-red-400 focus:ring-red-500')
                                  : precoAbaixoTabela ? 'border-amber-400 focus:ring-amber-500'
                                  : 'border-blue-400 focus:ring-blue-500';
                                return (
                                  <>
                                    <input type="text" data-field="preco" value={precoDisplay} onChange={() => {}}
                                      onFocus={(ev) => ev.target.select()}
                                      onBlur={() => {
                                        const digitado = precoPristineRef.current ? pt : parseInt(precoDigits || '0', 10) / 100;
                                        if (!hasMPV && pm > 0 && digitado < pm) {
                                          setPrecoDigits(String(Math.round(pm * 100)));
                                          precoPristineRef.current = false;
                                          setPrecoInput(String(pm));
                                          setAvisoInline(`Preço ajustado p/ margem ${mmPerc}%: R$ ${pm.toFixed(2)}`);
                                        } else {
                                          setPrecoInput(String(digitado));
                                          setAvisoInline('');
                                        }
                                      }}
                                      onKeyDown={(ev) => {
                                        const el = ev.target as HTMLInputElement;
                                        const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                        const idx = all.indexOf(el);
                                        if (ev.key >= '0' && ev.key <= '9') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation();
                                          if (precoPristineRef.current) { precoPristineRef.current = false; setPrecoDigits(ev.key); }
                                          else { setPrecoDigits(prev => (prev + ev.key).replace(/^0+/, '') || '0'); }
                                        } else if (ev.key === 'Backspace') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation();
                                          if (precoPristineRef.current) { precoPristineRef.current = false; setPrecoDigits('0'); }
                                          else { setPrecoDigits(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); }
                                        } else if (ev.key === 'Enter') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation();
                                          const val = precoPristineRef.current ? pt : parseInt(precoDigits || '0', 10) / 100;
                                          setPrecoInput(String(val));
                                          if (idx < all.length - 1) all[idx + 1].focus();
                                        } else if (ev.key === 'ArrowLeft') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation();
                                          if (idx > 0) all[idx - 1].focus();
                                        } else if (ev.key === 'ArrowRight') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation();
                                          if (idx < all.length - 1) all[idx + 1].focus();
                                        } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
                                          ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setPedindoQtd(-1); const prods = listaProdRef.current; const cur = linhaSelecionadaRef.current; const next = ev.key === 'ArrowDown' ? Math.min(cur + 1, prods.length - 1) : Math.max(cur - 1, 0); linhaSelecionadaRef.current = next; setLinhaSelecionada(next); modalRef.current?.focus();
                                        }
                                      }}
                                      className={`w-24 h-6 text-center text-xs border rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 ${borderClassFinal}`} />
                                  </>
                                );
                              })()}
                              {chkRequisicao ? (
                                <>
                                  <span className="text-[10px] text-gray-500">Req:</span>
                                  <input type="text" data-field="nrequis" value={nrequisInput}
                                    onChange={(ev) => setNrequisInput(ev.target.value)}
                                    onFocus={(ev) => ev.target.select()}
                                    list="hist-requisicoes"
                                    onKeyDown={(ev) => {
                                      const el = ev.target as HTMLInputElement;
                                      const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                      const i = all.indexOf(el);
                                      if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowRight' && el.selectionStart === el.value.length) { ev.preventDefault(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowLeft' && el.selectionStart === 0) { ev.preventDefault(); if (i > 0) all[i - 1].focus(); }
                                    }}
                                    className="w-20 h-6 text-center text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  <datalist id="hist-requisicoes">
                                    {historicoRequisicoes.map(nr => <option key={nr} value={nr} />)}
                                  </datalist>
                                  <span className="text-[10px] text-gray-500">Item:</span>
                                  <input type="text" data-field="nritem" value={nritemInput}
                                    onChange={(ev) => setNritemInput(ev.target.value)}
                                    onFocus={(ev) => ev.target.select()}
                                    onKeyDown={(ev) => {
                                      const el = ev.target as HTMLInputElement;
                                      const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                      const i = all.indexOf(el);
                                      if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowRight' && el.selectionStart === el.value.length) { ev.preventDefault(); if (i < all.length - 1) all[i + 1].focus(); }
                                      if (ev.key === 'ArrowLeft' && el.selectionStart === 0) { ev.preventDefault(); if (i > 0) all[i - 1].focus(); }
                                    }}
                                    className="w-14 h-6 text-center text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </>
                              ) : null}
                              <span data-field="ok" tabIndex={0} role="button"
                                onClick={() => confirmarAdicao()}
                                onKeyDown={(ev) => {
                                  const el = ev.target as HTMLElement;
                                  const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                  const i = all.indexOf(el);
                                  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); confirmarAdicao(); }
                                  if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                  if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i > 0) all[i - 1].focus(); }
                                  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setPedindoQtd(-1); const prods = listaProdRef.current; const cur = linhaSelecionadaRef.current; const next = ev.key === 'ArrowDown' ? Math.min(cur + 1, prods.length - 1) : Math.max(cur - 1, 0); linhaSelecionadaRef.current = next; setLinhaSelecionada(next); modalRef.current?.focus(); }
                                }}
                                className="h-6 px-2 text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer select-none inline-flex items-center outline-none focus:ring-2 focus:ring-blue-400">OK</span>
                              {hasVDM ? (
                              <label className="flex items-center gap-1 ml-1 cursor-pointer select-none" title="NÃO gerar demanda para este item">
                                <input type="checkbox" data-field="demanda" checked={naoGerarDemanda} onChange={(ev) => setNaoGerarDemanda(ev.target.checked)}
                                  onKeyDown={(ev) => {
                                    const el = ev.target as HTMLInputElement;
                                    const all = Array.from(el.closest('[data-inline-fields]')?.querySelectorAll<HTMLElement>('[data-field]') || []);
                                    const i = all.indexOf(el);
                                    if (ev.key === 'Enter') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setNaoGerarDemanda(!el.checked); }
                                    if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i > 0) all[i - 1].focus(); }
                                    if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); if (i < all.length - 1) all[i + 1].focus(); }
                                    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.nativeEvent.stopImmediatePropagation(); setPedindoQtd(-1); const prods = listaProdRef.current; const cur = linhaSelecionadaRef.current; const next = ev.key === 'ArrowDown' ? Math.min(cur + 1, prods.length - 1) : Math.max(cur - 1, 0); linhaSelecionadaRef.current = next; setLinhaSelecionada(next); modalRef.current?.focus(); }
                                  }}
                                  className="w-3 h-3 accent-blue-600" />
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap">Não gerar demanda</span>
                              </label>
                              ) : null}
                              {hasMPV && (() => { const pc = Number(produto.prcompra) || 0; const isImp = (produto.dolar || 'N') !== 'N'; const pm = pc > 0 ? pc * (1 + (isImp ? 40 : 20) / 100) : 0; const dig = parseFloat(String(precoInput).replace(',', '.')) || 0; return pm > 0 && dig < pm; })() ? <span className="text-[9px] text-emerald-600 font-bold">MPV</span> : null}
                              {avisoInline ? <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 ml-1">{avisoInline}</span> : null}
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
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-white w-[100px]">
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

        {/* Equivalentes inline */}
          <div className="h-[40%] border-t-[3px] border-blue-400 dark:border-blue-600 flex flex-col">
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-blue-600" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                Equivalentes {linhaSelecionada >= 0 && listaProd[linhaSelecionada] ? `— ${listaProd[linhaSelecionada].ref || listaProd[linhaSelecionada].codprod}` : ''}
              </span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">{equivalentes.length} encontrado(s)</span>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingEquiv ? (
                <div className="flex items-center justify-center py-8 text-gray-700 dark:text-gray-200">
                  <Loader2 size={18} className="animate-spin mr-2" /> Buscando equivalentes...
                </div>
              ) : equivalentes.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-700 dark:text-gray-200 text-sm font-medium">
                  {linhaSelecionada >= 0 ? 'Nenhum equivalente encontrado' : 'Selecione um item para ver equivalentes'}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
                    <tr>
                      <th className="w-[90px] px-3 py-1.5 text-left text-[10px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700">Ref</th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700">Produto</th>
                      <th className="w-[100px] px-3 py-1.5 text-left text-[10px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700">Marca</th>
                      <th className="w-[70px] px-3 py-1.5 text-center text-[10px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700">Estoque</th>
                      <th className="w-[80px] px-3 py-1.5 text-right text-[10px] font-bold text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-zinc-700">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equivalentes.map((eq: any, eqIdx: number) => {
                      const codprod = eq.CODPROD || eq.codprod;
                      const ref = eq.REF || eq.ref || codprod;
                      const descr = eq.DESCR || eq.descr || '';
                      const marca = eq.MARCA || eq.marca_nome || '';
                      const estq = Number(eq.QTDDISPONIVEL || eq.qtddisponivel || eq.QTEST || eq.qtest || 0);
                      const preco = Number(eq.PRECOVENDA || eq.prvenda || 0);
                      return (
                        <tr key={`${codprod}-${eqIdx}`}
                          tabIndex={0}
                          className="border-b border-gray-100 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer focus:bg-blue-100 dark:focus:bg-blue-900 outline-none"
                          onClick={() => {
                            if (estq <= 0) { toast({ title: 'Produto sem estoque' }); return; }
                            const item: any = {
                              codprod, ref, descr, qtd: 1, prunit: preco, prvenda_original: preco,
                              desconto_valor: 0, desconto_percentual: 0, total_item: preco,
                              prcompra: 0, prcustoatual: 0, margem: 0, codmarca: '', marca_nome: marca,
                              origem: 'N', estoque: estq, demanda: 'S', qtdpnd: 0, _novo: true,
                            };
                            onAdicionarItens([item]);
                            setAdicionados((prev) => { const m = new Map(prev); m.set(codprod, 1); return m; });
                            toast({ title: `${ref} adicionado (equivalente)` });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); }
                          }}
                        >
                          <td className="px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-white">{ref}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-900 dark:text-white">{descr.substring(0, 60)}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-900 dark:text-white">{marca.substring(0, 20)}</td>
                          <td className={`px-3 py-1.5 text-xs text-center font-bold ${estq > 0 ? 'text-blue-600' : 'text-red-600'}`}>{estq}</td>
                          <td className="px-3 py-1.5 text-xs text-right font-bold text-gray-900 dark:text-white">R$ {preco.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
            <span className="ml-auto text-[10px] text-gray-700 dark:text-gray-200">Enter</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={abrirHistorico}>
            <History size={14} className="mr-2" /> Histórico Produto
            <span className="ml-auto text-[10px] text-gray-700 dark:text-gray-200">F10</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>
            Fechar
            <span className="ml-auto text-[10px] text-gray-700 dark:text-gray-200">Esc</span>
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

      {/* Modal Filtro Avançado */}
      {mostrarFiltroAvancado ? (
        <div className="fixed inset-0 z-[70] bg-black/50 flex justify-center items-center p-4" onClick={(ev) => { if (ev.target === ev.currentTarget) setMostrarFiltroAvancado(false); }}>
          <div className="w-full max-w-3xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-zinc-700">
                <h3 className="text-sm font-bold text-[#347AB6]">FILTROS AVANÇADOS</h3>
                <button onClick={() => setMostrarFiltroAvancado(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FiltroDinamicoDeClientes
                colunas={['ref', 'descr', 'codmarca', 'codgpp', 'codgpf', 'qtest', 'prcompra', 'prvenda', 'prfabr', 'ipi', 'codprod', 'dolar', 'curva', 'tipo', 'prcustoatual', 'trib', 'clasfiscal']}
                rotulos={{
                  ref: 'Referência',
                  descr: 'Aplicação',
                  codmarca: 'Marca',
                  codgpp: 'Grupo de Produto',
                  codgpf: 'Grupo de Função',
                  qtest: 'Quant. Estoque',
                  prcompra: 'Preço de Compra',
                  prvenda: 'Preço de Venda',
                  prfabr: 'Preço de Fábrica',
                  ipi: 'IPI',
                  codprod: 'Código',
                  dolar: 'Origem (S=Imp/N=Nac)',
                  curva: 'Curva ABC',
                  tipo: 'Tipo (ME/MC)',
                  prcustoatual: 'Custo Atual',
                  trib: 'Tributação',
                  clasfiscal: 'Class. Fiscal (NCM)',
                }}
                onChange={handleFiltroAvancado}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ModalAdicionarItemRapido;
