/**
 * Modal para buscar e importar itens de pedidos de compra aprovados.
 * Filtra por fornecedor (cod_credor) e permite multi-select.
 * Padrão visual igual ao BuscarContaPagarModal.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Loader2, Check, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import { fmtDecimal } from '../utils/formatters';

interface ItemPedido {
  orc_id: string;
  codprod: string;
  ref: string;
  descricao: string;
  qtd_disponivel: number;
  preco_unit: number;
  unidade: string;
  ncm: string;
}

export interface ItemPedidoSelecionado {
  codprod: string;
  descricao: string;
  qtd: number;
  proforma_unit: number;
  invoice_unit: number;
  unidade: string;
  ncm: string;
  id_orc: number;
}

interface ImportarPedidoModalProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (itens: ItemPedidoSelecionado[]) => void;
  codCredor?: string;
  fornecedorNome?: string;
}

export const ImportarPedidoModal: React.FC<ImportarPedidoModalProps> = ({
  aberto,
  onFechar,
  onConfirmar,
  codCredor,
  fornecedorNome,
}) => {
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Map<string, ItemPedido>>(new Map());
  // Quantidade a importar por ordem selecionada (default = saldo da ordem). Editável
  // para permitir ratear um produto entre ordens diferentes (pega parcial de cada uma).
  const [qtdPorItem, setQtdPorItem] = useState<Map<string, number>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const temFornecedor = !!(codCredor || fornecedorNome);

  const fetchItens = useCallback(async (termo: string) => {
    if (!temFornecedor) return;
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (codCredor) {
        params.set('cod_credor', codCredor);
      } else if (fornecedorNome) {
        params.set('fornecedor_nome', fornecedorNome);
      }
      if (termo) params.set('search', termo);

      const res = await api.get(`/api/importacao/itens-pedido?${params}`);
      setItens(res.data?.itens || []);
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [codCredor, fornecedorNome, temFornecedor]);

  useEffect(() => {
    if (aberto && temFornecedor) {
      setBusca('');
      setItens([]);
      setSelecionados(new Map());
      setQtdPorItem(new Map());
      fetchItens('');
    }
  }, [aberto, codCredor, fornecedorNome, fetchItens]);

  const handleBuscaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusca(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchItens(val), 400);
  };

  // Chave única: orc_id + codprod (mesmo produto pode estar em pedidos diferentes)
  const chave = (item: ItemPedido) => `${item.orc_id}__${item.codprod}`;

  const toggleSelecao = (item: ItemPedido) => {
    const k = chave(item);
    const estaSelecionado = selecionados.has(k);
    setSelecionados((prev) => {
      const novo = new Map(prev);
      if (estaSelecionado) novo.delete(k);
      else novo.set(k, item);
      return novo;
    });
    setQtdPorItem((prev) => {
      const novo = new Map(prev);
      if (estaSelecionado) novo.delete(k);
      else novo.set(k, item.qtd_disponivel); // default = saldo da ordem
      return novo;
    });
  };

  // Ajusta a quantidade a importar de uma ordem (limitada ao saldo disponível).
  const setQtd = (k: string, valor: string, max: number) => {
    let v = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > max) v = max;
    setQtdPorItem((prev) => new Map(prev).set(k, v));
  };

  const handleConfirmar = () => {
    const resultado: ItemPedidoSelecionado[] = Array.from(selecionados.values())
      .map((item) => {
        const k = chave(item);
        const qtd = qtdPorItem.get(k) ?? item.qtd_disponivel;
        return {
          codprod: item.codprod,
          descricao: item.descricao,
          qtd,
          proforma_unit: item.preco_unit,
          invoice_unit: item.preco_unit,
          unidade: item.unidade,
          ncm: item.ncm,
          id_orc: parseInt(item.orc_id),
        };
      })
      .filter((r) => r.qtd > 0); // ignora linhas com quantidade zerada
    onConfirmar(resultado);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#347AB6]" />
            <h3 className="text-lg font-bold text-[#347AB6]">Importar do Pedido de Compra</h3>
          </div>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={handleBuscaChange}
              placeholder="Buscar por codigo, referencia ou descricao..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
              autoFocus
            />
          </div>
        </div>

        {/* Chips de selecionados — com quantidade editável por ordem (rateio) */}
        {selecionados.size > 0 && (
          <div className="px-5 py-2 border-b border-gray-200 dark:border-zinc-700 shrink-0">
            <div className="flex flex-wrap gap-2">
              {Array.from(selecionados.values()).map((item) => {
                const k = chave(item);
                const qtd = qtdPorItem.get(k) ?? item.qtd_disponivel;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-xs font-medium bg-[#347AB6]/10 text-[#347AB6] dark:bg-blue-900/30 dark:text-blue-400 border border-[#347AB6]/20 dark:border-blue-800"
                  >
                    <span className="font-mono text-[11px]">OC #{item.orc_id}</span>
                    <span className="truncate max-w-[180px]">
                      {item.codprod} - {item.descricao.substring(0, 24)}{item.descricao.length > 24 ? '…' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={qtd}
                        onChange={(e) => setQtd(k, e.target.value, item.qtd_disponivel)}
                        title="Quantidade a importar desta ordem"
                        className="w-14 text-right font-mono px-1 py-0.5 rounded border border-[#347AB6]/30 dark:border-blue-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#347AB6]"
                      />
                      <span className="text-gray-400 dark:text-gray-500">/ {fmtDecimal(item.qtd_disponivel, 0)}</span>
                    </span>
                    <button
                      onClick={() => toggleSelecao(item)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              Ajuste a quantidade para pegar parte de uma ordem — selecione outra ordem do mesmo produto para ratear o restante.
            </p>
          </div>
        )}

        {/* Tabela */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
          ) : itens.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
              Nenhum item de pedido encontrado para este fornecedor
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                <tr className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <th className="w-10 py-2 px-2" />
                  <th className="text-left py-2 px-2">Pedido</th>
                  <th className="text-left py-2 px-2">Codigo</th>
                  <th className="text-left py-2 px-2">REF</th>
                  <th className="text-left py-2 px-2">Descricao</th>
                  <th className="text-right py-2 px-2">Qtd Disponivel</th>
                  <th className="text-right py-2 px-2">Preco Unit</th>
                  <th className="text-center py-2 px-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => {
                  const k = chave(item);
                  const sel = selecionados.has(k);
                  return (
                    <tr
                      key={k}
                      onClick={() => toggleSelecao(item)}
                      className={`border-b border-gray-100 dark:border-zinc-700 cursor-pointer transition-colors ${
                        sel
                          ? 'bg-[#347AB6]/5 dark:bg-blue-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <td className="py-2 px-2 text-center">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          sel
                            ? 'bg-[#347AB6] border-[#347AB6]'
                            : 'border-gray-300 dark:border-zinc-600'
                        }`}>
                          {sel && <Check size={12} className="text-white" />}
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-gray-900 dark:text-gray-100">
                        {item.orc_id}
                      </td>
                      <td className="py-2 px-2 font-mono text-gray-900 dark:text-gray-100">
                        {item.codprod}
                      </td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300">
                        {item.ref || '-'}
                      </td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-300 truncate max-w-[250px]">
                        {item.descricao || '-'}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                        {fmtDecimal(item.qtd_disponivel, 0)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">
                        {fmtDecimal(item.preco_unit)}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-300">
                        {item.unidade || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-zinc-700 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selecionados.size > 0
              ? `${selecionados.size} item(ns) selecionado(s)`
              : `${itens.length} item(ns) encontrado(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selecionados.size === 0}
              onClick={handleConfirmar}
              className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
            >
              Importar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
