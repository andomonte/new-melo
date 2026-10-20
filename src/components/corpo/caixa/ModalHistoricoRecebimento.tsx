'use client';

/**
 * Histórico de pagamentos de um título no Caixa (mesma fonte do Contas a Receber:
 * movimentos em dbfreceb por cod_receb). Somente leitura.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { History, X, Loader2 } from 'lucide-react';

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: any) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '—';
};

// Baldes por código de forma (igual ao Caixa): identifica tarifa/juros/recebimento.
const TIPOS_TARIFA = ['06', '07', '08', '15', '32', '44'];
const TIPOS_JUROS = ['18', '20', '21', '22', '23', '25', '26', '43'];
function rotuloTipo(tipo?: string): { txt: string; cls: string } {
  const t = String(tipo || '').trim();
  if (TIPOS_TARIFA.includes(t)) return { txt: 'Tarifa', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
  if (TIPOS_JUROS.includes(t)) return { txt: 'Juros', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  if (t === '05') return { txt: 'Devolução', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  return { txt: `Recebimento${t ? ' ' + t : ''}`, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
}

interface MovimentoFreceb {
  cod_freceb: string;
  dt_pgto: string;
  valor: number;
  tipo: string;
  sf: string;
  observacao: string | null; // dbfreceb.nome
  codusr: string | null;
  cod_conta: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  codReceb: string | null;
  titulo?: string; // rótulo (nº do documento) para o cabeçalho
}

export default function ModalHistoricoRecebimento({ isOpen, onClose, codReceb, titulo }: Props) {
  const [rows, setRows] = useState<MovimentoFreceb[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!isOpen || !codReceb) return;
    let ativo = true;
    setCarregando(true);
    setRows([]);
    fetch(`/api/contas-receber/${encodeURIComponent(codReceb)}/historico`)
      .then((r) => r.json())
      .then((d) => {
        if (!ativo) return;
        if (d?.historico) setRows(d.historico);
        else toast.error(d?.erro || 'Não foi possível carregar o histórico.');
      })
      .catch(() => ativo && toast.error('Erro ao carregar o histórico.'))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [isOpen, codReceb]);

  if (!isOpen) return null;

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          <History size={18} />
          <span className="font-bold">Histórico de pagamentos</span>
          {titulo && <span className="text-sm text-gray-400 font-mono">· {titulo}</span>}
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {carregando ? (
            <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhum pagamento registrado para este título.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 text-gray-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Data Pgto</th>
                  <th className="px-3 py-2 font-semibold text-right">Valor</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Baixa</th>
                  <th className="px-3 py-2 font-semibold">Observação</th>
                  <th className="px-3 py-2 font-semibold">Conta</th>
                  <th className="px-3 py-2 font-semibold">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((m) => {
                  const rt = rotuloTipo(m.tipo);
                  return (
                    <tr key={m.cod_freceb} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(m.dt_pgto)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{brl(m.valor)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full ${rt.cls}`}>{rt.txt}</span>
                      </td>
                      <td className="px-3 py-2">
                        {m.sf === 'S'
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Sim</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[220px]">{m.observacao || '—'}</td>
                      <td className="px-3 py-2 font-mono">{m.cod_conta || '—'}</td>
                      <td className="px-3 py-2">{m.codusr || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-500">
            {rows.length} movimento(s) · total <b className="font-mono">{brl(total)}</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
