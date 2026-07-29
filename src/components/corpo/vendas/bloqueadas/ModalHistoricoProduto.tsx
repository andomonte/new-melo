'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, History, Package, ShoppingCart, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ModalHistoricoProdutoProps {
  isOpen: boolean;
  onClose: () => void;
  produto: { codprod: string; ref: string; descr: string } | null;
}

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ModalHistoricoProduto: React.FC<ModalHistoricoProdutoProps> = ({ isOpen, onClose, produto }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState<any[]>([]);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [statsVendas, setStatsVendas] = useState({ total: 0, qtd: 0 });
  const [statsEntradas, setStatsEntradas] = useState({ total: 0, qtd: 0 });
  const [pedidosPendentes, setPedidosPendentes] = useState<any[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !produto?.codprod) return;
    setLoading(true);
    setVendas([]);
    setEntradas([]);

    // Buscar vendas e entradas em paralelo
    Promise.all([
      fetch(`/api/vendas/historico-produto?codprod=${produto.codprod}`).then(r => r.json()).catch(() => ({ vendas: [], stats: {} })),
      fetch(`/api/produtos/historico-pedidos?codprod=${produto.codprod}`).then(r => r.json()).catch(() => ({ entradas: [], stats: {} })),
    ]).then(([vendasData, entradasData]) => {
      setVendas(vendasData.vendas || []);
      setStatsVendas({ total: vendasData.stats?.totalVendido || 0, qtd: vendasData.stats?.qtdVendas || 0 });
      setEntradas(entradasData.entradas || []);
      setPedidosPendentes(entradasData.pedidosPendentes || []);
      setStatsEntradas({ total: entradasData.stats?.totalEntradas12m || 0, qtd: entradasData.stats?.qtdEntradas12m || 0 });
    }).finally(() => setLoading(false));
  }, [isOpen, produto?.codprod]);

  // Atalhos
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); setTimeout(onClose, 0); return; }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, onClose]);

  if (!isOpen || !produto) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
      <div ref={modalRef} className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-[90vw] h-[85vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <History size={18} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Histórico do Produto</h2>
              <span className="text-xs text-gray-500">{produto.ref} — {produto.descr?.substring(0, 60)} | Cód: {produto.codprod}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Esc fechar</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500 mr-2" />
            <span className="text-sm text-gray-500">Carregando histórico...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-6">
            {/* Cards resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart size={18} className="text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">Vendas (12m)</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statsVendas.qtd}</p>
                <p className="text-sm text-blue-600 font-medium mt-1">{statsVendas.total} unid. vendidas</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={18} className="text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300 font-semibold">Entradas (12m)</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{statsEntradas.qtd}</p>
                <p className="text-sm text-green-600 font-medium mt-1">{statsEntradas.total} unid. recebidas</p>
              </div>
              <div className={`rounded-lg p-4 border ${pedidosPendentes.length > 0 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={18} className={pedidosPendentes.length > 0 ? 'text-orange-600' : 'text-gray-400'} />
                  <span className={`text-sm font-semibold ${pedidosPendentes.length > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500'}`}>Pedidos Pendentes</span>
                </div>
                <p className={`text-2xl font-bold ${pedidosPendentes.length > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-400'}`}>{pedidosPendentes.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pedidosPendentes.length > 0 ? 'Em andamento' : 'Nenhum'}</p>
              </div>
            </div>

            {/* Pedidos Pendentes */}
            {pedidosPendentes.length > 0 ? (
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Truck size={14} className="text-orange-500" />
                  Pedidos em Andamento
                </h3>
                <div className="border rounded-lg overflow-hidden dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 dark:bg-orange-950/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Ordem</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Fornecedor</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Data Pedido</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Qtd</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Preço Unit.</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Previsão</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                      {pedidosPendentes.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                          <td className="px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{p.numero_ordem}</td>
                          <td className="px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{p.fornecedor || '-'}</td>
                          <td className="px-3 py-1.5 text-sm text-center text-gray-800 dark:text-gray-200">{formatDate(p.data_ordem)}</td>
                          <td className="px-3 py-1.5 text-sm text-right font-bold text-gray-900 dark:text-gray-100">{p.quantidade?.toFixed(0) || 0}</td>
                          <td className="px-3 py-1.5 text-sm text-right text-gray-800 dark:text-gray-200">{formatCurrency(p.preco_unitario || 0)}</td>
                          <td className="px-3 py-1.5 text-sm text-center font-bold text-orange-600 dark:text-orange-400">{formatDate(p.previsao_chegada)}</td>
                          <td className="px-3 py-1.5 text-sm text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              p.status_descricao === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
                              p.status_descricao === 'APROVADO' || p.status_descricao === 'EM TRANSITO' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{p.status_descricao}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Vendas */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <ShoppingCart size={14} className="text-blue-500" />
                Últimas Vendas
              </h3>
              <div className="border rounded-lg overflow-hidden dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 dark:bg-blue-950/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Venda</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Cliente</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Data</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Qtd</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Preço Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Total</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                    {vendas.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">Nenhuma venda nos últimos 12 meses</td></tr>
                    ) : vendas.map((v, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{v.codvenda}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{v.cliente || '-'}</td>
                        <td className="px-3 py-1.5 text-sm text-center text-gray-800 dark:text-gray-200">{formatDate(v.data)}</td>
                        <td className="px-3 py-1.5 text-sm text-right font-bold text-gray-900 dark:text-gray-100">{v.qtd}</td>
                        <td className="px-3 py-1.5 text-sm text-right text-gray-800 dark:text-gray-200">{formatCurrency(v.prunit)}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(v.total)}</td>
                        <td className="px-3 py-1.5 text-sm text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            v.status === 'F' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            v.status === 'B' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
                          }`}>{v.status === 'F' ? 'Faturada' : v.status === 'B' ? 'Bloqueada' : v.status === 'N' ? 'Normal' : v.status || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Entradas */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Package size={14} className="text-green-500" />
                Últimas Entradas / Compras
              </h3>
              <div className="border rounded-lg overflow-hidden dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 dark:bg-green-950/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Documento</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">NF</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Fornecedor</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Data</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Qtd</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Preço Unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                    {entradas.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-sm">Nenhuma entrada nos últimos 12 meses</td></tr>
                    ) : entradas.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300">{e.numero_documento || '-'}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200">{e.nota_fiscal || '-'}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{e.fornecedor || '-'}</td>
                        <td className="px-3 py-1.5 text-sm text-center text-gray-800 dark:text-gray-200">{formatDate(e.data_entrada)}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-semibold text-green-600 dark:text-green-400">+{e.quantidade?.toFixed(0) || 0}</td>
                        <td className="px-3 py-1.5 text-sm text-right text-gray-800 dark:text-gray-200">{formatCurrency(e.preco_unitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalHistoricoProduto;
