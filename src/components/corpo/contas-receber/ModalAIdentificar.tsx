'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Loader2, Search, HelpCircle } from 'lucide-react';

interface LinhaAI {
  lin_id: number;
  data: string;
  historico: string;
  valorCentavos: number;
  pagador: { documento: string | null; tipo: string | null; nome: string | null };
  lote_id: number;
  banco: string | null;
  conta: string | null;
  arquivo: string | null;
  dias: number;
  bucket: string;
}
interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario: string;
  filial?: string;
  codContaPadrao?: string;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BUCKETS = ['0-7', '8-30', '31-60', '+60'] as const;
const corBucket = (b: string) =>
  b === '0-7' ? 'bg-emerald-600' : b === '8-30' ? 'bg-amber-500' : b === '31-60' ? 'bg-orange-600' : 'bg-red-600';

export default function ModalAIdentificar({ isOpen, onClose, usuario, filial, codContaPadrao }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaAI[]>([]);
  const [resumo, setResumo] = useState<Record<string, { qtd: number; totalCentavos: number }>>({});
  const [bucket, setBucket] = useState<string>(''); // '' = todos
  const [termo, setTermo] = useState('');
  const [cofId, setCofId] = useState<string | null>(null);
  const [codConta, setCodConta] = useState(codContaPadrao || '');
  const [memorizar, setMemorizar] = useState(true);
  // busca manual por linha
  const [buscaLinha, setBuscaLinha] = useState<number | null>(null);
  const [buscaTermo, setBuscaTermo] = useState('');
  const [buscaResultados, setBuscaResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [vinculando, setVinculando] = useState<number | null>(null);

  // Conta do operador vem do login (igual Caixa/Conciliação).
  useEffect(() => {
    if (codContaPadrao) { setCodConta(String(codContaPadrao)); return; }
    if (usuario && filial) {
      fetch(`/api/perfilFilial/get?user_login_id=${encodeURIComponent(usuario)}&nome_filial=${encodeURIComponent(filial)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCodConta(d?.cod_conta ? String(d.cod_conta) : ''))
        .catch(() => setCodConta(''));
    }
  }, [codContaPadrao, usuario, filial]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams();
      if (termo.trim().length >= 2) qs.set('termo', termo.trim());
      if (bucket) qs.set('bucket', bucket);
      const r = await fetch(`/api/conciliacao/a-identificar?${qs.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao carregar');
      setLinhas(d.linhas || []);
      setResumo(d.resumo || {});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, [termo, bucket]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(carregar, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [isOpen, carregar]);

  const buscarManual = async (l: LinhaAI, t: string) => {
    setBuscaTermo(t);
    if (t.trim().length < 2) { setBuscaResultados([]); return; }
    setBuscando(true);
    try {
      const r = await fetch(`/api/conciliacao/buscar-titulos?termo=${encodeURIComponent(t)}&valor_cent=${l.valorCentavos}`);
      const d = await r.json();
      setBuscaResultados(d.titulos || []);
    } catch {
      setBuscaResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const vincular = async (l: LinhaAI, cod_receb: string) => {
    if (!codConta.trim()) { toast.error('Seu login não tem conta de recebimento — peça o cadastro.'); return; }
    if (!cofId) { toast.error('Selecione a conta financeira.'); return; }
    setVinculando(l.lin_id);
    try {
      const r = await fetch('/api/conciliacao/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lin_id: l.lin_id, titulos: [cod_receb], cof_id: cofId, cod_conta: codConta.trim(), usuario, salvarApelido: memorizar }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao vincular');
      toast.success(`Baixa conciliada (comprovante ${d.aut_id ?? '-'}).`);
      setLinhas((prev) => prev.filter((x) => x.lin_id !== l.lin_id));
      setBuscaLinha(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVinculando(null);
    }
  };

  const totalMostrado = useMemo(() => linhas.reduce((s, l) => s + l.valorCentavos, 0), [linhas]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recebimentos a identificar" width="w-[97%] max-w-7xl">
      <div className="space-y-4">
        {/* Aging + total */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setBucket('')}
            className={`rounded-full px-2.5 py-0.5 font-medium text-white bg-slate-600 transition ${bucket === '' ? 'ring-2 ring-offset-1 ring-slate-600 dark:ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}
          >
            Todos
          </button>
          {BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-full px-2.5 py-0.5 font-medium text-white ${corBucket(b)} transition ${bucket === b ? 'ring-2 ring-offset-1 dark:ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}
              title="dias desde o crédito"
            >
              {b} dias: {resumo[b]?.qtd ?? 0} · {brl(resumo[b]?.totalCentavos ?? 0)}
            </button>
          ))}
        </div>

        {/* Conta de baixa + busca */}
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2">
          <div className="w-56">
            <Label className="text-[11px]">Conta financeira (classificação)</Label>
            <Autocomplete
              placeholder="Buscar conta..."
              apiUrl="/api/contas-receber/contas"
              value={cofId}
              onChange={(v) => setCofId(v)}
              mapResponse={(data) => (data.contas || []).map((c: any) => ({ value: c.id, label: c.label }))}
            />
          </div>
          <div className="self-center">
            <Label className="text-[11px]">Conta operador (do login)</Label>
            {codConta ? (
              <div className="font-mono text-sm text-blue-900 dark:text-blue-100 h-9 flex items-center">{codConta}</div>
            ) : (
              <div className="text-[11px] text-red-600 h-9 flex items-center max-w-[220px] leading-tight">
                Login sem conta de recebimento — peça o cadastro.
              </div>
            )}
          </div>
          <label className="self-center flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={memorizar} onChange={(e) => setMemorizar(e.target.checked)} />
            memorizar pagador ao vincular
          </label>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-[11px]">Filtrar</Label>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="histórico, CPF/CNPJ ou nome…" className="h-9 text-xs" />
          </div>
        </div>

        <div className="text-[11px] text-gray-500">
          {carregando ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> carregando…</span>
          ) : (
            <>Mostrando <b>{linhas.length}</b> recebimento(s) · <b>{brl(totalMostrado)}</b>. Vincule ao título correto para dar baixa.</>
          )}
        </div>

        <div className="max-h-[55vh] overflow-auto rounded border border-gray-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
              <tr>
                <th className="px-2 py-1 text-left">Data / Idade</th>
                <th className="px-2 py-1 text-left">Histórico / Pagador</th>
                <th className="px-2 py-1 text-left">Origem</th>
                <th className="px-2 py-1 text-right">Valor</th>
                <th className="px-2 py-1 text-center w-40">Vincular a título</th>
              </tr>
            </thead>
            <tbody>
              {!carregando && linhas.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-[11px]">Nenhum recebimento a identificar neste filtro.</td></tr>
              )}
              {linhas.map((l) => {
                const aberta = buscaLinha === l.lin_id;
                return (
                  <Fragment key={l.lin_id}>
                    <tr className="border-t border-gray-100 dark:border-slate-800 align-top">
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div>{new Date(l.data).toLocaleDateString('pt-BR')}</div>
                        <span className={`inline-block mt-0.5 rounded-full px-1.5 text-[9px] text-white ${corBucket(l.bucket)}`}>{l.dias}d</span>
                      </td>
                      <td className="px-2 py-1">
                        <div>{l.historico}</div>
                        <div className="text-[10px] text-gray-500">
                          {l.pagador.documento ? `${l.pagador.tipo?.toUpperCase()} ${l.pagador.documento}` : 'sem doc'}
                          {l.pagador.nome ? ` · ${l.pagador.nome}` : ''}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-[10px] text-gray-500">
                        {l.banco || '-'} {l.conta ? `· ${l.conta}` : ''}<br />
                        <span className="text-gray-400">lote #{l.lote_id}</span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">{brl(l.valorCentavos)}</td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => { setBuscaLinha(aberta ? null : l.lin_id); setBuscaTermo(''); setBuscaResultados([]); }}
                          className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Search size={12} /> {aberta ? 'fechar' : 'buscar título'}
                        </button>
                      </td>
                    </tr>
                    {aberta && (
                      <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                        <td colSpan={5} className="px-3 py-2">
                          <Input
                            autoFocus
                            placeholder="Buscar título por cliente, código ou nota..."
                            value={buscaTermo}
                            onChange={(e) => buscarManual(l, e.target.value)}
                            className="mb-2 h-8 text-xs"
                          />
                          {buscando && <div className="text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin inline" /> buscando…</div>}
                          <div className="max-h-40 overflow-auto space-y-1">
                            {buscaResultados.map((t: any) => (
                              <div key={t.cod_receb} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-[11px]">
                                <span>
                                  <span className="font-mono">{t.cod_receb}</span> · {t.codcli} - {t.nome_cliente} · {t.nro_doc || '-'} · venc {new Date(t.dt_venc).toLocaleDateString('pt-BR')} · <b>{brl(t.saldoCentavos)}</b>
                                </span>
                                <Button size="sm" className="h-6 text-[10px]" disabled={vinculando === l.lin_id} onClick={() => vincular(l, t.cod_receb)}>
                                  Vincular
                                </Button>
                              </div>
                            ))}
                            {!buscando && buscaTermo.length >= 2 && buscaResultados.length === 0 && (
                              <div className="text-[11px] text-gray-400 inline-flex items-center gap-1"><HelpCircle size={12} /> Nenhum título em aberto encontrado.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-500">
          Estes são créditos que caíram no banco mas o pagador não foi reconhecido. Ao <b>Vincular</b> ao título
          correto, dá a baixa e (se marcado) memoriza o pagador para as próximas importações resolverem sozinhas.
        </p>
      </div>
    </Modal>
  );
}
