'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatarBRL } from '@/utils/monetario';
import { Loader2 } from 'lucide-react';

/**
 * Modal "Baixar Juros" (liberar taxa) para UM título do Contas a Receber, acionado pelo
 * menu de ações da linha. Porte do Delphi UniContasR.BaixarJuros: NÃO recebe o título —
 * autoriza uma taxa (0 = isentar) com motivo obrigatório (≥15) p/ o próximo recebimento,
 * gravando em fin_libera_juros. Reaproveita os mesmos endpoints do painel de recebimento:
 *  - prévia ao vivo: POST /api/caixa/dados-recebimento (taxaOverride, read-only)
 *  - gravação: POST /api/contas-receber/liberar-juros
 */

interface TituloJuros {
  cod_receb: string;
  nome_cliente?: string | null;
  nro_doc?: string | null;
  dt_venc?: string | null;
}

interface Props {
  isOpen: boolean;
  conta: TituloJuros | null;
  /** Login do operador (auditoria). */
  username: string;
  /** Usuário logado — usa user.codusr para lij_cod_usuario (varchar 4). */
  user?: { usuario?: string; codusr?: string | number } | null;
  onClose: () => void;
  /** Chamado após liberar (o pai recarrega o grid). */
  onSuccess: () => void;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
// Data-only (DATE) sem shift de fuso: 'YYYY-MM-DD' -> 'DD/MM/YYYY'.
const fmtDataBR = (v?: string | null) => {
  if (!v) return '-';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '-';
};

export default function ModalBaixarJuros({
  isOpen,
  conta,
  username,
  user,
  onClose,
  onSuccess,
}: Props) {
  const [taxa, setTaxa] = useState('');
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [liberando, setLiberando] = useState(false);
  const [preview, setPreview] = useState<{ juros: number; total: number; dias: number } | null>(null);

  // Reset ao abrir/trocar de título.
  useEffect(() => {
    if (!isOpen || !conta) return;
    setMotivo('');
    setData(hojeISO());
    setPreview(null);
    // Pré-carrega a taxa atual do título (se houver) para exibir/editar.
    const ctrl = new AbortController();
    fetch('/api/caixa/dados-recebimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_receb: [conta.cod_receb], dataPgto: hojeISO() }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = Number(d?.taxaJuros);
        setTaxa(Number.isFinite(t) ? String(t) : '');
      })
      .catch(() => setTaxa(''));
    return () => ctrl.abort();
  }, [isOpen, conta]);

  // Prévia ao vivo (debounce 300ms) — juros só incide sobre atraso até a data prevista.
  useEffect(() => {
    if (!isOpen || !conta) return;
    const tx = Number(String(taxa).replace(',', '.'));
    if (!Number.isFinite(tx) || tx < 0 || !data) {
      setPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const tmr = setTimeout(() => {
      fetch('/api/caixa/dados-recebimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cod_receb: [conta.cod_receb], dataPgto: data, taxaOverride: tx }),
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.totais) {
            setPreview(null);
            return;
          }
          const dias = (d.titulos || []).reduce(
            (m: number, t: any) => Math.max(m, Number(t.diasAtraso || 0)),
            0
          );
          setPreview({
            juros: Number(d.totais.juros || 0),
            total: Number(d.totais.aReceber || 0),
            dias,
          });
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(tmr);
      ctrl.abort();
    };
  }, [isOpen, conta, taxa, data]);

  const confirmar = async () => {
    if (!conta) return;
    const tx = Number(String(taxa).replace(',', '.'));
    if (!Number.isFinite(tx) || tx < 0) {
      toast.error('Informe uma taxa de juros válida (0 = isentar).');
      return;
    }
    if (motivo.trim().length < 15) {
      toast.error('O motivo é obrigatório (mínimo 15 caracteres).');
      return;
    }
    setLiberando(true);
    try {
      const r = await fetch('/api/contas-receber/liberar-juros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_receb: conta.cod_receb,
          taxa: tx,
          motivo: motivo.trim(),
          usuario: username,
          codusr: user?.codusr ?? null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao liberar juros');
      toast.success(
        `Juros liberado à taxa ${tx}% para o título ${conta.nro_doc || conta.cod_receb}.`
      );
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLiberando(false);
    }
  };

  if (!isOpen || !conta) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Baixar Juros" width="w-[94%] max-w-lg">
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-3 space-y-3">
        <div className="text-xs font-bold text-blue-800 dark:text-blue-200">
          {conta.nome_cliente || 'Cliente'}
          {conta.nro_doc ? ` · Doc ${conta.nro_doc}` : ''} · Venc {fmtDataBR(conta.dt_venc)}
        </div>

        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <Label className="text-[11px]">Taxa liberada (% a.m.) — 0 isenta</Label>
            <Input
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
              inputMode="decimal"
              placeholder="ex: 0"
              className="font-mono h-9"
            />
          </div>
          <div>
            <Label className="text-[11px]">Data prevista de pagamento</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="font-mono h-9"
            />
          </div>
        </div>

        {/* Prévia: juros só incide sobre ATRASO até a data prevista */}
        <div className="text-[11px] rounded bg-white/70 dark:bg-zinc-800/70 border border-blue-100 dark:border-zinc-700 px-2 py-1.5">
          {preview ? (
            preview.dias > 0 ? (
              <>
                Nessa taxa, pagando em {fmtDataBR(data)}: <b>{preview.dias}</b> dia(s) de atraso →
                juros <b className="text-amber-600">{formatarBRL(preview.juros)}</b> · total{' '}
                <b>{formatarBRL(preview.total)}</b>
              </>
            ) : (
              <span className="text-gray-500">
                Título <b>em dia</b> nessa data (0 dia de atraso) → <b>sem juros</b>. O juros só
                incide após o vencimento.
              </span>
            )
          ) : (
            <span className="text-gray-400">Informe taxa e data para ver a prévia do juros.</span>
          )}
        </div>

        <div>
          <Label className="text-[11px]">Motivo (mín. 15 caracteres)</Label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full text-xs rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 resize-y"
            placeholder="Justificativa da liberação de juros…"
          />
          <div
            className={`text-[10px] mt-0.5 ${
              motivo.trim().length < 15 ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            {motivo.trim().length}/15
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={liberando}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {liberando && <Loader2 className="size-3.5 animate-spin" />}
            {liberando ? 'Liberando…' : 'Confirmar liberação'}
          </button>
        </div>

        <p className="text-[10px] text-gray-500">
          Autoriza a taxa para o próximo recebimento (registra usuário, data e motivo). Não recebe o
          título.
        </p>
      </div>
    </Modal>
  );
}
