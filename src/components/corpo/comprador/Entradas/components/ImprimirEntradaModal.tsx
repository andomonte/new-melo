import React, { useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, FileDown, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entradaId: string;
  numeroEntrada?: string;
}

export const ImprimirEntradaModal: React.FC<Props> = ({ isOpen, onClose, entradaId, numeroEntrada }) => {
  const [imprimirEntrada, setImprimirEntrada] = useState(true);
  const [imprimirRomaneio, setImprimirRomaneio] = useState(true);
  const [formato, setFormato] = useState<'pdf' | 'matricial'>('pdf');
  const [enviando, setEnviando] = useState(false);

  // Regra do Delphi: imprimir a Entrada já força o Romaneio.
  const romaneioTravado = imprimirEntrada;
  const romaneioMarcado = imprimirEntrada || imprimirRomaneio;

  const getUsername = () => {
    try {
      const p = localStorage.getItem('perfilUserMelo');
      return p ? JSON.parse(p)?.usuario || 'WEB' : 'WEB';
    } catch {
      return 'WEB';
    }
  };

  const confirmar = async () => {
    if (!imprimirEntrada && !romaneioMarcado) {
      toast.error('Selecione Entrada e/ou Romaneio.');
      return;
    }
    if (formato === 'pdf') {
      const params = new URLSearchParams({
        entrada: imprimirEntrada ? '1' : '0',
        romaneio: romaneioMarcado ? '1' : '0',
      });
      window.open(`/api/entradas/${entradaId}/imprimir-pdf?${params.toString()}`, '_blank');
      onClose();
      return;
    }
    // Matricial → enfileira na fila do robô
    setEnviando(true);
    try {
      const r = await fetch(`/api/entradas/${entradaId}/enfileirar-impressao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entrada: imprimirEntrada,
          romaneio: romaneioMarcado,
          username: getUsername(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao enviar para impressão.');
      toast.success(d.mensagem || 'Enviado à fila de impressão.');
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Imprimir Entrada${numeroEntrada ? ` ${numeroEntrada}` : ''}`}
      width="w-[95%] max-w-md"
    >
      <div className="space-y-5">
        {/* O que imprimir */}
        <div>
          <Label className="text-xs text-gray-500">O que imprimir</Label>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={imprimirEntrada}
                onChange={(e) => setImprimirEntrada(e.target.checked)}
              />
              <span>Entrada (relatório de produtos)</span>
            </label>
            <label className={`flex items-center gap-2 ${romaneioTravado ? 'opacity-60' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={romaneioMarcado}
                disabled={romaneioTravado}
                onChange={(e) => setImprimirRomaneio(e.target.checked)}
              />
              <span>Romaneio por armazém (com locação)</span>
            </label>
            {romaneioTravado && (
              <p className="text-[11px] text-gray-500 pl-6">
                Imprimir a Entrada já inclui o Romaneio.
              </p>
            )}
          </div>
        </div>

        {/* Formato */}
        <div>
          <Label className="text-xs text-gray-500">Formato</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormato('pdf')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                formato === 'pdf'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              <FileDown size={16} /> PDF (tela/laser)
            </button>
            <button
              type="button"
              onClick={() => setFormato('matricial')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                formato === 'matricial'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              <Printer size={16} /> Matricial (robô)
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {formato === 'pdf'
              ? 'Gera o PDF para visualizar/imprimir na hora.'
              : 'Envia para a fila do robô imprimir na impressora matricial.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer size={16} className="mr-1" />}
            {formato === 'pdf' ? 'Gerar PDF' : 'Enviar à fila'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImprimirEntradaModal;
