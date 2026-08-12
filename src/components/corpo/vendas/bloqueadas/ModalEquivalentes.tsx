'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  demanda: string;
  qtdpnd: number;
  nrequis: string;
  nritem: string;
  _novo: boolean;
}

interface ProdutoOrigem {
  codprod: string;
  ref: string;
  descr: string;
  codgpe: string;
  origem: string;
}

interface ModalEquivalentesProps {
  isOpen: boolean;
  onClose: () => void;
  onAdicionarItens: (itens: ItemAdicionado[]) => void;
  itensExistentes: string[];
  produto: ProdutoOrigem | null;
}

const ModalEquivalentes: React.FC<ModalEquivalentesProps> = ({
  isOpen,
  onClose,
  onAdicionarItens,
  itensExistentes,
  produto,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [linhaSelecionada, setLinhaSelecionada] = useState(-1);
  const [adicionados, setAdicionados] = useState<Map<string, number>>(new Map());
  const [pedindoQtd, setPedindoQtd] = useState(-1);
  const [qtdInput, setQtdInput] = useState('1');

  const modalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qtdInputRef = useRef<HTMLInputElement>(null);
  const linhaSelecionadaRef = useRef(-1);
  linhaSelecionadaRef.current = linhaSelecionada;

  // Buscar equivalentes ao abrir
  useEffect(() => {
    if (!isOpen || !produto?.codgpe) {
      setLista([]);
      setLinhaSelecionada(-1);
      setAdicionados(new Map());
      setPedindoQtd(-1);
      return;
    }
    setLoading(true);
    setLinhaSelecionada(-1);
    setAdicionados(new Map());
    setPedindoQtd(-1);
    setQtdInput('1');

    fetch('/api/vendas/postgresql/produtoEquival', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CODGPE: produto.codgpe, PRVENDA: '0' }),
    })
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        setLista(items);
        if (items.length > 0) setLinhaSelecionada(0);
      })
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [isOpen, produto?.codgpe]);

  // Focar qtd input
  useEffect(() => {
    if (pedindoQtd >= 0) {
      setTimeout(() => { qtdInputRef.current?.focus(); qtdInputRef.current?.select(); }, 50);
    }
  }, [pedindoQtd]);

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

  // Pode adicionar?
  const podeAdicionar = useCallback((item: any) => {
    if (!item) return false;
    const est = Number(item.QTDDISPONIVEL ?? item.QTEST ?? 0);
    if (est <= 0) return false;
    const cod = item.CODPROD || item.codprod;
    if (itensExistentes.includes(cod)) return false;
    return true;
  }, [itensExistentes]);

  // Abrir qtd
  const abrirQtd = useCallback((idx: number) => {
    const item = lista[idx];
    if (!podeAdicionar(item)) {
      const est = Number(item?.QTDDISPONIVEL ?? item?.QTEST ?? 0);
      if (est <= 0) toast({ title: 'Produto sem estoque disponível' });
      else toast({ title: 'Item já está na venda' });
      return;
    }
    setLinhaSelecionada(idx);
    setPedindoQtd(idx);
    const cod = item.CODPROD || item.codprod;
    setQtdInput(String(adicionados.get(cod) || 1));
  }, [lista, podeAdicionar, adicionados, toast]);

  // Confirmar adição
  const confirmarAdicao = useCallback(() => {
    const item = lista[pedindoQtd];
    if (!item) return;
    const qtd = parseInt(qtdInput) || 1;
    const est = Number(item.QTDDISPONIVEL ?? item.QTEST ?? 0);
    if (qtd > est) {
      toast({ title: `Quantidade maior que estoque (${est})`, variant: 'destructive' });
      return;
    }

    const cod = item.CODPROD || item.codprod;
    const prunit = Number(item.PRECOVENDA || item.prvenda || 0);
    const prcompra = Number(item.prcompra || 0);
    const margem = prcompra > 0 ? ((prunit / prcompra) - 1) * 100 : 0;

    const novoItem: ItemAdicionado = {
      codprod: cod,
      ref: item.REF || item.ref || '',
      descr: item.DESCR || item.descr || '',
      qtd,
      prunit,
      prvenda_original: prunit,
      desconto_valor: 0,
      desconto_percentual: 0,
      total_item: prunit * qtd,
      prcompra,
      prcustoatual: Number(item.prcustoatual || 0),
      margem: Math.round(margem * 100) / 100,
      codmarca: item.MARCA || item.codmarca || '',
      marca_nome: item.MARCA || '',
      origem: item.dolar || 'N',
      demanda: 'S',
      qtdpnd: 0,
      nrequis: '',
      nritem: '',
      _novo: true,
    };

    onAdicionarItens([novoItem]);
    setAdicionados((prev) => { const m = new Map(prev); m.set(cod, qtd); return m; });
    setPedindoQtd(-1);
    toast({ title: `${novoItem.ref || cod} adicionado (qtd: ${qtd})` });
  }, [lista, pedindoQtd, qtdInput, onAdicionarItens, toast]);

  // Atalhos
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
        e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
        setTimeout(onClose, 0);
        return;
      }

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && lista.length > 0 && !emInput) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.key === 'ArrowDown') {
          setLinhaSelecionada((prev) => Math.min(prev + 1, lista.length - 1));
        } else {
          setLinhaSelecionada((prev) => Math.max(prev - 1, 0));
        }
        return;
      }

      if (e.key === 'Enter' && !emInput && linhaSelecionadaRef.current >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        abrirQtd(linhaSelecionadaRef.current);
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, lista, pedindoQtd, confirmarAdicao, abrirQtd, onClose]);

  if (!isOpen || !produto) return null;

  const fmtMoeda = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
      <div ref={modalRef} className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-[90vw] h-[85vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <ArrowLeftRight size={18} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-[#347AB6]">Produtos Equivalentes</h2>
              <span className="text-xs text-gray-500">
                {produto.ref} — {produto.descr?.substring(0, 50)} | Grupo: {produto.codgpe}
              </span>
            </div>
            {adicionados.size > 0 ? (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-2 py-1 rounded-full font-medium">
                {adicionados.size} adicionado(s)
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">
              ↑↓ navegar | Enter selecionar | Esc fechar
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500 mr-2" />
            <span className="text-sm text-gray-500">Buscando equivalentes...</span>
          </div>
        ) : null}

        {/* Lista vazia */}
        {!loading && lista.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {produto.codgpe ? 'Nenhum produto equivalente encontrado' : 'Produto não possui grupo de equivalência'}
          </div>
        ) : null}

        {/* Tabela */}
        {!loading && lista.length > 0 ? (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-700 w-[100px]">Referência</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-700">Produto</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-700 w-[100px]">Marca</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-700 w-[70px]">Estoque</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase border-b border-gray-200 dark:border-zinc-700 w-[80px]">Preço</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((item, idx) => {
                  const cod = item.CODPROD || item.codprod;
                  const ref = item.REF || item.ref || '';
                  const descr = item.DESCR || item.descr || '';
                  const marca = item.MARCA || '';
                  const estoque = Number(item.QTDDISPONIVEL ?? item.QTEST ?? 0);
                  const preco = Number(item.PRECOVENDA || item.prvenda || 0);
                  const jaExistente = itensExistentes.includes(cod);
                  const jaAdicionado = adicionados.has(cod);
                  const semEstoque = estoque <= 0;
                  const isSelecionado = idx === linhaSelecionada;

                  return (
                    <tr
                      key={cod}
                      className={`border-b border-gray-100 dark:border-zinc-800 transition-colors cursor-pointer
                        ${jaExistente ? 'opacity-40' : ''}
                        ${semEstoque && !jaExistente ? 'opacity-50' : ''}
                        ${isSelecionado ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
                      `}
                      onClick={() => abrirQtd(idx)}
                    >
                      <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">{ref}</td>
                      <td className="px-3 py-1">
                        <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                          <div title={descr} style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {descr}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            {jaExistente ? <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">Na venda</span> : null}
                            {jaAdicionado ? <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded ml-2">Qtd: {adicionados.get(cod)}</span> : null}
                            {semEstoque && !jaExistente ? <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded ml-2">S/ EST.</span> : null}
                            {idx === pedindoQtd ? (
                              <div className="flex items-center gap-1 ml-3" onClick={(ev) => ev.stopPropagation()}>
                                <span className="text-[10px] text-gray-500">Qtd:</span>
                                <input ref={qtdInputRef} type="number" min="1" max={estoque} value={qtdInput} onChange={(ev) => setQtdInput(ev.target.value)}
                                  className="w-14 h-6 text-center text-xs border border-blue-400 rounded bg-white dark:bg-zinc-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                <button onClick={() => confirmarAdicao()} className="h-6 px-2 text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white rounded">OK</button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div title={marca} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
                          {marca}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-xs text-center ${semEstoque ? 'text-red-500 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>{estoque}</td>
                      <td className="px-3 py-2 text-xs text-right text-blue-600 dark:text-blue-400 font-medium">{fmtMoeda(preco)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ModalEquivalentes;
