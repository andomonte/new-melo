'use client';

/**
 * Consulta de PRÉ-PEDIDOS no Caixa (SOMENTE LEITURA) — equivalente ao Delphi
 * "Consultas e Operações para Pré-Pedidos" na visão só de consulta.
 *
 * O operador localiza o pré-pedido (por data / nº / cliente) e COPIA o número
 * para colar na busca do Caixa e faturar. Não altera nem cancela nada.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Search, X, Copy, Check, Loader2, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const hojeISO = () => new Date().toISOString().slice(0, 10);
// Default: últimos 30 dias (pré-pedido pendente pode ter alguns dias).
const umMesAtrasISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: any) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '—';
};

interface PrePedido {
  codvenda: string;
  nrovenda: string;
  data: string;
  tipo: string;
  status: string;
  obs: string;
  nome_cliente: string | null;
  total: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** opcional: joga o número copiado direto na busca do Caixa. */
  onUsarNumero?: (nrovenda: string) => void;
}

export default function ModalConsultaPrePedidos({ isOpen, onClose, onUsarNumero }: Props) {
  const [desde, setDesde] = useState(umMesAtrasISO());
  const [termo, setTermo] = useState('');
  const [rows, setRows] = useState<PrePedido[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiadoTimer = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDesde(umMesAtrasISO());
    setTermo('');
    setRows(null);
    setBusy(false);
    setCopiado(null);
  }, [isOpen]);

  useEffect(() => () => { if (copiadoTimer.current) clearTimeout(copiadoTimer.current); }, []);

  const filtrar = async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde);
      if (termo.trim()) params.append('termo', termo.trim());
      const resp = await fetch(`/api/caixa/consultar-prevendas?${params.toString()}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Erro ao consultar');
      setRows(data.prevendas || []);
      if (!data.prevendas?.length) toast.info('Nenhum pré-pedido para os filtros informados.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao consultar');
    } finally {
      setBusy(false);
    }
  };

  const copiarNumero = async (nro: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(nro);
      } else {
        const ta = document.createElement('textarea');
        ta.value = nro;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(nro);
      toast.success(`Nº ${nro} copiado.`);
      if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
      copiadoTimer.current = setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error('Não consegui copiar — selecione e copie manualmente.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          <ShoppingCart size={18} />
          <span className="font-bold">Consultar Pré-Pedidos</span>
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Filtros */}
        <div className="shrink-0 px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-end gap-3 flex-wrap">
          <div>
            <Label>A partir de</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-40" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label>Localizar (nº, código ou nome do cliente)</Label>
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') filtrar(); }}
              placeholder="Ex.: 123456 ou nome do cliente"
              className="mt-1 w-full"
            />
          </div>
          <button
            type="button"
            onClick={filtrar}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 h-10"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Filtrar
          </button>
        </div>

        {/* Resultado */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {rows === null ? (
            <div className="p-8 text-center text-sm text-gray-400">Informe os filtros e clique em <b>Filtrar</b>.</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhum pré-pedido para os filtros informados.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 text-gray-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Data</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Nº Venda</th>
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                  <th className="px-3 py-2 font-semibold">Observação</th>
                  <th className="px-3 py-2 font-semibold text-center">Nº</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.codvenda} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(r.data)}</td>
                    <td className="px-3 py-2 font-mono">{r.tipo || '—'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{r.nrovenda}</td>
                    <td className="px-3 py-2 truncate max-w-[220px]">{r.nome_cliente || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{brl(r.total)}</td>
                    <td className="px-3 py-2 truncate max-w-[220px] text-gray-500">{r.obs || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Copiar número do pré-pedido"
                          onClick={() => copiarNumero(r.nrovenda)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-slate-700"
                        >
                          {copiado === r.nrovenda ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                        {onUsarNumero && (
                          <button
                            type="button"
                            title="Usar este número na busca do Caixa"
                            onClick={() => { onUsarNumero(r.nrovenda); onClose(); }}
                            className="text-[11px] font-semibold text-blue-600 hover:underline px-1"
                          >
                            Usar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-400">
            {rows !== null && `${rows.length} pré-pedido(s)`} · somente consulta
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
