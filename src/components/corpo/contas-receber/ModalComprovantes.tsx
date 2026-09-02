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
  valor_original: number | null;
  taxa_admin: number | null;
  codcli: number | null;
  nome_cliente: string | null;
}
interface FormaPgto {
  nome: string | null;
  valor: number;
  coddocumento: string | null;
  codautorizacao: string | null;
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
  const [formas, setFormas] = useState<FormaPgto[]>([]);
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
    setFormas([]);
    try {
      const r = await fetch(`/api/contas-receber/comprovantes?aut_id=${encodeURIComponent(c.aut_id)}`);
      const d = await r.json();
      setItens(Array.isArray(d?.itens) ? d.itens : []);
      setFormas(Array.isArray(d?.formas) ? d.formas : []);
    } catch {
      toast.error('Erro ao carregar o detalhe do comprovante.');
    } finally {
      setLoadingDet(false);
    }
  };

  const imprimir = () => {
    if (!sel) return;
    // Número 2 casas no padrão do comprovante Delphi (sem "R$", separador BR).
    const num = (n: any) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalRecebido = itens.reduce((s, i) => s + Number(i.ita_valor || 0), 0);

    // Linhas dos títulos — "Título" = número do documento (nro_doc), não o cód. interno.
    const linhas = itens
      .map((i, idx) => {
        const original = i.valor_original != null ? i.valor_original : i.ita_valo_areceber;
        return `<tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${i.ita_nro_doc || '-'}</td>
          <td class="r">${num(original)}</td>
          <td class="r">${num(i.ita_valor_juros)}</td>
          <td class="r">${num(i.taxa_admin)}</td>
          <td class="r">${num(i.ita_valor_total)}</td>
          <td class="r">${num(i.ita_valor_total)}</td>
          <td class="r">${num(i.ita_valor)}</td>
        </tr>`;
      })
      .join('');

    // FORMAS DE PAGAMENTO (movimentos ligados ao comprovante).
    const linhasFormas = formas.length
      ? formas
          .map(
            (f) =>
              `<tr><td>${(f.nome || '-').toUpperCase()}</td><td class="r">${num(f.valor)}</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="2" style="color:#888">—</td></tr>`;

    const impressoEm = new Date().toLocaleString('pt-BR');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante ${sel.aut_id}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:18px}
        .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .logo img{height:46px;width:auto}
        .cli{border:1px solid #000;padding:4px 8px;font-size:11px;min-width:280px}
        .aut{text-align:right;font-family:monospace;font-size:10px}
        .barcode{font-family:monospace;font-size:22px;letter-spacing:1px;border:1px solid #000;padding:2px 8px;display:inline-block}
        h3{text-align:center;margin:14px 0 6px;font-size:13px;letter-spacing:1px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #000;padding:3px 6px}
        th{background:#f0f0f0;font-size:10px;text-align:left}
        td.r,th.r{text-align:right}
        .sec{margin-top:10px;font-weight:bold;font-size:11px}
        .formas{width:60%;margin-top:2px}
        /* Rodapé fixo no fim da página (igual ao Delphi) */
        .rodape{position:fixed;left:18px;right:18px;bottom:14px}
        .totrec{display:flex;justify-content:flex-end;align-items:center;gap:10px;font-size:13px}
        .totrec b{border:1px solid #000;padding:2px 20px;min-width:120px;text-align:right}
        .notas{margin-top:10px;font-size:9px;color:#333;display:flex;justify-content:space-between;align-items:flex-end}
        .cancel{color:#c00;font-weight:bold}
      </style></head>
      <body>
        <div class="top">
          <div class="logo">
            <img src="${origin}/images/logoPdf.png" alt="MELO" />
          </div>
          <div class="cli">
            <div><b>Cliente</b></div>
            <div>${sel.codcli || ''} - ${sel.nome_cliente || ''}</div>
            <div><b>Data:</b> ${fmtData(sel.aut_data)}</div>
          </div>
          <div class="aut">
            <div class="barcode">${sel.aut_id}</div>
            <div>${sel.aut_autenticacao || ''}</div>
          </div>
        </div>

        <h3>COMPROVANTE DE PAGAMENTO ${sel.aut_cancel === 1 ? '<span class="cancel">(CANCELADO)</span>' : ''}</h3>

        <table>
          <thead><tr>
            <th style="text-align:center">#</th>
            <th>Título</th>
            <th class="r">Valor Original</th>
            <th class="r">Valor do Juros</th>
            <th class="r">Taxa Admin.</th>
            <th class="r">Valor Total<sup>1</sup></th>
            <th class="r">Valor Total a Pagar<sup>1</sup></th>
            <th class="r">Valor Pago</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>

        <div class="sec">FORMAS DE PAGAMENTO</div>
        <table class="formas"><tbody>${linhasFormas}</tbody></table>

        <div class="rodape">
          <div class="totrec"><span><b style="border:none;padding:0">Total Recebido:</b></span><b>${num(totalRecebido)}</b></div>
          <div class="notas">
            <div>
              <div><sup>1</sup> Valor atualizado até o dia ${fmtData(sel.aut_data)}.</div>
              <div><sup>2</sup> Pagamento efetuado com cheque ou cheque-pré está sujeito a compensação.</div>
              <div>(*) Pagamento realizado parcialmente.</div>
            </div>
            <div>Impresso em ${impressoEm}</div>
          </div>
        </div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
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
                        <th className="px-2 py-1 text-right">Valor Original</th>
                        <th className="px-2 py-1 text-right">Juros</th>
                        <th className="px-2 py-1 text-right">Taxa Admin.</th>
                        <th className="px-2 py-1 text-right">Total</th>
                        <th className="px-2 py-1 text-right">Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDet ? (
                        <tr><td colSpan={6} className="px-2 py-4 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                      ) : (
                        itens.map((i) => (
                          <tr key={i.ita_cod_receb} className="border-t border-gray-100 dark:border-slate-800">
                            {/* "Título" para o usuário = número do documento (nro_doc), não o cód. interno */}
                            <td className="px-2 py-1 font-mono">{i.ita_nro_doc || i.ita_cod_receb}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.valor_original ?? i.ita_valo_areceber)}</td>
                            <td className="px-2 py-1 text-right tabular-nums text-amber-600">{fmtBRL(i.ita_valor_juros)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.taxa_admin)}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmtBRL(i.ita_valor_total)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(i.ita_valor)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {formas.length > 0 && (
                  <div className="mt-2 text-[11px]">
                    <div className="font-semibold text-gray-600 dark:text-gray-300">Formas de Pagamento</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {formas.map((f, idx) => (
                        <span key={idx} className="text-gray-700 dark:text-gray-300">
                          {(f.nome || '-').toUpperCase()}: <b className="tabular-nums">{fmtBRL(f.valor)}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
