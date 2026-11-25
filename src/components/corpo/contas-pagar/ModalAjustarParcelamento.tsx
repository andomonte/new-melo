/**
 * Contas a Pagar → Ajustar parcelamento (aberto pelo Editar).
 * Só é permitido se nenhuma parcela tiver pagamento, remessa, crédito ou adiantamento
 * (o servidor confere de novo). Vencimento e valor editáveis; incluir/remover parcela;
 * a soma precisa fechar com o total. Parcela removida é CANCELADA (histórico preservado).
 * Regras: src/lib/contasPagar/ajusteParcelamento.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { mascaraInputBRL, desmascarar } from '@/utils/monetario';

interface Linha { cod_pgto: string | null; nro_dup: string | null; dt_venc: string; valor: string }

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const paraMascara = (v: number) => mascaraInputBRL(String(Math.round(v * 100)));
const somarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
const dataBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);

export default function ModalAjustarParcelamento({ codPgto, usuario, aberto, onFechar, onAjustado }: {
  codPgto: string | number | null; usuario?: string; aberto: boolean; onFechar: () => void; onAjustado: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [total, setTotal] = useState(0);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [originais, setOriginais] = useState<Linha[]>([]);

  useEffect(() => {
    if (!aberto || !codPgto) return;
    setCarregando(true);
    fetch(`/api/contas-pagar/${codPgto}/ajustar-parcelamento`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.erro || 'Erro'); return j; })
      .then((j) => {
        setTotal(Number(j.total) || 0);
        setBloqueios(j.bloqueios || []);
        const l = (j.parcelas || []).map((p: any) => ({ cod_pgto: p.cod_pgto, nro_dup: p.nro_dup, dt_venc: p.dt_venc, valor: paraMascara(Number(p.valor_pgto)) }));
        setLinhas(l);
        setOriginais(l);
      })
      .catch((e) => { toast.error(e.message); onFechar(); })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, codPgto]);

  const soma = useMemo(() => Math.round(linhas.reduce((s, l) => s + desmascarar(l.valor), 0) * 100) / 100, [linhas]);
  const diferenca = Math.round((total - soma) * 100) / 100;
  const bloqueado = bloqueios.length > 0;
  const removidas = originais.filter((o) => !linhas.some((l) => l.cod_pgto === o.cod_pgto));
  const valido = !bloqueado && linhas.length > 0 && diferenca === 0
    && linhas.every((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.dt_venc) && desmascarar(l.valor) > 0);

  const set = (i: number, k: 'dt_venc' | 'valor', v: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: k === 'valor' ? mascaraInputBRL(v) : v } : l)));

  const incluir = () => setLinhas((ls) => {
    const ultima = ls[ls.length - 1]?.dt_venc;
    return [...ls, { cod_pgto: null, nro_dup: null, dt_venc: ultima ? somarDias(ultima, 30) : '', valor: paraMascara(Math.max(diferenca, 0)) }];
  });

  // divide o total igualmente (1ª parcela leva os centavos), mantendo os vencimentos
  const dividirIgual = () => setLinhas((ls) => {
    const n = ls.length;
    if (!n) return ls;
    const base = Math.floor((total / n) * 100) / 100;
    const primeira = Math.round((total - base * (n - 1)) * 100) / 100;
    return ls.map((l, i) => ({ ...l, valor: paraMascara(i === 0 ? primeira : base) }));
  });

  const salvar = async () => {
    if (removidas.length && !window.confirm(`${removidas.length} parcela(s) serão CANCELADAS (${removidas.map((r) => r.nro_dup || r.cod_pgto).join(', ')}). Confirma?`)) return;
    setGravando(true);
    try {
      const r = await fetch(`/api/contas-pagar/${codPgto}/ajustar-parcelamento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, parcelas: linhas.map((l) => ({ cod_pgto: l.cod_pgto, dt_venc: l.dt_venc, valor: desmascarar(l.valor) })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao ajustar o parcelamento');
      toast.success(`Parcelamento ajustado: ${j.parcelas.length} parcela(s)${j.canceladas.length ? `, ${j.canceladas.length} cancelada(s)` : ''}.`);
      onAjustado();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };

  return (
    <Modal isOpen={aberto} onClose={() => !gravando && onFechar()} title="Ajustar parcelamento" zClass="z-[60]">
      {carregando ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <div className="space-y-3 text-sm">
          {bloqueado ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" /> Este parcelamento não pode ser ajustado</div>
              <ul className="list-disc pl-5">{bloqueios.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Altere vencimentos e valores, inclua ou remova parcelas. A soma precisa fechar com o total;
              parcela removida fica cancelada e a duplicata é renumerada.
            </p>
          )}

          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Duplicata atual</th>
                <th className="py-1 pr-2">Vencimento</th><th className="py-1 pr-2 text-right">Valor (R$)</th><th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.cod_pgto || `nova-${i}`} className="border-t border-gray-100 dark:border-zinc-700">
                  <td className="py-1 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-1 pr-2 font-mono text-xs">{l.cod_pgto ? (l.nro_dup || l.cod_pgto) : <span className="text-blue-600 dark:text-blue-400">nova</span>}</td>
                  <td className="py-1 pr-2">
                    <Input type="date" value={l.dt_venc} disabled={bloqueado} className="h-8 w-40"
                      onChange={(e) => set(i, 'dt_venc', e.target.value)} />
                  </td>
                  <td className="py-1 pr-2">
                    <Input inputMode="numeric" value={l.valor} disabled={bloqueado} className="h-8 w-36 text-right"
                      onFocus={(e) => e.target.select()} onChange={(e) => set(i, 'valor', e.target.value)} />
                  </td>
                  <td className="py-1">
                    {!bloqueado && linhas.length > 1 && (
                      <button type="button" title="Remover parcela" className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!bloqueado && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={incluir}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700">
                <Plus className="h-3.5 w-3.5" /> Incluir parcela
              </button>
              <button type="button" onClick={dividirIgual}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700">
                Dividir o total igualmente
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded bg-gray-50 p-2 dark:bg-zinc-800">
            <span>Total: <b>{brl(total)}</b></span>
            <span>Soma: <b>{brl(soma)}</b></span>
            <span className={diferenca === 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              Diferença: <b>{brl(diferenca)}</b>
            </span>
          </div>
          {removidas.length > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Serão canceladas: {removidas.map((r) => `${r.nro_dup || r.cod_pgto} (${dataBR(r.dt_venc)})`).join(', ')}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFechar} disabled={gravando}
              className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700">
              {bloqueado ? 'Fechar' : 'Cancelar'}
            </button>
            {!bloqueado && (
              <button type="button" onClick={salvar} disabled={!valido || gravando}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar parcelamento
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
