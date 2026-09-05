'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Loader2, Upload, CheckCircle2, HelpCircle, Search } from 'lucide-react';
import ModalBaixaConciliacao, { type TituloBaixa } from '@/components/corpo/contas-receber/ModalBaixaConciliacao';

interface TituloDetalhe {
  cod_receb: string;
  nome_cliente?: string | null;
  saldoCentavos: number;
  dt_venc: string;
  nro_doc?: string | null;
  parcelaX?: number | null;
  parcelaN?: number | null;
}
interface Sugestao {
  confianca: 'alta' | 'media' | 'baixa';
  tipoMatch: string;
  titulos: string[];
  detalhes?: TituloDetalhe[];
  motivo: string;
  saldoRestanteCentavos?: number;
}
interface Linha {
  lin_id: number;
  idx: number;
  data: string;
  historico: string;
  valorCentavos: number;
  tipo: string;
  categoria: 'recebimento' | 'boleto' | 'descarte' | 'a_identificar';
  pagador: { documento: string | null; tipo: string | null; nome: string | null };
  codcli: string | null;
  cliVia: string | null;
  status: string;
  sugestoes: Sugestao[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario: string;
  filial?: string;
  codContaPadrao?: string;
}

const brl = (cent: number) => (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const badgeConf = (c: string) =>
  c === 'alta' ? 'bg-green-500' : c === 'media' ? 'bg-amber-500' : 'bg-gray-400';

export default function ModalConciliacao({ isOpen, onClose, usuario, filial, codContaPadrao }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loteId, setLoteId] = useState<number | null>(null);
  const [cofId, setCofId] = useState<string | null>(null);
  // Conta do operador vem do LOGIN (igual ao Caixa): user.cod_conta e, na falta, perfilFilial.
  // Não é digitada; se o login não tiver conta cadastrada, fica vazia e a baixa avisa.
  const [codConta, setCodConta] = useState(codContaPadrao || '');
  useEffect(() => {
    if (codContaPadrao) { setCodConta(String(codContaPadrao)); return; }
    if (usuario && filial) {
      fetch(`/api/perfilFilial/get?user_login_id=${encodeURIComponent(usuario)}&nome_filial=${encodeURIComponent(filial)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCodConta(d?.cod_conta ? String(d.cod_conta) : ''))
        .catch(() => setCodConta(''));
    } else {
      setCodConta('');
    }
  }, [codContaPadrao, usuario, filial]);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [estornando, setEstornando] = useState<number | null>(null);
  // Filtro da lista por status/categoria (badges clicáveis).
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'a_identificar' | 'conciliado' | 'descarte' | 'boleto'>('todos');
  // Busca manual de título (por linha).
  const [buscaLinha, setBuscaLinha] = useState<number | null>(null);
  const [buscaTermo, setBuscaTermo] = useState('');
  const [buscaResultados, setBuscaResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [memorizarApelido, setMemorizarApelido] = useState(true); // memorizar pagador→cliente ao vincular manual

  const toBase64 = (buf: ArrayBuffer) => {
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const importar = async () => {
    if (!arquivo) {
      toast.error('Escolha o arquivo CSV do extrato.');
      return;
    }
    setImportando(true);
    try {
      const b64 = toBase64(await arquivo.arrayBuffer());
      const r = await fetch('/api/conciliacao/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivoBase64: b64, nome: arquivo.name, usuario }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao importar');
      setLoteId(d.lote_id);
      setLinhas(d.linhas || []);
      if (d.reaberto) {
        toast.info(d.mensagem || 'Extrato já importado — reaberto para continuar a validação.');
      } else {
        toast.success(`${d.totalRecebimento} recebimento(s) de ${d.totalLinhas} linhas.`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportando(false);
    }
  };

  // Fluxo "Dar Baixa": abre o ModalRecebimentoTitulos (a tela de baixa que já existe) com os
  // títulos sugeridos/buscados. Ao confirmar, o /api/caixa/receber marca a conc_linha (concLinId).
  const [baixaLinha, setBaixaLinha] = useState<Linha | null>(null);
  const [baixaTitulos, setBaixaTitulos] = useState<TituloBaixa[]>([]);
  const abrirBaixa = (
    l: Linha,
    titulos: { cod_receb: string; codcli?: string | null; nome_cliente?: string | null; nro_doc?: string | null; dt_venc?: string | null; saldoCentavos?: number | null }[],
  ) => {
    // Pode abrir sem sugestão (títulos=[]) — o operador busca dentro do modal.
    setBaixaTitulos(
      titulos.map((t) => ({
        cod_receb: String(t.cod_receb),
        codcli: String(t.codcli ?? l.codcli ?? ''),
        nome_cliente: t.nome_cliente ?? null,
        nro_doc: t.nro_doc ?? null,
        dt_venc: t.dt_venc ?? null,
        saldoCentavos: Number(t.saldoCentavos ?? 0),
      })),
    );
    setBaixaLinha(l);
  };

  const confirmar = async (l: Linha, titulos: string[], memorizar = false) => {
    if (!codConta.trim()) {
      toast.error('Seu login não tem conta de recebimento — peça o cadastro para dar baixa.');
      return;
    }
    if (!cofId) {
      toast.error('Selecione a conta financeira.');
      return;
    }
    if (!titulos || titulos.length === 0) return;
    setConfirmando(l.lin_id);
    try {
      const r = await fetch('/api/conciliacao/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lin_id: l.lin_id, titulos, cof_id: cofId, cod_conta: codConta.trim(), usuario, salvarApelido: memorizar }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao confirmar');
      toast.success(`Baixa conciliada (comprovante ${d.aut_id ?? '-'}).`);
      setLinhas((prev) => prev.map((x) => (x.lin_id === l.lin_id ? { ...x, status: 'conciliado' } : x)));
      setBuscaLinha(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConfirmando(null);
    }
  };

  const estornar = async (l: Linha) => {
    if (!window.confirm('Estornar esta conciliação? Isso reverte a baixa e cancela o comprovante.')) return;
    setEstornando(l.lin_id);
    try {
      const r = await fetch('/api/conciliacao/estornar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lin_id: l.lin_id, usuario }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao estornar');
      toast.success('Conciliação estornada.');
      setLinhas((prev) => prev.map((x) => (x.lin_id === l.lin_id ? { ...x, status: d.novoStatus } : x)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEstornando(null);
    }
  };

  const [estornandoLote, setEstornandoLote] = useState(false);
  const estornarLote = async () => {
    if (!loteId) return;
    if (!window.confirm('Estornar TODAS as baixas conciliadas deste lote? Reverte as baixas e cancela os comprovantes.')) return;
    setEstornandoLote(true);
    try {
      const r = await fetch('/api/conciliacao/estornar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote_id: loteId, usuario }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao estornar lote');
      toast.success(`${d.estornadas} baixa(s) estornada(s).`);
      // Reflete: conciliadas com cliente voltam a 'pendente'; sem cliente, 'a_identificar'.
      setLinhas((prev) => prev.map((x) => (x.status === 'conciliado' ? { ...x, status: x.codcli ? 'pendente' : 'a_identificar' } : x)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEstornandoLote(false);
    }
  };

  const buscarTitulosManual = async (l: Linha, termo: string) => {
    setBuscaTermo(termo);
    if (termo.trim().length < 2) { setBuscaResultados([]); return; }
    setBuscando(true);
    try {
      const r = await fetch(`/api/conciliacao/buscar-titulos?termo=${encodeURIComponent(termo)}&valor_cent=${l.valorCentavos}`);
      const d = await r.json();
      setBuscaResultados(d.titulos || []);
    } catch {
      setBuscaResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const recebimentos = useMemo(() => linhas.filter((l) => l.categoria === 'recebimento'), [linhas]);
  const descartadas = useMemo(() => linhas.filter((l) => l.categoria === 'descarte'), [linhas]);
  // Boletos: liquidação de cobrança — baixados na tela de boletos, fora desta conciliação manual.
  const boletos = useMemo(() => linhas.filter((l) => l.categoria === 'boleto'), [linhas]);
  // Status DENTRO dos recebimentos (é isso que interessa ao operador).
  const recPendentes = useMemo(() => recebimentos.filter((l) => l.status === 'pendente'), [recebimentos]);
  const recAIdent = useMemo(() => recebimentos.filter((l) => l.status === 'a_identificar'), [recebimentos]);
  const recConciliados = useMemo(() => recebimentos.filter((l) => l.status === 'conciliado'), [recebimentos]);

  const listaExibida = useMemo(() => {
    if (filtro === 'descarte') return descartadas;
    if (filtro === 'boleto') return boletos;
    if (filtro === 'pendente') return recPendentes;
    if (filtro === 'a_identificar') return recAIdent;
    if (filtro === 'conciliado') return recConciliados;
    return recebimentos;
  }, [filtro, recebimentos, descartadas, boletos, recPendentes, recAIdent, recConciliados]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conciliação Bancária — Contas a Receber" width="w-[97%] max-w-7xl">
      <div className="space-y-4">
        {/* Upload — o extrato é só lido/classificado. As contas de baixa vêm depois (ao confirmar). */}
        <div className="flex flex-wrap items-end gap-3 border-b pb-3">
          <div>
            <Label>Arquivo do extrato (CSV ou OFX)</Label>
            <input
              type="file"
              accept=".csv,.ofx,text/csv,application/x-ofx,application/ofx,text/plain"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="block text-sm"
            />
          </div>
          <Button onClick={importar} disabled={importando || !arquivo}>
            {importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Importar
          </Button>
          <span className="text-[11px] text-gray-500 self-center max-w-xs">
            O extrato é apenas lido e classificado. Reimportar o mesmo arquivo reabre o lote para
            continuar a validação.
          </span>
        </div>

        {linhas.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs items-center">
            {([
              { k: 'todos', label: `Recebimentos: ${recebimentos.length}`, cor: 'bg-blue-600', ring: 'ring-blue-600' },
              { k: 'pendente', label: `Com sugestão: ${recPendentes.length}`, cor: 'bg-emerald-600', ring: 'ring-emerald-600' },
              { k: 'a_identificar', label: `A identificar: ${recAIdent.length}`, cor: 'bg-amber-500', ring: 'ring-amber-500' },
              { k: 'conciliado', label: `Conciliados: ${recConciliados.length}`, cor: 'bg-teal-600', ring: 'ring-teal-600' },
              { k: 'boleto', label: `Boletos: ${boletos.length}`, cor: 'bg-indigo-500', ring: 'ring-indigo-500' },
              { k: 'descarte', label: `Descartadas: ${descartadas.length}`, cor: 'bg-gray-400', ring: 'ring-gray-400' },
            ] as const).map((b) => (
              <button
                key={b.k}
                type="button"
                onClick={() => setFiltro(b.k as typeof filtro)}
                className={`${b.cor} text-white rounded-full px-2.5 py-0.5 font-medium transition ${
                  filtro === b.k ? `ring-2 ring-offset-1 ${b.ring} dark:ring-offset-slate-900` : 'opacity-70 hover:opacity-100'
                }`}
                title="Clique para filtrar a lista"
              >
                {b.label}
              </button>
            ))}
            {loteId && <span className="text-gray-400 ml-1">lote #{loteId}</span>}
            {loteId && recConciliados.length > 0 && (
              <button
                type="button"
                onClick={estornarLote}
                disabled={estornandoLote}
                className="ml-auto text-[11px] text-red-600 hover:underline inline-flex items-center gap-1"
              >
                {estornandoLote ? 'estornando…' : `estornar lote (${recConciliados.length})`}
              </button>
            )}
          </div>
        )}

        {/* Conta de baixa — só aparece após importar; usada ao Confirmar/Vincular cada linha. */}
        {recebimentos.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2">
            <div className="self-center text-xs font-semibold text-blue-900 dark:text-blue-100">
              Conta de baixa
              <span className="ml-1 font-normal text-blue-700 dark:text-blue-300">(aplicada ao confirmar)</span>
            </div>
            <div className="w-56">
              <Label className="text-[11px]">Conta financeira (classificação)</Label>
              <Autocomplete
                placeholder="Buscar conta..."
                apiUrl="/api/contas-receber/contas"
                value={cofId}
                onChange={(v) => setCofId(v)}
                mapResponse={(data) => (data.contas || []).map((c: any) => ({ value: c.id, label: c.label }))}
              />
            </div>
            <div className="self-center">
              <Label className="text-[11px]">Conta operador (do login)</Label>
              {codConta ? (
                <div className="font-mono text-sm text-blue-900 dark:text-blue-100 h-9 flex items-center">
                  {codConta}
                </div>
              ) : (
                <div className="text-[11px] text-red-600 h-9 flex items-center max-w-[220px] leading-tight">
                  Seu login não tem conta de recebimento — peça o cadastro para poder dar baixa.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista filtrada pelos chips acima */}
        {linhas.length > 0 && (
          <div className="max-h-[55vh] overflow-auto rounded border border-gray-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                <tr>
                  <th className="px-2 py-1 text-left">Data</th>
                  <th className="px-2 py-1 text-left">Histórico / Pagador</th>
                  <th className="px-2 py-1 text-right">Valor</th>
                  <th className="px-2 py-1 text-left">{filtro === 'descarte' ? 'Motivo do descarte' : 'Sugestão'}</th>
                  <th className="px-2 py-1 text-center w-28">Ação</th>
                </tr>
              </thead>
              <tbody>
                {listaExibida.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-[11px]">
                      Nenhum lançamento neste filtro.
                    </td>
                  </tr>
                )}
                {listaExibida.map((l) => {
                  const isDescarte = l.categoria === 'descarte';
                  const top = l.sugestoes?.[0];
                  const feito = l.status === 'conciliado';
                  const buscando_ = buscaLinha === l.lin_id;
                  return (
                    <Fragment key={l.lin_id}>
                      <tr className="border-t border-gray-100 dark:border-slate-800 align-top">
                        <td className="px-2 py-1 whitespace-nowrap">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                        <td className="px-2 py-1">
                          <div>{l.historico}</div>
                          <div className="text-[10px] text-gray-500">
                            {isDescarte
                              ? `não é recebível · ${l.tipo}`
                              : (
                                <>
                                  {l.pagador.documento ? `${l.pagador.tipo?.toUpperCase()} ${l.pagador.documento}` : 'sem doc'}
                                  {l.codcli ? ` · cliente ${l.codcli} (${l.cliVia})` : ' · cliente não identificado'}
                                </>
                              )}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{brl(l.valorCentavos)}</td>
                        <td className="px-2 py-1">
                          {isDescarte ? (
                            <span className="text-[10px] text-gray-400">{l.tipo}</span>
                          ) : top ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                <Badge className={`${badgeConf(top.confianca)} text-[9px]`}>{top.confianca}</Badge>
                                <span className="text-[10px] text-gray-500">{top.tipoMatch}</span>
                                <span className="font-mono">{top.titulos.join(' + ')}</span>
                              </div>
                              {/* Detalhes do(s) título(s) para o operador validar */}
                              {(top.detalhes || []).map((d) => (
                                <span key={d.cod_receb} className="text-[10px] text-gray-700 dark:text-gray-300">
                                  {d.nome_cliente || '—'} · parc {d.parcelaX ?? '?'}/{d.parcelaN ?? '?'} · venc{' '}
                                  {d.dt_venc ? new Date(d.dt_venc).toLocaleDateString('pt-BR') : '—'} · doc {d.nro_doc || '—'} ·{' '}
                                  <b className="tabular-nums">{brl(d.saldoCentavos)}</b>
                                </span>
                              ))}
                              <span className="text-[10px] text-gray-500">{top.motivo}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1">
                              <HelpCircle size={12} /> sem sugestão
                            </span>
                          )}
                          {!feito && !isDescarte && (
                            <button
                              type="button"
                              onClick={() => { setBuscaLinha(buscando_ ? null : l.lin_id); setBuscaTermo(''); setBuscaResultados([]); }}
                              className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"
                            >
                              <Search size={11} /> {buscando_ ? 'fechar busca' : 'buscar título manual'}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {feito ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-green-600 inline-flex items-center gap-1 text-[11px]">
                                <CheckCircle2 size={14} /> conciliado
                              </span>
                              <button
                                type="button"
                                onClick={() => estornar(l)}
                                disabled={estornando === l.lin_id}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                {estornando === l.lin_id ? 'estornando...' : 'estornar'}
                              </button>
                            </div>
                          ) : top ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                abrirBaixa(
                                  l,
                                  (top.detalhes && top.detalhes.length
                                    ? top.detalhes
                                    : top.titulos.map((cr) => ({ cod_receb: cr }))) as any,
                                )
                              }
                              className="h-7 text-[11px]"
                            >
                              Dar Baixa
                            </Button>
                          ) : !isDescarte ? (
                            <Button size="sm" variant="outline" onClick={() => abrirBaixa(l, [])} className="h-7 text-[11px]">
                              Dar Baixa
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                      {buscando_ && (
                        <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                          <td colSpan={5} className="px-3 py-2">
                            <Input
                              autoFocus
                              placeholder="Buscar título por cliente, código ou nota..."
                              value={buscaTermo}
                              onChange={(e) => buscarTitulosManual(l, e.target.value)}
                              className="mb-2 h-8 text-xs"
                            />
                            {buscando && <div className="text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin inline" /> buscando…</div>}
                            <label className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-300 mb-1 cursor-pointer">
                              <input type="checkbox" checked={memorizarApelido} onChange={(e) => setMemorizarApelido(e.target.checked)} />
                              memorizar este pagador ({l.pagador.documento || l.pagador.nome || 'pagador'}) para o cliente vinculado — próximas importações resolvem sozinhas
                            </label>
                            <div className="max-h-40 overflow-auto space-y-1">
                              {buscaResultados.map((t: any) => (
                                <div key={t.cod_receb} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-[11px]">
                                  <span>
                                    <span className="font-mono">{t.cod_receb}</span> · {t.codcli} - {t.nome_cliente} · {t.nro_doc || '-'} · venc {new Date(t.dt_venc).toLocaleDateString('pt-BR')} · <b>{brl(t.saldoCentavos)}</b>
                                  </span>
                                  <Button size="sm" className="h-6 text-[10px]" disabled={confirmando === l.lin_id} onClick={() => confirmar(l, [t.cod_receb], memorizarApelido)}>
                                    Vincular
                                  </Button>
                                </div>
                              ))}
                              {!buscando && buscaTermo.length >= 2 && buscaResultados.length === 0 && (
                                <div className="text-[11px] text-gray-400">Nenhum título em aberto encontrado.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {linhas.length > 0 && (
          <p className="text-[11px] text-gray-500">
            Alta confiança = CPF/CNPJ confere + valor. <b>Dar Baixa</b> abre a tela de recebimento com o(s)
            título(s) sugerido(s) — lá você ajusta valor/forma e confirma. Os "a identificar" ficam pendentes.
          </p>
        )}
      </div>

      {/* Tela dedicada de baixa da conciliação — valor do Pix fixo, seleção/busca de títulos. */}
      <ModalBaixaConciliacao
        isOpen={baixaLinha !== null}
        linId={baixaLinha?.lin_id ?? null}
        valorCentavos={baixaLinha?.valorCentavos ?? 0}
        dataPgto={baixaLinha?.data ?? new Date().toISOString().slice(0, 10)}
        pagador={baixaLinha?.pagador ?? { documento: null, nome: null }}
        historico={baixaLinha?.historico}
        titulosIniciais={baixaTitulos}
        usuario={usuario}
        filial={filial}
        codConta={codConta}
        cofIdInicial={cofId}
        onClose={() => setBaixaLinha(null)}
        onSuccess={() => {
          const id = baixaLinha?.lin_id;
          setLinhas((prev) => prev.map((x) => (x.lin_id === id ? { ...x, status: 'conciliado' } : x)));
          setBaixaLinha(null);
        }}
      />
    </Modal>
  );
}
