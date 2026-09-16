'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Printer, FileSpreadsheet, Wallet } from 'lucide-react';

interface Linha {
  banco: string; conta: string; codconta: string;
  valor: number; historico: string; forma_pgto: string; cx_geral: string; oficial: string;
}
interface Resposta {
  ok: boolean; data: string; tipo: string;
  entradas01: Linha[]; entradas02: Linha[]; saidas01: Linha[]; saidas02: Linha[];
  geralEntradas: Linha[]; geralSaidas: Linha[];
  totalEntrada: number; totalSaida: number; saldo: number; erro?: string;
}

type Aba = 'e01' | 'e02' | 's01' | 's02' | 'geral';
const ABAS: { key: Aba; label: string }[] = [
  { key: 'e01', label: 'Entradas 01' },
  { key: 'e02', label: 'Entradas 02' },
  { key: 's01', label: 'Saídas 01' },
  { key: 's02', label: 'Saídas 02' },
  { key: 'geral', label: 'Caixa Geral' },
];
const TIPOS = [
  { v: 'N', l: 'Todos' }, { v: 'S', l: 'Depósito' }, { v: 'C', l: 'Crédito Cliente' }, { v: 'P', l: 'PIX' },
];

const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Tabela de movimento (entradas ou saídas). OFICIAL só nas ENTRADAS (fiel ao Delphi).
function GridMov({ linhas, coluna }: { linhas: Linha[]; coluna: 'ENTRADA' | 'SAIDA' }) {
  const total = linhas.reduce((a, x) => a + x.valor, 0);
  const temOficial = coluna === 'ENTRADA';
  const nCols = temOficial ? 6 : 5;
  return (
    <div className="overflow-auto border border-gray-200 rounded-lg h-full">
      <table className="text-xs min-w-max w-full">
        <thead className="sticky top-0 z-10 bg-[#1e40af] text-white">
          <tr>
            <th className="px-2 py-1.5 text-left">HISTÓRICO</th>
            <th className="px-2 py-1.5 text-left">CONTA</th>
            <th className="px-2 py-1.5 text-left">FORMA_PGTO</th>
            <th className="px-2 py-1.5 text-right">{coluna}</th>
            <th className="px-2 py-1.5 text-center">CX_GERAL</th>
            {temOficial && <th className="px-2 py-1.5 text-center">OFICIAL</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr><td colSpan={nCols} className="text-center text-gray-400 py-6">Sem movimento.</td></tr>
          ) : linhas.map((l, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-blue-50">
              <td className="px-2 py-1 whitespace-nowrap max-w-[360px] truncate" title={l.historico}>{l.historico}</td>
              <td className="px-2 py-1 whitespace-nowrap" title={l.banco}>{l.conta}</td>
              <td className="px-2 py-1 whitespace-nowrap">{l.forma_pgto}</td>
              <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{brl(l.valor)}</td>
              <td className="px-2 py-1 text-center">{l.cx_geral}</td>
              {temOficial && <td className="px-2 py-1 text-center">{l.oficial}</td>}
            </tr>
          ))}
        </tbody>
        {linhas.length > 0 && (
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td className="px-2 py-1" colSpan={3}>Total</td>
              <td className="px-2 py-1 text-right tabular-nums">{brl(total)}</td>
              <td colSpan={temOficial ? 2 : 1} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function CaixaDiario() {
  const [data, setData] = useState(hojeISO());
  const [tipo, setTipo] = useState('N');
  const [conta, setConta] = useState(''); // cod_conta selecionado ('' = todas)
  const [contaLabel, setContaLabel] = useState('');
  const [contaOpts, setContaOpts] = useState<{ cod_conta: string; label: string }[]>([]);
  const [contaAberto, setContaAberto] = useState(false);
  const [aba, setAba] = useState<Aba>('e01');
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<Resposta | null>(null);

  // Combobox de conta — busca em dbconta (mesmo endpoint do Contas a Pagar)
  const buscarContas = async (term: string) => {
    try {
      const q = new URLSearchParams();
      if (term.trim()) q.set('busca', term.trim());
      const r = await fetch('/api/contas-pagar/contas-dbconta?' + q.toString());
      const d = await r.json();
      setContaOpts((d.contas || []).map((x: any) => ({ cod_conta: x.cod_conta, label: x.label })));
    } catch { setContaOpts([]); }
  };

  const consultar = async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ data, tipo });
      if (conta.trim()) q.set('conta', conta.trim());
      const r = await fetch('/api/financeiro/caixa-diario?' + q.toString());
      const d: Resposta = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.erro || 'Falha ao gerar o movimento.');
      setDados(d);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  const abaAtual = (d: Resposta): Linha[] =>
    aba === 'e01' ? d.entradas01 : aba === 'e02' ? d.entradas02 : aba === 's01' ? d.saidas01 : aba === 's02' ? d.saidas02 : [];
  const colAba = aba.startsWith('e') ? 'ENTRADA' : 'SAIDA' as 'ENTRADA' | 'SAIDA';

  const exportarExcel = async () => {
    if (!dados) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const addAba = (nome: string, linhas: Linha[], col: string) => {
        const oficial = col === 'ENTRADA';
        const ws = wb.addWorksheet(nome.slice(0, 31));
        const head = ['HISTÓRICO', 'CONTA', 'FORMA_PGTO', col, 'CX_GERAL', ...(oficial ? ['OFICIAL'] : [])];
        ws.addRow(head).font = { bold: true };
        linhas.forEach((l) => ws.addRow([l.historico, l.conta, l.forma_pgto, l.valor, l.cx_geral, ...(oficial ? [l.oficial] : [])]));
        ws.addRow(['Total', '', '', linhas.reduce((a, x) => a + x.valor, 0), '', ...(oficial ? [''] : [])]).font = { bold: true };
        ws.getColumn(1).width = 45; ws.getColumn(2).width = 22; ws.getColumn(4).numFmt = '#,##0.00';
      };
      if (aba === 'geral') {
        addAba('Entradas', dados.geralEntradas, 'ENTRADA');
        addAba('Saídas', dados.geralSaidas, 'SAIDA');
      } else {
        addAba(ABAS.find((a) => a.key === aba)!.label, abaAtual(dados), colAba);
      }
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `caixa-diario-${data}.xlsx`);
    } catch (e: any) { toast.error('Falha ao gerar Excel: ' + (e?.message || '')); }
  };

  const imprimir = () => {
    if (!dados) return;
    const w = window.open('', '_blank', 'width=1000,height=800'); if (!w) return;
    const tabela = (titulo: string, linhas: Linha[], col: string) => {
      const oficial = col === 'ENTRADA';
      const nc = oficial ? 6 : 5;
      const rows = linhas.map((l) => `<tr><td>${l.historico}</td><td>${l.conta}</td><td>${l.forma_pgto}</td><td class="num">${brl(l.valor)}</td><td class="c">${l.cx_geral}</td>${oficial ? `<td class="c">${l.oficial}</td>` : ''}</tr>`).join('');
      const tot = linhas.reduce((a, x) => a + x.valor, 0);
      return `<h3>${titulo}</h3><table><thead><tr><th>HISTÓRICO</th><th>CONTA</th><th>FORMA_PGTO</th><th>${col}</th><th>CX_GERAL</th>${oficial ? '<th>OFICIAL</th>' : ''}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${nc}">Sem movimento.</td></tr>`}</tbody>
        <tfoot><tr class="forte"><td colspan="3">Total</td><td class="num">${brl(tot)}</td><td colspan="${oficial ? 2 : 1}"></td></tr></tfoot></table>`;
    };
    const corpo = aba === 'geral'
      ? tabela('Entradas', dados.geralEntradas, 'ENTRADA') + tabela('Saídas', dados.geralSaidas, 'SAIDA')
        + `<div class="tot">Entradas do Dia: ${brl(dados.totalEntrada)} &nbsp;|&nbsp; Saídas do Dia: ${brl(dados.totalSaida)} &nbsp;|&nbsp; Saldo do Dia: ${brl(dados.saldo)}</div>`
      : tabela(ABAS.find((a) => a.key === aba)!.label, abaAtual(dados), colAba);
    w.document.write(`<html><head><title>Movimento Diário do Caixa</title><style>
      body{font-family:Arial;font-size:9px;padding:12px}h2{margin:0}h3{margin:10px 0 4px}
      table{border-collapse:collapse;width:100%;margin-bottom:6px}th,td{border:1px solid #ccc;padding:2px 4px}
      th{background:#1e40af;color:#fff;text-align:left}.num{text-align:right}.c{text-align:center}.forte{background:#eef2ff;font-weight:bold}
      .tot{margin-top:8px;font-weight:bold}
    </style></head><body><h2>MELO DISTRIBUIDORA DE PECAS LTDA.</h2>
      <div>Movimento Diário do Caixa — ${dataBR(dados.data)}</div>${corpo}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Wallet className="w-6 h-6 text-blue-700" />
        <h1 className="text-xl font-bold text-gray-800">Movimento Diário do Caixa</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data da operação</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">Conta (opcional)</label>
          <input
            value={contaLabel}
            onChange={(e) => { setContaLabel(e.target.value); setConta(''); buscarContas(e.target.value); setContaAberto(true); }}
            onFocus={() => { buscarContas(contaLabel); setContaAberto(true); }}
            onBlur={() => setTimeout(() => setContaAberto(false), 150)}
            placeholder="Todas as contas"
            className="border rounded px-2 py-1.5 text-sm w-64 pr-6"
          />
          {contaLabel && (
            <button type="button" title="Limpar (todas)"
              onClick={() => { setConta(''); setContaLabel(''); setContaOpts([]); }}
              className="absolute right-2 top-[26px] text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
          {contaAberto && contaOpts.length > 0 && (
            <div className="absolute z-30 mt-1 w-72 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
              {contaOpts.map((o) => (
                <button key={o.cod_conta} type="button"
                  onMouseDown={() => { setConta(o.cod_conta); setContaLabel(o.label); setContaAberto(false); }}
                  className="block w-full text-left px-2 py-1.5 hover:bg-blue-50 whitespace-nowrap">
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={consultar} disabled={carregando} className="gap-2">
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Pesquisar
        </Button>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir} disabled={!dados} className="gap-2"><Printer className="w-4 h-4" /> Imprimir</Button>
          <Button variant="outline" onClick={exportarExcel} disabled={!dados} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mt-3 shrink-0 border-b border-gray-200">
        {ABAS.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={`px-4 py-2 text-sm rounded-t-md ${aba === a.key ? 'bg-blue-700 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {dados ? (
        aba === 'geral' ? (
          <div className="flex-1 min-h-0 mt-2 flex gap-3">
            {/* dois grids empilhados */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex-1 min-h-0"><GridMov linhas={dados.geralEntradas} coluna="ENTRADA" /></div>
              <div className="flex-1 min-h-0"><GridMov linhas={dados.geralSaidas} coluna="SAIDA" /></div>
            </div>
            {/* painel de totais */}
            <div className="w-56 shrink-0 flex flex-col gap-2">
              <div className="border rounded-lg p-3 text-center bg-emerald-50">
                <div className="text-xs text-gray-600">Entradas do Dia</div>
                <div className="text-lg font-bold text-emerald-700">{brl(dados.totalEntrada)}</div>
              </div>
              <div className="border rounded-lg p-3 text-center bg-red-50">
                <div className="text-xs text-gray-600">Saídas do Dia</div>
                <div className="text-lg font-bold text-red-700">{brl(dados.totalSaida)}</div>
              </div>
              <div className="border rounded-lg p-3 text-center bg-blue-50">
                <div className="text-xs text-gray-600">Saldo do Dia</div>
                <div className={`text-lg font-bold ${dados.saldo < 0 ? 'text-red-600' : 'text-blue-700'}`}>{brl(dados.saldo)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 mt-2">
            <GridMov linhas={abaAtual(dados)} coluna={colAba} />
          </div>
        )
      ) : (
        !carregando && (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-sm">
            Selecione a data e clique em <span className="font-medium">&nbsp;Pesquisar&nbsp;</span> para ver o movimento do caixa.
          </div>
        )
      )}
    </div>
  );
}
