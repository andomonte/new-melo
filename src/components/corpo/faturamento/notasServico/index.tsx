/**
 * Faturamento → Notas de Serviço (/faturamento/notasServico) — NFS-e PRESTADAS.
 * Fluxo do Delphi (Faturamento > Nota Fiscal de Serviço > Prestado): a nota é emitida no portal
 * da prefeitura e LANÇADA aqui (nº, verificação, competência, valores, ISS e retenções); depois
 * geram-se os títulos a receber (dbreceb tipo 'S'); cancelar cancela nota e títulos.
 * Regras: src/lib/nfse/notasServico.ts e calculoNota.ts.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Eye, FileText, Loader2, Plus, Receipt, RefreshCw, Search } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Autocomplete } from '@/components/common/Autocomplete';
import { mascaraInputBRL, desmascarar } from '@/utils/monetario';
import { calcularValoresNota, dividirParcelas } from '@/lib/nfse/calculoNota';

const API = '/api/nfse';
const moeda = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const dataBR = (s?: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};
const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' });
const somarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
const primeiroDiaMes = () => `${hojeISO().slice(0, 8)}01`;
const pct = (s: string) => Math.max(0, parseFloat(String(s || '').replace(',', '.')) || 0);
const lerPrazos = (s: string) => String(s || '').split(/[^0-9]+/).filter(Boolean).map(Number);

const th = 'px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';
const td = 'px-2 py-1.5 text-sm whitespace-nowrap';
const num = 'text-right tabular-nums';
const botao = 'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const primario = `${botao} bg-blue-600 text-white hover:bg-blue-700`;
const secundario = `${botao} border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700`;
const perigo = `${botao} bg-red-600 text-white hover:bg-red-700`;

interface NotaLista {
  codfat: string; nroform: string; verificacao: string; chave_acesso?: string | null; dtemissao: string; competencia: string; data: string;
  codcli: string; nome_cliente: string; valor_servico: number; issqn_aliquota: number; issqn_retido: string;
  issqn_valor: number; retencoes: number; valor_liquido: number; cancel: string; origem: string;
  descr: string; sen_codigo: string; qtd_titulos: number; recebido: number;
}

const FORMAS_MELO = [
  { v: 'CARTEIRA', l: 'Carteira' }, { v: 'RECIBO', l: 'Recibo' },
  { v: 'CARTAO', l: 'Cartão' }, { v: 'PROMISSORIA', l: 'Promissória' },
];

export default function NotasServico() {
  const { user } = useContext(AuthContext) as any;
  const usuario = user?.usuario || user?.nome || '';
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hojeISO());
  const [base, setBase] = useState<'emissao' | 'lancamento'>('emissao');
  const [situacao, setSituacao] = useState<'ativas' | 'canceladas' | 'todas'>('ativas');
  const [busca, setBusca] = useState('');
  const [notas, setNotas] = useState<NotaLista[]>([]);
  const [totais, setTotais] = useState<any>(null);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [lancarAberto, setLancarAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const carregar = useCallback(async (p = 1) => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ base, situacao, page: String(p), limit: '100' });
      if (de) q.set('de', de);
      if (ate) q.set('ate', ate);
      if (busca.trim()) q.set('q', busca.trim());
      const r = await fetch(`${API}/notas?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao buscar');
      setNotas(j.notas || []);
      setTotais(j.totais || null);
      setPagina(p);
      setTotalPaginas(j.paginacao?.totalPaginas || 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, [base, situacao, de, ate, busca]);

  useEffect(() => { carregar(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-5 w-5 text-blue-600" /> Notas de Serviço
        </h1>
        <button className={primario} onClick={() => setLancarAberto(true)}><Plus className="h-4 w-4" /> Lançar nota</button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-3 dark:border-zinc-700">
        <div>
          <Label>Período por</Label>
          <select className="block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={base} onChange={(e) => setBase(e.target.value as any)}>
            <option value="emissao">Emissão</option>
            <option value="lancamento">Lançamento</option>
          </select>
        </div>
        <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div>
          <Label>Situação</Label>
          <select className="block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={situacao} onChange={(e) => setSituacao(e.target.value as any)}>
            <option value="ativas">Ativas</option>
            <option value="canceladas">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div className="min-w-[260px] flex-1">
          <Label>Buscar</Label>
          <Input placeholder="Nº, verificação, cliente ou discriminação" value={busca}
            onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar(1)} />
        </div>
        <button className={primario} onClick={() => carregar(1)} disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar
        </button>
      </div>

      {/* Totais */}
      {totais && (
        <div className="flex flex-wrap gap-6 text-sm">
          <span><b>{totais.qtd}</b> nota(s)</span>
          <span>Serviços: <b>{moeda(totais.servico)}</b></span>
          <span>ISS: <b>{moeda(totais.iss)}</b></span>
          <span>Retenções: <b>{moeda(totais.retencoes)}</b></span>
          <span>Líquido: <b className="text-green-700 dark:text-green-400">{moeda(totais.liquido)}</b></span>
        </div>
      )}

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200 dark:border-zinc-700">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-zinc-800">
            <tr>
              <th className={th}>Nº</th><th className={th}>Verificação / chave</th><th className={th}>Emissão</th>
              <th className={th}>Compet.</th><th className={th}>Cliente</th><th className={th}>Serviço</th>
              <th className={`${th} ${num}`}>Valor serviço</th><th className={`${th} ${num}`}>ISS</th>
              <th className={`${th} ${num}`}>Retenções</th><th className={`${th} ${num}`}>Líquido</th>
              <th className={th}>Títulos</th><th className={th}>Situação</th><th className={th} />
            </tr>
          </thead>
          <tbody>
            {!carregando && notas.length === 0 && (
              <tr><td colSpan={13} className="p-8 text-center text-sm text-gray-500">Nenhuma nota no período.</td></tr>
            )}
            {notas.map((n) => (
              <tr key={n.codfat} className={`border-t border-gray-100 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-zinc-700/60 ${n.cancel === 'S' ? 'text-red-600 line-through decoration-1 dark:text-red-400' : ''}`}>
                <td className={`${td} font-mono`}>{n.nroform}</td>
                <td className={`${td} font-mono text-xs`} title={n.chave_acesso || ''}>{n.chave_acesso ? `…${n.chave_acesso.slice(-12)}` : n.verificacao}</td>
                <td className={td}>{dataBR(n.dtemissao)}</td>
                <td className={td}>{n.competencia || '-'}</td>
                <td className={`${td} max-w-[220px] truncate`} title={n.nome_cliente}>{n.nome_cliente || n.codcli}</td>
                <td className={`${td} max-w-[220px] truncate`} title={n.descr}>{n.sen_codigo ? `${n.sen_codigo} · ` : ''}{n.descr}</td>
                <td className={`${td} ${num}`}>{moeda(n.valor_servico)}</td>
                <td className={`${td} ${num}`}>
                  {moeda(n.issqn_valor)}
                  {n.issqn_retido === 'S' && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">retido</span>}
                </td>
                <td className={`${td} ${num}`}>{moeda(n.retencoes)}</td>
                <td className={`${td} ${num} font-semibold`}>{moeda(n.valor_liquido)}</td>
                <td className={td}>
                  {n.qtd_titulos > 0
                    ? <span>{n.qtd_titulos}{n.recebido > 0 ? <span className="ml-1 text-xs text-green-700 dark:text-green-400">· rec. {moeda(n.recebido)}</span> : ''}</span>
                    : n.cancel === 'S' ? '-' : <span className="text-xs text-amber-700 dark:text-amber-400">sem cobrança</span>}
                </td>
                <td className={td}>{n.cancel === 'S' ? 'Cancelada' : 'Ativa'}</td>
                <td className={td}>
                  <button className={`${secundario} px-2 py-1 text-xs no-underline`} onClick={() => setDetalhe(n.codfat)}>
                    <Eye className="h-3.5 w-3.5" /> Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button className={secundario} disabled={pagina <= 1 || carregando} onClick={() => carregar(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button className={secundario} disabled={pagina >= totalPaginas || carregando} onClick={() => carregar(pagina + 1)}>Próxima</button>
        </div>
      )}

      {lancarAberto && (
        <ModalLancar onFechar={() => setLancarAberto(false)}
          onSalvo={(codfat) => { setLancarAberto(false); carregar(1); setDetalhe(codfat); }} />
      )}
      {detalhe && (
        <ModalDetalhe codfat={detalhe} usuario={usuario} onFechar={() => setDetalhe(null)} onAlterado={() => carregar(pagina)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- cobrança (bloco reutilizado)

function CamposCobranca({ valor, emissao, cob, setCob }: {
  valor: number; emissao: string;
  cob: { banco: string; forma: string; prazos: string };
  setCob: (c: { banco: string; forma: string; prazos: string }) => void;
}) {
  const [bancos, setBancos] = useState<{ banco: string; nome: string }[]>([]);
  useEffect(() => {
    fetch(`${API}/bancos`).then((r) => r.json()).then((j) => setBancos(j.bancos || [])).catch(() => undefined);
  }, []);
  const prazos = lerPrazos(cob.prazos);
  const parcelas = prazos.length ? dividirParcelas(valor, prazos.length) : [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Banco de cobrança</Label>
          <select className="block h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            value={cob.banco} onChange={(e) => setCob({ ...cob, banco: e.target.value })}>
            {bancos.map((b) => <option key={b.banco} value={b.banco}>{b.nome}{b.banco === '5' ? ' (cobrança própria)' : ' (boleto)'}</option>)}
          </select>
        </div>
        {cob.banco === '5' && (
          <div>
            <Label>Forma</Label>
            <select className="block h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              value={cob.forma} onChange={(e) => setCob({ ...cob, forma: e.target.value })}>
              {FORMAS_MELO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>Prazos (dias)</Label>
          <Input value={cob.prazos} placeholder="Ex.: 30/60/90 (0 = à vista)" onChange={(e) => setCob({ ...cob, prazos: e.target.value })} />
        </div>
      </div>
      {parcelas.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {parcelas.map((v, i) => (
            <span key={i} className="rounded border border-gray-200 px-2 py-1 dark:border-zinc-700">
              {String.fromCharCode(65 + i)} · venc. {dataBR(somarDias(emissao, prazos[i]))} · {moeda(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- lançar nota

function ModalLancar({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: (codfat: string) => void }) {
  const [f, setF] = useState({
    codcli: '', nroform: '', verificacao: '', chave_acesso: '', dtemissao: hojeISO(), competencia: `${hojeISO().slice(5, 7)}/${hojeISO().slice(0, 4)}`,
    sen_id: '', descr: '', valor_servico: '', valor_desconto: '', valor_deducoes: '', issqn_aliquota: '', issqn_retido: false,
    aliquota_pis: '', aliquota_cofins: '', aliquota_ir: '', aliquota_inss: '', aliquota_csll: '', outros_valor: '', obs: '',
  });
  const [gerarCobranca, setGerarCobranca] = useState(true);
  const [cob, setCob] = useState({ banco: '5', forma: 'CARTEIRA', prazos: '30' });
  const [gravando, setGravando] = useState(false);
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));

  const v = useMemo(() => calcularValoresNota({
    valor_servico: desmascarar(f.valor_servico), valor_desconto: desmascarar(f.valor_desconto),
    valor_deducoes: desmascarar(f.valor_deducoes), issqn_aliquota: pct(f.issqn_aliquota), issqn_retido: f.issqn_retido,
    aliquota_pis: pct(f.aliquota_pis), aliquota_cofins: pct(f.aliquota_cofins), aliquota_ir: pct(f.aliquota_ir),
    aliquota_inss: pct(f.aliquota_inss), aliquota_csll: pct(f.aliquota_csll), outros_valor: desmascarar(f.outros_valor),
  }), [f]);

  const salvar = async () => {
    setGravando(true);
    try {
      const nota = {
        codcli: f.codcli, nroform: f.nroform, verificacao: f.verificacao || null, chave_acesso: f.chave_acesso || null, dtemissao: f.dtemissao, competencia: f.competencia,
        sen_id: f.sen_id, descr: f.descr, obs: f.obs || null,
        valor_servico: v.valor_servico, valor_desconto: v.valor_desconto, valor_deducoes: v.valor_deducoes,
        issqn_aliquota: v.issqn_aliquota, issqn_retido: v.issqn_retido, aliquota_pis: v.aliquota_pis,
        aliquota_cofins: v.aliquota_cofins, aliquota_ir: v.aliquota_ir, aliquota_inss: v.aliquota_inss,
        aliquota_csll: v.aliquota_csll, outros_valor: v.outros_valor,
      };
      const cobranca = gerarCobranca
        ? { banco: cob.banco, forma: cob.banco === '5' ? cob.forma : null, prazos: lerPrazos(cob.prazos) }
        : null;
      const r = await fetch(`${API}/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota, cobranca }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao lançar a nota');
      toast.success(`Nota lançada (fatura ${j.codfat})${j.cobranca ? ` com ${j.cobranca.titulos.length} título(s)` : ''}.`);
      onSalvo(j.codfat);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };

  const campoPct = (k: keyof typeof f, rotulo: string) => (
    <div>
      <Label>{rotulo}</Label>
      <Input inputMode="decimal" placeholder="0" value={f[k] as string} onChange={(e) => set(k, e.target.value.replace(/[^0-9.,]/g, ''))} />
    </div>
  );
  const campoValor = (k: keyof typeof f, rotulo: string) => (
    <div>
      <Label>{rotulo}</Label>
      <Input inputMode="numeric" placeholder="0,00" value={f[k] as string}
        onFocus={(e) => e.target.select()} onChange={(e) => set(k, mascaraInputBRL(e.target.value))} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !gravando && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançar nota de serviço</DialogTitle>
          <DialogDescription>Dados da NFS-e já emitida (portal nacional: informe a chave de acesso; notas antigas da prefeitura: o código de verificação).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Cliente (tomador) *</Label>
              <Autocomplete apiUrl="/api/contas-receber/clientes" mapResponse={(d) => d.clientes || []}
                value={f.codcli} onChange={(val) => set('codcli', val)} placeholder="Buscar cliente..." />
            </div>
            <div><Label>Número da nota *</Label><Input value={f.nroform} onChange={(e) => set('nroform', e.target.value)} /></div>
            <div><Label>Código de verificação</Label><Input value={f.verificacao} onChange={(e) => set('verificacao', e.target.value)} placeholder="Nota da prefeitura (até 2025)" /></div>
            <div className="md:col-span-2">
              <Label>Chave de acesso (NFS-e nacional)</Label>
              <Input value={f.chave_acesso} maxLength={60} placeholder="50 dígitos — notas de 2026 em diante"
                onChange={(e) => set('chave_acesso', e.target.value.replace(/\D/g, '').slice(0, 50))} />
              {f.chave_acesso && f.chave_acesso.length !== 50 && <p className="text-xs text-red-600">{f.chave_acesso.length}/50 dígitos</p>}
            </div>
            <div><Label>Emissão *</Label>
              <Input type="date" value={f.dtemissao} onChange={(e) => {
                const d = e.target.value;
                setF((p) => ({ ...p, dtemissao: d, competencia: /^\d{4}-\d{2}/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : p.competencia }));
              }} />
            </div>
            <div><Label>Competência *</Label><Input value={f.competencia} placeholder="MM/AAAA" onChange={(e) => set('competencia', e.target.value)} /></div>
            <div className="md:col-span-2">
              <Label>Serviço *</Label>
              <Autocomplete apiUrl={`${API}/servicos`} mapResponse={(d) => d.servicos || []} value={f.sen_id}
                placeholder="Código ou atividade"
                onChange={(val, item: any) => setF((p) => ({
                  ...p, sen_id: val,
                  issqn_aliquota: p.issqn_aliquota || (item?.sen_issqn ? String(item.sen_issqn).replace('.', ',') : ''),
                  descr: p.descr || item?.sen_atividade || '',
                }))} />
            </div>
            <div className="md:col-span-4">
              <Label>Discriminação do serviço *</Label>
              <Textarea rows={2} maxLength={2000} value={f.descr} onChange={(e) => set('descr', e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-zinc-700">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Valores e ISS</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {campoValor('valor_servico', 'Valor do serviço *')}
              {campoValor('valor_desconto', 'Desconto')}
              {campoValor('valor_deducoes', 'Deduções')}
              {campoPct('issqn_aliquota', 'Alíquota ISS (%)')}
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input type="checkbox" checked={f.issqn_retido} onChange={(e) => set('issqn_retido', e.target.checked)} />
                ISS retido pelo tomador
              </label>
            </div>
            <div className="mt-3 mb-2 text-xs font-semibold uppercase text-gray-500">Retenções federais (alíquota %)</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {campoPct('aliquota_pis', 'PIS')}
              {campoPct('aliquota_cofins', 'COFINS')}
              {campoPct('aliquota_csll', 'CSLL')}
              {campoPct('aliquota_ir', 'IRRF')}
              {campoPct('aliquota_inss', 'INSS')}
              {campoValor('outros_valor', 'Outras (R$)')}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded bg-gray-50 p-2 text-sm dark:bg-zinc-800 md:grid-cols-5">
              <span>Base ISS: <b>{moeda(v.issqn_basecalculo)}</b></span>
              <span>ISS: <b>{moeda(v.issqn_valor)}</b>{v.issqn_retido === 'S' ? ' (retido)' : ''}</span>
              <span>Federais: <b>{moeda(v.pis_valor + v.cofins_valor + v.csll_valor + v.ir_valor + v.inss_valor)}</b></span>
              <span>Retenções: <b>{moeda(v.total_retencoes)}</b></span>
              <span>Líquido: <b className="text-green-700 dark:text-green-400">{moeda(v.valor_liquido)}</b></span>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-zinc-700">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={gerarCobranca} onChange={(e) => setGerarCobranca(e.target.checked)} />
              Gerar os títulos a receber agora (valor líquido)
            </label>
            {gerarCobranca && <CamposCobranca valor={v.valor_liquido} emissao={hojeISO()} cob={cob} setCob={setCob} />}
          </div>

          <div><Label>Observação</Label><Input maxLength={255} value={f.obs} onChange={(e) => set('obs', e.target.value)} /></div>
        </div>

        <DialogFooter>
          <button className={secundario} onClick={onFechar} disabled={gravando}>Cancelar</button>
          <button className={primario} onClick={salvar} disabled={gravando || v.valor_servico <= 0}>
            {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Lançar nota
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- detalhe

function ModalDetalhe({ codfat, usuario, onFechar, onAlterado }: {
  codfat: string; usuario: string; onFechar: () => void; onAlterado: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<'ver' | 'cobranca' | 'cancelar'>('ver');
  const [cob, setCob] = useState({ banco: '5', forma: 'CARTEIRA', prazos: '30' });
  const [motivo, setMotivo] = useState('');
  const [gravando, setGravando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`${API}/notas/${codfat}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro');
      setD(j);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, [codfat]);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (url: string, body: any, msg: string) => {
    setGravando(true);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro');
      toast.success(msg);
      setModo('ver');
      await carregar();
      onAlterado();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };

  const n = d?.nota;
  const titulosAtivos = (d?.titulos || []).filter((t: any) => t.cancel !== 'S');
  const linha = (rot: string, val: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1 text-sm dark:border-zinc-700">
      <span className="text-gray-500">{rot}</span><span className="text-right">{val}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !gravando && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> NFS-e nº {n?.nroform || '...'}
            {n?.cancel === 'S' && <span className="rounded bg-red-100 px-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">CANCELADA</span>}
          </DialogTitle>
          <DialogDescription>Fatura {codfat}{n ? ` · lançada em ${dataBR(n.data)} · origem ${n.origem}` : ''}</DialogDescription>
        </DialogHeader>
        {carregando || !d ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <div>
                {linha('Cliente', `${n.codcli} - ${n.nome_cliente || ''}`)}
                {n.chave_acesso
                  ? linha('Chave de acesso', <span className="break-all font-mono text-xs">{n.chave_acesso}</span>)
                  : linha('Verificação', <span className="font-mono">{n.verificacao}</span>)}
                {linha('Emissão / competência', `${dataBR(n.dtemissao)} · ${n.competencia || '-'}`)}
                {linha('Serviço', d.servicos?.[0] ? `${d.servicos[0].sen_codigo || ''} ${d.servicos[0].sen_atividade || ''}` : '-')}
              </div>
              <div>
                {linha('Valor do serviço', moeda(n.valor_servico))}
                {linha('Desconto / deduções', `${moeda(n.valor_desconto)} / ${moeda(n.valor_deducoes)}`)}
                {linha(`ISS (${Number(n.issqn_aliquota || 0).toLocaleString('pt-BR')}%)`, `${moeda(n.issqn_valor)}${n.issqn_retido === 'S' ? ' · retido' : ''}`)}
                {linha('PIS / COFINS / CSLL', `${moeda(n.pis_valor)} / ${moeda(n.cofins_valor)} / ${moeda(n.csll_valor)}`)}
                {linha('IRRF / INSS / outras', `${moeda(n.ir_valor)} / ${moeda(n.inss_valor)} / ${moeda(n.outros_valor)}`)}
                {linha('Valor líquido', <b className="text-green-700 dark:text-green-400">{moeda(n.totalfat)}</b>)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Discriminação</div>
              <p className="whitespace-pre-wrap text-sm">{d.servicos?.map((s: any) => s.descr).join('\n') || '-'}</p>
              {n.obs && <p className="mt-1 text-xs text-gray-500">Obs.: {n.obs}</p>}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Títulos a receber</div>
              {d.titulos.length === 0 ? <p className="text-sm text-gray-500">Nenhum título gerado.</p> : (
                <table className="w-full">
                  <thead><tr>
                    <th className={th}>Documento</th><th className={th}>Emissão</th><th className={th}>Vencimento</th>
                    <th className={`${th} ${num}`}>Valor</th><th className={`${th} ${num}`}>Recebido</th><th className={th}>Situação</th>
                  </tr></thead>
                  <tbody>
                    {d.titulos.map((t: any) => (
                      <tr key={t.cod_receb} className="border-t border-gray-100 dark:border-zinc-700">
                        <td className={`${td} font-mono`}>{t.nro_doc}</td>
                        <td className={td}>{dataBR(t.dt_emissao)}</td>
                        <td className={td}>{dataBR(t.dt_venc)}</td>
                        <td className={`${td} ${num}`}>{moeda(t.valor_pgto)}</td>
                        <td className={`${td} ${num}`}>{moeda(t.valor_rec)}</td>
                        <td className={td}>{t.cancel === 'S' ? 'Cancelado' : t.rec === 'S' ? 'Recebido' : Number(t.valor_rec) > 0 ? 'Parcial' : 'Em aberto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {modo === 'cobranca' && (
              <div className="rounded-md border border-blue-200 p-3 dark:border-blue-900">
                <CamposCobranca valor={Number(n.totalfat)} emissao={n.data || hojeISO()} cob={cob} setCob={setCob} />
                <div className="mt-3 flex justify-end gap-2">
                  <button className={secundario} onClick={() => setModo('ver')} disabled={gravando}>Voltar</button>
                  <button className={primario} disabled={gravando}
                    onClick={() => acao(`${API}/notas/${codfat}/titulos`,
                      { banco: cob.banco, forma: cob.banco === '5' ? cob.forma : null, prazos: lerPrazos(cob.prazos) }, 'Títulos gerados.')}>
                    {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Gerar títulos
                  </button>
                </div>
              </div>
            )}
            {modo === 'cancelar' && (
              <div className="rounded-md border border-red-200 p-3 dark:border-red-900">
                <Label>Motivo do cancelamento *</Label>
                <Textarea rows={2} maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">A nota e os títulos em aberto serão cancelados. Título com recebimento impede o cancelamento.</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button className={secundario} onClick={() => setModo('ver')} disabled={gravando}>Voltar</button>
                  <button className={perigo} disabled={gravando || !motivo.trim()}
                    onClick={() => acao(`${API}/notas/${codfat}/cancelar`, { motivo, usuario }, 'Nota cancelada.')}>
                    {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Cancelar nota
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {d && n?.cancel !== 'S' && modo === 'ver' && (
          <DialogFooter>
            {titulosAtivos.length === 0 && (
              <button className={primario} onClick={() => setModo('cobranca')}><RefreshCw className="h-4 w-4" /> Gerar títulos</button>
            )}
            <button className={perigo} onClick={() => setModo('cancelar')}><Ban className="h-4 w-4" /> Cancelar nota</button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
