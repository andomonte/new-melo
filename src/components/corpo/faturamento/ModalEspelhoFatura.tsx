'use client';

/**
 * Espelho da Fatura (read-only) — equivalente ao "CONSULTAR FATURA UNIFICADO - ZOOM"
 * do Delphi. Abas: Dados (fatura + status NF-e + valores), Itens, Vendas, Cobrança.
 * Self-contained: busca /api/faturamento/espelho-fatura?codfat=.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, X, Loader2 } from 'lucide-react';

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: any) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '—';
};
const fmtDataHora = (d: any) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
};
const simNao = (v: any) => (String(v ?? '').toUpperCase() === 'S' ? 'SIM' : 'NÃO');
const TIPO_FAT: Record<string, string> = { '1': 'Nota Fiscal', '2': 'NE', '3': 'FAG' };
const FRM_FAT: Record<string, string> = { '1': 'À vista', '2': 'Boleto', '3': 'Promissória', '4': 'Carteira' };
const statusNfe = (s?: string) => {
  const c = String(s ?? '').trim();
  if (c === '100') return { txt: 'Autorizada', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (['101', '151', '155'].includes(c)) return { txt: 'Cancelada', cls: 'text-red-600 dark:text-red-400' };
  if (['110', '301', '302', '303'].includes(c)) return { txt: 'Denegada', cls: 'text-red-600 dark:text-red-400' };
  if (!c) return { txt: '—', cls: 'text-gray-500' };
  return { txt: `Rejeitada (${c})`, cls: 'text-amber-600 dark:text-amber-400' };
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  codfat: string | null;
}

export default function EspelhoFaturaModal({ isOpen, onClose, codfat }: Props) {
  const [tab, setTab] = useState<'dados' | 'itens' | 'vendas' | 'cobranca'>('dados');
  const [data, setData] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!isOpen || !codfat) return;
    let ativo = true;
    setTab('dados');
    setData(null);
    setCarregando(true);
    fetch(`/api/faturamento/espelho-fatura?codfat=${encodeURIComponent(codfat)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ativo) return;
        if (d && !d.error) setData(d);
        else toast.error(d?.error || 'Fatura não encontrada.');
      })
      .catch(() => ativo && toast.error('Erro ao carregar o espelho da fatura.'))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [isOpen, codfat]);

  if (!isOpen) return null;

  const f = data?.fatura;
  const val = data?.valores;
  const nfe = data?.nfe;
  const st = statusNfe(nfe?.status);

  const Campo = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono tabular-nums' : ''} break-words`}>{children ?? '—'}</div>
    </div>
  );
  const Secao = ({ titulo, children, cols = 4 }: { titulo: string; children: React.ReactNode; cols?: number }) => (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">{titulo}</div>
      <div className={`grid grid-cols-2 ${cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3`}>{children}</div>
    </div>
  );

  const TABS = [
    { k: 'dados', label: 'Dados Fatura' },
    { k: 'itens', label: `Itens (${data?.itens?.length ?? 0})` },
    { k: 'vendas', label: `Vendas (${data?.vendas?.length ?? 0})` },
    { k: 'cobranca', label: `Cobrança (${data?.cobranca?.length ?? 0})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          <FileText size={18} />
          <span className="font-bold">Espelho da Fatura</span>
          {f?.documento && <span className="text-sm text-gray-400 font-mono">· {f.documento}</span>}
          {nfe && <span className={`text-xs font-semibold ${st.cls}`}>· NF-e {st.txt}</span>}
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Abas */}
        <div className="shrink-0 flex gap-1 px-4 pt-3 border-b border-gray-200 dark:border-slate-700">
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-t-lg ${
                tab === t.k
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {carregando ? (
            <div className="py-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Carregando…
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-sm text-gray-400">Fatura não encontrada.</div>
          ) : tab === 'dados' ? (
            <div className="flex flex-col gap-4">
              <Secao titulo="Dados da Fatura">
                <Campo label="Documento" mono>{f.documento}</Campo>
                <Campo label="Formulário" mono>{f.formulario || '—'}</Campo>
                <Campo label="Série" mono>{f.serie || '—'}</Campo>
                <Campo label="Data">{fmtData(f.data)}</Campo>
                <Campo label="Cliente">{f.cliente?.codcli} — {f.cliente?.nome || '—'}</Campo>
                <Campo label="UF" mono>{f.cliente?.uf || '—'}</Campo>
                <Campo label="Vendedor">{f.vendedor?.cod} — {f.vendedor?.nome || '—'}</Campo>
                <Campo label="Transportadora">{f.transportadora?.cod} — {f.transportadora?.nome || '—'}</Campo>
                <Campo label="Tipo Fatura">{TIPO_FAT[String(f.tipofat ?? '')] || f.tipofat || '—'}</Campo>
                <Campo label="Forma">{FRM_FAT[String(f.frmfat ?? '')] || f.frmfat || '—'}</Campo>
                <Campo label="CFOP 1" mono>{f.cfop1 || '—'}</Campo>
                <Campo label="CFOP 2" mono>{f.cfop2 || '—'}</Campo>
                <Campo label="Natureza (CFOP)">{f.descrcfop || '—'}</Campo>
                <Campo label="Agrupada">{simNao(f.agrupada)}{f.codgp ? ` (GP ${f.codgp})` : ''}</Campo>
                <Campo label="Insc. Estadual 07">{simNao(f.insc07)}</Campo>
                <Campo label="Cancelada"><span className={String(f.cancel).toUpperCase() === 'S' ? 'text-red-600 font-semibold' : ''}>{simNao(f.cancel)}</span></Campo>
                <Campo label="Foi para o banco">{simNao(f.foi_banco)}</Campo>
                <Campo label="Tem cobrança">{simNao(f.cobranca)}</Campo>
                <Campo label="Pedido" mono>{f.pedido || '—'}</Campo>
              </Secao>

              {f.obs && String(f.obs).trim() && (
                <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Observação</div>
                  <div className="text-sm whitespace-pre-wrap">{f.obs}</div>
                </div>
              )}

              <Secao titulo="Status NF-e" cols={3}>
                {!nfe ? (
                  <div className="col-span-full text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ Esta fatura não tem NF-e associada.
                  </div>
                ) : (
                  <>
                    <div className="md:col-span-3 min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Chave NF-e</div>
                      <div className="text-sm font-mono break-all">{nfe.chave || '—'}</div>
                    </div>
                    <Campo label="Modelo" mono>{nfe.modelo === '65' ? 'NFC-e (65)' : nfe.modelo === '55' ? 'NF-e (55)' : nfe.modelo || '—'}</Campo>
                    <Campo label="Situação"><span className={`font-semibold ${st.cls}`}>{st.txt}</span></Campo>
                    <Campo label="Protocolo" mono>{nfe.numprotocolo || '—'}</Campo>
                    <Campo label="Data envio">{fmtDataHora(nfe.data_envio)}</Campo>
                    <Campo label="Autorização">{fmtDataHora(nfe.dthrprotocolo)}</Campo>
                    <Campo label="Denegada">{simNao(f.denegada)}</Campo>
                    {nfe.dthrcancelamento && <Campo label="Cancelamento">{fmtDataHora(nfe.dthrcancelamento)}</Campo>}
                    {nfe.motivocancelamento && <div className="md:col-span-2"><Campo label="Motivo cancelamento">{nfe.motivocancelamento}</Campo></div>}
                    {nfe.motivo && <div className="md:col-span-3"><Campo label="Motivo SEFAZ">{nfe.motivo}</Campo></div>}
                  </>
                )}
              </Secao>

              <Secao titulo="Valores">
                <Campo label="Base ICMS" mono>{brl(val.baseicms)}</Campo>
                <Campo label="Valor ICMS" mono>{brl(val.valor_icms)}</Campo>
                <Campo label="Base ICMS Subst." mono>{brl(val.baseicms_subst)}</Campo>
                <Campo label="Valor ICMS Subst." mono>{brl(val.valoricms_subst)}</Campo>
                <Campo label="Total Produtos" mono>{brl(val.totalprod)}</Campo>
                <Campo label="Total IPI" mono>{brl(val.totalipi)}</Campo>
                <Campo label="Frete" mono>{brl(val.frete)}</Campo>
                <Campo label="Desconto" mono>{brl(val.desconto)}</Campo>
                <Campo label="Acréscimo" mono>{brl(val.acrescimo)}</Campo>
                <Campo label="Total Fatura" mono>{brl(val.totalfat)}</Campo>
                <Campo label="Total NF" mono><b>{brl(val.totalnf)}</b></Campo>
              </Secao>
            </div>
          ) : tab === 'itens' ? (
            <Tabela
              vazio="Sem itens na fatura."
              rows={data.itens}
              cols={[
                ['Ref', (r: any) => <span className="font-mono">{r.ref || '—'}</span>],
                ['Descrição', (r: any) => <span className="truncate block max-w-[280px]">{r.descr || '—'}</span>],
                ['Marca', (r: any) => r.marca || '—'],
                ['Qtd', (r: any) => <span className="tabular-nums">{r.qtd}</span>, 'right'],
                ['Unit.', (r: any) => <span className="font-mono tabular-nums">{brl(r.prunit)}</span>, 'right'],
                ['Desc.', (r: any) => <span className="font-mono tabular-nums">{brl(r.desconto)}</span>, 'right'],
                ['Total', (r: any) => <span className="font-mono tabular-nums font-semibold">{brl(r.total)}</span>, 'right'],
                ['CFOP', (r: any) => <span className="font-mono">{r.cfop || '—'}</span>],
              ]}
            />
          ) : tab === 'vendas' ? (
            <Tabela
              vazio="Sem vendas associadas."
              rows={data.vendas}
              cols={[
                ['Nº Venda', (r: any) => <span className="font-mono">{r.nrovenda}</span>],
                ['Data', (r: any) => fmtData(r.data)],
                ['Status', (r: any) => r.status || '—'],
                ['Pedido', (r: any) => r.pedido || '—'],
                ['Vendedor', (r: any) => r.vendedor || '—'],
                ['Total', (r: any) => <span className="font-mono tabular-nums font-semibold">{brl(r.total)}</span>, 'right'],
              ]}
            />
          ) : (
            <Tabela
              vazio="Sem cobrança/parcelas."
              rows={data.cobranca}
              cols={[
                ['Documento', (r: any) => <span className="font-mono">{r.nro_doc || r.cod_receb}</span>],
                ['Emissão', (r: any) => fmtData(r.dt_emissao)],
                ['Vencimento', (r: any) => fmtData(r.dt_venc)],
                ['Banco', (r: any) => r.banco || '—'],
                ['Situação', (r: any) =>
                  String(r.cancel).toUpperCase() === 'S' ? <span className="text-red-600">Cancelado</span>
                  : String(r.rec).toUpperCase() === 'S' ? <span className="text-emerald-600">Pago</span>
                  : <span className="text-amber-600">Aberto</span>],
                ['Valor', (r: any) => <span className="font-mono tabular-nums font-semibold">{brl(r.valor)}</span>, 'right'],
              ]}
            />
          )}
        </div>

        <div className="shrink-0 flex items-center px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-400">Somente consulta</span>
          <button type="button" onClick={onClose} className="ml-auto px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Tabela genérica read-only
function Tabela({ rows, cols, vazio }: { rows: any[]; cols: [string, (r: any) => React.ReactNode, ('right' | 'left')?][]; vazio: string }) {
  if (!rows || rows.length === 0) return <div className="py-10 text-center text-sm text-gray-400">{vazio}</div>;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500">
          <tr className="text-left">
            {cols.map(([h, , align], i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              {cols.map(([, render, align], ci) => (
                <td key={ci} className={`px-3 py-2 ${align === 'right' ? 'text-right' : ''}`}>{render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
