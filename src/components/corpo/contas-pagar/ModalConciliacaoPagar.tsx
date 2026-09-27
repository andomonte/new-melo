'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle2, FileText, Landmark } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuario?: string;
  onBaixaConcluida?: () => void; // recarrega a lista de contas a pagar
}

interface ContaMatch {
  cod_pgto: string;
  tipo: string;
  credor: string;
  nro_dup: string;
  nro_nf: string;
  dt_venc: string | null;
  dt_emissao: string | null;
  valor_pgto: number;
  valor_pago: number;
  saldo: number;
  conta_financeira: string;
}
interface Pagamento {
  idx: number;
  data: string;
  historico: string;
  documento: string;
  valorCentavos: number;
  tipo: string;
  motivo: string;
  contas: ContaMatch[];
}
interface Resultado {
  banco: string;
  agencia: string | null;
  conta: string | null;
  totalLinhas: number;
  totalPagamentos: number;
  comMatch: number;
  semMatch: number;
  pagamentos: Pagamento[];
}

const brl = (cent: number) => (cent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlNum = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
};

export default function ModalConciliacaoPagar({ isOpen, onClose, usuario, onBaixaConcluida }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [selecionado, setSelecionado] = useState<Record<number, string>>({}); // idx → cod_pgto
  const [baixando, setBaixando] = useState<number | null>(null);
  const [baixados, setBaixados] = useState<Record<number, string>>({}); // idx → cod_pgto baixado
  const [contas, setContas] = useState<{ value: string; label: string }[]>([]);
  const [contaSel, setContaSel] = useState(''); // conta bancária do extrato (grava no dbpgto)
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega as contas bancárias (dbconta) — a baixa registra em qual conta o pagamento saiu,
  // igual ao Pagamento em Lote (que exige a Conta).
  useEffect(() => {
    if (!isOpen || contas.length > 0) return;
    fetch('/api/contas-pagar/contas-dbconta')
      .then((r) => r.json())
      .then((data) => {
        const lista = (data.contas || data || []).map((c: any) => ({
          value: String(c.value ?? c.cod_conta ?? ''),
          label: c.label || `${c.cod_conta} - ${c.descricao || c.nome || ''}`,
        }));
        setContas(lista);
      })
      .catch(() => {});
  }, [isOpen, contas.length]);

  const importar = async (file: File) => {
    setCarregando(true);
    setRes(null);
    setSelecionado({});
    setBaixados({});
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await fetch('/api/contas-pagar/conciliacao/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivoBase64: base64, nome: file.name, usuario }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Falha ao importar extrato');
      setRes(data);
      // pré-seleciona quando há exatamente 1 título correspondente
      const pre: Record<number, string> = {};
      data.pagamentos.forEach((p: Pagamento) => {
        if (p.contas.length === 1) pre[p.idx] = p.contas[0].cod_pgto;
      });
      setSelecionado(pre);
      if (data.totalPagamentos === 0) toast.info('Nenhum pagamento (saída) reconhecido no extrato.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar extrato');
    } finally {
      setCarregando(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNomeArquivo(f.name);
    importar(f);
  };

  const darBaixa = async (pag: Pagamento) => {
    const codPgto = selecionado[pag.idx];
    if (!codPgto) { toast.error('Selecione o título a pagar correspondente.'); return; }
    if (!contaSel) { toast.error('Selecione a Conta do extrato (no topo) antes de dar baixa.'); return; }
    const conta = pag.contas.find((c) => c.cod_pgto === codPgto);
    if (!conta) return;
    setBaixando(pag.idx);
    try {
      // marcar-pago (PUT) grava também a conta bancária (cod_conta) — mesmo endpoint do
      // Pagamento em Lote — diferente do /pagar, que não registra a conta.
      const r = await fetch(`/api/contas-pagar/${codPgto}/marcar-pago`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor_pago: conta.saldo,
          dt_pgto: pag.data,
          banco: contaSel,
          cod_conta: contaSel,
          username: usuario || 'CONCILIACAO',
          obs: `Baixa por conciliação bancária (${res?.banco || 'extrato'}) — ${pag.historico}`.slice(0, 240),
        }),
      });
      const data = await r.json();
      if (!r.ok || data?.success === false || data?.erro) throw new Error(data?.message || data?.erro || 'Falha ao dar baixa');
      setBaixados((prev) => ({ ...prev, [pag.idx]: codPgto }));
      toast.success(`Título ${codPgto} baixado (R$ ${brlNum(conta.saldo)}).`);
      onBaixaConcluida?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao dar baixa');
    } finally {
      setBaixando(null);
    }
  };

  const resetar = () => { setRes(null); setNomeArquivo(''); setSelecionado({}); setBaixados({}); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conciliação Bancária — Contas a Pagar" width="w-[96%] max-w-6xl">
      <div className="space-y-4 p-1">
        {/* Upload */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <input ref={fileRef} type="file" accept=".ofx,.csv,.txt" onChange={onFile} className="hidden" id="conc-pag-file" />
          <label htmlFor="conc-pag-file"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer text-sm font-medium">
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar extrato (OFX/CSV)
          </label>
          {nomeArquivo && <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{nomeArquivo}</span>}
          {res && <Button variant="outline" size="sm" onClick={resetar}>Limpar</Button>}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs font-medium">Conta do extrato *</label>
            <select
              value={contaSel}
              onChange={(e) => setContaSel(e.target.value)}
              className="h-9 min-w-[240px] px-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800"
            >
              <option value="">Selecione a conta…</option>
              {contas.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground w-full">
            Lê as <strong>saídas (débitos)</strong> do extrato e compara com os títulos a pagar em aberto (mesmo valor). A baixa registra o pagamento na <strong>Conta do extrato</strong> selecionada acima.
          </p>
        </div>

        {/* Resumo */}
        {res && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1 font-medium"><Landmark className="w-4 h-4 text-blue-600" />{res.banco}{res.agencia ? ` · Ag ${res.agencia}` : ''}{res.conta ? ` · Cc ${res.conta}` : ''}</span>
            <span className="text-muted-foreground">Pagamentos no extrato: <strong>{res.totalPagamentos}</strong></span>
            <span className="text-green-700 dark:text-green-400">Com título: <strong>{res.comMatch}</strong></span>
            <span className="text-amber-600">Sem título: <strong>{res.semMatch}</strong></span>
          </div>
        )}

        {/* Lista de pagamentos */}
        {res && res.pagamentos.length > 0 && (
          <div className="space-y-2 max-h-[58vh] overflow-auto pr-1">
            {res.pagamentos.map((pag) => {
              const baixado = baixados[pag.idx];
              return (
                <div key={pag.idx} className={`border rounded-md p-3 ${baixado ? 'bg-green-50 dark:bg-green-950/20 border-green-300' : 'bg-white dark:bg-zinc-900'}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{fmtData(pag.data)}</span>
                      <span className="font-semibold text-red-600">− R$ {brl(pag.valorCentavos)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{pag.motivo}</span>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 max-w-[680px] truncate" title={pag.historico}>{pag.historico}</div>
                    </div>
                    {baixado ? (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Baixado (título {baixado})
                      </span>
                    ) : pag.contas.length > 0 ? (
                      <Button size="sm" onClick={() => darBaixa(pag)} disabled={baixando === pag.idx || !selecionado[pag.idx] || !contaSel} title={!contaSel ? 'Selecione a Conta do extrato (no topo)' : undefined}>
                        {baixando === pag.idx ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                        Dar Baixa
                      </Button>
                    ) : (
                      <span className="text-xs text-amber-600">Sem título a pagar correspondente</span>
                    )}
                  </div>

                  {/* Títulos correspondentes */}
                  {!baixado && pag.contas.length > 0 && (
                    <div className="mt-2 border-t pt-2 space-y-1">
                      {pag.contas.map((c) => (
                        <label key={c.cod_pgto} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded px-1 py-1">
                          <input
                            type="radio"
                            name={`pag-${pag.idx}`}
                            checked={selecionado[pag.idx] === c.cod_pgto}
                            onChange={() => setSelecionado((prev) => ({ ...prev, [pag.idx]: c.cod_pgto }))}
                            style={{ width: 14, height: 14, accentColor: '#2f6fa8' }}
                          />
                          <span className="font-mono text-[11px] text-muted-foreground w-[80px]">{c.cod_pgto}</span>
                          <span className="flex-1 truncate">{c.credor || '(sem credor)'}</span>
                          <span className="text-muted-foreground">Dup {c.nro_dup || '—'}</span>
                          <span className="text-muted-foreground">Venc {fmtData(c.dt_venc)}</span>
                          {c.conta_financeira && <span className="text-muted-foreground max-w-[160px] truncate">{c.conta_financeira}</span>}
                          <span className="font-medium tabular-nums w-[90px] text-right">R$ {brlNum(c.saldo)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {res && res.pagamentos.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pagamento (saída) reconhecido no extrato.</p>
        )}
      </div>
    </Modal>
  );
}
