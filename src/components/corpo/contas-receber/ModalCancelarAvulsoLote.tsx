'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

/**
 * Modal "Cancelar Título Avulso em LOTE". Só cancela títulos AVULSOS (sem fatura e
 * sem grupo). Os vinculados a fatura/grupo são mostrados como "serão ignorados" e
 * não vão no POST. O servidor (/api/contas-receber/cancelar-lote) revalida (avulso,
 * não recebido, não cancelado, não enviado ao banco) e devolve os ignorados.
 */

interface TituloLote {
  cod_receb: string;
  nro_doc?: string | null;
  cod_fat?: string | null;
  grupo_pagamento_id?: number | null;
}

interface Props {
  isOpen: boolean;
  titulos: TituloLote[];
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ehAvulso = (t: TituloLote) => !t.cod_fat && !t.grupo_pagamento_id;

export default function ModalCancelarAvulsoLote({ isOpen, titulos, username, onClose, onSuccess }: Props) {
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMotivo('');
  }, [isOpen]);

  const avulsos = useMemo(() => titulos.filter(ehAvulso), [titulos]);
  const vinculados = titulos.length - avulsos.length;

  const confirmar = async () => {
    if (avulsos.length === 0) {
      toast.error('Nenhum título avulso selecionado. Títulos com fatura/grupo não podem ser cancelados aqui.');
      return;
    }
    if (motivo.trim().length < 5) {
      toast.error('Informe o motivo do cancelamento (mínimo 5 caracteres).');
      return;
    }
    setCancelando(true);
    try {
      const r = await fetch('/api/contas-receber/cancelar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_receb: avulsos.map((t) => t.cod_receb),
          motivo: motivo.trim(),
          usuario: username,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao cancelar títulos');
      const ign = Number(d.ignorados?.length || 0);
      toast.success(`${d.cancelados} título(s) avulso(s) cancelado(s).` + (ign > 0 ? ` ${ign} ignorado(s).` : ''));
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancelar Título Avulso em lote" width="w-[94%] max-w-lg">
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 p-3 space-y-3">
        <div className="flex items-start gap-2 text-xs text-red-800 dark:text-red-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <b>{avulsos.length}</b> título(s) avulso(s) serão cancelados.
            {vinculados > 0 && (
              <>
                {' '}
                <b>{vinculados}</b> vinculado(s) a fatura/grupo serão <b>ignorados</b> (só cancela avulso).
              </>
            )}
            <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-300">Esta ação não pode ser desfeita.</div>
          </div>
        </div>

        <div>
          <Label className="text-[11px]">Motivo (mín. 5 caracteres)</Label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full text-xs rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 resize-y"
            placeholder="Justificativa do cancelamento…"
          />
          <div className={`text-[10px] mt-0.5 ${motivo.trim().length < 5 ? 'text-red-600' : 'text-gray-400'}`}>
            {motivo.trim().length}/5
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={cancelando || avulsos.length === 0}
            className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {cancelando && <Loader2 className="size-3.5 animate-spin" />}
            {cancelando ? 'Cancelando…' : `Cancelar ${avulsos.length} avulso(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
