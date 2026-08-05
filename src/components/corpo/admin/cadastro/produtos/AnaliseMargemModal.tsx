import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Loader2, Percent, TrendingUp } from 'lucide-react';
import { useDebounce } from 'use-debounce';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Busca herdada da tela de produtos: abre já com esses produtos (estilo
   *  Delphi, que mostra todos os produtos do filtro). */
  buscaInicial?: string;
}

interface ProdutoLista {
  codprod: string;
  descr: string;
  ref?: string;
  marca?: string;
  grupoproduto?: string;
  estoque?: number;
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

const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const pct = (v: number) => `${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Análise de Margem de Preço dos Produtos (porte do Delphi Ctrl+M -
 * uniMargemPrecoVendasNovo). Mestre-detalhe: busca/lista de produtos à esquerda;
 * política de preço por tipo à direita, com edição da Margem Líquida (grava na
 * hora e recalcula o Preço de Venda com o motor validado).
 */
export default function AnaliseMargemModal({ isOpen, onClose, buscaInicial }: Props) {
  const [busca, setBusca] = useState('');
  const [debouncedBusca] = useDebounce(busca, 400);
  const [produtos, setProdutos] = useState<ProdutoLista[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  const [produtoSel, setProdutoSel] = useState<ProdutoLista | null>(null);
  const [politica, setPolitica] = useState<LinhaPolitica[]>([]);
  const [loadingPolitica, setLoadingPolitica] = useState(false);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Valor em edição por faixa (string) — commit no blur/Enter.
  const [margemEdit, setMargemEdit] = useState<Record<number, string>>({});
  // Ignora o disparo do debounce logo após abrir (o open effect já carregou).
  const pulaDebounceRef = useRef(false);

  const buscaRef = useRef<HTMLInputElement>(null);

  // Carrega a lista mestre (termo vazio = todos, 1ª página) — estilo Delphi,
  // que abre com todos os produtos do filtro.
  const carregarProdutos = useCallback(async (termo: string): Promise<ProdutoLista[]> => {
    setLoadingProdutos(true);
    try {
      const resp = await fetch(
        `/api/compras/produtos?search=${encodeURIComponent(termo)}&perPage=50&page=1`,
      );
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

  // Ao abrir: carrega a lista do filtro atual e já seleciona o 1º (detalhe).
  useEffect(() => {
    if (!isOpen) return;
    setErro(null);
    setMargemEdit({});
    setProdutoSel(null);
    setPolitica([]);
    const termo = buscaInicial || '';
    setBusca(termo);
    pulaDebounceRef.current = true;
    (async () => {
      const lista = await carregarProdutos(termo.trim());
      if (lista.length > 0) selecionarProduto(lista[0]);
    })();
    setTimeout(() => buscaRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, buscaInicial]);

  // Digitação: recarrega a lista (vazio = todos). Não reseleciona.
  useEffect(() => {
    if (!isOpen) return;
    if (pulaDebounceRef.current) {
      pulaDebounceRef.current = false;
      return;
    }
    carregarProdutos(debouncedBusca.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBusca]);

  const selecionarProduto = async (prod: ProdutoLista) => {
    setProdutoSel(prod);
    setPolitica([]);
    setMargemEdit({});
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
  };

  const salvarMargem = async (linha: LinhaPolitica, valorStr: string) => {
    if (!produtoSel) return;
    const nova = parseFloat(String(valorStr).replace(',', '.'));
    // Sem mudança / valor inválido → apenas restaura o texto exibido.
    if (Number.isNaN(nova) || nova === linha.margemLiquida) {
      setMargemEdit((p) => {
        const n = { ...p };
        delete n[linha.tipoPreco];
        return n;
      });
      return;
    }
    setSalvando(linha.tipoPreco);
    setErro(null);
    try {
      const resp = await fetch('/api/produtos/politica-preco/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codprod: produtoSel.codprod, tipoPreco: linha.tipoPreco, margem: nova }),
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
      } else {
        setErro(data?.error || 'NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
      }
    } catch {
      setErro('NÃO FOI POSSÍVEL ATUALIZAR O PREÇO DE VENDA.');
    } finally {
      setSalvando(null);
      setMargemEdit((p) => {
        const n = { ...p };
        delete n[linha.tipoPreco];
        return n;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#347AB6]" />
            <h3 className="text-lg font-semibold text-[#347AB6]">Análise de Margem de Preço</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Mestre: busca + lista de produtos */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto (cód, descr, ref, marca)..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">espaço = E · ; = OU · a marca entra na busca</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingProdutos ? (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando...
                </div>
              ) : produtos.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm px-3">
                  Nenhum produto encontrado.
                </div>
              ) : (
                produtos.map((prod) => (
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
                    </div>
                  </button>
                ))
              )}
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
                    <span className="ml-3 text-gray-400">Edite a <strong>Margem (%)</strong> — o preço recalcula e grava na hora.</span>
                  </div>
                  {erro && <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">{erro}</div>}
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
                          <th className="text-right p-2">ICMS</th>
                          <th className="text-right p-2">IPI</th>
                          <th className="text-right p-2">PIS</th>
                          <th className="text-right p-2">COFINS</th>
                          <th className="text-right p-2">DCI</th>
                          <th className="text-right p-2">Comis.</th>
                          <th className="text-right p-2">F. Desp.</th>
                          <th className="text-right p-2 font-semibold">Pr. Venda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {politica.map((l) => {
                          const editando = margemEdit[l.tipoPreco] !== undefined;
                          const valor = editando ? margemEdit[l.tipoPreco] : pct(l.margemLiquida);
                          return (
                            <tr key={l.tipoPreco} className="hover:bg-gray-50 dark:hover:bg-zinc-700/40">
                              <td className="p-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{l.tipoPrecoLabel}</td>
                              <td className="p-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{moeda(l.prcompra)}</td>
                              <td className="p-2 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    value={valor}
                                    onChange={(e) => setMargemEdit((p) => ({ ...p, [l.tipoPreco]: e.target.value }))}
                                    onFocus={(e) => {
                                      setMargemEdit((p) => ({ ...p, [l.tipoPreco]: pct(l.margemLiquida) }));
                                      e.currentTarget.select();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') {
                                        setMargemEdit((p) => { const n = { ...p }; delete n[l.tipoPreco]; return n; });
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    onBlur={(e) => salvarMargem(l, e.target.value)}
                                    disabled={salvando === l.tipoPreco}
                                    inputMode="decimal"
                                    className="w-20 text-right px-2 py-1 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                                  />
                                  {salvando === l.tipoPreco && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                                </div>
                              </td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.icms)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.ipi)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.pis)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.cofins)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.dci)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.comissao)}</td>
                              <td className="p-2 text-right text-gray-500 dark:text-gray-400">{pct(l.fatorDespesas)}</td>
                              <td className="p-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{moeda(l.precoVenda)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-400 inline-flex items-center gap-1">
            <Percent size={12} /> Fase 1 — edição de Margem Líquida (recalcula e grava na hora).
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-[#347AB6] text-white hover:bg-[#2a5f8f]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
