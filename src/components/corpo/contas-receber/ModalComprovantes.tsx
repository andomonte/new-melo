'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SelectPadrao from '@/components/common/SelectPadrao';
import { Search, Loader2, Printer, Ban, FileText } from 'lucide-react';

interface Comprovante {
  aut_id: string;
  aut_data: string;
  aut_codusr: string | null;
  aut_codconta: string | null;
  aut_autenticacao: string | null;
  aut_cancel: number;
  nomeusr: string | null;
  valor_total: number;
  qtd_titulos: number;
  codcli: number | null;
  nome_cliente: string | null;
}
interface ItemComprovante {
  ita_cod_receb: string;
  ita_nro_doc: string | null;
  ita_valor: number;
  ita_valo_areceber: number;
  ita_valor_juros: number;
  ita_valor_total: number;
  codcli: number | null;
  nome_cliente: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

const fmtBRL = (n: any) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => (d ? new Date(d).toLocaleString('pt-BR') : '-');

export default function ModalComprovantes({ isOpen, onClose, username }: Props) {
  const [lista, setLista] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativo' | 'cancelado' | 'todos'>('todos');
  const [sel, setSel] = useState<Comprovante | null>(null);
  const [itens, setItens] = useState<ItemComprovante[]>([]);
  const [loadingDet, setLoadingDet] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/contas-receber/comprovantes?status=${status}`);
      const d = await r.json();
      setLista(Array.isArray(d?.comprovantes) ? d.comprovantes : []);
    } catch {
      toast.error('Erro ao carregar comprovantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSel(null);
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, status]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter(
      (c) =>
        String(c.aut_id).includes(t) ||
        (c.nome_cliente || '').toLowerCase().includes(t) ||
        String(c.codcli || '').includes(t),
    );
  }, [lista, busca]);

  const abrirDetalhe = async (c: Comprovante) => {
    setSel(c);
    setLoadingDet(true);
    setItens([]);
    try {
      const r = await fetch(`/api/contas-receber/comprovantes?aut_id=${encodeURIComponent(c.aut_id)}`);
      const d = await r.json();
      setItens(Array.isArray(d?.itens) ? d.itens : []);
    } catch {
      toast.error('Erro ao carregar o detalhe do comprovante.');
    } finally {
      setLoadingDet(false);
    }
  };

  const imprimir = () => {
    if (!sel) return;
    const linhas = itens
      .map(
        (i) =>
          `<tr><td>${i.ita_cod_receb}</td><td>${i.ita_nro_doc || '-'}</td><td style="text-align:right">${fmtBRL(
            i.ita_valo_areceber,
          )}</td><td style="text-align:right">${fmtBRL(i.ita_valor_juros)}</td><td style="text-align:right">${fmtBRL(
            i.ita_valor_total,
          )}</td></tr>`,
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante ${sel.aut_id}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:4px 6px}th{background:#eee;text-align:left}</style></head>
      <body>
        <h2>Comprovante de Pagamento</h2>
        <div>Nº: <b>${sel.aut_id}</b> ${sel.aut_cancel === 1 ? '<b style="color:#c00">(CANCELADO)</b>' : ''}</div>
        <div>Data: ${fmtData(sel.aut_data)}</div>
        <div>Cliente: ${sel.codcli || ''} - ${sel.nome_cliente || ''}</div>
        <div>Operador: ${sel.nomeusr || sel.aut_codusr || ''} · Conta: ${sel.aut_codconta || ''}</div>
        <div>Autenticação: ${sel.aut_autenticacao || ''}</div>
        <table><thead><tr><th>Título</th><th>Documento</th><th>A receber</th><th>Juros</th><th>Total</th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr><td colspan="4" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${fmtBRL(
            sel.valor_total,
          )}</b></td></tr></tfoot>
        </table>
      </body></html>`;
    const w = window.open('', '_blank', 'width=720,height=600');
    if (!w) {
      toast.error('Permita pop-ups para imprimir.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const cancelar = async () => {
    if (!sel) return;
    if (sel.aut_cancel === 1) return;
    if (!confirm(`Cancelar o comprovante ${sel.aut_id}? Isso ESTORNA os títulos recebidos.`)) return;
    setCancelando(true);
    try {
      const r = await fetch('/api/contas-receber/comprovantes/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aut_id: sel.aut_id, usuario: username }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao cancelar.');
      toast.success(`Comprovante cancelado — ${d.estornados} título(s) estornado(s).`);
      setSel(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Comprovantes de Pagamento" width="w-[97%] max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Listagem */}
        <section className="rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-slate-700">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nº, cliente ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="w-40">
              <SelectPadrao
                value={status}
                onValueChange={(v) => setStatus(v as any)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'ativo', label: 'Ativos' },
                  { value: 'cancelado', label: 'Cancelados' },
                ]}
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                <tr>
                  <th className="px-2 py-1 text-left">Nº</th>
                  <th className="px-2 py-1 text-left">Data</th>
                  <th className="px-2 py-1 text-left">Cliente</th>
                  <th className="px-2 py-1 text-right">Valor</th>
                  <th className="px-2 py-1 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin inline" /> Carregando...
                    </td>
                  </tr>
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-gray-400">
                      Nenhum comprovante.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((c) => (
                    <tr
                      key={c.aut_id}
                      onClick={() => abrirDetalhe(c)}
                      className={`border-t border-gray-100 dark:border-slate-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 ${
                        sel?.aut_id === c.aut_id ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                      }`}
                    >
                      <td className="px-2 py-1 font-mono">{c.aut_id}</td>
                      <td className="px-2 py-1">{fmtData(c.aut_data)}</td>
                      <td className="px-2 py-1">
                        {c.codcli ? `${c.codcli} - ` : ''}
                        {c.nome_cliente || '-'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtBRL(c.valor_total)}</td>
                      <td className="px-2 py-1 text-center">
                        {Number(c.aut_cancel) === 1 ? (
                          <Badge className="bg-red-500 text-[10px]">Cancelado</Badge>
                        ) : (
                          <Badge className="bg-green-500 text-[10px]">Ativo</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detalhe */}
        <section className="rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <FileText size={16} />
            <span className="text-sm font-semibold">
              {sel ? `Comprovante ${sel.aut_id}` : 'Selecione um comprovante'}
            </span>
          </div>
          <div className="p-3">
            {!sel ? (
              <p className="text-sm text-gray-400 text-center py-8">Clique em um comprovante para ver os títulos.</p>
            ) : (
              <>
                <div className="text-xs space-y-0.5 mb-3">
                  <div>Data: <b>{fmtData(sel.aut_data)}</b></div>
                  <div>Cliente: <b>{sel.codcli ? `${sel.codcli} - ` : ''}{sel.nome_cliente || '-'}</b></div>
                  <div>Operador: <b>{sel.nomeusr || sel.aut_codusr || '-'}</b> · Conta: <b>{sel.aut_codconta || '-'}</b></div>
                  <div className="text-gray-500 break-all">Autenticação: {sel.aut_autenticacao || '-'}</div>
                </div>
                <div className="max-h-[38vh] overflow-auto rounded border border-gray-100 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-2 py-1 text-left">Título</th>
                        <th className="px-2 py-1 text-left">Doc</th>
                        <th className="px-2 py-1 text-right">A receber</th>
                        <th className="px-2 py-1 text-right">Juros</th>
                        <th className="px-2 py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDet ? (
                        <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                      ) : (
                        itens.map((i) => (
                          <tr key={i.ita_cod_receb} className="border-t border-gray-100 dark:border-slate-800">
                            <td className="px-2 py-1 font-mono">{i.ita_cod_receb}</td>
                            <td className="px-2 py-1">{i.ita_nro_doc || '-'}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.ita_valo_areceber)}</td>
                            <td className="px-2 py-1 text-right tabular-nums text-amber-600">{fmtBRL(i.ita_valor_juros)}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmtBRL(i.ita_valor_total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm">Total: <b className="font-mono">{fmtBRL(sel.valor_total)}</b></span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={imprimir}>
                      <Printer size={14} className="mr-1" /> Imprimir
                    </Button>
                    {sel.aut_cancel !== 1 && (
                      <Button type="button" variant="outline" size="sm" onClick={cancelar} disabled={cancelando}
                        className="text-red-600 border-red-300 hover:bg-red-50">
                        {cancelando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban size={14} className="mr-1" />}
                        Cancelar (estornar)
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
