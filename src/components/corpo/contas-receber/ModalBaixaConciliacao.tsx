'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Loader2, Search, Trash2, Plus, RefreshCw } from 'lucide-react';

export interface TituloBaixa {
  cod_receb: string;
  codcli: string;
  nome_cliente?: string | null;
  nro_doc?: string | null;
  dt_venc?: string | null;
  saldoCentavos: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  linId: number | null;
  /** Valor que caiu no extrato (o Pix/TED). Fixo — o operador só escolhe QUAIS títulos ele paga. */
  valorCentavos: number;
  dataPgto: string; // 'YYYY-MM-DD' do lançamento
  pagador: { documento: string | null; nome: string | null };
  historico?: string;
  /** Títulos da sugestão (pré-selecionados). */
  titulosIniciais: TituloBaixa[];
  usuario: string;
  filial?: string;
  codConta: string; // conta do operador (login)
  cofIdInicial?: string | null;
}

// Conta financeira do PRINCIPAL na conciliação (receita operacional). Editável.
const COF_PRINCIPAL_PADRAO = '242';
// Juros e tarifa são fixos no motor (COF_JUROS=160 / COF_TARIFA=161) — exibidos, não editáveis.
const COF_JUROS = '160';
const COF_TARIFA = '161';

const brl = (cent: number) => (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtVenc = (v?: string | null) => (v ? new Date(String(v).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '-');
// Exibe centavos como reais em pt-BR (vírgula). Ex.: 4570 → "45,70".
const fmtCent = (c: number) => (c / 100).toFixed(2).replace('.', ',');
// Máscara de moeda "da direita p/ esquerda": os dígitos digitados são os centavos.
// Ex.: "4500" → 4500 centavos (R$ 45,00); "4" → 4 centavos (R$ 0,04).
const digitosParaCent = (texto: string): number => {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : 0;
};

export default function ModalBaixaConciliacao({
  isOpen, onClose, onSuccess, linId, valorCentavos, dataPgto, pagador, historico,
  titulosIniciais, usuario, filial, codConta, cofIdInicial,
}: Props) {
  const [selecionados, setSelecionados] = useState<TituloBaixa[]>([]);
  const [cofPrincipal, setCofPrincipal] = useState<string | null>(cofIdInicial != null ? String(cofIdInicial) : COF_PRINCIPAL_PADRAO);
  const [busca, setBusca] = useState('');
  const [buscaResultados, setBuscaResultados] = useState<TituloBaixa[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Juros: só leitura (vem calculado do atraso). Tarifa: editável (máscara de moeda em centavos).
  const [jurosCent, setJurosCent] = useState(0);
  const [tarifaCent, setTarifaCent] = useState(0);
  // Juros calculado por título (de /api/caixa/dados-recebimento, na data do extrato), em centavos.
  const [jurosCalcMap, setJurosCalcMap] = useState<Map<string, number>>(new Map());
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelecionados(titulosIniciais || []);
      setCofPrincipal(cofIdInicial != null ? String(cofIdInicial) : COF_PRINCIPAL_PADRAO);
      setBusca('');
      setBuscaResultados([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const codcliSel = selecionados[0]?.codcli || null;
  const somaCent = useMemo(() => selecionados.reduce((s, t) => s + Number(t.saldoCentavos || 0), 0), [selecionados]);
  const selKey = useMemo(() => selecionados.map((t) => t.cod_receb).sort().join(','), [selecionados]);
  const sumJurosCalc = useMemo(
    () => selecionados.reduce((s, t) => s + (jurosCalcMap.get(t.cod_receb) || 0), 0),
    [selecionados, jurosCalcMap],
  );

  // Principal = o que sobra do Pix depois do juros e da tarifa (baixa os títulos em cascata).
  const principalCent = valorCentavos - jurosCent - tarifaCent;
  const totalDevido = somaCent + sumJurosCalc; // quanto os títulos custam hoje (principal + juros)
  const principalFaltando = Math.max(0, somaCent - principalCent); // principal do(s) título(s) que fica em aberto
  const excedePrincipal = principalCent > somaCent + 1; // não pode pagar mais principal do que o saldo

  /**
   * Cascata da conciliação (fiel ao Delphi): o valor recebido paga PRIMEIRO o juros do atraso,
   * e o que sobra amortiza o principal do título; se ainda sobrar depois de cobrir principal+juros
   * de todos, a sobra vira tarifa. Distribui título a título, na ordem selecionada.
   */
  const cascata = (jcalc: Map<string, number>) => {
    let rem = valorCentavos;
    let jurosTot = 0;
    for (const t of selecionados) {
      if (rem <= 0) break;
      const jc = jcalc.get(t.cod_receb) || 0;
      const saldo = Number(t.saldoCentavos || 0);
      const take = Math.min(rem, jc + saldo); // o que esse título consome (juros + principal)
      jurosTot += Math.min(take, jc); // juros primeiro
      rem -= take;
    }
    return { jurosTot, tarifaTot: Math.max(0, rem) };
  };

  /**
   * Ao mudar o CONJUNTO de títulos, recalcula o juros (motor dados-recebimento) e monta a cascata
   * automática. Edições manuais persistem até a seleção mudar de novo.
   */
  useEffect(() => {
    if (!isOpen) return;
    if (selecionados.length === 0) {
      setJurosCalcMap(new Map());
      setJurosCent(0);
      setTarifaCent(0);
      return;
    }
    let cancel = false;
    (async () => {
      setCalculando(true);
      try {
        const r = await fetch('/api/caixa/dados-recebimento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cod_receb: selecionados.map((t) => t.cod_receb), dataPgto }),
        });
        const d = await r.json();
        if (cancel) return;
        const m = new Map<string, number>();
        for (const t of d.titulos || []) m.set(String(t.cod_receb), Math.round(Number(t.juros || 0) * 100));
        setJurosCalcMap(m);
        const { jurosTot, tarifaTot } = cascata(m); // usa o mapa recém-buscado (state ainda não atualizou)
        setJurosCent(jurosTot);
        setTarifaCent(tarifaTot);
      } catch {
        if (!cancel) {
          setJurosCalcMap(new Map());
          setJurosCent(0);
          setTarifaCent(0);
        }
      } finally {
        if (!cancel) setCalculando(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, isOpen, dataPgto, valorCentavos]);

  const recalcularAuto = () => {
    const { jurosTot, tarifaTot } = cascata(jurosCalcMap);
    setJurosCent(jurosTot);
    setTarifaCent(tarifaTot);
  };

  const buscar = async (termo: string) => {
    setBusca(termo);
    if (termo.trim().length < 2) { setBuscaResultados([]); return; }
    setBuscando(true);
    try {
      const r = await fetch(`/api/conciliacao/buscar-titulos?termo=${encodeURIComponent(termo)}&valor_cent=${valorCentavos}`);
      const d = await r.json();
      setBuscaResultados(Array.isArray(d.titulos) ? d.titulos : []);
    } catch {
      setBuscaResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const adicionar = (t: TituloBaixa) => {
    if (selecionados.some((x) => x.cod_receb === t.cod_receb)) return;
    if (codcliSel && String(t.codcli) !== String(codcliSel)) {
      toast.error('Todos os títulos devem ser do MESMO cliente (regra do recebimento).');
      return;
    }
    setSelecionados((prev) => [...prev, t]);
  };
  const remover = (cod: string) => setSelecionados((prev) => prev.filter((x) => x.cod_receb !== cod));

  /** Quais títulos recebem principal (cascata por saldo, na ordem) — p/ não perder juros/tarifa no motor. */
  const principalPorTitulo = (): number[] => {
    let rem = principalCent;
    return selecionados.map((t) => {
      const take = Math.max(0, Math.min(rem, Number(t.saldoCentavos || 0)));
      rem -= take;
      return take;
    });
  };

  /** Distribui o juros total entre os títulos que recebem principal, proporcional ao juros calculado. */
  const distribuirJuros = (recebePrincipal: boolean[]): Map<string, number> => {
    const m = new Map<string, number>();
    selecionados.forEach((t) => m.set(t.cod_receb, 0));
    if (jurosCent <= 0) return m;
    const elig = selecionados.map((t, i) => (recebePrincipal[i] ? jurosCalcMap.get(t.cod_receb) || 0 : 0));
    const sumElig = elig.reduce((s, v) => s + v, 0);
    let acc = 0;
    if (sumElig > 0) {
      selecionados.forEach((t, i) => {
        const v = Math.round((jurosCent * elig[i]) / sumElig);
        m.set(t.cod_receb, v);
        acc += v;
      });
    } else {
      const idx = recebePrincipal.findIndex(Boolean);
      if (idx >= 0) {
        m.set(selecionados[idx].cod_receb, jurosCent);
        acc = jurosCent;
      }
    }
    const diff = jurosCent - acc; // ajuste de arredondamento
    if (diff !== 0) {
      const alvo = selecionados.find((t) => (m.get(t.cod_receb) || 0) > 0) || selecionados[recebePrincipal.findIndex(Boolean)] || selecionados[0];
      if (alvo) m.set(alvo.cod_receb, (m.get(alvo.cod_receb) || 0) + diff);
    }
    return m;
  };

  const confirmar = async () => {
    if (!linId) return;
    if (selecionados.length === 0) return toast.error('Selecione ao menos um título.');
    if (!codConta.trim()) return toast.error('Seu login não tem conta de recebimento — peça o cadastro.');
    if (!cofPrincipal) return toast.error('Selecione a conta financeira do principal (classificação).');
    if (principalCent < 1) return toast.error('O principal ficou zero/negativo — reduza o juros/tarifa.');
    if (excedePrincipal) {
      return toast.error(`O principal (${brl(principalCent)}) passa do saldo dos títulos (${brl(somaCent)}). Adicione títulos ou aumente juros/tarifa.`);
    }

    const shares = principalPorTitulo();
    const recebePrincipal = shares.map((v) => v > 0);
    if (!recebePrincipal.some(Boolean)) return toast.error('Nenhum título recebe principal — revise os valores.');
    const jm = distribuirJuros(recebePrincipal);
    const idxTarifa = recebePrincipal.findIndex(Boolean); // título que carrega a tarifa (1º com principal)

    setSalvando(true);
    try {
      const titulos = selecionados.map((t, i) => ({
        cod_receb: t.cod_receb,
        principalPendente: Number(t.saldoCentavos || 0) / 100,
        juros: (jm.get(t.cod_receb) || 0) / 100,
        tarifa: i === idxTarifa ? tarifaCent / 100 : 0, // a sobra (tarifa) inteira no 1º título com principal
      }));
      const r = await fetch('/api/caixa/receber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulos,
          dataPgto,
          cod_conta: codConta.trim(),
          username: usuario,
          conc_lin_id: linId,
          pagamentos: [{ forma: 'pix', codfpgt: '42', tipo: '42', valor: principalCent / 100, cof_id: cofPrincipal }],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detalhes || d.erro || 'Erro ao dar baixa');
      toast.success(`Baixa conciliada (comprovante ${d.aut_id ?? '-'}).`);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Baixa da Conciliação" width="w-[97%] max-w-4xl">
      <div className="space-y-3">
        {/* Valor fixo do extrato */}
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            Recebido no extrato: <b className="text-blue-700 dark:text-blue-300">{brl(valorCentavos)}</b>
            <span className="text-[11px] text-gray-500 ml-2">
              {historico || '—'} · {pagador.documento ? `${pagador.documento}` : 'sem doc'}{pagador.nome ? ` · ${pagador.nome}` : ''}
            </span>
          </div>
          <div className="text-[11px]">
            {somaCent === 0 ? (
              <span className="text-amber-600">Selecione os títulos que esse valor paga.</span>
            ) : valorCentavos < totalDevido - 1 ? (
              <span className="text-amber-600">Pix não cobre principal+juros (<b>{brl(totalDevido)}</b>) — o último título fica <b>parcial</b>.</span>
            ) : valorCentavos > totalDevido + 1 ? (
              <span className="text-sky-600">Pix maior que principal+juros — a sobra vira <b>tarifa</b>.</span>
            ) : (
              <span className="text-emerald-600">Pix cobre principal + juros ✓</span>
            )}
          </div>
        </div>

        {/* Títulos selecionados */}
        <div>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Títulos selecionados {codcliSel ? `· cliente ${codcliSel} - ${selecionados[0]?.nome_cliente || ''}` : ''}
          </div>
          <div className="rounded border border-gray-200 dark:border-slate-700 overflow-auto max-h-[26vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                <tr>
                  <th className="px-2 py-1 text-left">Documento</th>
                  <th className="px-2 py-1 text-left">Venc.</th>
                  <th className="px-2 py-1 text-right">Saldo (principal)</th>
                  <th className="px-2 py-1 text-right">Juros calc.</th>
                  <th className="px-2 py-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {selecionados.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400 text-[11px]">Nenhum título — use a busca abaixo.</td></tr>
                )}
                {selecionados.map((t) => (
                  <tr key={t.cod_receb} className="border-t border-gray-100 dark:border-slate-800">
                    <td className="px-2 py-1 font-mono">{t.nro_doc || t.cod_receb}</td>
                    <td className="px-2 py-1">{fmtVenc(t.dt_venc)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{brl(t.saldoCentavos)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-amber-600">
                      {calculando ? '…' : (jurosCalcMap.get(t.cod_receb) || 0) > 0 ? brl(jurosCalcMap.get(t.cod_receb) || 0) : '—'}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button type="button" onClick={() => remover(t.cod_receb)} className="text-red-500 hover:text-red-700" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {selecionados.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <td colSpan={2} className="px-2 py-1 text-right font-semibold">Soma</td>
                    <td className="px-2 py-1 text-right font-mono font-semibold">{brl(somaCent)}</td>
                    <td className="px-2 py-1 text-right font-mono font-semibold text-amber-600">{brl(sumJurosCalc)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Buscar/adicionar título */}
        <div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={busca}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Buscar título por cliente, código ou nota para adicionar…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          {busca.trim().length >= 2 && (
            <div className="mt-1 max-h-36 overflow-auto space-y-1">
              {buscando && <div className="text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin inline" /> buscando…</div>}
              {buscaResultados.map((t: any) => (
                <div key={t.cod_receb} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-[11px]">
                  <span>
                    <span className="font-mono">{t.cod_receb}</span> · {t.codcli} - {t.nome_cliente} · {t.nro_doc || '-'} · venc {fmtVenc(t.dt_venc)} · <b>{brl(t.saldoCentavos)}</b>
                  </span>
                  <Button size="sm" className="h-6 text-[10px]" onClick={() => adicionar(t)} disabled={selecionados.some((x) => x.cod_receb === t.cod_receb)}>
                    <Plus size={12} className="mr-0.5" /> Adicionar
                  </Button>
                </div>
              ))}
              {!buscando && buscaResultados.length === 0 && <div className="text-[11px] text-gray-400">Nenhum título em aberto encontrado.</div>}
            </div>
          )}
        </div>

        {/* Formas de pagamento (cascata do Pix fixo: juros → principal → sobra) */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Formas de pagamento {calculando && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
            </span>
            <button type="button" onClick={recalcularAuto} className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1" title="Refazer a divisão automática">
              <RefreshCw size={11} /> recalcular automático
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
            {/* JUROS — pix 43 / conta 160 (abatido PRIMEIRO; calculado do atraso, só leitura) */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="inline-flex items-center rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 font-semibold">JUROS PIX (43)</span>
              <span className="text-[11px] text-gray-500">conta {COF_JUROS} · Juros ativos · abatido primeiro (calculado)</span>
              <span className="ml-auto font-mono font-semibold tabular-nums text-sm text-amber-600">{calculando ? '…' : brl(jurosCent)}</span>
            </div>

            {/* PRINCIPAL — pix 42 / receita operacional (o que sobra depois do juros; conta editável) */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-semibold">PIX · principal (42)</span>
              <div className="w-56">
                <Autocomplete
                  placeholder="Conta financeira do principal…"
                  apiUrl="/api/contas-receber/contas"
                  value={cofPrincipal}
                  onChange={(v) => setCofPrincipal(v || null)}
                  mapResponse={(data) => (data.contas || []).map((c: any) => ({ value: String(c.id), label: c.label }))}
                />
              </div>
              <span className={`ml-auto font-mono font-semibold tabular-nums text-sm ${principalCent < 1 || excedePrincipal ? 'text-red-600' : ''}`}>{brl(principalCent)}</span>
            </div>

            {/* TARIFA — pix 44 / conta 161 (sobra depois de principal+juros; valor editável) */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="inline-flex items-center rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 font-semibold">TARIFA PIX (44)</span>
              <span className="text-[11px] text-gray-500">conta {COF_TARIFA} · Tarifa (sobra)</span>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[11px] text-gray-400">R$</span>
                <Input
                  type="text" inputMode="numeric"
                  value={fmtCent(tarifaCent)}
                  onChange={(e) => setTarifaCent(digitosParaCent(e.target.value))}
                  className="h-7 w-24 text-right text-xs tabular-nums"
                />
                {tarifaCent > 0 && (
                  <button type="button" onClick={() => setTarifaCent(0)} className="text-red-500 hover:text-red-700" title="Zerar tarifa"><Trash2 size={13} /></button>
                )}
              </div>
            </div>

            {/* Total das formas × Pix */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-gray-500">
                {excedePrincipal ? (
                  <span className="text-red-600">Principal passa do saldo dos títulos — aumente juros/tarifa ou adicione títulos.</span>
                ) : principalFaltando > 0 ? (
                  <span className="text-amber-600">Juros abatido primeiro — fica <b>{brl(principalFaltando)}</b> de principal em aberto (título parcial).</span>
                ) : (
                  <>Juros {brl(jurosCent)} + Principal {brl(principalCent)} + Tarifa {brl(tarifaCent)}</>
                )}
              </span>
              <span className={`font-mono font-semibold tabular-nums text-sm ${Math.abs(jurosCent + principalCent + tarifaCent - valorCentavos) <= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                {brl(jurosCent + principalCent + tarifaCent)}
              </span>
            </div>
          </div>
        </div>

        {/* Conta operador + confirmar */}
        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="self-center">
            <Label className="text-[11px]">Conta operador (do login)</Label>
            {codConta ? (
              <div className="font-mono text-sm text-blue-900 dark:text-blue-100 h-9 flex items-center">{codConta}</div>
            ) : (
              <div className="text-[11px] text-red-600 h-9 flex items-center max-w-[200px] leading-tight">Login sem conta de recebimento — peça o cadastro.</div>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={confirmar} disabled={salvando || selecionados.length === 0 || calculando}>
              {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Dar Baixa ({brl(valorCentavos)})
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          O valor do extrato é fixo. O sistema divide automático: abate <b>primeiro o juros</b> do atraso (pix 43 ·
          conta 160), o que sobra vira <b>principal</b> (pix 42 · receita operacional) e baixa os títulos em cascata;
          se ainda sobrar, vira <b>tarifa</b> (pix 44 · conta 161). Ajuste ou zere juros/tarifa se precisar.
        </p>
      </div>
    </Modal>
  );
}
