'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarClock, FileSpreadsheet } from 'lucide-react';

export interface DetalheCtx {
  tipo_op: 'E' | 'S';
  tipo_mov: 'OP' | 'NOP';
  cc: string;
  alvo: string;        // 'ATRASADOS' | número do dia
  rotuloAlvo: string;  // 'ATRASADOS' | 'DIA03'
  mes: number;
  ano: number;
}

interface Titulo {
  codigo: string; nome: string; nro_doc: string | null;
  valor_pgto: number; valor_rec: number;
  dtvenc_previsao: string | null; dt_emissao: string | null; dt_pgto: string | null; dt_venc: string | null;
  origem: string; pago: string; src: 'ABERTO' | 'REALIZADO';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ctx: DetalheCtx | null;
  onReagendado?: () => void; // avisa a tela p/ re-consultar
}

const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ModalDetalheFluxo({ isOpen, onClose, ctx, onReagendado }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [sel, setSel] = useState<Titulo | null>(null);
  const [novaData, setNovaData] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!ctx) return;
    setCarregando(true); setSel(null); setNovaData('');
    try {
      const q = new URLSearchParams({
        tipo_op: ctx.tipo_op, tipo_mov: ctx.tipo_mov, cc: ctx.cc,
        alvo: ctx.alvo, mes: String(ctx.mes), ano: String(ctx.ano),
      });
      const r = await fetch('/api/fluxo-caixa/detalhe?' + q.toString());
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.erro || 'Falha ao carregar detalhe.');
      setTitulos(data.titulos || []);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar detalhe.');
      setTitulos([]);
    } finally {
      setCarregando(false);
    }
  }, [ctx]);

  useEffect(() => { if (isOpen && ctx) carregar(); }, [isOpen, ctx, carregar]);

  const selecionar = (t: Titulo) => {
    // Só faz sentido reagendar título em aberto (não pago) — igual ao Delphi
    if (t.pago === 'S') { setSel(null); return; }
    setSel(t);
    setNovaData(t.dtvenc_previsao || t.dt_venc || '');
  };

  const reagendar = async () => {
    if (!ctx || !sel) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) return toast.error('Informe uma data válida.');
    setSalvando(true);
    try {
      const r = await fetch('/api/fluxo-caixa/reagendar', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_op: ctx.tipo_op, codigo: sel.codigo, nova_data: novaData }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.erro || 'Falha ao reagendar.');
      toast.success('Previsão atualizada com sucesso.');
      onReagendado?.();
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reagendar.');
    } finally {
      setSalvando(false);
    }
  };

  const exportarExcel = async () => {
    if (!titulos.length) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Detalhe');
      ws.addRow(['Código', 'Nome', 'Nº Doc', 'Valor', 'Recebido/Pago', 'Emissão', 'Vencimento', 'Previsão', 'Pgto', 'Pago', 'Origem']).font = { bold: true };
      for (const t of titulos) {
        ws.addRow([t.codigo, t.nome, t.nro_doc || '', t.valor_pgto, t.valor_rec, dataBR(t.dt_emissao), dataBR(t.dt_venc), dataBR(t.dtvenc_previsao), dataBR(t.dt_pgto), t.pago, t.origem]);
      }
      ws.getColumn(2).width = 40; ws.getColumn(4).numFmt = '#,##0.00'; ws.getColumn(5).numFmt = '#,##0.00';
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `detalhe-fluxo-${ctx?.rotuloAlvo || ''}.xlsx`);
    } catch (e: any) {
      toast.error('Falha ao gerar Excel: ' + (e?.message || ''));
    }
  };

  const titulo = ctx
    ? `Consulta Detalhada de Títulos — ${ctx.tipo_op === 'E' ? 'Entradas' : 'Saídas'} (${ctx.tipo_mov}) · ${ctx.cc} · ${ctx.rotuloAlvo}`
    : 'Consulta Detalhada de Títulos';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} width="max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          {carregando ? 'Carregando…' : `${titulos.length} título(s)`}
        </div>
        <Button variant="outline" size="sm" onClick={exportarExcel} disabled={!titulos.length} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[50vh]">
        <table className="text-xs min-w-max w-full">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              {['Código', 'Nome', 'Nº Doc', 'Valor', 'Receb./Pago', 'Emissão', 'Vencimento', 'Previsão', 'Pgto', 'Pago'].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap font-semibold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={10} className="text-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : titulos.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-6 text-gray-400">Nenhum título encontrado.</td></tr>
            ) : titulos.map((t) => {
              const podeReagendar = t.pago === 'N';
              const selecionado = sel?.codigo === t.codigo;
              return (
                <tr key={t.codigo}
                    onClick={() => selecionar(t)}
                    className={`border-t border-gray-100 ${podeReagendar ? 'cursor-pointer hover:bg-blue-50' : 'opacity-70'} ${selecionado ? 'bg-blue-100' : ''}`}>
                  <td className="px-2 py-1 whitespace-nowrap">{t.codigo}</td>
                  <td className="px-2 py-1 whitespace-nowrap max-w-[280px] truncate" title={t.nome}>{t.nome}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{t.nro_doc || '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{brl(t.valor_pgto)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{brl(t.valor_rec)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{dataBR(t.dt_emissao)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{dataBR(t.dt_venc)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{dataBR(t.dtvenc_previsao)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{dataBR(t.dt_pgto)}</td>
                  <td className="px-2 py-1 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.pago === 'S' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.pago}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reagendar previsão (só MAO / títulos em aberto) */}
      <div className="mt-3 flex flex-wrap items-end gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <CalendarClock className="w-5 h-5 text-blue-700 mb-1" />
        <div className="text-xs text-gray-600">
          {sel ? <>Reagendar título <span className="font-semibold">{sel.codigo}</span> — {sel.nome}</> : 'Selecione um título em aberto na tabela para reagendar a previsão'}
        </div>
        <div className="flex-1" />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nova previsão</label>
          <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} disabled={!sel} className="w-40" />
        </div>
        <Button onClick={reagendar} disabled={!sel || salvando} className="gap-2">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Atualizar previsão
        </Button>
      </div>
    </Modal>
  );
}
