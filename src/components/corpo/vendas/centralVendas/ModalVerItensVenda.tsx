// /src/components/corpo/vendas/centralVendas/ModalVerItensVenda.tsx

import React from 'react';
import { Venda, ItemVenda, ItemVendaSalva } from '@/data/vendas/vendas';
import { X, User, CreditCard, Truck, FileText, Package, Calendar, DollarSign } from 'lucide-react';

interface ModalVerItensVendaProps {
  isOpen: boolean;
  onClose: () => void;
  venda: Venda | null;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const d = String(dateStr).substring(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : '-';
};

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const str = String(dateStr);
  const d = str.substring(0, 10).split('-');
  const t = str.substring(11, 16);
  if (d.length !== 3) return '-';
  // Só mostra hora se não for 00:00 (vendas antigas sem hora)
  return t && t !== '00:00' ? `${d[2]}/${d[1]}/${d[0]} ${t}` : `${d[2]}/${d[1]}/${d[0]}`;
};

const statusLabel = (s: string | null) => {
  const map: Record<string, { text: string; color: string }> = {
    N: { text: 'Não Faturada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    F: { text: 'Faturada', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    B: { text: 'Bloqueada', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
    C: { text: 'Cancelada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    S: { text: 'Orçada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  };
  const cfg = map[s || ''] || { text: s || '-', color: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.text}</span>;
};

const InfoRow = ({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-zinc-700/50 last:border-0">
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-gray-100`}>{value || '-'}</span>
  </div>
);

const ModalVerItensVenda: React.FC<ModalVerItensVendaProps> = ({
  isOpen,
  onClose,
  venda,
}) => {
  // Escape fecha o modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !venda) return null;

  const itens = venda.dbitvenda || [];
  const header = (venda as any)?.draft?.payload?.header || {};
  const cli = (venda as any)?.dbclien || {};
  const totalVenda = Number(venda.total) || 0;
  const debito = Number(cli.debito) || 0;
  const limite = Number(cli.limite) || 0;
  const saldo = limite - debito;

  const totalItens = itens.reduce((acc, item) => {
    return acc + (Number(item.prunit) * Number(item.qtd) - Number(item.desconto || 0));
  }, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-[96vw] h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b-2 border-blue-500/20 dark:border-zinc-700 bg-gradient-to-r from-blue-500/5 to-transparent dark:from-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-blue-700 dark:text-blue-400">
              Detalhes da Venda — {venda.codvenda}
            </h2>
            {statusLabel(venda.status)}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-500 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Cards de informação */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cliente */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-zinc-700/50 bg-blue-50/50 dark:bg-blue-900/10">
                <User size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Cliente</span>
              </div>
              <div className="px-4 py-2">
                <InfoRow label="Código" value={venda.codcli} />
                <InfoRow label="Nome" value={cli.nomefant || cli.nome} bold />
                {cli.cpfcgc ? <InfoRow label="CNPJ/CPF" value={cli.cpfcgc} /> : null}
                {cli.cidade ? <InfoRow label="Cidade/UF" value={`${cli.cidade || ''}${cli.uf ? '/' + cli.uf : ''}`} /> : null}
                <InfoRow label="Limite" value={formatCurrency(limite)} />
                <InfoRow label="Débito" value={<span className={debito > 0 ? 'text-red-600 dark:text-red-400' : ''}>{formatCurrency(debito)}</span>} />
                <InfoRow label="Saldo" value={<span className={saldo > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatCurrency(saldo)}</span>} bold />
              </div>
            </div>

            {/* Dados da Venda */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-zinc-700/50 bg-green-50/50 dark:bg-green-900/10">
                <FileText size={14} className="text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Dados da Venda</span>
              </div>
              <div className="px-4 py-2">
                <InfoRow label="Data" value={formatDateTime(venda.data as any)} />
                <InfoRow label="Vendedor" value={header.vendedor_nome ? `${header.vendedor} — ${header.vendedor_nome}` : header.vendedor} />
                <InfoRow label="Operador" value={header.operador_nome ? `${header.operador} — ${header.operador_nome}` : header.operador} />
                <InfoRow label="Pedido" value={header.pedido} />
                <InfoRow label="Local Entrega" value={header.localentregacliente} />
                <InfoRow label="Observações" value={header.obs} />
              </div>
            </div>

            {/* Pagamento e Transporte */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-zinc-700/50 bg-purple-50/50 dark:bg-purple-900/10">
                <CreditCard size={14} className="text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">Pagamento / Transporte</span>
              </div>
              <div className="px-4 py-2">
                <InfoRow label="Prazo" value={header.prazo} />
                <InfoRow label="Forma Pagamento" value={header.obsfat} />
                <InfoRow label="Transportadora" value={header.transp} />
                <InfoRow label="Frete" value={header.vlrfrete ? formatCurrency(Number(header.vlrfrete)) : null} />
                <InfoRow label="Total" value={<span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalVenda)}</span>} bold />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Itens */}
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Package size={14} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">{itens.length} Itens</span>
          </div>
          {itens.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Nenhum item nesta venda.
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Ref</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Marca</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Unit.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Desc.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-100 dark:divide-zinc-700/50">
                  {itens.map((item: ItemVenda | ItemVendaSalva, idx: number) => {
                    const qtd = Number(item.qtd);
                    const prunit = Number(item.prunit);
                    const desconto = Number(item.desconto || 0);
                    const totalItem = prunit * qtd - desconto;
                    const produto = item.dbprod;
                    const ref = (item as any).ref || produto?.codprod || item.codprod || '';

                    return (
                      <tr key={`${item.codprod}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{ref}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            {produto?.origem ? (
                              <img src={produto.origem === 'N' ? '/images/brasil.png' : '/images/importado.png'} alt="" className="w-4 h-3 object-contain" />
                            ) : null}
                            <span>{produto?.descr || item.descr || 'Sem descrição'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{(produto as any)?.dbmarcas?.descr || '-'}</td>
                        <td className="px-3 py-2 text-sm text-center font-semibold text-gray-800 dark:text-gray-200">{qtd}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(prunit)}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-500 dark:text-gray-400">{desconto > 0 ? formatCurrency(desconto) : '-'}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalItem)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-zinc-800 border-t-2 border-gray-300 dark:border-zinc-600">
                    <td colSpan={6} className="px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 text-right">TOTAL:</td>
                    <td className="px-3 py-2 text-base font-bold text-blue-600 dark:text-blue-400 text-right">{formatCurrency(totalVenda)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalVerItensVenda;
