import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  codfat?: string | null;
}

/**
 * Modal com o HISTÓRICO de eventos de uma NF-e: Autorização, Cancelamento,
 * Rejeições (cStat + motivo) e Cartas de Correção (com botão p/ abrir o PDF).
 * Reutilizado pelo preview da nota e pela ação "Evento" da Consulta de Faturas.
 */
export default function ModalEventosNota({ open, onClose, codfat }: Props) {
  const [eventos, setEventos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open || !codfat) return;
    let ativo = true;
    setCarregando(true);
    setEventos([]);
    axios
      .get(`/api/faturamento/eventos-nota?codfat=${codfat}`)
      .then(({ data }) => {
        if (ativo) setEventos(data.eventos || []);
      })
      .catch(() => {
        if (ativo) setEventos([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [open, codfat]);

  const fmtDataHora = (d: any) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-full bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Eventos da nota — Fatura {codfat}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {carregando ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              Carregando eventos…
            </p>
          ) : eventos.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              Nenhum evento registrado.
            </p>
          ) : (
            <ul className="space-y-3">
              {eventos.map((ev, i) => {
                const cor =
                  ev.tipo === 'CANCELAMENTO'
                    ? 'text-red-600'
                    : ev.tipo === 'REJEICAO'
                      ? 'text-amber-600'
                      : ev.tipo === 'CARTA_CORRECAO'
                        ? 'text-blue-600'
                        : 'text-green-600';
                const Icon =
                  ev.tipo === 'CANCELAMENTO'
                    ? XCircle
                    : ev.tipo === 'REJEICAO'
                      ? AlertTriangle
                      : ev.tipo === 'CARTA_CORRECAO'
                        ? FileText
                        : CheckCircle2;
                return (
                  <li
                    key={i}
                    className="flex gap-3 border border-gray-200 dark:border-zinc-700 rounded-md p-3"
                  >
                    <Icon className={`size-5 mt-0.5 shrink-0 ${cor}`} />
                    <div className="text-sm">
                      <div className={`font-semibold ${cor}`}>{ev.descricao}</div>
                      <div className="text-gray-600 dark:text-gray-300">
                        {fmtDataHora(ev.data)}
                        {ev.protocolo ? ` · Protocolo ${ev.protocolo}` : ''}
                        {ev.usuario ? ` · ${ev.usuario}` : ''}
                      </div>
                      {ev.motivo && (
                        <div className="mt-1 text-gray-700 dark:text-gray-200">
                          <span className="font-medium">Motivo:</span> {ev.motivo}
                        </div>
                      )}
                      {ev.texto && (
                        <div className="mt-1 text-gray-700 dark:text-gray-200">
                          <span className="font-medium">Correção:</span> {ev.texto}
                        </div>
                      )}
                      {ev.tipo === 'CARTA_CORRECAO' && (
                        <button
                          onClick={() =>
                            window.open(
                              `/api/faturamento/cce-pdf?codfat=${codfat}&seq=${ev.seq ?? ''}`,
                              '_blank',
                            )
                          }
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <FileText size={14} /> Abrir PDF da carta
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
