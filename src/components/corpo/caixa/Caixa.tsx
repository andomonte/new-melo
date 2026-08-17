'use client';

import { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectPadrao from '@/components/common/SelectPadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { mascaraInputBRL, desmascarar, formatarBRL } from '@/utils/monetario';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';
import {
  Search,
  CreditCard,
  Banknote,
  QrCode,
  Trash2,
  Loader2,
  Landmark,
  FileText,
} from 'lucide-react';

// ---- Tipos ----
interface Operadora {
  codopera: string;
  descr: string;
  txopera: number;
  pzopera: number;
}

interface Titulo {
  cod_receb: string;
  codcli: string;
  nome_cliente: string | null;
  dt_venc: string | null;
  dt_emissao: string | null;
  valor_original: number;
  valor_recebido: number;
  nro_doc: string | null;
  tipo: string | null;
  rec: string | null;
  cancel: string | null;
  banco: string | null;
  cod_fat: string | null;
  cod_venda: string | null;
  status: string;
  parcela_atual?: number;
  qtd_parcelas?: number;
}

type Forma = 'dinheiro' | 'credito' | 'debito' | 'pix';

interface Passada {
  id: number;
  forma: Forma;
  codopera?: string;
  descrOperadora?: string;
  taxa: number;
  vezes: number;
  valor: number; // valor bruto passado
  cvnsu?: string;
  autorizacao?: string;
}

const FORMA_PGTO_COD: Record<Forma, string> = {
  dinheiro: '001',
  pix: '003',
  credito: '005',
  debito: '006',
};

const FORMAS: { key: Forma; label: string; icon: React.ElementType }[] = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'credito', label: 'Crédito', icon: CreditCard },
  { key: 'debito', label: 'Débito', icon: CreditCard },
  { key: 'pix', label: 'PIX', icon: QrCode },
];

const OPCOES_VEZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function Caixa() {
  const { user } = useContext(AuthContext);
  const username = user?.usuario || 'Sistema';

  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar recebimento',
    message: 'Deseja receber e dar baixa neste título?',
  });

  // ---- Estado: busca / documento ----
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState<Titulo | null>(null);

  // ---- Estado: operadoras ----
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);

  // ---- Estado: formulário de pagamento ----
  const [forma, setForma] = useState<Forma>('credito');
  const [operadoraSel, setOperadoraSel] = useState('');
  const [vezes, setVezes] = useState('1');
  const [valorPassada, setValorPassada] = useState('');
  const [cvnsu, setCvnsu] = useState('');
  const [autorizacao, setAutorizacao] = useState('');

  // ---- Estado: passadas / salvar ----
  const [passadas, setPassadas] = useState<Passada[]>([]);
  const [salvando, setSalvando] = useState(false);

  const ehCartao = forma === 'credito' || forma === 'debito';

  // Carregar operadoras de cartão
  useEffect(() => {
    fetch('/api/operadoras')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setOperadoras(data);
      })
      .catch((err) => console.error('Erro ao carregar operadoras:', err));
  }, []);

  // ---- Derivados ----
  const totalReceber = useMemo(() => {
    if (!contaSelecionada) return 0;
    const bruto = Number(contaSelecionada.valor_original || 0);
    const rec = Number(contaSelecionada.valor_recebido || 0);
    return Math.max(0, bruto - rec);
  }, [contaSelecionada]);

  const recebido = useMemo(
    () => passadas.reduce((s, p) => s + p.valor, 0),
    [passadas]
  );
  const falta = Math.max(0, totalReceber - recebido);
  const quitado = totalReceber > 0 && recebido >= totalReceber - 0.005;

  // ---- Buscar título ----
  const buscar = async () => {
    const termo = busca.trim();
    if (!termo) {
      toast.info('Digite o número do documento ou nota para buscar.');
      return;
    }
    try {
      setBuscando(true);
      setContaSelecionada(null);
      setPassadas([]);
      const params = new URLSearchParams({
        search: termo,
        limit: '20',
        status: 'pendente',
      });
      const resp = await fetch(`/api/contas-receber?${params.toString()}`);
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.erro || `Erro HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const lista: Titulo[] = (data.contas_receber || []).filter(
        (t: Titulo) => t.cancel !== 'S' && t.rec !== 'S'
      );
      setTitulos(lista);
      if (lista.length === 0) {
        toast.info('Nenhum título em aberto encontrado para essa busca.');
      } else if (lista.length === 1) {
        setContaSelecionada(lista[0]);
      }
    } catch (err: any) {
      toast.error(`Erro ao buscar: ${err.message}`);
    } finally {
      setBuscando(false);
    }
  };

  // ---- Adicionar passada ----
  const adicionarPassada = () => {
    if (!contaSelecionada) {
      toast.error('Selecione um título antes de adicionar o pagamento.');
      return;
    }
    const valor = desmascarar(valorPassada);
    if (!valor || valor <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (ehCartao && !operadoraSel) {
      toast.error('Selecione a operadora do cartão.');
      return;
    }

    const op = operadoras.find((o) => o.codopera === operadoraSel);
    setPassadas((prev) => [
      ...prev,
      {
        id: prev.reduce((m, p) => Math.max(m, p.id), 0) + 1,
        forma,
        codopera: ehCartao ? operadoraSel : undefined,
        descrOperadora: ehCartao ? op?.descr : undefined,
        taxa: ehCartao ? Number(op?.txopera || 0) : 0,
        vezes: ehCartao ? parseInt(vezes) || 1 : 1,
        valor,
        cvnsu: ehCartao ? cvnsu.trim() || undefined : undefined,
        autorizacao: ehCartao ? autorizacao.trim() || undefined : undefined,
      },
    ]);
    // limpar campos da passada
    setValorPassada('');
    setCvnsu('');
    setAutorizacao('');
  };

  const removerPassada = (id: number) =>
    setPassadas((prev) => prev.filter((p) => p.id !== id));

  // ---- Receber e dar baixa ----
  const receberEDarBaixa = async () => {
    if (!contaSelecionada) return;
    if (passadas.length === 0) {
      toast.error('Adicione ao menos uma forma de pagamento.');
      return;
    }

    setSalvando(true);
    const hoje = new Date().toISOString().split('T')[0];
    try {
      // Processa sequencialmente para não competir pelo valor_rec do mesmo título
      for (const p of passadas) {
        if (p.forma === 'credito' || p.forma === 'debito') {
          // Cartão → gera parcelas (operadora) e baixa o título
          const resp = await fetch('/api/contas-receber/gerar-parcelas-cartao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cod_receb: contaSelecionada.cod_receb,
              codopera: p.codopera,
              valorTotal: p.valor,
              numParcelas: p.vezes,
              dt_base: hoje,
              cod_autorizacao: p.autorizacao || null,
              cod_documento: p.cvnsu || null,
              username,
            }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || data.erro || 'Erro ao gerar parcelas do cartão');
        } else {
          // Dinheiro / PIX → baixa direta no bruto
          const resp = await fetch('/api/contas-receber/dar-baixa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cod_receb: contaSelecionada.cod_receb,
              valor_recebido: p.valor,
              forma_pgto: FORMA_PGTO_COD[p.forma],
              dt_pgto: hoje,
              tipo: 'D',
              sf: 'S',
              nome: `Recebimento ${p.forma.toUpperCase()} - Caixa`,
              username,
            }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.detalhes || data.erro || 'Erro ao dar baixa');
        }
      }

      toast.success('Recebimento registrado e título baixado com sucesso!');
      // Recarrega o título para refletir o novo estado
      setPassadas([]);
      await buscarNovamente(contaSelecionada.cod_receb);
    } catch (err: any) {
      toast.error(`Erro ao receber: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // Recarrega um título específico após a baixa
  const buscarNovamente = async (codReceb: string) => {
    try {
      const resp = await fetch(`/api/contas-receber/${codReceb}`);
      if (!resp.ok) {
        setContaSelecionada(null);
        setTitulos((prev) => prev.filter((t) => t.cod_receb !== codReceb));
        return;
      }
      const t = await resp.json();
      // normaliza para o shape da lista
      const atualizado: Titulo = {
        cod_receb: t.cod_receb,
        codcli: t.codcli,
        nome_cliente: t.nome_cliente,
        dt_venc: t.dt_venc,
        dt_emissao: t.dt_emissao,
        valor_original: Number(t.valor_pgto || 0),
        valor_recebido: Number(t.valor_rec || 0),
        nro_doc: t.nro_doc,
        tipo: t.tipo,
        rec: t.rec,
        cancel: t.cancel,
        banco: t.banco,
        cod_fat: t.cod_fat,
        cod_venda: t.cod_venda,
        status: t.status,
      };
      setContaSelecionada(atualizado.rec === 'S' ? null : atualizado);
      setTitulos((prev) =>
        prev.map((x) => (x.cod_receb === codReceb ? atualizado : x))
          .filter((x) => x.rec !== 'S')
      );
    } catch {
      /* silencioso: baixa já foi confirmada */
    }
  };

  const fmtData = (d: string | null) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('pt-BR');
  };

  // ================= RENDER =================
  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900 dark:border-slate-700">
      {/* Barra superior */}
      <div className="flex items-center gap-4 flex-wrap px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <div className="flex items-center gap-2 font-bold">
          <span className="w-8 h-8 rounded-md bg-blue-600 text-white grid place-items-center font-black">
            M
          </span>
          <div className="leading-tight">
            <div>CAIXA</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold -mt-0.5">
              Melo · Distribuidora de Peças
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-6 flex-wrap text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Operador</div>
            <div className="font-semibold">{username}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Filial</div>
            <div className="font-semibold">{user?.filial || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Data</div>
            <div className="font-semibold tabular-nums">
              {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.95fr] gap-4 items-start max-w-[1180px] mx-auto">
          {/* ---- COLUNA ESQUERDA: Documento ---- */}
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                <FileText size={14} /> Documento
              </h2>
              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscar()}
                    placeholder="Nº do documento, nota ou cliente"
                    className="h-11 font-mono tracking-wide"
                    aria-label="Número do documento ou nota fiscal"
                  />
                  <DefaultButton
                    text={buscando ? 'Buscando...' : 'Buscar'}
                    icon={buscando ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                    onClick={buscar}
                    variant="primary"
                  />
                </div>

                {/* Lista de resultados (quando >1) */}
                {titulos.length > 1 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {titulos.length} títulos encontrados — selecione
                    </div>
                    {titulos.map((t) => (
                      <button
                        key={t.cod_receb}
                        onClick={() => {
                          setContaSelecionada(t);
                          setPassadas([]);
                        }}
                        className={`w-full text-left flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          contaSelecionada?.cod_receb === t.cod_receb
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                            : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        <span className="font-mono">{t.nro_doc || t.cod_receb}</span>
                        <span className="truncate flex-1 text-gray-500">{t.nome_cliente}</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {formatarBRL(Number(t.valor_original || 0) - Number(t.valor_recebido || 0))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Resumo do documento selecionado */}
                {contaSelecionada && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
                      <Campo label="Documento" valor={contaSelecionada.nro_doc || '-'} mono />
                      <Campo label="Cód. Receb." valor={contaSelecionada.cod_receb} mono />
                      <Campo label="Vencimento" valor={fmtData(contaSelecionada.dt_venc)} />
                      <Campo
                        label="A receber"
                        valor={formatarBRL(totalReceber)}
                        mono
                        big
                      />
                      <div className="col-span-2 sm:col-span-4">
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          Cliente
                        </div>
                        <div className="font-semibold">
                          {contaSelecionada.codcli} · {contaSelecionada.nome_cliente || '-'}
                        </div>
                      </div>
                    </div>

                    <table className="w-full mt-4 text-sm border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-gray-400 text-left">
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700">Título</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700">Vencimento</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700">Situação</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 font-mono">{contaSelecionada.nro_doc || contaSelecionada.cod_receb}</td>
                          <td className="py-2">{fmtData(contaSelecionada.dt_venc)}</td>
                          <td className="py-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30 rounded-full px-2 py-0.5">
                              {contaSelecionada.status === 'recebido_parcial' ? 'Parcial' : 'Em aberto'}
                            </span>
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {formatarBRL(totalReceber)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-500 mt-2">
                      Título gerado no <b>faturamento</b>. Ao receber no caixa, recebe <b>baixa automática</b>.
                    </p>
                  </>
                )}

                {!contaSelecionada && titulos.length <= 1 && (
                  <div className="mt-4 text-center text-sm text-gray-400 border border-dashed border-gray-300 dark:border-slate-700 rounded-lg py-8">
                    Busque um documento para iniciar o recebimento.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ---- COLUNA DIREITA: Recebimento ---- */}
          <div>
            <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                <Landmark size={14} /> Recebimento
              </h2>
              <div className="p-4">
                {/* Segmented forma de pagamento */}
                <div className="flex gap-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
                  {FORMAS.map((f) => {
                    const Icon = f.icon;
                    const ativo = forma === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setForma(f.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[13px] font-semibold transition-colors ${
                          ativo
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                      >
                        <Icon size={15} /> {f.label}
                      </button>
                    );
                  })}
                </div>

                {/* Formulário */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {ehCartao && (
                    <>
                      <div className="col-span-2">
                        <Label>Operadora de Cartão</Label>
                        <SelectPadrao
                          searchable
                          value={operadoraSel}
                          onValueChange={setOperadoraSel}
                          placeholder="Selecione a operadora..."
                          options={operadoras.map((op) => ({
                            value: op.codopera,
                            label: `${op.descr} — tx ${op.txopera}% (${op.pzopera} dias)`,
                          }))}
                        />
                      </div>
                      <div>
                        <Label>Nº de vezes (parcelas)</Label>
                        <SelectPadrao
                          value={vezes}
                          onValueChange={setVezes}
                          options={OPCOES_VEZES.map((n) => ({
                            value: String(n),
                            label: n === 1 ? '1x — à vista' : `${n}x`,
                          }))}
                        />
                      </div>
                    </>
                  )}

                  <div className={ehCartao ? '' : 'col-span-2'}>
                    <Label>Valor (R$)</Label>
                    <Input
                      value={valorPassada}
                      onChange={(e) => setValorPassada(mascaraInputBRL(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && adicionarPassada()}
                      placeholder="0,00"
                      className="text-right font-mono tabular-nums"
                      inputMode="decimal"
                    />
                  </div>

                  {ehCartao && (
                    <>
                      <div>
                        <Label>
                          CV / NSU <span className="text-gray-400 normal-case">(opcional)</span>
                        </Label>
                        <Input
                          value={cvnsu}
                          onChange={(e) => setCvnsu(e.target.value)}
                          placeholder="comprovante"
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Label>
                          Nº Autorização <span className="text-gray-400 normal-case">(opcional)</span>
                        </Label>
                        <Input
                          value={autorizacao}
                          onChange={(e) => setAutorizacao(e.target.value)}
                          placeholder="cód. maquineta"
                          className="font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={adicionarPassada}
                      className="w-full border border-dashed border-gray-300 dark:border-slate-600 rounded-lg py-2 text-sm font-semibold text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                    >
                      ＋ Adicionar {ehCartao ? 'passada do cartão' : 'pagamento'}
                    </button>
                  </div>
                </div>

                {/* Lista de passadas */}
                {passadas.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {passadas.map((p) => {
                      const liq = p.valor * (1 - p.taxa / 100);
                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2"
                        >
                          <span className="px-2 py-1 rounded bg-blue-700 text-white text-[9px] font-black uppercase">
                            {p.forma === 'credito'
                              ? 'CRÉD'
                              : p.forma === 'debito'
                              ? 'DÉB'
                              : p.forma === 'pix'
                              ? 'PIX'
                              : 'DIN'}
                          </span>
                          <span className="text-[13px]">
                            {p.forma === 'credito' || p.forma === 'debito' ? (
                              <>
                                {p.descrOperadora} · {p.vezes}x
                                <small className="block text-gray-400 text-[11px]">
                                  tx {p.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% → líq{' '}
                                  {formatarBRL(liq)}
                                  {(p.cvnsu || p.autorizacao) &&
                                    ` · ${[p.cvnsu && 'CV ' + p.cvnsu, p.autorizacao && 'Aut ' + p.autorizacao]
                                      .filter(Boolean)
                                      .join(' / ')}`}
                                </small>
                              </>
                            ) : (
                              <>{p.forma === 'pix' ? 'PIX' : 'Dinheiro'}</>
                            )}
                          </span>
                          <span className="font-mono tabular-nums font-semibold">
                            {formatarBRL(p.valor)}
                          </span>
                          <button
                            onClick={() => removerPassada(p.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remover"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-center text-sm text-gray-400 border border-dashed border-gray-300 dark:border-slate-700 rounded-lg py-3">
                    Nenhum pagamento adicionado ainda.
                  </div>
                )}

                {/* Totais */}
                <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total a receber</span>
                    <span className="font-mono tabular-nums font-semibold">{formatarBRL(totalReceber)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Recebido</span>
                    <span className="font-mono tabular-nums font-semibold">{formatarBRL(recebido)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="uppercase tracking-wide text-xs font-bold">Falta</span>
                    <span
                      className={`font-mono tabular-nums text-2xl font-bold ${
                        quitado ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {formatarBRL(falta)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2.5">
                  💳 No cartão, cada passada gera as <b>parcelas em contas a receber</b> (30/60/90, com a taxa da
                  operadora) e dá <b>baixa</b> no título do faturamento. Dinheiro/PIX baixam no valor cheio.
                </div>

                <DefaultButton
                  text={salvando ? 'Processando...' : 'Receber e dar baixa'}
                  icon={salvando ? <Loader2 className="animate-spin" size={16} /> : undefined}
                  onClick={() =>
                    pedirConfirmacao(receberEDarBaixa, {
                      title: 'Confirmar recebimento',
                      message: `Receber ${formatarBRL(recebido)} e dar baixa no título ${
                        contaSelecionada?.nro_doc || contaSelecionada?.cod_receb || ''
                      }?`,
                    })
                  }
                  variant="confirm"
                  disabled={salvando || !contaSelecionada || passadas.length === 0 || !quitado}
                  className="w-full mt-3 h-12"
                />
              </div>
            </section>
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-6">
          Caixa · Fase 1 — recebimento e baixa de títulos
        </p>
      </main>

      {ConfirmacaoSalvarModal}
    </div>
  );
}

// ---- Componente auxiliar de campo ----
function Campo({
  label,
  valor,
  mono,
  big,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div
        className={`font-semibold ${mono ? 'font-mono tabular-nums' : ''} ${
          big ? 'text-xl' : 'text-[15px]'
        }`}
      >
        {valor}
      </div>
    </div>
  );
}
