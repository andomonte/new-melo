'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

/**
 * Modal "Baixar Juros em LOTE" (liberar taxa) para VÁRIOS títulos selecionados do
 * Contas a Receber. Mesma gravação do unitário (fin_libera_juros, motivo ≥ 15) — o
 * endpoint /api/contas-receber/liberar-juros já aceita `cod_receb` como array e pula
 * os já recebidos. Não recebe os títulos; só autoriza a taxa para o próximo recebimento.
 */

interface TituloLote {
  cod_receb: string;
  nro_doc?: string | null;
  nome_cliente?: string | null;
}

interface Props {
  isOpen: boolean;
  titulos: TituloLote[];
  username: string;
  user?: { usuario?: string; codusr?: string | number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalBaixarJurosLote({ isOpen, titulos, username, user, onClose, onSuccess }: Props) {
  const [taxa, setTaxa] = useState('0');
  const [motivo, setMotivo] = useState('');
  const [liberando, setLiberando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTaxa('0');
    setMotivo('');
  }, [isOpen]);

  const confirmar = async () => {
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
          cod_receb: titulos.map((t) => t.cod_receb),
          taxa: tx,
          motivo: motivo.trim(),
          usuario: username,
          codusr: user?.codusr ?? null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao liberar juros');
      const naoLib = Number(d.jaRecebidos?.length || 0);
      toast.success(
        `Juros liberado à taxa ${tx}% em ${d.liberados} título(s).` +
          (naoLib > 0 ? ` ${naoLib} já recebido(s) foram ignorados.` : ''),
      );
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLiberando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Baixar Juros em lote" width="w-[94%] max-w-lg">
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-3 space-y-3">
        <div className="text-xs font-bold text-blue-800 dark:text-blue-200">
          {titulos.length} título(s) selecionado(s)
        </div>

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
          <Label className="text-[11px]">Motivo (mín. 15 caracteres)</Label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full text-xs rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 resize-y"
            placeholder="Justificativa da liberação de juros…"
          />
          <div className={`text-[10px] mt-0.5 ${motivo.trim().length < 15 ? 'text-red-600' : 'text-gray-400'}`}>
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
            {liberando ? 'Liberando…' : `Confirmar em ${titulos.length} título(s)`}
          </button>
        </div>

        <p className="text-[10px] text-gray-500">
          Aplica a MESMA taxa e motivo a todos os selecionados. Títulos já recebidos são ignorados.
          Autoriza a taxa para o próximo recebimento (registra usuário, data e motivo); não recebe os títulos.
        </p>
      </div>
    </Modal>
  );
}
