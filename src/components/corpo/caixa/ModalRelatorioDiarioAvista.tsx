'use client';

/**
 * Modal do operador de caixa: gera SÓ o relatório "Títulos Diário à Vista" de
 * Contas a Receber, sem expor a tela de Contas a Receber nem os demais relatórios.
 *
 * Fluxo igual ao Delphi (Relatório de Títulos a Vista Diário): filtra, CONSULTA
 * (prévia na tela) e então imprime/exporta (PDF ou Excel).
 *
 * Visível apenas para quem tem a função REL_DIARIO_AVISTA (gate na tela do Caixa).
 * O backend (/api/contas-receber/relatorio) também exige essa função OU acesso à
 * tela de Contas a Receber — ver src/lib/permissoes.ts.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, FileSpreadsheet, Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const hojeISO = () => new Date().toISOString().slice(0, 10);

// UFs do Brasil — lista fixa (no Delphi o combo é uma enumeração fixa, não vem do banco).
const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: any) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10); // já vem yyyy-mm-dd
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '—';
};

interface LinhaRel {
  nro_doc?: string | null;
  cliente?: string | null;
  cod_conta?: string | null;
  dt_emissao?: string | null;
  valor_pgto?: number;
  valor_rec?: number;
  valor_aberto?: number;
  [k: string]: any;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalRelatorioDiarioAvista({ isOpen, onClose }: Props) {
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [situacao, setSituacao] = useState<'' | 'N' | 'S'>(''); // '' = todos, N = não pago, S = pago
  const [ufAtiva, setUfAtiva] = useState(false);
  const [uf, setUf] = useState('');
  const [autoPecas, setAutoPecas] = useState(true);
  const [ferramentas, setFerramentas] = useState(true);
  const [busy, setBusy] = useState<false | 'consultar' | 'pdf' | 'excel'>(false);
  const [resultado, setResultado] = useState<LinhaRel[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDataInicio(hojeISO());
    setDataFim(hojeISO());
    setSituacao('');
    setUfAtiva(false);
    setUf('');
    setAutoPecas(true);
    setFerramentas(true);
    setResultado(null);
    setBusy(false);
  }, [isOpen]);

  // Qualquer mudança de filtro invalida a prévia (evita mostrar resultado velho).
  const limparPrevia = () => setResultado(null);

  const montarParams = (formato: 'pdf' | 'excel' | 'json') => {
    const params = new URLSearchParams();
    params.append('formato', formato);
    params.append('tipo', 'diario_avista');
    params.append('data_inicio', dataInicio);
    params.append('data_fim', dataFim);
    if (situacao) params.append('rec_filtro', situacao);
    if (ufAtiva && uf) params.append('uf', uf);
    // Auto Peças / Ferramentas: os dois marcados (ou nenhum) = todos.
    if (autoPecas && !ferramentas) params.append('ramo', 'A');
    else if (!autoPecas && ferramentas) params.append('ramo', 'F');
    return params;
  };

  const validar = () => {
    if (!dataInicio || !dataFim) { toast.error('Informe o período (início e fim).'); return false; }
    if (dataFim < dataInicio) { toast.error('A data fim não pode ser menor que a início.'); return false; }
    if (ufAtiva && !uf) { toast.error('Selecione a UF ou desmarque "Filtrar UF".'); return false; }
    return true;
  };

  const consultar = async () => {
    if (!validar()) return;
    setBusy('consultar');
    setResultado(null);
    try {
      const resp = await fetch(`/api/contas-receber/relatorio?${montarParams('json').toString()}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || data.error || 'Erro ao consultar');
      setResultado(data.rows || []);
      if (!data.rows?.length) toast.info('Nenhum título para os filtros informados.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao consultar');
    } finally {
      setBusy(false);
    }
  };

  const baixar = async (formato: 'pdf' | 'excel') => {
    if (!validar()) return;
    setBusy(formato);
    try {
      const resp = await fetch(`/api/contas-receber/relatorio?${montarParams(formato).toString()}`);
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.erro || e.error || 'Erro ao gerar relatório');
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = formato === 'pdf' ? 'titulos_diario_avista.pdf' : 'titulos_diario_avista.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Relatório ${formato.toUpperCase()} gerado.`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar relatório');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const totais = (resultado || []).reduce(
    (acc, r) => {
      acc.pgto += Number(r.valor_pgto || 0);
      acc.rec += Number(r.valor_rec || 0);
      acc.aberto += Number(r.valor_aberto || 0);
      return acc;
    },
    { pgto: 0, rec: 0, aberto: 0 },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          <FileText size={18} />
          <span className="font-bold">Títulos Diário à Vista</span>
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Por emissão, com pago/não pago e UF (igual ao Delphi). Consulte e então gere PDF ou Excel.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); limparPrevia(); }} className="w-full mt-1" />
            </div>
            <div>
              <Label>Data fim *</Label>
              <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); limparPrevia(); }} className="w-full mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Situação</Label>
              <select
                value={situacao}
                onChange={(e) => { setSituacao(e.target.value as '' | 'N' | 'S'); limparPrevia(); }}
                className="w-full mt-1 h-10 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="N">Não pago</option>
                <option value="S">Pago</option>
              </select>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ufAtiva}
                  onChange={(e) => { setUfAtiva(e.target.checked); if (!e.target.checked) setUf(''); limparPrevia(); }}
                /> Filtrar UF
              </Label>
              <select
                value={uf}
                onChange={(e) => { setUf(e.target.value); limparPrevia(); }}
                disabled={!ufAtiva}
                className="w-full mt-1 h-10 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm disabled:opacity-50"
              >
                <option value="">Selecione…</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Ramo</Label>
            <div className="flex items-center gap-5 mt-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoPecas} onChange={(e) => { setAutoPecas(e.target.checked); limparPrevia(); }} /> Auto Peças
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ferramentas} onChange={(e) => { setFerramentas(e.target.checked); limparPrevia(); }} /> Ferramentas
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">Os dois marcados (ou nenhum) = todos.</p>
          </div>

          {/* Prévia (resultado da consulta) */}
          {resultado !== null && (
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <span>Resultado ({resultado.length})</span>
                <span className="text-gray-500">
                  Valor {brl(totais.pgto)} · Recebido {brl(totais.rec)} · Aberto {brl(totais.aberto)}
                </span>
              </div>
              {resultado.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">Nenhum título para os filtros informados.</div>
              ) : (
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 text-gray-500">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 font-semibold">Título</th>
                        <th className="px-2 py-1.5 font-semibold">Cliente</th>
                        <th className="px-2 py-1.5 font-semibold">Conta</th>
                        <th className="px-2 py-1.5 font-semibold">Emissão</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Valor</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Recebido</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Aberto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {resultado.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-2 py-1.5 font-mono">{r.nro_doc || '—'}</td>
                          <td className="px-2 py-1.5 truncate max-w-[200px]">{r.cliente || '—'}</td>
                          <td className="px-2 py-1.5 font-mono">{r.cod_conta || '—'}</td>
                          <td className="px-2 py-1.5 tabular-nums">{fmtData(r.dt_emissao)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{brl(r.valor_pgto)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{brl(r.valor_rec)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{brl(r.valor_aberto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de ações */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={consultar}
            disabled={!!busy}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'consultar' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Consultar
          </button>
          <button
            type="button"
            onClick={() => baixar('excel')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
          >
            {busy === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
          </button>
          <button
            type="button"
            onClick={() => baixar('pdf')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
          </button>
        </div>
      </div>
    </div>
  );
}
