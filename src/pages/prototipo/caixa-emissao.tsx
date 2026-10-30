// PROTÓTIPO (só tela, dados simulados — NÃO chama API nem grava no banco).
// Mesmo layout do Caixa atual (src/components/corpo/caixa/Caixa.tsx). Única mudança de fluxo:
//   • Ao selecionar pré-pedido(s) aparece o botão "Faturar e emitir nota" (padrão Delphi):
//     fatura + emite a nota com tPag 99 "Recibo" — sem pedir a forma de pagamento.
//   • Nota com erro → a fatura NÃO é desfeita; reenvia a nota da mesma fatura.
//   • O painel Recebimento só é liberado com a nota AUTORIZADA.
// Acesso: /prototipo/caixa-emissao

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Lock,
  Printer,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectPadrao from '@/components/common/SelectPadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { formatarBRL } from '@/utils/monetario';

type ResultadoNota = 'autorizada' | 'rejeitada' | 'timeout';

interface PreVenda {
  codvenda: string;
  nrovenda: string;
  data: string;
  codcli: string;
  nome_cliente: string;
  modelo: 'NF-e' | 'NFC-e';
  total: number;
}

interface Passada {
  id: number;
  codfpgt: string;
  descricao: string;
  valor: number;
}

const PREVENDAS: PreVenda[] = [
  { codvenda: '002439995', nrovenda: '002439995', data: '19/10/2026', codcli: '37989', nome_cliente: 'REGINALDO MONTEIRO DA SILVA', modelo: 'NFC-e', total: 198.23 },
  { codvenda: '002439996', nrovenda: '002439996', data: '19/10/2026', codcli: '37989', nome_cliente: 'REGINALDO MONTEIRO DA SILVA', modelo: 'NFC-e', total: 203.58 },
  { codvenda: '002440010', nrovenda: '002440010', data: '20/10/2026', codcli: '05956', nome_cliente: 'PENDENCIA - MELO DIST.DE PECAS LTDA', modelo: 'NF-e', total: 906.87 },
];

const FORMAS = [
  { codfpgt: '01', descricao: 'DINHEIRO' },
  { codfpgt: '04', descricao: 'CARTAO' },
  { codfpgt: '09', descricao: 'DEPOSITO' },
  { codfpgt: '42', descricao: 'PIX' },
];
const CONTAS_FIN = [{ cof_id: '1', cof_descricao: 'RECEITA DE VENDAS' }];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const brToNum = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;
const numToBr = (n: number) => n.toFixed(2).replace('.', ',');

export default function PrototipoCaixaEmissao() {
  // Painel de simulação (fora do layout do caixa)
  const [simNota, setSimNota] = useState<ResultadoNota>('autorizada');

  const [busca, setBusca] = useState('002439995');
  const [preVendasSel, setPreVendasSel] = useState<PreVenda[]>([]);

  // Faturar e emitir nota
  const [emitindo, setEmitindo] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [codfat, setCodfat] = useState<string | null>(null);
  const [nota, setNota] = useState<{ numero: string; modelo: string } | null>(null);
  const [erroNota, setErroNota] = useState<string | null>(null);

  // Recebimento (igual ao atual)
  const [codFpgt, setCodFpgt] = useState('01');
  const [cofId, setCofId] = useState('');
  const [valorPassada, setValorPassada] = useState('');
  const [passadas, setPassadas] = useState<Passada[]>([]);
  const [deposito, setDeposito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const totalSel = useMemo(() => preVendasSel.reduce((s, p) => s + p.total, 0), [preVendasSel]);
  const recebido = passadas.reduce((s, p) => s + p.valor, 0);
  const notaOk = !!nota;
  const totalReceber = notaOk ? totalSel : 0;
  const falta = Math.max(0, +(totalReceber - recebido).toFixed(2));
  const quitado = notaOk && falta <= 0.005;
  const travadoSelecao = !!codfat; // depois de faturar, a seleção não muda

  const selecionarPreVenda = (pv: PreVenda) => {
    if (travadoSelecao) return;
    setPreVendasSel((prev) =>
      prev.some((x) => x.codvenda === pv.codvenda) ? prev.filter((x) => x.codvenda !== pv.codvenda) : [...prev, pv],
    );
  };

  const emitirNota = async () => {
    setProgresso('Reservando número da nota…');
    await esperar(500);
    setProgresso(`Emitindo ${preVendasSel[0].modelo} (pagamento na nota: 99 — Outros / Recibo)…`);
    await esperar(1200);
    if (simNota === 'autorizada') {
      setNota({ numero: String(Math.floor(100000 + Math.random() * 899999)).padStart(9, '0'), modelo: preVendasSel[0].modelo });
      setErroNota(null);
      setValorPassada(numToBr(totalSel));
    } else {
      setErroNota(
        simNota === 'rejeitada'
          ? 'Rejeição 778: Informado NCM inexistente [nItem: 2]'
          : 'SEFAZ não respondeu (timeout). Consultar a situação da nota antes de reenviar.',
      );
    }
  };

  const faturarEEmitir = async () => {
    setEmitindo(true);
    setErroNota(null);
    try {
      setProgresso('Faturando (fatura, itens e estoque)…');
      await esperar(900);
      setCodfat(String(Math.floor(100000000 + Math.random() * 899999999)));
      await emitirNota();
    } finally {
      setEmitindo(false);
      setProgresso(null);
    }
  };

  const reenviarNota = async () => {
    setEmitindo(true);
    try {
      await emitirNota();
    } finally {
      setEmitindo(false);
      setProgresso(null);
    }
  };

  const adicionarPassada = () => {
    const v = brToNum(valorPassada);
    if (!notaOk || v <= 0) return;
    const f = FORMAS.find((x) => x.codfpgt === codFpgt)!;
    setPassadas((p) => [...p, { id: Date.now(), codfpgt: f.codfpgt, descricao: f.descricao, valor: Math.min(v, falta) }]);
    setValorPassada('');
  };

  const receberEDarBaixa = async () => {
    setSalvando(true);
    await esperar(1000);
    setSalvando(false);
    setConcluido(true);
  };

  const limpar = () => {
    setPreVendasSel([]);
    setCodfat(null);
    setNota(null);
    setErroNota(null);
    setPassadas([]);
    setValorPassada('');
    setConcluido(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-3 space-y-3">
      {/* Painel de simulação — NÃO faz parte do caixa */}
      <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 text-amber-900 px-4 py-2 text-sm flex flex-wrap items-center gap-4">
        <b>PROTÓTIPO</b> dados simulados — nada é gravado nem enviado à SEFAZ.
        <label className="flex items-center gap-2">
          Simular nota:
          <select className="border rounded px-2 py-1 bg-white" value={simNota} onChange={(e) => setSimNota(e.target.value as ResultadoNota)}>
            <option value="autorizada">Autorizada</option>
            <option value="rejeitada">Rejeitada pela SEFAZ</option>
            <option value="timeout">SEFAZ sem resposta</option>
          </select>
        </label>
        <button onClick={limpar} className="ml-auto underline">Recomeçar</button>
      </div>

      {/* ====== A PARTIR DAQUI: MESMO LAYOUT DO CAIXA ATUAL ====== */}
      <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white">
        {/* Barra superior */}
        <div className="flex items-center gap-4 flex-wrap px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-md bg-blue-600 text-white grid place-items-center font-black">M</span>
            <div className="leading-tight">
              <div>CAIXA</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold -mt-0.5">Melo · Distribuidora de Peças</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-6 flex-wrap text-sm">
            {[
              { i: <User size={15} />, t: 'Cliente' },
              { i: <ShoppingCart size={15} />, t: 'Pré-Pedidos' },
              { i: <FileText size={15} />, t: 'Diário à Vista' },
            ].map((b) => (
              <button key={b.t} type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:text-blue-600 transition">
                {b.i} {b.t}
              </button>
            ))}
            <div><div className="text-[10px] uppercase tracking-wide text-gray-400">Operador</div><div className="font-semibold">REGINALDO</div></div>
            <div><div className="text-[10px] uppercase tracking-wide text-gray-400">Filial</div><div className="font-semibold">MANAUS</div></div>
            <div><div className="text-[10px] uppercase tracking-wide text-gray-400">Data</div><div className="font-semibold tabular-nums">{new Date().toLocaleDateString('pt-BR')}</div></div>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4">
          <div className="w-full max-w-[1700px] mx-auto">
            {/* Barra da sessão do caixa (igual CaixaSessaoBar) */}
            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 mb-4 flex items-center gap-6 flex-wrap">
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: '#10b981' }} />
              <Bloco label="Caixa"><span className="font-mono tabular-nums">0217</span></Bloco>
              <Bloco label="Operador">REGINALDO</Bloco>
              <Bloco label="Situação">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> ABERTO
                </span>
              </Bloco>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Dinheiro na gaveta</div>
                <div className="text-2xl font-semibold font-mono tabular-nums">{formatarBRL(149.45)}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn><Printer size={15} /> Movimento</Btn>
                <Btn><ArrowDown size={15} /> Suprimento</Btn>
                <Btn><ArrowUp size={15} /> Sangria</Btn>
                <Btn danger><Lock size={15} /> Fechar caixa</Btn>
              </div>
            </div>

            {/* Erro persistente (mesmo banner do caixa atual) — agora SEM rollback da fatura */}
            {erroNota && (
              <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-red-700">Nota não autorizada — fatura {codfat} mantida</div>
                  <div className="text-sm text-red-700 break-words whitespace-pre-wrap mt-0.5">{erroNota}</div>
                  <div className="text-xs text-red-700 mt-1">
                    A fatura <b>não foi desfeita</b>. Corrija e reenvie a nota desta mesma fatura. O recebimento continua bloqueado.
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={reenviarNota}
                      disabled={emitindo}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <Loader2 size={14} className={emitindo ? 'animate-spin' : 'hidden'} /> Reenviar nota
                    </button>
                    <button type="button" className="text-xs font-semibold rounded-lg px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-100">
                      Copiar
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setErroNota(null)} title="Fechar" className="text-red-400 hover:text-red-600 shrink-0">
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 items-start">
              {/* ---- COLUNA ESQUERDA: Documento ---- */}
              <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <FileText size={14} /> Documento
                  </h2>
                  <div className="p-4">
                    <div className="flex gap-2">
                      <Input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Nº do documento, nota, nome ou código do cliente"
                        className="h-11 font-mono tracking-wide"
                      />
                      <DefaultButton text="Buscar" icon={<Search size={16} />} onClick={() => {}} variant="primary" />
                    </div>

                    <div className="mt-3 inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                      {[`Tudo (${PREVENDAS.length})`, 'Títulos (0)', `Pré-Pedidos (${PREVENDAS.length})`].map((l, i) => (
                        <button key={l} type="button" className={`px-3 py-1.5 ${i === 0 ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                          {l}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        {PREVENDAS.length} pré-venda(s) a faturar — selecione um ou mais (mesmo cliente)
                      </div>
                      {PREVENDAS.map((pv) => {
                        const sel = preVendasSel.some((x) => x.codvenda === pv.codvenda);
                        const outroCliente = preVendasSel.length > 0 && preVendasSel[0].codcli !== pv.codcli;
                        return (
                          <button
                            key={pv.codvenda}
                            onClick={() => selecionarPreVenda(pv)}
                            disabled={outroCliente || (travadoSelecao && !sel)}
                            className={`w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              sel
                                ? 'border-emerald-500 bg-emerald-50'
                                : outroCliente || travadoSelecao
                                ? 'border-gray-200 opacity-40 cursor-not-allowed'
                                : 'border-emerald-200 hover:border-emerald-400'
                            }`}
                          >
                            <input type="checkbox" readOnly checked={sel} className="pointer-events-none accent-emerald-600" />
                            <span className="flex flex-col leading-tight min-w-[120px]">
                              <span className="font-mono">{pv.nrovenda}</span>
                              <span className="text-[11px] text-gray-400">{pv.data} · {pv.modelo}</span>
                            </span>
                            <span className="truncate flex-1 text-gray-600">
                              {pv.nome_cliente}
                              <span className="text-gray-400"> - {pv.codcli}</span>
                            </span>
                            <span className="font-mono tabular-nums font-semibold">{formatarBRL(pv.total)}</span>
                          </button>
                        );
                      })}

                      {/* ===== NOVO: Faturar e emitir nota (aparece com pré-pedido selecionado) ===== */}
                      {preVendasSel.length > 0 && (
                        <div className="pt-2 space-y-2">
                          {!codfat && (
                            <p className="text-[11px] text-emerald-700">
                              Faturando <b>{preVendasSel.length}</b> pré-pedido(s) de <b>{preVendasSel[0].nome_cliente}</b> — total{' '}
                              <b>{formatarBRL(totalSel)}</b> numa única nota. Clique em <b>Faturar e emitir nota</b>; o recebimento
                              é liberado após a nota autorizada.
                            </p>
                          )}

                          {codfat && (
                            <div
                              className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-3 ${
                                notaOk ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
                              }`}
                            >
                              {notaOk ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-amber-600" />}
                              <div className="flex-1">
                                <div className="font-semibold">
                                  Fatura <span className="font-mono">{codfat}</span>
                                  {notaOk ? (
                                    <> · {nota!.modelo} <span className="font-mono">{nota!.numero}</span> autorizada</>
                                  ) : (
                                    <> · aguardando nota</>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500">Pagamento na nota: 99 — Outros (Recibo)</div>
                              </div>
                              {notaOk && (
                                <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                                  <Printer size={14} /> DANFE
                                </button>
                              )}
                            </div>
                          )}

                          {!codfat && (
                            <DefaultButton
                              text={emitindo ? progresso || 'Processando...' : 'Faturar e emitir nota'}
                              icon={emitindo ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                              onClick={faturarEEmitir}
                              variant="primary"
                              disabled={emitindo}
                              className="w-full h-11"
                            />
                          )}
                          {codfat && emitindo && (
                            <div className="text-xs text-blue-700 flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin" /> {progresso}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* ---- COLUNA DIREITA: Recebimento (igual ao atual; liberado só com a nota autorizada) ---- */}
              <div className="relative">
                {!notaOk && preVendasSel.length > 0 && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1.5px]">
                    <div className="bg-white border border-gray-200 shadow-lg rounded-2xl px-7 py-6 text-center max-w-sm">
                      <div className="text-3xl">🔒</div>
                      <div className="font-bold mt-1.5">Aguardando a nota fiscal</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Fature e emita a nota. O recebimento é liberado quando a nota for autorizada.
                      </div>
                    </div>
                  </div>
                )}

                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    <Landmark size={14} /> Recebimento
                  </h2>
                  <div className="p-4">
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <SelectPadrao
                        searchable
                        value={codFpgt}
                        onValueChange={setCodFpgt}
                        placeholder="Selecione a forma..."
                        options={FORMAS.map((f) => ({ value: f.codfpgt, label: `${f.codfpgt} — ${f.descricao}` }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="col-span-2">
                        <Label>Conta Financeira</Label>
                        <SelectPadrao
                          searchable
                          value={cofId}
                          onValueChange={setCofId}
                          placeholder="SELECIONE A CONTA..."
                          options={CONTAS_FIN.map((c) => ({ value: c.cof_id, label: `${c.cof_id} — ${c.cof_descricao}` }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Valor principal (R$)</Label>
                        <Input
                          value={valorPassada}
                          onChange={(e) => setValorPassada(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && adicionarPassada()}
                          placeholder="0,00"
                          className="text-right font-mono tabular-nums"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={adicionarPassada}
                          className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm font-semibold text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          ＋ Adicionar pagamento
                        </button>
                      </div>
                    </div>

                    {passadas.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {passadas.map((p) => (
                          <div key={p.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <span className="px-2 py-1 rounded text-white text-[9px] font-black uppercase bg-blue-700">{p.descricao}</span>
                            <span className="text-sm">{p.codfpgt} — {p.descricao}</span>
                            <span className="font-mono tabular-nums font-semibold">{formatarBRL(p.valor)}</span>
                            {!concluido && (
                              <button type="button" onClick={() => setPassadas((l) => l.filter((x) => x.id !== p.id))} className="text-gray-400 hover:text-red-600">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 border border-dashed border-gray-300 rounded-lg py-4 text-center text-sm text-gray-400">
                        Nenhum pagamento adicionado ainda.
                      </div>
                    )}

                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { l: 'Títulos', v: recebido },
                          { l: 'Tarifa', v: 0 },
                          { l: 'Juros', v: 0 },
                        ].map((x) => (
                          <div key={x.l} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400">Recebido {x.l}</div>
                            <div className="font-mono tabular-nums font-semibold text-sm">{formatarBRL(x.v)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-baseline mt-3">
                        <span className="uppercase tracking-wide text-xs font-bold">Falta (a receber)</span>
                        <span className={`font-mono tabular-nums text-2xl font-bold ${quitado ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {formatarBRL(falta)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 items-end">
                      <div>
                        <Label>Conta (operador)</Label>
                        <Input value="0217" readOnly className="font-mono bg-gray-50" />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 h-6 cursor-pointer select-none mb-1">
                          <input type="checkbox" checked={deposito} onChange={(e) => setDeposito(e.target.checked)} />
                          <span className="text-sm font-medium">Depósito</span>
                        </label>
                        <Input type="date" disabled={!deposito} defaultValue={new Date().toISOString().slice(0, 10)} className="font-mono disabled:opacity-50" />
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                      💳 No cartão, gera as <b>parcelas a receber da operadora</b> (venc. pelo prazo da operadora, valor líquido) e dá{' '}
                      <b>baixa</b> no título.
                    </div>

                    {concluido ? (
                      <div className="w-full mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={18} /> Recebido! Fatura {codfat} · {nota?.modelo} {nota?.numero} · {formatarBRL(recebido)}
                        <button onClick={limpar} className="ml-auto underline">Próximo</button>
                      </div>
                    ) : (
                      <DefaultButton
                        text={salvando ? 'Processando...' : 'Receber e dar baixa'}
                        icon={salvando ? <Loader2 className="animate-spin" size={16} /> : undefined}
                        onClick={receberEDarBaixa}
                        variant="confirm"
                        disabled={salvando || !notaOk || passadas.length === 0 || falta > 0.005}
                        className="w-full mt-3 h-12"
                      />
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Bloco({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

function Btn({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  const base = 'inline-flex items-center gap-1.5 font-semibold text-sm rounded-lg px-3.5 py-2 border transition';
  const cls = danger
    ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600';
  return <button className={`${base} ${cls}`}>{children}</button>;
}
