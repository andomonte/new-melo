'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectPadrao from '@/components/common/SelectPadrao';
import Modal from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { mascaraInputBRL, desmascarar, formatarBRL, formatarDecimalBR } from '@/utils/monetario';
import { Trash2, Loader2, Landmark } from 'lucide-react';

/**
 * Modal de Recebimento (baixa) de vários títulos do Contas a Receber.
 *
 * Reaproveita o MESMO motor do Caixa (/api/caixa/dados-recebimento + /api/caixa/receber):
 *  - baixa em CASCATA (waterfall) entre os títulos selecionados (mesmo cliente);
 *  - baixa total ou PARCIAL (o último título coberto fica em aberto no restante);
 *  - juros/tarifa por título, múltiplas formas de pagamento, Modo simulação (dryRun).
 *
 * Diferença para o Caixa: baixa INDEPENDENTE — NÃO registra movimento em sessão de caixa.
 */

// ---- Tipos ----
type Forma = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'deposito' | 'credito_devolucao';

interface Operadora {
  codopera: string;
  descr: string;
  txopera: number;
  pzopera: number;
}
type ContaFin = { cof_id: number; cof_descricao: string; centro_custo: string | null };
type FormaCat = { codfpgt: string; descricao: string };

interface Passada {
  id: number;
  forma: Forma;
  codopera?: string;
  descrOperadora?: string;
  taxa: number;
  vezes: number;
  valor: number;
  cvnsu?: string;
  autorizacao?: string;
  cofId: number;
  cofDescricao?: string;
  codfpgt: string;
}

export interface TituloSelecionado {
  cod_receb: string;
  codcli: string | number;
  nome_cliente?: string | null;
  nro_doc?: string | null;
  dt_venc?: string | null;
  valor_original: number;
  valor_recebido: number;
  forma_fat?: string | null;
}

interface Props {
  isOpen: boolean;
  titulos: TituloSelecionado[];
  /** Login do operador (para auditoria no dbfreceb). */
  username: string;
  /** Conta do operador (tb_user_perfil.cod_conta da filial). Se vazia, o modal tenta buscar. */
  codContaInicial?: string;
  /** Dados do usuário logado para fallback da conta do operador. */
  user?: { usuario?: string; filial?: string; cod_conta?: string | number; codusr?: string | number } | null;
  onClose: () => void;
  /** Chamado após confirmar o recebimento (real) — o pai recarrega o grid. */
  onSuccess: () => void;
}

// Combo de forma de pagamento → comportamento interno.
const CAT_POR_CODFPGT: Record<string, Forma> = {
  '01': 'dinheiro',
  '04': 'credito',
  '05': 'credito_devolucao',
  '09': 'deposito',
  '42': 'pix',
};

// Baldes do recebimento por código de forma (rateio do SysCaixa).
const TIPOS_TARIFA_FPGT = ['06', '07', '08', '15', '32', '44'];
const TIPOS_JUROS_FPGT = ['18', '20', '21', '22', '23', '25', '26', '43'];
function bucketDaForma(codfpgt?: string): 'tarifa' | 'juros' | 'principal' {
  if (codfpgt && TIPOS_TARIFA_FPGT.includes(codfpgt)) return 'tarifa';
  if (codfpgt && TIPOS_JUROS_FPGT.includes(codfpgt)) return 'juros';
  return 'principal';
}

const OPCOES_VEZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ModalRecebimentoTitulos({
  isOpen,
  titulos,
  username,
  codContaInicial,
  user,
  onClose,
  onSuccess,
}: Props) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  // Data-only (DATE) sem shift de fuso: 'YYYY-MM-DD' -> 'DD/MM/YYYY' (evita -1 dia em UTC-4).
  const fmtDataBR = (v?: string | null) => {
    if (!v) return '-';
    const [y, m, d] = String(v).slice(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : '-';
  };

  const [contasFin, setContasFin] = useState<ContaFin[]>([]);
  const [cofId, setCofId] = useState('');
  const [formasPag, setFormasPag] = useState<FormaCat[]>([]);
  const [codFpgt, setCodFpgt] = useState('01');
  const [forma, setForma] = useState<Forma>('dinheiro');
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [operadoraSel, setOperadoraSel] = useState('');
  const [vezes, setVezes] = useState('1');
  const [cvnsu, setCvnsu] = useState('');
  const [autorizacao, setAutorizacao] = useState('');
  const [valorPassada, setValorPassada] = useState('');
  const [passadas, setPassadas] = useState<Passada[]>([]);
  const [dadosMap, setDadosMap] = useState<Record<string, any>>({});
  const [codConta, setCodConta] = useState(String(codContaInicial ?? ''));
  const [deposito, setDeposito] = useState(false);
  const [dataPgto, setDataPgto] = useState(hojeISO);
  const [simular, setSimular] = useState(true);
  const [previa, setPrevia] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [refetchDados, setRefetchDados] = useState(0); // bump p/ recarregar juros após liberar
  // Liberação de juros (baixar juros): taxa autorizada + motivo (≥15) para os títulos selecionados.
  const [liberarAberto, setLiberarAberto] = useState(false);
  const [liberarTaxa, setLiberarTaxa] = useState('');
  const [liberarMotivo, setLiberarMotivo] = useState('');
  const [liberando, setLiberando] = useState(false);
  const [liberarData, setLiberarData] = useState(hojeISO); // data prevista de pagamento (prévia)
  const [liberarPreview, setLiberarPreview] = useState<{ juros: number; total: number; dias: number } | null>(null);

  const ehCartao = forma === 'credito' || forma === 'debito';
  const formaBucket = bucketDaForma(codFpgt);

  // Conta do operador: prop → user.cod_conta → endpoint (fallback).
  useEffect(() => {
    if (codContaInicial) {
      setCodConta(String(codContaInicial));
      return;
    }
    if (user?.cod_conta) {
      setCodConta(String(user.cod_conta));
      return;
    }
    if (user?.usuario && user?.filial) {
      fetch(
        `/api/perfilFilial/get?user_login_id=${encodeURIComponent(user.usuario)}&nome_filial=${encodeURIComponent(user.filial)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCodConta(d?.cod_conta ? String(d.cod_conta) : ''))
        .catch(() => setCodConta(''));
    }
  }, [codContaInicial, user?.cod_conta, user?.usuario, user?.filial]);

  // Carregar operadoras / contas financeiras / formas de pagamento (uma vez, ao abrir).
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/operadoras')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setOperadoras(d))
      .catch(() => {});
    fetch('/api/caixa/contas-financeiras')
      .then((r) => (r.ok ? r.json() : { contas: [] }))
      .then((d) => setContasFin(Array.isArray(d?.contas) ? d.contas : []))
      .catch(() => {});
    fetch('/api/caixa/formas-pagamento')
      .then((r) => (r.ok ? r.json() : { formas: [] }))
      .then((d) => {
        const fs: FormaCat[] = Array.isArray(d?.formas) ? d.formas : [];
        setFormasPag(fs);
        if (fs.length) {
          setCodFpgt(fs[0].codfpgt);
          setForma(CAT_POR_CODFPGT[fs[0].codfpgt] ?? 'dinheiro');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Busca juros/tarifa/principal pendente dos títulos selecionados (motor validado).
  useEffect(() => {
    if (!isOpen || titulos.length === 0) {
      setDadosMap({});
      return;
    }
    setPrevia(null);
    fetch('/api/caixa/dados-recebimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_receb: titulos.map((t) => t.cod_receb), dataPgto }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m: Record<string, any> = {};
        (d?.titulos || []).forEach((t: any) => {
          m[t.cod_receb] = t;
        });
        setDadosMap(m);
      })
      .catch(() => setDadosMap({}));
  }, [isOpen, titulos, dataPgto, refetchDados]);

  // ---- Derivados (somam todos os títulos selecionados) ----
  const principalPend = useMemo(
    () =>
      titulos.reduce((s, t) => {
        const d = dadosMap[t.cod_receb];
        return (
          s +
          (d
            ? Number(d.principalPendente || 0)
            : Math.max(0, Number(t.valor_original || 0) - Number(t.valor_recebido || 0)))
        );
      }, 0),
    [titulos, dadosMap],
  );
  const jurosVal = useMemo(
    () => titulos.reduce((s, t) => s + Number(dadosMap[t.cod_receb]?.juros || 0), 0),
    [titulos, dadosMap],
  );
  const tarifaVal = useMemo(
    () => titulos.reduce((s, t) => s + Number(dadosMap[t.cod_receb]?.tarifa || 0), 0),
    [titulos, dadosMap],
  );
  const totalReceber = principalPend + jurosVal + tarifaVal;

  const recTitulos = useMemo(
    () => passadas.filter((p) => bucketDaForma(p.codfpgt) === 'principal').reduce((s, p) => s + p.valor, 0),
    [passadas],
  );
  const recTarifa = useMemo(
    () => passadas.filter((p) => bucketDaForma(p.codfpgt) === 'tarifa').reduce((s, p) => s + p.valor, 0),
    [passadas],
  );
  const recJuros = useMemo(
    () => passadas.filter((p) => bucketDaForma(p.codfpgt) === 'juros').reduce((s, p) => s + p.valor, 0),
    [passadas],
  );
  const recebidoTotal = recTitulos + recTarifa + recJuros;
  const falta = Math.max(0, totalReceber - recebidoTotal);
  const faltaTarifa = Math.max(0, tarifaVal - recTarifa);
  const faltaJuros = Math.max(0, jurosVal - recJuros);
  const quitado = totalReceber > 0 && recebidoTotal >= totalReceber - 0.005;
  const parcial = recTitulos > 0 && recTitulos < principalPend - 0.005;

  // Abre o painel "Baixar Juros" já com a taxa aplicada atual e a data de pagamento do recebimento.
  const abrirLiberarJuros = () => {
    const taxaAtual = titulos.map((t) => dadosMap[t.cod_receb]?.taxa).find((x) => x != null);
    setLiberarTaxa(taxaAtual != null ? String(taxaAtual) : '');
    setLiberarMotivo('');
    setLiberarData(dataPgto || hojeISO);
    setLiberarPreview(null);
    setLiberarAberto(true);
  };

  // Prévia ao vivo (fiel ao Delphi CalculaValorFinal): juros/total à taxa e data prevista informadas.
  useEffect(() => {
    if (!liberarAberto || titulos.length === 0) return;
    const taxa = Number(String(liberarTaxa).replace(',', '.'));
    if (!Number.isFinite(taxa) || taxa < 0 || !liberarData) {
      setLiberarPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const tmr = setTimeout(() => {
      fetch('/api/caixa/dados-recebimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cod_receb: titulos.map((t) => t.cod_receb), dataPgto: liberarData, taxaOverride: taxa }),
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.totais) { setLiberarPreview(null); return; }
          const dias = (d.titulos || []).reduce((m: number, t: any) => Math.max(m, Number(t.diasAtraso || 0)), 0);
          setLiberarPreview({ juros: Number(d.totais.juros || 0), total: Number(d.totais.aReceber || 0), dias });
        })
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(tmr); ctrl.abort(); };
  }, [liberarAberto, liberarTaxa, liberarData, titulos]);

  const confirmarLiberarJuros = async () => {
    const taxa = Number(String(liberarTaxa).replace(',', '.'));
    if (!Number.isFinite(taxa) || taxa < 0) {
      toast.error('Informe uma taxa de juros válida (0 = isentar).');
      return;
    }
    if (liberarMotivo.trim().length < 15) {
      toast.error('O motivo é obrigatório (mínimo 15 caracteres).');
      return;
    }
    setLiberando(true);
    try {
      const r = await fetch('/api/contas-receber/liberar-juros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cod_receb: titulos.map((t) => t.cod_receb), taxa, motivo: liberarMotivo.trim(), usuario: username, codusr: user?.codusr ?? null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao liberar juros');
      toast.success(`Juros liberado em ${d.liberados} título(s) à taxa ${taxa}%${d.jaRecebidos?.length ? ` (${d.jaRecebidos.length} já recebido[s] ignorado[s])` : ''}.`);
      setLiberarAberto(false);
      setRefetchDados((x) => x + 1); // recalcula o juros com a taxa liberada
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLiberando(false);
    }
  };

  const adicionarPassada = () => {
    if (titulos.length === 0) {
      toast.error('Nenhum título selecionado.');
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
    if (!cofId) {
      toast.error('Selecione a Conta Financeira.');
      return;
    }
    if (deposito && forma === 'dinheiro') {
      toast.error('Com Depósito marcado não dá pra receber em dinheiro — use cartão, PIX ou depósito.');
      return;
    }
    const bucket = bucketDaForma(codFpgt);
    const limite =
      bucket === 'tarifa' ? faltaTarifa : bucket === 'juros' ? faltaJuros : principalPend - recTitulos;
    const nomeBucket = bucket === 'tarifa' ? 'a tarifa' : bucket === 'juros' ? 'o juros' : 'o principal';
    const nomeBucketCap = bucket === 'tarifa' ? 'A tarifa' : bucket === 'juros' ? 'O juros' : 'O principal';
    if (bucket === 'tarifa' && recTitulos <= 0.005) {
      toast.error('Adicione o pagamento do título antes da tarifa.');
      return;
    }
    if (limite <= 0.005) {
      toast.error(`${nomeBucketCap} já está coberto.`);
      return;
    }
    if (valor > limite + 0.005) {
      toast.error(`Valor acima do saldo de ${nomeBucket}. Máximo: ${formatarBRL(limite)}.`);
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
        cofId: Number(cofId),
        cofDescricao: contasFin.find((cf) => String(cf.cof_id) === String(cofId))?.cof_descricao,
        codfpgt: codFpgt,
      },
    ]);
    setValorPassada('');
    setCvnsu('');
    setAutorizacao('');
  };

  const removerPassada = (id: number) => setPassadas((prev) => prev.filter((p) => p.id !== id));

  const receberEDarBaixa = async () => {
    if (titulos.length === 0) return;
    if (passadas.length === 0) {
      toast.error('Adicione ao menos uma forma de pagamento.');
      return;
    }
    if (!codConta.trim()) {
      toast.error('Operador sem conta — configure no cadastro de usuário.');
      return;
    }

    // Regra do Caixa (UniCaixa.bbtnSalvarClick): SEMPRE amortizar o juros. Não pode baixar o
    // principal deixando juros pendente — o juros do atraso entra integral.
    if (
      jurosVal > 0.005 &&
      (recJuros <= 0.005 || (recTitulos > 0.005 && recJuros < jurosVal - 0.005))
    ) {
      toast.error('Você deve sempre amortizar o juros. O restante baixar do valor principal.');
      return;
    }

    // Regra do Caixa: se o PRINCIPAL não é totalmente coberto, o título fica ABERTO (parcial) — confirma no salvamento real.
    if (!simular && recTitulos < principalPend - 0.005) {
      const ok = window.confirm(
        'O valor recebido é MENOR que o valor total do título.\n' +
          'Com esse valor o título permanecerá ABERTO (recebido parcial).\n\n' +
          'Deseja continuar mesmo assim?',
      );
      if (!ok) return;
    }

    setSalvando(true);
    setPrevia(null);
    try {
      // Waterfall: cada título com seu principal pendente; juros/tarifa rateados proporcionalmente
      // ao que foi efetivamente lançado nos baldes de juros/tarifa.
      const titulosPayload = titulos.map((t) => {
        const dTarifa = Number(dadosMap[t.cod_receb]?.tarifa || 0);
        const dJuros = Number(dadosMap[t.cod_receb]?.juros || 0);
        return {
          cod_receb: t.cod_receb,
          principalPendente: Number(
            dadosMap[t.cod_receb]?.principalPendente ??
              Math.max(0, Number(t.valor_original || 0) - Number(t.valor_recebido || 0)),
          ),
          juros: jurosVal > 0 ? Math.round(dJuros * (recJuros / jurosVal) * 100) / 100 : 0,
          tarifa: tarifaVal > 0 ? Math.round(dTarifa * (recTarifa / tarifaVal) * 100) / 100 : 0,
        };
      });
      const pagamentosPrincipal = passadas
        .filter((p) => bucketDaForma(p.codfpgt) === 'principal')
        .map((p) => ({
          forma: p.forma,
          valor: p.valor,
          codopera: p.codopera,
          vezes: p.vezes,
          cvnsu: p.cvnsu,
          autorizacao: p.autorizacao,
          cof_id: p.cofId,
          tipo: p.codfpgt,
        }));
      const resp = await fetch('/api/caixa/receber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulos: titulosPayload,
          dataPgto,
          cod_conta: codConta.trim(),
          username,
          dryRun: simular,
          pagamentos: pagamentosPrincipal,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detalhes || data.erro || 'Erro no recebimento');

      if (data.simulado) {
        setPrevia(data);
        toast.info('Simulação concluída — nada foi gravado.');
      } else {
        toast.success('Recebimento efetuado!');
        setPassadas([]);
        setPrevia(null);
        onSuccess();
      }
    } catch (err: any) {
      toast.error(`Erro ao receber: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const clienteLabel = titulos[0]
    ? `${titulos[0].codcli}${titulos[0].nome_cliente ? ' - ' + titulos[0].nome_cliente : ''}`
    : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recebimento de Títulos" width="w-[97%] max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ---- Coluna esquerda: resumo dos títulos selecionados ---- */}
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            {titulos.length} título(s) selecionado(s)
          </h2>
          <div className="p-3">
            {clienteLabel && (
              <p className="text-sm mb-2">
                Cliente: <b>{clienteLabel}</b>
              </p>
            )}
            <div className="max-h-56 overflow-y-auto rounded border border-gray-100 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-2 py-1 text-left">Título</th>
                    <th className="px-2 py-1 text-left">Doc</th>
                    <th className="px-2 py-1 text-left">Venc.</th>
                    <th className="px-2 py-1 text-right">Principal</th>
                    <th className="px-2 py-1 text-right">Juros</th>
                  </tr>
                </thead>
                <tbody>
                  {titulos.map((t) => {
                    const d = dadosMap[t.cod_receb];
                    const principal = d
                      ? Number(d.principalPendente || 0)
                      : Math.max(0, Number(t.valor_original || 0) - Number(t.valor_recebido || 0));
                    return (
                      <tr key={t.cod_receb} className="border-b border-gray-100 dark:border-slate-800">
                        <td className="px-2 py-1 font-mono">{t.cod_receb}</td>
                        <td className="px-2 py-1">{t.nro_doc || '-'}</td>
                        <td className="px-2 py-1">
                          {fmtDataBR(t.dt_venc)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{formatarBRL(principal)}</td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums text-amber-600">
                          {formatarBRL(Number(d?.juros || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Composição: Principal + Juros = Total do Título + Tarifa = Total a Receber */}
            <div className="mt-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Valor Principal ({titulos.length} tít.)</span>
                <span className="font-mono tabular-nums">{formatarBRL(principalPend)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Juros{jurosVal > 0 ? '' : ' (em dia)'}</span>
                <span className={`font-mono tabular-nums ${jurosVal > 0 ? 'text-amber-600' : ''}`}>
                  {formatarBRL(jurosVal)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-slate-700 pt-1 font-semibold">
                <span>= Total do Título</span>
                <span className="font-mono tabular-nums">{formatarBRL(principalPend + jurosVal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Tarifa bancária</span>
                <span className="font-mono tabular-nums">{formatarBRL(tarifaVal)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-gray-300 dark:border-slate-600 pt-1 font-bold text-base">
                <span>= Total a Receber</span>
                <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                  {formatarBRL(totalReceber)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Coluna direita: recebimento ---- */}
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <Landmark size={14} /> Recebimento
          </h2>
          <div className="p-4">
            <div>
              <Label>Forma de Pagamento</Label>
              <SelectPadrao
                searchable
                value={codFpgt}
                onValueChange={(cod) => {
                  const cat: Forma = cod === '04' ? 'credito' : cod === '42' ? 'pix' : 'dinheiro';
                  if (deposito && cod === '01') {
                    toast.error('Com Depósito marcado não dá pra receber em dinheiro.');
                    return;
                  }
                  setCodFpgt(cod);
                  setForma(cat);
                  const b = bucketDaForma(cod);
                  if (b === 'tarifa') {
                    setValorPassada(formatarDecimalBR(faltaTarifa));
                    setCofId('161');
                  } else if (b === 'juros') {
                    setValorPassada(formatarDecimalBR(faltaJuros));
                    setCofId('160');
                  }
                }}
                placeholder="Selecione a forma..."
                options={formasPag.map((f) => ({ value: f.codfpgt, label: `${f.codfpgt} — ${f.descricao}` }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="col-span-2">
                <Label>
                  Conta Financeira
                  {formaBucket === 'tarifa' && ' (tarifa → 161, fixa)'}
                  {formaBucket === 'juros' && ' (juros → 160, fixa)'}
                </Label>
                <SelectPadrao
                  searchable
                  value={String(cofId ?? '')}
                  onValueChange={(v) => setCofId(v)}
                  disabled={formaBucket !== 'principal'}
                  placeholder="SELECIONE A CONTA..."
                  options={contasFin.map((cf) => ({
                    value: String(cf.cof_id),
                    label: `${cf.cof_id} — ${cf.cof_descricao}${cf.centro_custo ? ` · ${cf.centro_custo}` : ''}`,
                  }))}
                />
              </div>

              {ehCartao && (
                <>
                  <div className="col-span-2">
                    <Label>Tipo do cartão</Label>
                    <div className="flex gap-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
                      {(['credito', 'debito'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForma(t)}
                          className={`flex-1 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                            forma === t
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                        >
                          {t === 'credito' ? 'Crédito' : 'Débito'}
                        </button>
                      ))}
                    </div>
                  </div>
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
                <Label>
                  {formaBucket === 'tarifa'
                    ? 'Valor da tarifa (R$)'
                    : formaBucket === 'juros'
                    ? 'Valor do juros (R$)'
                    : 'Valor principal (R$)'}
                </Label>
                <Input
                  value={valorPassada}
                  onChange={(e) => setValorPassada(mascaraInputBRL(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarPassada()}
                  placeholder="0,00"
                  readOnly={formaBucket === 'tarifa'}
                  className={`text-right font-mono tabular-nums ${formaBucket === 'tarifa' ? 'bg-gray-100 dark:bg-slate-800' : ''}`}
                  inputMode="decimal"
                />
              </div>

              {ehCartao && (
                <>
                  <div>
                    <Label>
                      CV / NSU <span className="text-gray-400 normal-case">(opcional)</span>
                    </Label>
                    <Input value={cvnsu} onChange={(e) => setCvnsu(e.target.value)} placeholder="comprovante" className="font-mono" />
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
                  const b = bucketDaForma(p.codfpgt);
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2"
                    >
                      <span
                        className={`px-2 py-1 rounded text-white text-[9px] font-black uppercase ${
                          b === 'tarifa' ? 'bg-purple-700' : b === 'juros' ? 'bg-amber-700' : 'bg-blue-700'
                        }`}
                      >
                        {b === 'tarifa'
                          ? 'TAR'
                          : b === 'juros'
                          ? 'JUR'
                          : p.forma === 'credito'
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
                              tx {p.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% → líq {formatarBRL(liq)}
                            </small>
                          </>
                        ) : (
                          formasPag.find((f) => f.codfpgt === p.codfpgt)?.descricao ??
                          (p.forma === 'pix' ? 'PIX' : 'Dinheiro')
                        )}
                      </span>
                      <span className="font-mono tabular-nums font-semibold">{formatarBRL(p.valor)}</span>
                      <button onClick={() => removerPassada(p.id)} className="text-red-500 hover:text-red-700 p-1" title="Remover">
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
          </div>
        </section>

        {/* ---- Coluna 3: totais e confirmação ---- */}
        <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            Totais e confirmação
          </h2>
          <div className="p-4">
            {/* Recebido (Títulos / Tarifa / Juros) */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Títulos', v: recTitulos },
                { l: 'Tarifa', v: recTarifa },
                { l: 'Juros', v: recJuros },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Recebido {x.l}</div>
                  <div className="font-mono tabular-nums font-semibold text-sm">{formatarBRL(x.v)}</div>
                </div>
              ))}
            </div>

            {/* Falta */}
            <div className="flex justify-between items-baseline mt-3">
              <span className="uppercase tracking-wide text-xs font-bold">
                Falta (a receber){parcial ? ' — parcial' : ''}
              </span>
              <span className={`font-mono tabular-nums text-2xl font-bold ${quitado ? 'text-emerald-600' : 'text-amber-600'}`}>
                {formatarBRL(falta)}
              </span>
            </div>
            {(faltaTarifa > 0.005 || faltaJuros > 0.005) && (
              <div className="text-[11px] text-gray-500 mt-1">
                Ainda falta lançar:{' '}
                {[
                  faltaTarifa > 0.005 ? `tarifa ${formatarBRL(faltaTarifa)}` : '',
                  faltaJuros > 0.005 ? `juros ${formatarBRL(faltaJuros)}` : '',
                ]
                  .filter(Boolean)
                  .join(' e ')}{' '}
                (escolha a forma de tarifa/juros no combo).
              </div>
            )}
            {parcial && (
              <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 mt-2">
                Principal <b>parcial</b>: o(s) título(s) ficam <b>em aberto</b> no restante (baixa em cascata).
              </div>
            )}

            {/* Baixar Juros (liberar taxa) — porte do Delphi UniContasR.BaixarJuros */}
            <div className="mt-3">
              {!liberarAberto ? (
                <button
                  type="button"
                  onClick={abrirLiberarJuros}
                  disabled={titulos.length === 0}
                  className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-40"
                  title="Autoriza uma taxa de juros (0 = isentar) para os títulos selecionados"
                >
                  Baixar juros (liberar taxa)…
                </button>
              ) : (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2">
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-100">
                    Baixar juros — {titulos.length} título(s)
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div>
                      <Label className="text-[11px]">Taxa liberada (% a.m.) — 0 isenta</Label>
                      <Input
                        value={liberarTaxa}
                        onChange={(e) => setLiberarTaxa(e.target.value)}
                        inputMode="decimal"
                        placeholder="ex: 0"
                        className="font-mono h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Data prevista de pagamento</Label>
                      <Input
                        type="date"
                        value={liberarData}
                        onChange={(e) => setLiberarData(e.target.value)}
                        className="font-mono h-9"
                      />
                    </div>
                  </div>
                  {/* Prévia: juros só incide sobre ATRASO até a data prevista (fiel ao Delphi) */}
                  <div className="text-[11px] rounded bg-white/70 dark:bg-slate-900/50 border border-blue-200 dark:border-blue-900 px-2 py-1.5">
                    {liberarPreview ? (
                      liberarPreview.dias > 0 ? (
                        <>
                          Nessa taxa, pagando em {fmtDataBR(liberarData)}:{' '}
                          <b>{liberarPreview.dias}</b> dia(s) de atraso → juros{' '}
                          <b className="text-amber-600">{formatarBRL(liberarPreview.juros)}</b> · total{' '}
                          <b>{formatarBRL(liberarPreview.total)}</b>
                        </>
                      ) : (
                        <span className="text-gray-500">
                          Título <b>em dia</b> nessa data (0 dia de atraso) → <b>sem juros</b>. O juros só incide após o vencimento.
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400">Informe taxa e data para ver a prévia do juros.</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px]">Motivo (mín. 15 caracteres)</Label>
                    <textarea
                      value={liberarMotivo}
                      onChange={(e) => setLiberarMotivo(e.target.value)}
                      rows={2}
                      className="w-full text-xs rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      placeholder="Justificativa da liberação de juros…"
                    />
                    <div className={`text-[10px] mt-0.5 ${liberarMotivo.trim().length < 15 ? 'text-red-600' : 'text-gray-400'}`}>
                      {liberarMotivo.trim().length}/15
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setLiberarAberto(false)}
                      className="text-xs px-3 h-8 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmarLiberarJuros}
                      disabled={liberando}
                      className="text-xs px-3 h-8 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      {liberando ? 'Liberando…' : 'Confirmar liberação'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Autoriza a taxa para o próximo recebimento (registra usuário, data e motivo). Não recebe o título.
                  </p>
                </div>
              )}
            </div>

            {/* Conta operador + depósito + simulação */}
            <div className="mt-4 grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Conta (operador)</Label>
                <Input value={codConta} readOnly placeholder="—" className="font-mono bg-gray-50 dark:bg-slate-800" />
                {!codConta && <p className="text-[11px] text-red-600 mt-1">Operador sem conta — configure no cadastro.</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 h-6 cursor-pointer select-none mb-1">
                  <input
                    type="checkbox"
                    checked={deposito}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDeposito(on);
                      if (!on) setDataPgto(hojeISO);
                      if (on && forma === 'dinheiro') setForma('credito');
                    }}
                  />
                  <span className="text-sm font-medium">Depósito</span>
                </label>
                <Input
                  type="date"
                  value={dataPgto}
                  max={hojeISO}
                  disabled={!deposito}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDataPgto(v && v > hojeISO ? hojeISO : v || hojeISO);
                  }}
                  className="font-mono disabled:opacity-50"
                />
              </div>
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={simular} onChange={(e) => setSimular(e.target.checked)} />
                <span className="text-sm font-medium">Modo simulação</span>
              </label>
            </div>

            <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2.5">
              Com <b>Modo simulação</b> ligado, nada é gravado — mostra só a prévia. A baixa é{' '}
              <b>independente</b> do caixa físico.
            </div>

            {/* Prévia da simulação */}
            {previa?.simulado && (
              <div className="mt-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-3 text-sm">
                <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  🧪 Simulação (nada gravado) — {(previa.resultados || []).length} título(s)
                </div>
                {(previa.resultados || []).map((r: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[13px]">
                    <span className="font-mono">{r.cod_receb}</span>
                    <span className={`font-semibold ${r.baixa?.rec === 'S' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {r.baixa?.rec === 'S' ? 'quitado' : 'parcial'}
                      {r.baixa?.principalRecebido != null && ` · ${formatarBRL(r.baixa.principalRecebido)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
                Fechar
              </Button>
              <Button type="button" onClick={receberEDarBaixa} disabled={salvando || passadas.length === 0}>
                {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {simular ? 'Simular Recebimento' : 'Confirmar Recebimento'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
