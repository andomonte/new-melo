'use client';

import { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectPadrao from '@/components/common/SelectPadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { mascaraInputBRL, desmascarar, formatarBRL, formatarDecimalBR } from '@/utils/monetario';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';
import { useSessaoCaixa } from '@/hooks/useSessaoCaixa';
import CaixaSessaoBar from '@/components/corpo/caixa/CaixaSessaoBar';
import { registrarRecebimento } from '@/data/caixa/sessao';
import type { FormaPagamentoSessao } from '@/data/caixa/sessao';
import { faturarPreVenda, type DetalhesPreVenda } from '@/data/caixa/faturarPreVenda';
import {
  Search,
  CreditCard,
  Banknote,
  QrCode,
  Trash2,
  Loader2,
  Landmark,
  FileText,
  X,
  Printer,
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
  forma_fat?: string | null; // '6' = título "cartão a receber da operadora" (regra Delphi: isolado)
  parcelaLabel?: string; // ex: "1/3" (derivado no front)
}

type Forma = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'deposito' | 'credito_devolucao';

// mapeia a forma do recebimento → forma do movimento da sessão de caixa
const MAP_FORMA_SESSAO: Record<Forma, FormaPagamentoSessao> = {
  dinheiro: 'DINHEIRO',
  credito: 'CREDITO',
  debito: 'DEBITO',
  pix: 'PIX',
  deposito: 'OUTRO',
  credito_devolucao: 'OUTRO',
};

// mapeia o código real da dbforma_pagto → comportamento interno da UI.
// (04 CARTAO cai em crédito por padrão; a UI oferece o toggle crédito/débito.)
const CAT_POR_CODFPGT: Record<string, Forma> = {
  '01': 'dinheiro',
  '04': 'credito',
  '05': 'credito_devolucao',
  '09': 'deposito',
  '42': 'pix',
};

// Baldes do recebimento por código de forma (rateio do SysCaixa):
const TIPOS_TARIFA_FPGT = ['06', '07', '08', '15', '32', '44'];
const TIPOS_JUROS_FPGT = ['18', '20', '21', '22', '23', '25', '26', '43'];
function bucketDaForma(codfpgt?: string): 'tarifa' | 'juros' | 'principal' {
  if (codfpgt && TIPOS_TARIFA_FPGT.includes(codfpgt)) return 'tarifa';
  if (codfpgt && TIPOS_JUROS_FPGT.includes(codfpgt)) return 'juros';
  return 'principal';
}

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
  cofId?: number; // conta financeira (cad_conta_financeira.cof_id)
  cofDescricao?: string;
  codfpgt?: string; // código real da forma (dbforma_pagto.codfpgt) → dbfreceb.tipo
}

const FORMAS: { key: Forma; label: string; icon: React.ElementType }[] = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'credito', label: 'Crédito', icon: CreditCard },
  { key: 'debito', label: 'Débito', icon: CreditCard },
  { key: 'pix', label: 'PIX', icon: QrCode },
];

const OPCOES_VEZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Venda já faturada com NF autorizada — para reimprimir a nota no caixa
interface Emitida {
  nrovenda: string;
  codcli: string;
  nome_cliente: string;
  data: string;
  codfat: string;
  nrodoc: string;
  chave: string;
  modelo: string;
}

// Pré-venda faturável (dbvenda) — busca no caixa para faturar
interface PreVenda {
  codvenda: string;
  nrovenda: string;
  data: string;
  codvend: string;
  codcli: string;
  nome_cliente: string;
  total: number;
  tipo: string;
  status: string;
  doc: string | null;
}

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
  const [selecionados, setSelecionados] = useState<Titulo[]>([]);
  const [prevendas, setPrevendas] = useState<PreVenda[]>([]); // pré-vendas faturáveis achadas na busca
  const [preVendaSel, setPreVendaSel] = useState<PreVenda | null>(null); // pré-venda escolhida p/ faturar+receber
  const [preVendaDetalhes, setPreVendaDetalhes] = useState<DetalhesPreVenda | null>(null); // dados p/ faturar
  const [progresso, setProgresso] = useState<string | null>(null); // etapa atual do faturar+emitir+receber
  const [emitidas, setEmitidas] = useState<Emitida[]>([]); // vendas já faturadas (reimprimir)
  const [notaView, setNotaView] = useState<{ url: string; titulo: string } | null>(null); // visualizador da DANFE
  const [imprimindo, setImprimindo] = useState(false);

  // ---- Estado: operadoras ----
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);

  // ---- Estado: formulário de pagamento ----
  const [forma, setForma] = useState<Forma>('credito');
  const [operadoraSel, setOperadoraSel] = useState('');
  const [vezes, setVezes] = useState('1');
  const [valorPassada, setValorPassada] = useState('');
  const [cvnsu, setCvnsu] = useState('');
  const [autorizacao, setAutorizacao] = useState('');

  // ---- Estado: contas financeiras (classificação do recebimento) ----
  type ContaFin = { cof_id: number; cof_descricao: string; centro_custo: string | null };
  const [contasFin, setContasFin] = useState<ContaFin[]>([]);
  const [cofId, setCofId] = useState(''); // conta financeira escolhida p/ o pagamento (principal)

  // ---- Estado: formas de pagamento (combo data-driven — tabela real dbforma_pagto) ----
  type FormaCat = { codfpgt: string; descricao: string };
  const [formasPag, setFormasPag] = useState<FormaCat[]>([]);
  const [codFpgt, setCodFpgt] = useState('01'); // código da forma selecionado no combo

  // ---- Estado: passadas / salvar ----
  const [passadas, setPassadas] = useState<Passada[]>([]);
  const [salvando, setSalvando] = useState(false);

  // ---- Estado: novo motor (juros + receber) ----
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [dadosMap, setDadosMap] = useState<Record<string, any>>({}); // cod_receb -> {principalPendente, juros, ...}
  const [codConta, setCodConta] = useState(''); // conta do operador — vem do login (user.cod_conta)
  const [deposito, setDeposito] = useState(false); // flag Depósito (Delphi): data ≤ hoje + bloqueia dinheiro
  const [dataPgto, setDataPgto] = useState(hojeISO); // data de pagamento/depósito (≤ hoje) — base do juros
  const [simular, setSimular] = useState(true); // começa em simulação (seguro)
  const [previa, setPrevia] = useState<any | null>(null); // resultado do dry-run

  const ehCartao = forma === 'credito' || forma === 'debito';
  const formaBucket = bucketDaForma(codFpgt); // 'principal' | 'tarifa' | 'juros'

  // Conta do operador vem do login (user.cod_conta = tb_user_perfil.cod_conta da filial).
  // Fallback: se a sessão ainda não trouxe o cod_conta (login feito antes do campo),
  // busca direto do endpoint — evita ter que deslogar/reselecionar a filial.
  useEffect(() => {
    if (user?.cod_conta) {
      setCodConta(String(user.cod_conta));
      return;
    }
    if (user?.usuario && user?.filial) {
      fetch(
        `/api/perfilFilial/get?user_login_id=${encodeURIComponent(
          user.usuario,
        )}&nome_filial=${encodeURIComponent(user.filial)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCodConta(d?.cod_conta ? String(d.cod_conta) : ''))
        .catch(() => setCodConta(''));
    } else {
      setCodConta('');
    }
  }, [user?.cod_conta, user?.usuario, user?.filial]);

  // Sessão de caixa (abertura/fechamento) — camada por cima, não altera o recebimento
  const sessaoCaixa = useSessaoCaixa(user?.filial, codConta, username);
  const caixaGate = sessaoCaixa.pronto && !sessaoCaixa.indisponivel && !sessaoCaixa.aberto;

  // Carregar operadoras de cartão
  useEffect(() => {
    fetch('/api/operadoras')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setOperadoras(data);
      })
      .catch((err) => console.error('Erro ao carregar operadoras:', err));
  }, []);

  // Carregar contas financeiras (classificação do recebimento)
  useEffect(() => {
    fetch('/api/caixa/contas-financeiras')
      .then((r) => (r.ok ? r.json() : { contas: [] }))
      .then((d) => setContasFin(Array.isArray(d?.contas) ? d.contas : []))
      .catch((err) => console.error('Erro ao carregar contas financeiras:', err));
  }, []);

  // Carregar formas de pagamento (combo)
  useEffect(() => {
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
      .catch((err) => console.error('Erro ao carregar formas de pagamento:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao (des)selecionar títulos, busca juros/dias/valor a receber de TODOS (motor validado)
  useEffect(() => {
    setPrevia(null);
    if (selecionados.length === 0) {
      setDadosMap({});
      return;
    }
    fetch('/api/caixa/dados-recebimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cod_receb: selecionados.map((t) => t.cod_receb),
        dataPgto,
      }),
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
  }, [selecionados, dataPgto]);

  const estaSelecionado = (t: Titulo) => selecionados.some((x) => x.cod_receb === t.cod_receb);
  const toggleTitulo = (t: Titulo) => {
    if (preVendaSel) {
      // receber título e faturar pré-venda são exclusivos
      setPreVendaSel(null);
      setPreVendaDetalhes(null);
      setValorPassada('');
    }
    const jaSel = selecionados.some((x) => x.cod_receb === t.cod_receb);
    if (!jaSel && selecionados.length > 0) {
      // Regra do caixa (Delphi): todos os títulos devem ser do MESMO cliente.
      if (selecionados[0].codcli !== t.codcli) {
        toast.error(`Só é possível receber títulos do MESMO cliente. Este é de "${t.nome_cliente || t.codcli}".`);
        return;
      }
      // Regra Delphi: título "cartão a receber da operadora" (forma_fat=6) deve ser recebido isolado.
      if (String(t.forma_fat) === '6' || selecionados.some((x) => String(x.forma_fat) === '6')) {
        toast.error('Título de cartão (a receber da operadora) deve ser recebido isoladamente.');
        return;
      }
    }
    setPassadas([]);
    setSelecionados((prev) =>
      prev.some((x) => x.cod_receb === t.cod_receb)
        ? prev.filter((x) => x.cod_receb !== t.cod_receb)
        : [...prev, t],
    );
  };

  // ---- Derivados (somam todos os títulos selecionados) ----
  // Principal pendente = base do recebimento; juros/tarifa são adicionais (cobrados à parte).
  const principalPend = useMemo(() => {
    // Pré-venda: o principal a receber é o total da venda (à vista, sem juros/tarifa)
    if (preVendaSel) return Number(preVendaSel.total || 0);
    return selecionados.reduce((s, t) => {
      const d = dadosMap[t.cod_receb];
      return (
        s +
        (d
          ? Number(d.principalPendente || 0)
          : Math.max(0, Number(t.valor_original || 0) - Number(t.valor_recebido || 0)))
      );
    }, 0);
  }, [selecionados, dadosMap, preVendaSel]);
  const jurosVal = useMemo(
    () => selecionados.reduce((s, t) => s + Number(dadosMap[t.cod_receb]?.juros || 0), 0),
    [selecionados, dadosMap],
  );
  const tarifaVal = useMemo(
    () => selecionados.reduce((s, t) => s + Number(dadosMap[t.cod_receb]?.tarifa || 0), 0),
    [selecionados, dadosMap],
  );
  const totalReceber = principalPend + jurosVal + tarifaVal; // "A receber" (Total = principal + juros + tarifa)

  // Rateio do SysCaixa: cada forma cai num balde (principal / tarifa / juros).
  // A Falta conta a partir do Total a Receber (título + juros + tarifa).
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
  const recebido = recTitulos; // principal recebido (base da baixa/guard)
  const recebidoTotal = recTitulos + recTarifa + recJuros;
  const falta = Math.max(0, totalReceber - recebidoTotal);
  const faltaTarifa = Math.max(0, tarifaVal - recTarifa);
  const faltaJuros = Math.max(0, jurosVal - recJuros);
  const quitado = totalReceber > 0 && recebidoTotal >= totalReceber - 0.005;
  const parcial = recTitulos > 0 && recTitulos < principalPend - 0.005;
  const podeReceber = recebidoTotal > 0;

  // ---- Buscar título ----
  const buscar = async () => {
    const termo = busca.trim();
    if (!termo) {
      toast.info('Digite o número do documento ou nota para buscar.');
      return;
    }
    try {
      setBuscando(true);
      setSelecionados([]);
      setPassadas([]);
      setPrevendas([]);
      setEmitidas([]);
      setPreVendaSel(null);
      // Sem filtro de status: precisa achar tanto pendentes quanto VENCIDOS.
      // O front filtra os já recebidos/cancelados (cancel/rec) logo abaixo.
      const params = new URLSearchParams({
        search: termo,
        // Limite alto: a API ordena pendentes antes de vencidos; com 30 os VENCIDOS ficavam
        // de fora. O Caixa precisa dos vencidos (reordenados abaixo, vencido primeiro).
        limit: '300',
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
      // Caixa: VENCIDOS primeiro (mais antigos no topo), depois a vencer — ambos por data.
      // Vencido = dt_venc < hoje (data local, sem shift de fuso).
      const hoje = new Date();
      const hojeLocal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const vencStr = (t: Titulo) => String(t.dt_venc || '').slice(0, 10);
      lista.sort((a, b) => {
        const oa = vencStr(a) && vencStr(a) < hojeLocal ? 0 : 1;
        const ob = vencStr(b) && vencStr(b) < hojeLocal ? 0 : 1;
        if (oa !== ob) return oa - ob; // vencidos primeiro
        const dv = vencStr(a).localeCompare(vencStr(b)); // por vencimento asc
        return dv !== 0 ? dv : String(a.nro_doc || a.cod_receb || '').localeCompare(String(b.nro_doc || b.cod_receb || ''));
      });
      // Derivar parcela "i/N": agrupa por fatura (cod_fat) ou prefixo do nro_doc (sem letra final)
      const grupoKey = (t: Titulo) =>
        (t.cod_fat && String(t.cod_fat).trim()) ||
        String(t.nro_doc || '').replace(/[A-Za-z]+$/, '') ||
        t.cod_receb;
      const grupos: Record<string, Titulo[]> = {};
      lista.forEach((t) => {
        const k = grupoKey(t);
        (grupos[k] ||= []).push(t);
      });
      Object.values(grupos).forEach((g) => {
        g.sort((a, b) => String(a.dt_venc || '').localeCompare(String(b.dt_venc || '')));
        g.forEach((t, i) => {
          t.parcelaLabel = g.length > 1 ? `${i + 1}/${g.length}` : '';
        });
      });
      setTitulos(lista);

      // Também busca PRÉ-VENDAS faturáveis (faturar) e vendas JÁ EMITIDAS (reimprimir)
      let pv: PreVenda[] = [];
      let em: Emitida[] = [];
      try {
        const rp = await fetch(`/api/caixa/buscar-prevenda?termo=${encodeURIComponent(termo)}`);
        const dp = await rp.json();
        if (rp.ok) {
          pv = dp.prevendas || [];
          em = dp.emitidas || [];
        }
      } catch {
        /* silencioso: pré-venda/emitida é complemento da busca de título */
      }
      setPrevendas(pv);
      setEmitidas(em);

      if (lista.length === 0 && pv.length === 0 && em.length === 0) {
        toast.info('Nada encontrado (título, pré-venda ou nota) para essa busca.');
      } else if (lista.length === 1 && pv.length === 0) {
        setSelecionados([lista[0]]);
      }
    } catch (err: any) {
      toast.error(`Erro ao buscar: ${err.message}`);
    } finally {
      setBuscando(false);
    }
  };

  // ---- Adicionar passada ----
  const adicionarPassada = () => {
    if (selecionados.length === 0 && !preVendaSel) {
      toast.error('Selecione um título ou pré-venda antes de adicionar o pagamento.');
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
    // Regra Delphi: conta financeira é obrigatória em toda forma de pagamento.
    if (!cofId) {
      toast.error('Selecione a Conta Financeira.');
      return;
    }
    // Regra Delphi: com Depósito marcado, dinheiro é bloqueado (só cartão/PIX/depósito/boleto).
    if (deposito && forma === 'dinheiro') {
      toast.error('Com Depósito marcado não dá pra receber em dinheiro — use cartão, PIX ou depósito.');
      return;
    }
    // Rateio do SysCaixa: cada balde (principal/tarifa/juros) tem seu próprio saldo.
    const bucket = bucketDaForma(codFpgt);
    const limite =
      bucket === 'tarifa' ? faltaTarifa : bucket === 'juros' ? faltaJuros : principalPend - recTitulos;
    const nomeBucket = bucket === 'tarifa' ? 'a tarifa' : bucket === 'juros' ? 'o juros' : 'o principal';
    const nomeBucketCap = bucket === 'tarifa' ? 'A tarifa' : bucket === 'juros' ? 'O juros' : 'O principal';
    // Tarifa: só depois de existir um pagamento principal (regra Delphi).
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
    // limpar campos da passada
    setValorPassada('');
    setCvnsu('');
    setAutorizacao('');
  };

  const removerPassada = (id: number) =>
    setPassadas((prev) => prev.filter((p) => p.id !== id));

  // ---- Receber e dar baixa (motor novo, com simulação) ----
  const receberEDarBaixa = async () => {
    if (selecionados.length === 0) return;
    if (passadas.length === 0) {
      toast.error('Adicione ao menos uma forma de pagamento.');
      return;
    }
    if (!codConta.trim()) {
      toast.error('Informe a conta do operador.');
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

    // Se o PRINCIPAL não é totalmente coberto, o título fica ABERTO (parcial) — confirma no salvamento real.
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
      // juros/tarifa efetivamente lançados (baldes) rateados por título (proporcional ao valor de cada um).
      const titulosPayload = selecionados.map((t) => {
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
      // pagamentos = SÓ as formas de principal (tarifa/juros vão pelos escalares acima).
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
        // Registra os movimentos de RECEBIMENTO na sessão aberta (auditoria + saldo da gaveta).
        // Falha aqui não desfaz a baixa: o movimento é só a camada de caixa (não gate).
        try {
          await registrarRecebimento({
            filial: user?.filial || '',
            cod_conta: codConta.trim(),
            operador: username,
            movimentos: passadas.map((p) => ({
              forma_pagamento: MAP_FORMA_SESSAO[p.forma],
              valor: p.valor,
              referencia: titulosPayload.map((t) => t.cod_receb).join(','),
            })),
          });
          await sessaoCaixa.refresh();
        } catch {
          /* silencioso: a baixa já foi confirmada */
        }
        setPassadas([]);
        setPrevia(null);
        await buscarNovamente(selecionados.map((t) => t.cod_receb));
      }
    } catch (err: any) {
      toast.error(`Erro ao receber: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // Recarrega os títulos após a baixa (remove os quitados, atualiza os parciais)
  const buscarNovamente = async (codRecebs: string[]) => {
    for (const codReceb of codRecebs) {
      try {
        const resp = await fetch(`/api/contas-receber/${codReceb}`);
        if (!resp.ok) {
          setSelecionados((prev) => prev.filter((t) => t.cod_receb !== codReceb));
          setTitulos((prev) => prev.filter((t) => t.cod_receb !== codReceb));
          continue;
        }
        const t = await resp.json();
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
        // Quitado sai da seleção/lista; parcial permanece atualizado
        setSelecionados((prev) =>
          atualizado.rec === 'S'
            ? prev.filter((x) => x.cod_receb !== codReceb)
            : prev.map((x) => (x.cod_receb === codReceb ? atualizado : x)),
        );
        setTitulos((prev) =>
          prev.map((x) => (x.cod_receb === codReceb ? atualizado : x)).filter((x) => x.rec !== 'S'),
        );
      } catch {
        /* silencioso: baixa já foi confirmada */
      }
    }
  };

  // Selecionar pré-venda para faturar+receber (mutuamente exclusivo com títulos).
  // Busca os detalhes da venda (dados p/ faturar + total REAL da fatura = totalGeral).
  const selecionarPreVenda = async (pv: PreVenda) => {
    if (preVendaSel?.codvenda === pv.codvenda) {
      setPreVendaSel(null);
      setPreVendaDetalhes(null);
      setValorPassada('');
      return;
    }
    setSelecionados([]);
    setPassadas([]);
    setPrevia(null);
    setPreVendaSel(pv);
    setPreVendaDetalhes(null);
    setValorPassada('');
    try {
      const r = await fetch(`/api/faturamento/detalhes-venda?nrovenda=${encodeURIComponent(pv.nrovenda)}`);
      const d = await r.json();
      if (r.ok && d?.resumoFinanceiro) {
        setPreVendaDetalhes({
          dbclien: d.dbclien,
          dbvenda: d.dbvenda,
          dbitvenda: d.dbitvenda,
          resumoFinanceiro: d.resumoFinanceiro,
        });
        // usa o total da FATURA (totalGeral), que pode diferir do total da lista
        const totalFat = Number(d.resumoFinanceiro.totalGeral ?? pv.total);
        setPreVendaSel({ ...pv, total: totalFat });
        // pré-preenche o valor a pagar com o total (caso comum: paga tudo de uma forma)
        setValorPassada(formatarDecimalBR(totalFat));
      } else {
        toast.error('Não foi possível carregar os itens da pré-venda.');
      }
    } catch {
      toast.error('Erro ao carregar a pré-venda.');
    }
  };

  // Faturar pré-venda no caixa: faturar → emitir NF → receber (nasce baixado). Rollback se falhar.
  const faturarEReceber = async () => {
    if (!preVendaSel) return;
    if (!preVendaDetalhes) {
      toast.error('Aguarde carregar os dados da pré-venda.');
      return;
    }
    if (passadas.length === 0) {
      toast.error('Adicione ao menos uma forma de pagamento.');
      return;
    }
    if (!codConta.trim()) {
      toast.error('Sem conta de operador.');
      return;
    }
    setSalvando(true);
    setProgresso('Iniciando…');
    try {
      // 1) faturar + emitir NF (com rollback interno em caso de falha)
      const r = await faturarPreVenda({
        detalhes: preVendaDetalhes,
        codConta: codConta.trim(),
        username,
        onStep: setProgresso,
      });
      // 2) receber o título gerado (nasce baixado conforme o pago)
      setProgresso('Recebendo o pagamento…');
      const resp = await fetch('/api/caixa/receber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_receb: r.cod_receb,
          dataPgto,
          cod_conta: codConta.trim(),
          username,
          principalPendente: r.valorTitulo,
          pagamentos: passadas
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
            })),
        }),
      });
      const dr = await resp.json();
      if (!resp.ok) throw new Error(dr.detalhes || dr.erro || 'Fatura/NF ok, mas falhou ao receber o título.');

      // 3) registra o movimento na sessão de caixa (auditoria + saldo da gaveta)
      try {
        await registrarRecebimento({
          filial: user?.filial || '',
          cod_conta: codConta.trim(),
          operador: username,
          movimentos: passadas.map((p) => ({
            forma_pagamento: MAP_FORMA_SESSAO[p.forma],
            valor: p.valor,
            referencia: r.cod_receb,
          })),
        });
        await sessaoCaixa.refresh();
      } catch {
        /* silencioso */
      }

      toast.success(`Faturado e recebido! Fatura ${r.codfat} · NF-e ${r.nfe.modelo} autorizada.`);
      // TODO(próximo): imprimir DANFE silenciosa (QZ Tray) usando r.nfe.pdfBase64
      setPreVendaSel(null);
      setPreVendaDetalhes(null);
      setPassadas([]);
      setPrevendas([]);
      setBusca('');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  };

  // Reimprimir: abre o PDF para VISUALIZAR; só imprime se confirmar (pode querer só conferir)
  const verReimprimir = async (em: Emitida) => {
    try {
      const r = await fetch(`/api/faturamento/pdf-nota?codfat=${encodeURIComponent(em.codfat)}`);
      const d = await r.json();
      if (!r.ok || !d.pdfBase64) throw new Error(d.error || 'PDF da nota não encontrado.');
      const bin = atob(d.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setNotaView({ url, titulo: `${d.tipoDocumento || 'NF'} nº ${em.nrodoc} — ${em.nome_cliente}` });
    } catch (e: any) {
      toast.error(`Não foi possível abrir a nota: ${e.message}`);
    }
  };

  const fecharNota = () => {
    if (notaView) URL.revokeObjectURL(notaView.url);
    setNotaView(null);
  };

  const imprimirNota = () => {
    if (!notaView) return;
    pedirConfirmacao(
      () => {
        // Impressão via iframe oculto (o QZ Tray silencioso entra aqui depois).
        setImprimindo(true);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = notaView.url;
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            /* ignore */
          }
          setTimeout(() => {
            iframe.remove();
            setImprimindo(false);
          }, 1000);
        };
        document.body.appendChild(iframe);
      },
      { title: 'Imprimir nota', message: 'Enviar a nota para a impressora?', type: 'info' },
    );
  };

  // Data-only (DATE) sem shift de fuso: 'YYYY-MM-DD'|ISO -> 'DD/MM/YYYY'.
  // new Date(iso) interpreta como UTC e recua 1 dia em America/Manaus (UTC-4) — venc aparecia -1.
  const fmtData = (d: string | null) => {
    if (!d) return '-';
    const [y, m, dd] = String(d).slice(0, 10).split('-');
    if (y && m && dd) return `${dd}/${m}/${y}`;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
  };

  // Badge de status igual à Contas a Receber (vencido vermelho, pendente âmbar, parcial azul).
  const statusChip = (s?: string | null): { t: string; c: string } | null => {
    switch (s) {
      case 'vencido':
        return { t: 'Vencido', c: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
      case 'pendente':
        return { t: 'Pendente', c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
      case 'recebido_parcial':
        return { t: 'Parcial', c: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
      default:
        return null;
    }
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
        <div className="w-full max-w-[1700px] mx-auto">
          {/* NOVO: barra de abertura/fechamento — encaixa em cima, não altera o recebimento */}
          {codConta && !sessaoCaixa.indisponivel && (
            <CaixaSessaoBar
              s={sessaoCaixa}
              filial={user?.filial || ''}
              codConta={codConta}
              operador={username}
            />
          )}
          <div className="relative">
            {/* Véu de bloqueio enquanto o caixa não está aberto (gate visual do recebimento) */}
            {caixaGate && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/60 dark:bg-slate-900/70 backdrop-blur-[1.5px]">
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg rounded-2xl px-7 py-6 text-center max-w-sm">
                  <div className="text-3xl">🔒</div>
                  <div className="font-bold mt-1.5">
                    {sessaoCaixa.emFechamento ? 'Caixa em fechamento' : 'Caixa fechado'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {sessaoCaixa.emFechamento
                      ? 'Conclua a conferência (Continuar fechamento) ou cancele para voltar a receber.'
                      : 'Abra o caixa (com o fundo de troco) para iniciar o recebimento.'}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 items-start">
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setBusca(v);
                      // Ao limpar o filtro, some com a lista e a seleção (não deixa resultado velho).
                      if (!v.trim()) {
                        setTitulos([]);
                        setSelecionados([]);
                        setPrevendas([]);
                        setEmitidas([]);
                        setPreVendaSel(null);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && buscar()}
                    placeholder="Nº do documento, nota, nome ou código do cliente"
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

                {/* Resultados — seleção MÚLTIPLA (marque os títulos a receber) */}
                {titulos.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {titulos.length} título(s) — marque os que vai receber
                    </div>
                    {titulos.map((t) => {
                      const sel = estaSelecionado(t);
                      const d = dadosMap[t.cod_receb];
                      const principal = d
                        ? Number(d.principalPendente || 0)
                        : Number(t.valor_original || 0) - Number(t.valor_recebido || 0);
                      return (
                        <button
                          key={t.cod_receb}
                          onClick={() => toggleTitulo(t)}
                          className={`w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            sel
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                              : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                        >
                          <input type="checkbox" readOnly checked={sel} className="pointer-events-none" />
                          <span className="flex flex-col leading-tight min-w-[128px]">
                            <span className="font-mono">
                              {t.nro_doc || t.cod_receb}
                              {t.parcelaLabel && (
                                <span className="ml-1 text-[10px] text-blue-600 font-bold">{t.parcelaLabel}</span>
                              )}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className={`text-[11px] ${t.status === 'vencido' ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                                venc {fmtData(t.dt_venc)}
                              </span>
                              {(() => {
                                const chip = statusChip(t.status);
                                return chip ? (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${chip.c}`}>{chip.t}</span>
                                ) : null;
                              })()}
                            </span>
                          </span>
                          <span className="truncate flex-1 text-gray-500">
                            {t.nome_cliente}
                            {t.codcli && <span className="text-gray-400"> - {t.codcli}</span>}
                          </span>
                          {d && Number(d.juros) > 0 && (
                            <span className="text-[11px] text-amber-600">+j {formatarBRL(Number(d.juros))}</span>
                          )}
                          <span className="font-mono tabular-nums font-semibold">{formatarBRL(principal)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pré-vendas faturáveis — selecione e escolha a forma; o botão vira "Faturar e receber" */}
                {prevendas.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {prevendas.length} pré-venda(s) a faturar — selecione uma
                    </div>
                    {prevendas.map((pv) => {
                      const sel = preVendaSel?.codvenda === pv.codvenda;
                      return (
                        <button
                          key={pv.codvenda}
                          onClick={() => selecionarPreVenda(pv)}
                          className={`w-full text-left flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            sel
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                              : 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                          }`}
                        >
                          <input type="radio" readOnly checked={sel} className="pointer-events-none accent-emerald-600" />
                          <span className="flex flex-col leading-tight min-w-[120px]">
                            <span className="font-mono">{pv.nrovenda}</span>
                            <span className="text-[11px] text-gray-400">
                              {fmtData(pv.data)} · {pv.doc && pv.doc.replace(/\D/g, '').length > 11 ? 'NF-e' : 'NFC-e'}
                            </span>
                          </span>
                          <span className="truncate flex-1 text-gray-600 dark:text-gray-300">
                            {pv.nome_cliente}
                            {pv.codcli && <span className="text-gray-400"> - {pv.codcli}</span>}
                          </span>
                          <span className="font-mono tabular-nums font-semibold">{formatarBRL(pv.total)}</span>
                        </button>
                      );
                    })}
                    {preVendaSel && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                        Faturando <b>{preVendaSel.nrovenda}</b> — escolha a forma de pagamento à direita e clique em{' '}
                        <b>Faturar e receber</b>.
                      </p>
                    )}
                  </div>
                )}

                {/* Vendas já faturadas — reimprimir a nota */}
                {emitidas.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {emitidas.length} nota(s) já emitida(s)
                    </div>
                    {emitidas.map((em) => (
                      <div
                        key={em.codfat}
                        className="w-full flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 px-3 py-2 text-sm"
                      >
                        <span className="flex flex-col leading-tight min-w-[120px]">
                          <span className="font-mono">{em.nrovenda}</span>
                          <span className="text-[11px] text-gray-400">
                            {em.modelo === '65' ? 'NFC-e' : 'NF-e'} nº {em.nrodoc}
                          </span>
                        </span>
                        <span className="truncate flex-1 text-gray-600 dark:text-gray-300">
                          {em.nome_cliente}
                          {em.codcli && <span className="text-gray-400"> - {em.codcli}</span>}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ✓ emitida
                        </span>
                        <button
                          onClick={() => verReimprimir(em)}
                          className="shrink-0 inline-flex items-center gap-1.5 font-semibold text-xs rounded-lg px-3 py-1.5 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          Ver / Reimprimir
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumo dos selecionados */}
                {selecionados.length > 0 && (
                  <div className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                      <Campo label="Títulos" valor={String(selecionados.length)} />
                      <Campo
                        label="Cliente"
                        valor={`${selecionados[0]?.nome_cliente || '-'}${
                          selecionados[0]?.codcli ? ' - ' + selecionados[0].codcli : ''
                        }`}
                      />
                      <Campo label="Principal" valor={formatarBRL(principalPend)} mono />
                      <Campo label="A receber" valor={formatarBRL(totalReceber)} mono big />
                    </div>

                    <table className="w-full mt-4 text-sm border-collapse">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-gray-400 text-left">
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700">Título</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700">Vencimento</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700 text-right">Principal</th>
                          <th className="py-2 border-b border-gray-200 dark:border-slate-700 text-right">Juros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selecionados.map((t) => {
                          const d = dadosMap[t.cod_receb];
                          const principal = d
                            ? Number(d.principalPendente || 0)
                            : Number(t.valor_original || 0) - Number(t.valor_recebido || 0);
                          return (
                            <tr key={t.cod_receb}>
                              <td className="py-2 font-mono">
                                {t.nro_doc || t.cod_receb}
                                {t.parcelaLabel && (
                                  <span className="ml-1 text-[10px] text-blue-600 font-bold">{t.parcelaLabel}</span>
                                )}
                              </td>
                              <td className="py-2">{fmtData(t.dt_venc)}</td>
                              <td className="py-2 text-right font-mono tabular-nums">{formatarBRL(principal)}</td>
                              <td className="py-2 text-right font-mono tabular-nums text-amber-600">
                                {formatarBRL(Number(d?.juros || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-500 mt-2">
                      Títulos do <b>faturamento</b>. O pagamento é distribuído entre eles (cascata); <b>cartão</b> só em 1
                      título.
                    </p>
                  </div>
                )}

                {titulos.length === 0 && prevendas.length === 0 && emitidas.length === 0 && (
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
                {/* Combo de forma de pagamento (tabela real dbforma_pagto — buscável por código e nome) */}
                <div>
                  <Label>Forma de Pagamento</Label>
                  <SelectPadrao
                    searchable
                    value={codFpgt}
                    onValueChange={(cod) => {
                      // grupo de comportamento p/ juros/tarifa/cartão (o tipo real = codfpgt)
                      const cat: Forma = cod === '04' ? 'credito' : cod === '42' ? 'pix' : 'dinheiro';
                      // Depósito bloqueia dinheiro (regra Delphi)
                      if (deposito && cod === '01') {
                        toast.error('Com Depósito marcado não dá pra receber em dinheiro.');
                        return;
                      }
                      setCodFpgt(cod);
                      setForma(cat);
                      // Tarifa/juros: valor travado no restante e conta financeira fixa (161/160), igual ao SysCaixa
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
                    options={formasPag.map((f) => ({
                      value: f.codfpgt,
                      label: `${f.codfpgt} — ${f.descricao}`,
                    }))}
                  />
                </div>

                {/* Formulário */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="col-span-2">
                    <Label>
                      Conta Financeira
                      {formaBucket === 'tarifa' && ' (tarifa → 161, fixa)'}
                      {formaBucket === 'juros' && ' (juros → 160, fixa)'}
                    </Label>
                    {/* Searchable: filtra por código e nome (o texto da opção inclui os dois). */}
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
                      {formaBucket === 'tarifa' ? 'Valor da tarifa (R$)' : formaBucket === 'juros' ? 'Valor do juros (R$)' : 'Valor principal (R$)'}
                    </Label>
                    <Input
                      value={valorPassada}
                      onChange={(e) => setValorPassada(mascaraInputBRL(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && adicionarPassada()}
                      placeholder="0,00"
                      readOnly={formaBucket === 'tarifa'}
                      title={formaBucket === 'tarifa' ? 'Tarifa é valor fixo do título (não editável)' : undefined}
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
                          <span
                            className={`px-2 py-1 rounded text-white text-[9px] font-black uppercase ${
                              bucketDaForma(p.codfpgt) === 'tarifa'
                                ? 'bg-purple-700'
                                : bucketDaForma(p.codfpgt) === 'juros'
                                ? 'bg-amber-700'
                                : 'bg-blue-700'
                            }`}
                          >
                            {bucketDaForma(p.codfpgt) === 'tarifa'
                              ? 'TAR'
                              : bucketDaForma(p.codfpgt) === 'juros'
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
                                  tx {p.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% → líq{' '}
                                  {formatarBRL(liq)}
                                  {(p.cvnsu || p.autorizacao) &&
                                    ` · ${[p.cvnsu && 'CV ' + p.cvnsu, p.autorizacao && 'Aut ' + p.autorizacao]
                                      .filter(Boolean)
                                      .join(' / ')}`}
                                </small>
                              </>
                            ) : (
                              <>
                                {formasPag.find((f) => f.codfpgt === p.codfpgt)?.descricao ??
                                  (p.forma === 'pix' ? 'PIX' : 'Dinheiro')}
                              </>
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

                {/* Composição do recebimento — igual ao SysCaixa:
                    Valor Principal + Juros = Total do Título + Tarifa = Total a Receber */}
                <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-3">
                  {selecionados.length > 0 && (
                    <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Valor Principal ({selecionados.length} tít.)</span>
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
                  )}

                  {/* Valor Recebido (Títulos / Tarifa / Juros) — igual ao SysCaixa.
                      Tarifa e juros só contam como recebidos quando o principal é coberto
                      (são lançados automaticamente ao confirmar). */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { l: 'Títulos', v: recTitulos },
                      { l: 'Tarifa', v: recTarifa },
                      { l: 'Juros', v: recJuros },
                    ].map((x) => (
                      <div
                        key={x.l}
                        className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-center"
                      >
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">Recebido {x.l}</div>
                        <div className="font-mono tabular-nums font-semibold text-sm">{formatarBRL(x.v)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Falta = Total a Receber − recebido (rateio do SysCaixa) */}
                  <div className="flex justify-between items-baseline mt-3">
                    <span className="uppercase tracking-wide text-xs font-bold">
                      Falta (a receber){parcial ? ' — parcial' : ''}
                    </span>
                    <span
                      className={`font-mono tabular-nums text-2xl font-bold ${
                        quitado ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {formatarBRL(falta)}
                    </span>
                  </div>
                  {selecionados.length > 0 && (faltaTarifa > 0.005 || faltaJuros > 0.005) && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      Ainda falta lançar:{' '}
                      {[
                        faltaTarifa > 0.005 ? `tarifa ${formatarBRL(faltaTarifa)}` : '',
                        faltaJuros > 0.005 ? `juros ${formatarBRL(faltaJuros)}` : '',
                      ]
                        .filter(Boolean)
                        .join(' e ')}
                      {' '}(escolha a forma de tarifa/juros no combo).
                    </div>
                  )}
                  {parcial && (
                    <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 mt-2">
                      Principal <b>parcial</b>: o título fica <b>em aberto</b> no restante; o juros será recalculado
                      sobre esse saldo no próximo pagamento.
                    </div>
                  )}
                </div>

                {/* Conta do operador + modo simulação */}
                <div className="mt-4 grid grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>Conta (operador)</Label>
                    <Input
                      value={codConta}
                      readOnly
                      placeholder="—"
                      title="Conta do operador (definida no cadastro de usuário por filial)"
                      className="font-mono bg-gray-50 dark:bg-slate-800"
                    />
                    {!codConta && (
                      <p className="text-[11px] text-red-600 mt-1">
                        Operador sem conta de caixa — configure no cadastro de usuário.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 h-6 cursor-pointer select-none mb-1">
                      <input
                        type="checkbox"
                        checked={deposito}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setDeposito(on);
                          if (!on) setDataPgto(hojeISO); // sem depósito → juros até hoje
                          if (on && forma === 'dinheiro') setForma('credito'); // depósito não aceita dinheiro
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
                  💳 No cartão, gera as <b>parcelas a receber da operadora</b> (venc. pelo prazo da operadora, valor
                  líquido) e dá <b>baixa</b> no título. Com <b>Modo simulação</b> ligado, nada é gravado — mostra só a
                  prévia.
                </div>

                {/* Prévia da simulação (por título) */}
                {previa?.simulado && (
                  <div className="mt-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-3 text-sm">
                    <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                      🧪 Simulação (nada gravado) — {(previa.resultados || []).length} título(s)
                    </div>
                    {(previa.resultados || []).map((r: any, idx: number) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div className="flex justify-between text-[13px]">
                          <span className="font-mono">{r.cod_receb}</span>
                          <span
                            className={`font-semibold ${
                              r.baixa?.rec === 'S' ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {r.baixa?.rec === 'S' ? 'quitado' : 'parcial'}
                            {r.baixa?.principalRecebido != null && ` · ${formatarBRL(r.baixa.principalRecebido)}`}
                          </span>
                        </div>
                        {r.titulosCartao?.length > 0 && (
                          <div className="pl-2 mt-1 space-y-0.5">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">
                              Parcelas da operadora
                            </div>
                            {r.titulosCartao.map((t: any, i: number) => (
                              <div key={i} className="flex justify-between font-mono tabular-nums text-[12px]">
                                <span>
                                  {t.parcela} · venc {fmtData(t.dt_venc)}
                                </span>
                                <span>{formatarBRL(t.valor)}</span>
                              </div>
                            ))}
                            {r.finCartao?.[0] && (
                              <div className="flex justify-between font-mono tabular-nums text-[12px] text-gray-500">
                                <span>Líquido (após taxa)</span>
                                <span className="font-semibold">{formatarBRL(r.finCartao[0].vlrliq)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <DefaultButton
                  text={
                    salvando
                      ? 'Processando...'
                      : preVendaSel
                      ? 'Faturar e receber'
                      : simular
                      ? 'Simular recebimento'
                      : parcial
                      ? 'Receber parcial'
                      : 'Receber e dar baixa'
                  }
                  icon={salvando ? <Loader2 className="animate-spin" size={16} /> : undefined}
                  onClick={() =>
                    preVendaSel
                      ? pedirConfirmacao(faturarEReceber, {
                          title: 'Faturar e receber',
                          message: `FATURAR a pré-venda ${preVendaSel.nrovenda} (${preVendaSel.nome_cliente}), emitir a nota e receber ${formatarBRL(
                            recebido,
                          )}?`,
                          type: 'info',
                        })
                      : simular
                      ? receberEDarBaixa()
                      : pedirConfirmacao(receberEDarBaixa, {
                          title: parcial ? 'Confirmar recebimento PARCIAL' : 'Confirmar recebimento',
                          message: parcial
                            ? `Receber PARCIAL de ${formatarBRL(recebido)} em ${selecionados.length} título(s)? O restante (${formatarBRL(
                                falta,
                              )}) fica EM ABERTO.`
                            : `GRAVAR o recebimento de ${formatarBRL(recebido)} e dar baixa em ${selecionados.length} título(s)?`,
                          type: parcial ? 'warning' : 'info',
                        })
                  }
                  variant={preVendaSel ? 'confirm' : simular ? 'primary' : 'confirm'}
                  disabled={
                    salvando ||
                    (selecionados.length === 0 && !preVendaSel) ||
                    passadas.length === 0 ||
                    !podeReceber
                  }
                  className="w-full mt-3 h-12"
                />
              </div>
            </section>
          </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-6">
          Caixa · Fase 1 — recebimento e baixa de títulos
        </p>
      </main>

      {ConfirmacaoSalvarModal}

      {/* Visualizador da nota (reimprimir): vê primeiro, imprime só se confirmar */}
      {notaView && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl h-[86vh] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <FileText size={16} />
              <span className="font-bold text-sm truncate">{notaView.titulo}</span>
              <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={fecharNota}>
                <X size={20} />
              </button>
            </div>
            <iframe title="Nota fiscal" src={notaView.url} className="flex-1 w-full bg-gray-100 dark:bg-slate-800" />
            <div className="flex items-center justify-end gap-2.5 px-4 py-3 border-t border-gray-200 dark:border-slate-700">
              <span className="mr-auto text-xs text-gray-400">Confira a nota. Imprime só se você clicar em Imprimir.</span>
              <button
                onClick={fecharNota}
                className="font-semibold text-sm rounded-lg px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-blue-500"
              >
                Fechar
              </button>
              <button
                onClick={imprimirNota}
                disabled={imprimindo}
                className="inline-flex items-center gap-1.5 font-semibold text-sm rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Printer size={15} /> {imprimindo ? 'Imprimindo…' : 'Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progresso do faturar → emitir → receber (etapas, igual ao faturamento) */}
      {progresso && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl px-7 py-6 w-full max-w-sm text-center">
            <Loader2 className="animate-spin mx-auto text-blue-600" size={30} />
            <div className="mt-3 font-bold">Faturando e recebendo</div>
            <div className="mt-1 text-sm text-gray-500">{progresso}</div>
            <div className="mt-3 text-[11px] text-gray-400">
              Não feche a tela — se a nota falhar, tudo é desfeito automaticamente.
            </div>
          </div>
        </div>
      )}
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
