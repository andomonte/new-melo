/**
 * Notas de Serviço → "Buscar no portal": NFS-e nacionais baixadas do ADN.
 *   Pendentes : notas em que a empresa é PRESTADORA, para conferir e importar (cliente e serviço
 *               sugeridos pelo CNPJ do tomador e pelo código nacional; títulos opcionais).
 *   (As notas TOMADAS — que a empresa recebeu — ficam na tela Notas de Serviço > Tomadas.)
 *   Eventos   : cancelamentos e outros eventos — avisa quando se referem a uma nota já importada.
 *   Tratadas  : importadas ou ignoradas.
 * Regras: src/lib/nfse/adn/distribuicao.ts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/common/Autocomplete';

const API = '/api/nfse';
const moeda = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const dataBR = (s?: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}` : '-';
};
const doc = (s?: string | null) => {
  const d = String(s || '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d || '-';
};
const lerPrazos = (s: string) => String(s || '').split(/[^0-9]+/).filter(Boolean).map(Number);
const th = 'px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';
const td = 'px-2 py-1.5 text-sm align-top';
const num = 'text-right tabular-nums whitespace-nowrap';
const botao = 'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';
const primario = `${botao} bg-blue-600 text-white hover:bg-blue-700`;
const secundario = `${botao} border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700`;
const ABAS = [['pendentes', 'Pendentes'], ['eventos', 'Eventos'], ['tratadas', 'Tratadas']] as const;
type Aba = typeof ABAS[number][0];

export default function ModalBuscaAdn({ usuario, onFechar, onImportou }: { usuario: string; onFechar: () => void; onImportou: () => void }) {
  const [aba, setAba] = useState<Aba>('pendentes');
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, { codcli: string; sen_id: string }>>({});
  const [gerarTitulos, setGerarTitulos] = useState(true);
  const [cob, setCob] = useState({ banco: '5', forma: 'CARTEIRA', prazos: '30' });
  const [bancos, setBancos] = useState<{ banco: string; nome: string }[]>([]);
  const [gravando, setGravando] = useState<string | null>(null);

  const carregar = useCallback(async (a: Aba = aba) => {
    setCarregando(true);
    try {
      const r = await fetch(`${API}/adn/documentos?aba=${a}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro');
      setDados(j);
      // sugestões: cliente único pelo CNPJ e 1º serviço pelo código nacional
      const e: Record<string, { codcli: string; sen_id: string }> = {};
      for (const d of j.documentos || []) {
        e[d.id] = { codcli: d.clientes?.length === 1 ? d.clientes[0].codcli : '', sen_id: d.servicos?.[0]?.sen_id || '' };
      }
      setEscolha(e);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, [aba]);

  useEffect(() => { carregar(aba); }, [aba, carregar]);
  useEffect(() => {
    fetch(`${API}/bancos`).then((r) => r.json()).then((j) => setBancos(j.bancos || [])).catch(() => undefined);
  }, []);

  const buscar = async () => {
    setBuscando(true);
    try {
      const r = await fetch(`${API}/adn/sincronizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro na busca');
      toast.success(j.novos ? `${j.novos} documento(s) novo(s) do portal.` : 'Nenhum documento novo no portal.');
      if (j.situacao === 'HA_MAIS') toast.info('Ainda há documentos no portal — clique em "Buscar agora" de novo.');
      await carregar(aba);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const importar = async (d: any) => {
    const esc = escolha[d.id] || { codcli: '', sen_id: '' };
    setGravando(d.id);
    try {
      const body = {
        codcli: esc.codcli || null, sen_id: esc.sen_id || null, usuario,
        cobranca: gerarTitulos ? { banco: cob.banco, forma: cob.banco === '5' ? cob.forma : null, prazos: lerPrazos(cob.prazos) } : null,
      };
      const r = await fetch(`${API}/adn/documentos/${d.id}/importar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro ao importar');
      toast.success(`Nota ${d.numero} importada (fatura ${j.codfat})${j.titulos ? ` com ${j.titulos.titulos.length} título(s)` : ''}.`);
      await carregar(aba);
      onImportou();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(null);
    }
  };

  const ignorar = async (d: any) => {
    setGravando(d.id);
    try {
      const r = await fetch(`${API}/adn/documentos/${d.id}/ignorar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro || 'Erro');
      await carregar(aba);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGravando(null);
    }
  };

  const ctrl = dados?.controle?.[0];
  const docs: any[] = dados?.documentos || [];

  return (
    <Dialog open onOpenChange={(o) => !o && !buscando && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CloudDownload className="h-5 w-5" /> Notas do portal nacional (ADN)</DialogTitle>
          <DialogDescription>
            {dados?.ambiente === 'RESTRITA' ? 'Ambiente de TESTES (produção restrita). ' : ''}
            {ctrl
              ? `CNPJ ${doc(ctrl.cnpj)} · último NSU ${ctrl.ultimo_nsu} · última busca ${dataBR(ctrl.atualizado_em)}${ctrl.ultima_situacao && ctrl.ultima_situacao !== 'EM_DIA' && ctrl.ultima_situacao !== 'OK' ? ` · ${ctrl.ultima_situacao}` : ''}`
              : 'Nenhuma busca feita ainda.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <button className={primario} onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />} Buscar agora
          </button>
          <div className="ml-4 flex gap-1">
            {ABAS.map(([k, rot]) => (
              <button key={k} onClick={() => setAba(k)}
                className={`rounded-md px-3 py-1.5 text-sm ${aba === k ? 'bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700'}`}>
                {rot}
              </button>
            ))}
          </div>
        </div>

        {aba === 'pendentes' && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-3 text-sm dark:border-zinc-700">
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={gerarTitulos} onChange={(e) => setGerarTitulos(e.target.checked)} />
              Gerar títulos ao importar (valor líquido)
            </label>
            {gerarTitulos && (
              <>
                <div>
                  <Label>Banco</Label>
                  <select className="block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                    value={cob.banco} onChange={(e) => setCob({ ...cob, banco: e.target.value })}>
                    {bancos.map((b) => <option key={b.banco} value={b.banco}>{b.nome}</option>)}
                  </select>
                </div>
                {cob.banco === '5' && (
                  <div>
                    <Label>Forma</Label>
                    <select className="block h-9 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      value={cob.forma} onChange={(e) => setCob({ ...cob, forma: e.target.value })}>
                      <option value="CARTEIRA">Carteira</option><option value="RECIBO">Recibo</option>
                      <option value="CARTAO">Cartão</option><option value="PROMISSORIA">Promissória</option>
                    </select>
                  </div>
                )}
                <div><Label>Prazos (dias)</Label><Input className="w-40" value={cob.prazos} onChange={(e) => setCob({ ...cob, prazos: e.target.value })} /></div>
              </>
            )}
          </div>
        )}

        <div className="overflow-auto rounded-md border border-gray-200 dark:border-zinc-700">
          {carregando ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : docs.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">Nada nesta aba.</p>
          ) : aba === 'eventos' ? (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-zinc-800"><tr>
                <th className={th}>NSU</th><th className={th}>Tipo</th><th className={th}>Descrição</th><th className={th}>Nota referida</th><th className={th}>No sistema</th>
              </tr></thead>
              <tbody>{docs.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 dark:border-zinc-700">
                  <td className={td}>{d.nsu}</td>
                  <td className={td}>{d.tipo_evento || '-'}</td>
                  <td className={`${td} max-w-[420px]`}>{d.descricao || '-'}</td>
                  <td className={`${td} font-mono text-xs`}>{d.chave_referida ? `…${String(d.chave_referida).slice(-15)}` : '-'}</td>
                  <td className={td}>
                    {d.codfat_referida
                      ? <span className={d.cancel_referida === 'S' ? 'text-gray-500' : 'font-medium text-red-600 dark:text-red-400'}>
                          fatura {d.codfat_referida}{d.cancel_referida === 'S' ? ' (já cancelada)' : ' — confira e cancele se for o caso'}
                        </span>
                      : <span className="text-gray-500">não importada</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-zinc-800"><tr>
                <th className={th}>Nº</th><th className={th}>Emissão</th>
                <th className={th}>Tomador</th>
                <th className={th}>Serviço</th><th className={`${th} ${num}`}>Valor</th><th className={`${th} ${num}`}>Líquido</th>
                {aba === 'pendentes' && <><th className={th}>Cliente no sistema</th><th className={th}>Serviço no cadastro</th><th className={th} /></>}
                {aba === 'tratadas' && <><th className={th}>Situação</th><th className={th}>Fatura</th></>}
              </tr></thead>
              <tbody>{docs.map((d) => {
                const esc = escolha[d.id] || { codcli: '', sen_id: '' };
                return (
                  <tr key={d.id} className="border-t border-gray-100 dark:border-zinc-700">
                    <td className={`${td} font-mono`}>{d.numero}</td>
                    <td className={`${td} whitespace-nowrap`}>{dataBR(d.dt_emissao)}</td>
                    <td className={`${td} max-w-[220px]`}>
                      <div className="truncate" title={d.nome_tomador}>{d.nome_tomador || '-'}</div>
                      <div className="text-xs text-gray-500">{doc(d.doc_tomador)}</div>
                    </td>
                    <td className={`${td} max-w-[260px]`}><div className="truncate" title={d.descricao}>{d.cod_servico} · {d.descricao}</div></td>
                    <td className={`${td} ${num}`}>{moeda(d.valor_servico)}</td>
                    <td className={`${td} ${num} font-semibold`}>{moeda(d.valor_liquido)}</td>
                    {aba === 'pendentes' && (
                      <>
                        <td className={`${td} w-56`}>
                          <Autocomplete apiUrl="/api/contas-receber/clientes" mapResponse={(x) => x.clientes || []}
                            value={esc.codcli}
                            initialLabel={d.clientes?.length === 1 ? `${d.clientes[0].codcli} - ${d.clientes[0].nome}` : undefined}
                            placeholder={d.clientes?.length > 1 ? `${d.clientes.length} com este CNPJ` : 'Não cadastrado — escolha'}
                            onChange={(v) => setEscolha((p) => ({ ...p, [d.id]: { ...esc, codcli: v } }))} />
                        </td>
                        <td className={`${td} w-56`}>
                          <Autocomplete apiUrl={`${API}/servicos`} mapResponse={(x) => x.servicos || []}
                            value={esc.sen_id}
                            initialLabel={d.servicos?.[0] ? `${d.servicos[0].sen_codigo} - ${d.servicos[0].sen_atividade}` : undefined}
                            placeholder="Escolha o serviço"
                            onChange={(v) => setEscolha((p) => ({ ...p, [d.id]: { ...esc, sen_id: v } }))} />
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          <div className="flex gap-1">
                            <button className={`${primario} px-2 py-1 text-xs`} disabled={!!gravando || !esc.codcli || !esc.sen_id}
                              title={!esc.codcli || !esc.sen_id ? 'Escolha o cliente e o serviço' : 'Importar para as Notas de Serviço'}
                              onClick={() => importar(d)}>
                              {gravando === d.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Importar
                            </button>
                            <button className={`${secundario} px-2 py-1 text-xs`} disabled={!!gravando} onClick={() => ignorar(d)}>Ignorar</button>
                          </div>
                        </td>
                      </>
                    )}
                    {aba === 'tratadas' && (
                      <>
                        <td className={td}>{d.situacao === 'IMPORTADA' ? 'Importada' : 'Ignorada'}<div className="text-xs text-gray-500">{d.tratado_por || ''}</div></td>
                        <td className={`${td} font-mono`}>{d.codfat || '-'}</td>
                      </>
                    )}
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
