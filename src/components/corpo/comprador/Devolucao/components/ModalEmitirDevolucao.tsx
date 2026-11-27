/**
 * Emissão da NF de devolução de compra (Faturamento › Devolução), como o
 * "Emitir Devolução" do Delphi: mostra o espelho fiscal (impostos da NF do fornecedor, na
 * proporção devolvida), deixa corrigir o CFOP sugerido por linha, pede transporte/volumes
 * e emite: fatura + baixa do estoque reservado + título a receber 30 dias + NF-e.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import api from '@/components/services/api';

interface Linha {
  chave: string;
  codprod: string;
  descr: string;
  ref: string;
  qtd: number;
  prunit: number;
  totalproduto: number;
  cfopFornecedor: string;
  cfop: string;
  csticms: string;
  aliqIcms: number;
  baseIcms: number;
  valorIcms: number;
  icmsDeson: number;
  cstipi: string;
  valorIpi: number;
  valorSt: number;
  outros: number;
  desconto: number;
}

interface Espelho {
  devId: string;
  nfFornecedor: string;
  serieFornecedor: string;
  chaveRef: string;
  nrovenda: string | null;
  cliente: { codcli: string; nome: string; cpfcgc: string; uf: string };
  interestadual: boolean;
  linhas: Linha[];
  totais: { produtos: number; ipi: number; st: number; outros: number; desconto: number; icmsDeson: number; icms: number; nf: number };
  infCompl: string;
  pendencias: string[];
}

interface Props {
  devId: string;
  usuario: string;
  onClose: () => void;
  onDone: () => void;
}

const moeda = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtdFmt = (v: number) => (Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2));
const MOD_FRETE = [
  { v: '9', l: 'Sem frete' },
  { v: '0', l: 'Por conta do emitente (Melo)' },
  { v: '1', l: 'Por conta do destinatário (fornecedor)' },
  { v: '2', l: 'Por conta de terceiros' },
];

export const ModalEmitirDevolucao: React.FC<Props> = ({ devId, usuario, onClose, onDone }) => {
  const { toast } = useToast();
  const [esp, setEsp] = useState<Espelho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cfops, setCfops] = useState<Record<string, string>>({});
  const [transp, setTransp] = useState({ modFrete: '9', codtransp: '', quantidade: '1', especie: 'VOLUME', marca: '', pesoBruto: '', pesoLiquido: '' });
  const [obs, setObs] = useState('');
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/devolucao/espelho`, { params: { devId } })
      .then((r) => {
        setEsp(r.data);
        setCfops(Object.fromEntries((r.data.linhas as Linha[]).map((l) => [l.chave, l.cfop])));
      })
      .catch((e) => setErro(e?.response?.data?.message || e.message));
  }, [devId]);

  const cfopsInvalidos = useMemo(
    () => Object.entries(cfops).filter(([, c]) => !/^[567]\d{3}$/.test(c)).map(([k]) => k),
    [cfops],
  );

  const emitir = async () => {
    if (!esp) return;
    setEmitindo(true);
    try {
      const r = await api.post('/api/devolucao/emitir', {
        devId,
        cfops,
        transporte: { ...transp, codtransp: transp.codtransp.trim() || null },
        obs: obs.trim() || null,
        username: usuario,
      });
      setResultado(r.data);
      toast({
        title: r.data?.nfe?.autorizada ? 'NF de devolução autorizada' : 'Fatura gravada; NF não autorizada',
        description: r.data?.message,
        variant: r.data?.nfe?.autorizada ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Não foi possível emitir', description: e?.response?.data?.message || e.message, variant: 'destructive' });
    } finally {
      setEmitindo(false);
    }
  };

  const fechar = () => (resultado ? onDone() : onClose());
  const bloqueado = !esp || esp.pendencias.length > 0 || cfopsInvalidos.length > 0 || emitindo;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center px-2">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Emitir NF de devolução · {devId}</h2>
          <button onClick={fechar} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {erro && <p className="text-red-600">{erro}</p>}
          {!esp && !erro && (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          )}

          {esp && resultado && (
            <div className={`rounded-md border p-4 mb-4 ${resultado.nfe?.autorizada ? 'border-green-300 bg-green-50 dark:bg-green-900/30' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/30'}`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {resultado.nfe?.autorizada ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {resultado.nfe?.autorizada ? `NF ${Number(resultado.nroform)} autorizada` : `Fatura ${resultado.codfat} gravada — NF não autorizada`}
              </div>
              <p>Fatura {resultado.codfat} · NF {Number(resultado.nroform)}/{resultado.serie} · {moeda(resultado.totalnf)}
                {resultado.codReceb ? ` · título a receber ${resultado.codReceb} (30 dias)` : ''}</p>
              {resultado.nfe && <p className="mt-1">SEFAZ: {resultado.nfe.status} — {resultado.nfe.motivo}</p>}
              {resultado.nfe?.autorizada && (
                <p className="mt-1">
                  {resultado.nfe.naFila
                    ? 'DANFE enviado para a fila de impressão.'
                    : resultado.nfe.danfe
                      ? 'DANFE gerado (já estava na fila de impressão).'
                      : 'Atenção: o DANFE não foi gerado; reimprima pelo Histórico de NF.'}
                </p>
              )}
              {resultado.nfe?.chave && <p className="mt-1 font-mono text-xs break-all">{resultado.nfe.chave}</p>}
              {!resultado.nfe?.autorizada && <p className="mt-2">Corrija o motivo e use “Transmitir NF” no detalhe da devolução.</p>}
            </div>
          )}

          {esp && !resultado && (
            <>
              {esp.pendencias.length > 0 && (
                <div className="mb-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 p-3 text-red-900 dark:text-red-200">
                  <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4" />Não é possível emitir:</div>
                  <ul className="list-disc ml-6 mt-1">{esp.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <Campo rotulo="Destinatário" valor={`${esp.cliente.codcli} · ${esp.cliente.nome}`} />
                <Campo rotulo="CNPJ / UF" valor={`${esp.cliente.cpfcgc} · ${esp.cliente.uf}${esp.interestadual ? ' (interestadual)' : ''}`} />
                <Campo rotulo="NF do fornecedor" valor={`${esp.nfFornecedor}${esp.serieFornecedor ? `/${esp.serieFornecedor}` : ''}`} />
                <Campo rotulo="Pré-pedido" valor={esp.nrovenda} />
              </div>
              <p className="text-xs text-gray-500 mb-3 font-mono break-all">Referência: {esp.chaveRef}</p>

              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-zinc-700 text-left">
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2 text-right">Qtd</th>
                      <th className="px-2 py-2 text-right">Unit.</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-center">CFOP forn.</th>
                      <th className="px-2 py-2 text-center">CFOP devolução</th>
                      <th className="px-2 py-2 text-center">CST</th>
                      <th className="px-2 py-2 text-right">ICMS</th>
                      <th className="px-2 py-2 text-right">IPI</th>
                      <th className="px-2 py-2 text-right">ST</th>
                      <th className="px-2 py-2 text-right">Outros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {esp.linhas.map((l) => {
                      const invalido = cfopsInvalidos.includes(l.chave);
                      return (
                        <tr key={l.chave} className="border-t border-gray-200 dark:border-zinc-700">
                          <td className="px-2 py-1.5">
                            <div className="font-medium">{l.codprod}{l.ref ? ` · ${l.ref}` : ''}</div>
                            <div className="text-gray-500 truncate max-w-[220px]">{l.descr}</div>
                          </td>
                          <td className="px-2 py-1.5 text-right">{qtdFmt(l.qtd)}</td>
                          <td className="px-2 py-1.5 text-right">{moeda(l.prunit)}</td>
                          <td className="px-2 py-1.5 text-right">{moeda(l.totalproduto)}</td>
                          <td className="px-2 py-1.5 text-center">{l.cfopFornecedor}</td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              value={cfops[l.chave] ?? ''}
                              maxLength={4}
                              onChange={(e) => setCfops((c) => ({ ...c, [l.chave]: e.target.value.replace(/\D/g, '') }))}
                              className={`w-16 text-center px-1 py-0.5 border rounded dark:bg-zinc-700 ${invalido ? 'border-red-500' : 'border-gray-300 dark:border-zinc-600'}`}
                              title="CFOP sugerido pela NF do fornecedor; pode ser alterado"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">{l.csticms}</td>
                          <td className="px-2 py-1.5 text-right">{l.valorIcms ? `${moeda(l.valorIcms)} (${l.aliqIcms}%)` : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{l.valorIpi ? moeda(l.valorIpi) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{l.valorSt ? moeda(l.valorSt) : '-'}</td>
                          <td className="px-2 py-1.5 text-right">{l.outros ? moeda(l.outros) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
                <Campo rotulo="Produtos" valor={moeda(esp.totais.produtos)} />
                <Campo rotulo="ICMS" valor={moeda(esp.totais.icms)} />
                <Campo rotulo="IPI" valor={moeda(esp.totais.ipi)} />
                <Campo rotulo="ST + outros (despesas)" valor={moeda(esp.totais.st + esp.totais.outros)} />
                <Campo rotulo="Desconto / ICMS deson." valor={moeda(esp.totais.desconto + esp.totais.icmsDeson)} />
                <Campo rotulo="Total da NF" valor={moeda(esp.totais.nf)} destaque />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mt-4">
                <label className="col-span-2">
                  <span className="text-xs text-gray-500">Frete</span>
                  <select value={transp.modFrete} onChange={(e) => setTransp({ ...transp, modFrete: e.target.value })}
                    className="w-full px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600">
                    {MOD_FRETE.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </label>
                <Entrada rotulo="Transportadora (cód.)" valor={transp.codtransp} onChange={(v) => setTransp({ ...transp, codtransp: v })} />
                <Entrada rotulo="Volumes" valor={transp.quantidade} onChange={(v) => setTransp({ ...transp, quantidade: v })} />
                <Entrada rotulo="Espécie" valor={transp.especie} onChange={(v) => setTransp({ ...transp, especie: v })} />
                <Entrada rotulo="Peso bruto" valor={transp.pesoBruto} onChange={(v) => setTransp({ ...transp, pesoBruto: v })} />
                <Entrada rotulo="Peso líquido" valor={transp.pesoLiquido} onChange={(v) => setTransp({ ...transp, pesoLiquido: v })} />
              </div>
              <label className="block mt-2">
                <span className="text-xs text-gray-500">Mensagem adicional (texto complementar)</span>
                <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300}
                  className="w-full px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600" />
              </label>
              <p className="text-xs text-gray-500 mt-1">Texto automático: {esp.infCompl}</p>

              <p className="mt-4 text-xs text-gray-600 dark:text-gray-300">
                Ao emitir: a fatura é gravada, o estoque reservado para a devolução é baixado, é gerado o
                título a receber do fornecedor em 30 dias e a NF-e é transmitida.
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-2">
          {!resultado && (
            <DefaultButton text={emitindo ? 'Emitindo...' : 'Emitir NF de devolução'} size="sm" disabled={bloqueado} onClick={emitir} />
          )}
          <DefaultButton text="Fechar" size="sm" variant="secondary" onClick={fechar} disabled={emitindo} />
        </div>
      </div>
    </div>
  );
};

const Campo: React.FC<{ rotulo: string; valor: string | null | undefined; destaque?: boolean }> = ({ rotulo, valor, destaque }) => (
  <div>
    <span className="text-xs text-gray-500 dark:text-gray-400">{rotulo}</span>
    <p className={`font-medium break-words ${destaque ? 'text-base text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>{valor || '-'}</p>
  </div>
);

const Entrada: React.FC<{ rotulo: string; valor: string; onChange: (v: string) => void }> = ({ rotulo, valor, onChange }) => (
  <label>
    <span className="text-xs text-gray-500">{rotulo}</span>
    <input value={valor} onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1 border rounded dark:bg-zinc-700 dark:border-zinc-600" />
  </label>
);
