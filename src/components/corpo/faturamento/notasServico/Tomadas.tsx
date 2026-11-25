/**
 * Financeiro → Notas de Serviço → Tomadas (/admin/financeiro/notasServicoTomadas).
 * NFS-e emitidas CONTRA a empresa (serviços contratados), baixadas do portal nacional (ADN) pelo
 * botão "Buscar no portal" — não há lançamento manual. Para cada nota gera-se, manualmente, o
 * título a pagar (valor líquido; fornecedor sugerido pelo CNPJ do prestador).
 * Regras: src/lib/nfse/tomadas.ts.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, ExternalLink, Eye, FileText, Loader2, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Autocomplete } from '@/components/common/Autocomplete';
import { mascaraInputBRL, desmascarar } from '@/utils/monetario';

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
const doc = (s?: string | null) => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return s || '-';
};
const paraMascara = (v: number) => mascaraInputBRL(String(Math.round(v * 100)));
const consultaPublica = (chave: string) => `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`;

const th = 'px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';
const td = 'px-2 py-1.5 text-sm whitespace-nowrap';
const num = 'text-right tabular-nums';
const botao = 'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const primario = `${botao} bg-blue-600 text-white hover:bg-blue-700`;
const secundario = `${botao} border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700`;

interface Tomada {
  id: string; numero: string; chave_acesso: string; dt_emissao: string; competencia: string;
  cnpj_prestador: string; nome_prestador: string; cod_servico: string; descricao: string;
  valor_servico: number; valor_liquido: number; cancelada: boolean;
  cod_credor_sugerido: string | null; nome_credor_sugerido: string | null;
  qtd_titulos: number; valor_titulos: number; valor_pago: number; titulos: string | null;
}

function Situacao({ t }: { t: Tomada }) {
  if (t.cancelada) return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">Cancelada</span>;
  if (t.qtd_titulos > 0) return <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300">Título gerado</span>;
  return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Pendente</span>;
}

export default function NotasServicoTomadas() {
  const { user } = useContext(AuthContext) as any;
  const usuario = user?.usuario || user?.nome || '';
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [situacao, setSituacao] = useState<'pendentes' | 'com_titulo' | 'canceladas' | 'todas'>('pendentes');
  const [busca, setBusca] = useState('');
  const [notas, setNotas] = useState<Tomada[]>([]);
  const [totais, setTotais] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscandoPortal, setBuscandoPortal] = useState(false);
  const [aberta, setAberta] = useState<{ id: string; gerar: boolean } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ situacao });
      if (de) q.set('de', de);
      if (ate) q.set('ate', ate);
      if (busca.trim()) q.set('q', busca.trim());
      const r = await fetch(`${API}/tomadas?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao carregar');
      setNotas(j.notas || []);
      setTotais(j.totais || null);
      if (j.aviso) toast.warning(j.aviso);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, [de, ate, situacao, busca]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [situacao]);

  const buscarPortal = async () => {
    setBuscandoPortal(true);
    try {
      const r = await fetch(`${API}/adn/sincronizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro na busca do portal');
      toast.success(j.novos ? `${j.novos} documento(s) novo(s) do portal.` : 'Nenhum documento novo no portal.');
      if (j.situacao === 'HA_MAIS') toast.info('Ainda há documentos no portal — clique em "Buscar no portal" de novo.');
      await carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBuscandoPortal(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold"><Receipt className="h-5 w-5 text-blue-600" /> Notas de Serviço — Tomadas</h1>
        <button className={secundario} onClick={buscarPortal} disabled={buscandoPortal}>
          {buscandoPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />} Buscar no portal
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Notas de serviço emitidas para a empresa, baixadas do portal nacional da NFS-e. Gere o título a pagar de cada nota.
      </p>

      <div className="mb-3 grid grid-cols-1 items-end gap-3 rounded-md border border-gray-200 p-3 dark:border-zinc-700 md:grid-cols-6">
        <div><Label>Emissão de</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div>
          <Label>Situação</Label>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as any)}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800">
            <option value="pendentes">Pendentes (sem título)</option>
            <option value="com_titulo">Com título gerado</option>
            <option value="canceladas">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <Label>Buscar</Label>
          <Input value={busca} placeholder="Nº, prestador, CNPJ, discriminação ou chave"
            onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar()} />
        </div>
        <button className={primario} onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar
        </button>
      </div>

      {totais && (
        <div className="mb-2 flex flex-wrap gap-6 text-sm">
          <span><b>{totais.qtd}</b> nota(s)</span>
          <span>Serviços: <b>{moeda(totais.servico)}</b></span>
          <span>Líquido: <b className="text-green-700 dark:text-green-400">{moeda(totais.liquido)}</b></span>
          <span>Em títulos: <b>{moeda(totais.titulos)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-zinc-700">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              <th className={th}>Nº</th><th className={th}>Emissão</th><th className={th}>Compet.</th><th className={th}>Prestador</th>
              <th className={th}>Serviço</th><th className={`${th} ${num}`}>Valor serviço</th><th className={`${th} ${num}`}>Líquido</th>
              <th className={th}>Títulos</th><th className={th}>Situação</th><th className={th} />
            </tr>
          </thead>
          <tbody>
            {notas.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-sm text-gray-500">
                {carregando ? 'Carregando…' : 'Nenhuma nota tomada. Use "Buscar no portal" para baixar as notas emitidas para a empresa.'}
              </td></tr>
            ) : notas.map((t) => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
                <td className={`${td} font-mono`}>{t.numero}</td>
                <td className={td}>{dataBR(t.dt_emissao)}</td>
                <td className={td}>{t.competencia || '-'}</td>
                <td className={`${td} max-w-[260px]`}>
                  <div className="truncate" title={t.nome_prestador}>{t.nome_prestador || '-'}</div>
                  <div className="text-xs text-gray-500">{doc(t.cnpj_prestador)}</div>
                </td>
                <td className={`${td} max-w-[260px]`}>
                  <div className="truncate" title={t.descricao}>{t.descricao || '-'}</div>
                  <div className="text-xs text-gray-500">{t.cod_servico || ''}</div>
                </td>
                <td className={`${td} ${num}`}>{moeda(t.valor_servico)}</td>
                <td className={`${td} ${num} font-medium`}>{moeda(t.valor_liquido)}</td>
                <td className={`${td} text-xs`}>{t.titulos || '-'}</td>
                <td className={td}><Situacao t={t} /></td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1">
                    <button className={secundario} title="Ver nota" onClick={() => setAberta({ id: t.id, gerar: false })}><Eye className="h-4 w-4" /></button>
                    {!t.cancelada && t.qtd_titulos === 0 && (
                      <button className={primario} onClick={() => setAberta({ id: t.id, gerar: true })}><FileText className="h-4 w-4" /> Gerar título</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aberta && (
        <ModalTomada id={aberta.id} iniciarGerando={aberta.gerar} usuario={usuario}
          onFechar={() => setAberta(null)} onGerado={() => { setAberta(null); carregar(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- detalhe + gerar título

function ModalTomada({ id, iniciarGerando, usuario, onFechar, onGerado }: {
  id: string; iniciarGerando: boolean; usuario: string; onFechar: () => void; onGerado: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [gerando, setGerando] = useState(iniciarGerando);
  const [gravando, setGravando] = useState(false);
  const [credor, setCredor] = useState('');
  const [cof, setCof] = useState('');
  const [conta, setConta] = useState('');
  const [obs, setObs] = useState('');
  const [parcelas, setParcelas] = useState<{ dt_venc: string; valor: string }[]>([]);

  useEffect(() => {
    fetch(`${API}/tomadas/${id}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.erro || 'Erro'); return j; })
      .then((j) => {
        setD(j);
        setCredor(j.nota.cod_credor_sugerido || '');
        setParcelas([{ dt_venc: somarDias(hojeISO(), 30), valor: paraMascara(Number(j.nota.valor_liquido)) }]);
      })
      .catch((e) => { toast.error(e.message); onFechar(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const n = d?.nota;
  const v = d?.valores;
  const liquido = Number(n?.valor_liquido || 0);
  const soma = useMemo(() => Math.round(parcelas.reduce((s, p) => s + desmascarar(p.valor), 0) * 100) / 100, [parcelas]);
  const diferenca = Math.round((liquido - soma) * 100) / 100;
  const podeGerar = !!n && !n.cancelada && Number(n.qtd_titulos) === 0;
  const valido = podeGerar && !!credor && parcelas.length > 0 && diferenca === 0
    && parcelas.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.dt_venc) && desmascarar(p.valor) > 0);

  const setP = (i: number, k: 'dt_venc' | 'valor', val: string) =>
    setParcelas((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: k === 'valor' ? mascaraInputBRL(val) : val } : p)));
  const dividirIgual = () => setParcelas((ps) => {
    const q = ps.length;
    const base = Math.floor((liquido / q) * 100) / 100;
    const primeira = Math.round((liquido - base * (q - 1)) * 100) / 100;
    return ps.map((p, i) => ({ ...p, valor: paraMascara(i === 0 ? primeira : base) }));
  });

  const gerar = async () => {
    setGravando(true);
    try {
      const r = await fetch(`${API}/tomadas/${id}/gerar-titulo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_credor: credor, pag_cof_id: cof || null, cod_conta: conta || null, obs: obs || null, usuario,
          parcelas: parcelas.map((p) => ({ dt_venc: p.dt_venc, valor: desmascarar(p.valor) })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao gerar o título');
      toast.success(`Título a pagar gerado: ${j.titulos.map((t: any) => t.nro_dup).join(', ')} (${j.fornecedor}).`);
      onGerado();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(false);
    }
  };

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
            <Receipt className="h-5 w-5" /> NFS-e tomada nº {n?.numero || '...'}
            {n?.cancelada && <span className="rounded bg-red-100 px-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">CANCELADA NO PORTAL</span>}
          </DialogTitle>
          <DialogDescription>{n ? `${n.nome_prestador} · ${doc(n.cnpj_prestador)}` : 'Carregando…'}</DialogDescription>
        </DialogHeader>

        {!d ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <div>
                {linha('Emissão / competência', `${dataBR(n.dt_emissao)} · ${n.competencia || '-'}`)}
                {linha('Serviço', `${n.cod_servico || ''}${d.codServicoMun ? ` · mun. ${d.codServicoMun}` : ''}`)}
                {linha('Chave de acesso', <a className="inline-flex items-center gap-1 break-all font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                  href={consultaPublica(n.chave_acesso)} target="_blank" rel="noreferrer">{n.chave_acesso} <ExternalLink className="h-3 w-3" /></a>)}
                {linha('Fornecedor no cadastro', n.cod_credor_sugerido ? `${n.cod_credor_sugerido} - ${n.nome_credor_sugerido}` : <span className="text-amber-700 dark:text-amber-300">não encontrado pelo CNPJ</span>)}
              </div>
              <div>
                {linha('Valor do serviço', moeda(n.valor_servico))}
                {v && linha(`ISS (${Number(v.issAliquota || 0).toLocaleString('pt-BR')}%)`, `${moeda(v.issValor)}${v.issRetido ? ' · retido pela empresa' : ''}`)}
                {v && linha('PIS / COFINS / CSLL', `${moeda(v.pis)} / ${moeda(v.cofins)} / ${moeda(v.csll)}`)}
                {v && linha('IRRF / INSS', `${moeda(v.ir)} / ${moeda(v.inss)}`)}
                {v && linha('Total retido (a empresa recolhe)', moeda(v.totalRetido))}
                {linha('Líquido a pagar ao fornecedor', <b className="text-green-700 dark:text-green-400">{moeda(liquido)}</b>)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Discriminação</div>
              <p className="whitespace-pre-wrap text-sm">{n.descricao || '-'}</p>
            </div>

            {d.titulos.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Títulos a pagar</div>
                <table className="w-full">
                  <thead><tr><th className={th}>Duplicata</th><th className={th}>Vencimento</th><th className={`${th} ${num}`}>Valor</th><th className={`${th} ${num}`}>Pago</th><th className={th}>Situação</th></tr></thead>
                  <tbody>
                    {d.titulos.map((t: any) => (
                      <tr key={t.cod_pgto} className="border-t border-gray-100 dark:border-zinc-700">
                        <td className={`${td} font-mono`}>{t.nro_dup}</td>
                        <td className={td}>{dataBR(t.dt_venc)}</td>
                        <td className={`${td} ${num}`}>{moeda(t.valor_pgto)}</td>
                        <td className={`${td} ${num}`}>{moeda(t.valor_pago)}</td>
                        <td className={td}>{t.cancel === 'S' ? 'Cancelado' : t.paga === 'S' ? 'Pago' : t.valor_pago > 0 ? 'Parcial' : 'Em aberto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {gerando && podeGerar && (
              <div className="space-y-3 rounded-md border border-blue-200 p-3 dark:border-blue-900">
                <div className="text-sm font-semibold">Gerar título a pagar</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>Fornecedor *</Label>
                    <Autocomplete placeholder="Buscar fornecedor..." apiUrl="/api/contas-pagar/fornecedores" value={credor}
                      initialLabel={n.cod_credor_sugerido ? `${n.cod_credor_sugerido} - ${n.nome_credor_sugerido}` : undefined}
                      onChange={(val) => setCredor(val)} mapResponse={(data) => data.fornecedores || []} />
                  </div>
                  <div>
                    <Label>Conta financeira</Label>
                    <Autocomplete placeholder="Buscar conta financeira..." apiUrl="/api/contas-pagar/contas" value={cof}
                      onChange={(val) => setCof(val)} mapResponse={(data) => data.contas || []} />
                  </div>
                  <div>
                    <Label>Código da conta</Label>
                    <Autocomplete placeholder="Buscar conta..." apiUrl="/api/contas-pagar/contas-dbconta" value={conta}
                      onChange={(val) => setConta(val)} mapResponse={(data) => data.contas || []} />
                  </div>
                </div>

                <table className="w-full">
                  <thead><tr><th className={th}>#</th><th className={th}>Vencimento</th><th className={`${th} ${num}`}>Valor (R$)</th><th /></tr></thead>
                  <tbody>
                    {parcelas.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-zinc-700">
                        <td className={td}>{i + 1}</td>
                        <td className={td}><Input type="date" className="h-8 w-40" value={p.dt_venc} onChange={(e) => setP(i, 'dt_venc', e.target.value)} /></td>
                        <td className={td}><Input inputMode="numeric" className="h-8 w-36 text-right" value={p.valor}
                          onFocus={(e) => e.target.select()} onChange={(e) => setP(i, 'valor', e.target.value)} /></td>
                        <td className={td}>
                          {parcelas.length > 1 && (
                            <button type="button" title="Remover parcela" className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => setParcelas((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={`${secundario} text-xs`} onClick={() => setParcelas((ps) => [...ps, {
                    dt_venc: somarDias(ps[ps.length - 1]?.dt_venc || hojeISO(), 30), valor: paraMascara(Math.max(diferenca, 0)),
                  }])}><Plus className="h-3.5 w-3.5" /> Incluir parcela</button>
                  <button type="button" className={`${secundario} text-xs`} onClick={dividirIgual}>Dividir o líquido igualmente</button>
                  <span className="ml-auto text-sm">
                    Soma <b>{moeda(soma)}</b> · Diferença{' '}
                    <b className={diferenca === 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{moeda(diferenca)}</b>
                  </span>
                </div>
                <div><Label>Observação</Label><Input maxLength={200} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <button className={secundario} onClick={onFechar} disabled={gravando}>Fechar</button>
          {podeGerar && !gerando && <button className={primario} onClick={() => setGerando(true)}><FileText className="h-4 w-4" /> Gerar título a pagar</button>}
          {podeGerar && gerando && (
            <button className={primario} onClick={gerar} disabled={!valido || gravando}>
              {gravando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar título a pagar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
