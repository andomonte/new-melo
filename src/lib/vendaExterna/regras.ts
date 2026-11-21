/**
 * Regras da venda externa — MESMAS da Nova Venda V2
 * (src/components/corpo/vendas/novaVendaV2/index.tsx: avistaForcado, isAvista, obsfatTexto,
 * impedimentoVenda, handleFinalizarVenda). Funções puras: valem online e, na fase 2,
 * sem internet. Se mudar a regra lá, mudar aqui também.
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 */

export const TABELAS_PRECO = [
  'BALCÃO',
  'ZFM',
  'INTERIOR',
  'ALC',
  'AMAZ. OCIDENTAL',
  'FORA ESTADO',
  'FORA ESTADO VAREJO',
  'RORAIMA',
];

export interface ClienteVenda {
  codcli: string;
  nome: string;
  nomefant: string;
  cpfcgc: string;
  tipo: string;
  uf?: string;
  cidade?: string;
  prvenda: string;
  claspgto: string;
  status: string;
  limite: number;
  debito: number;
  /** limite − débito + crédito temporário */
  saldo: number;
  codvend: string;
  atraso: number;
}

export interface ItemVenda {
  codprod: string;
  ref: string;
  descr: string;
  marca: string;
  qtd: number;
  prunit: number;
  /** preço da tabela no momento em que entrou (p/ detectar preço abaixo) */
  prvenda_original: number;
  disp: number;
  /** ST + IPI do item (calculado no servidor); undefined = ainda não calculado */
  impostos?: number;
  campos_fiscais?: Record<string, any>;
}

export interface FormaPagamento {
  id: string | number;
  descricao: string;
}

export interface PrazoOpcao {
  prazo: string; // "35 49 63"
  dias: number[];
}

const sem = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const tipoDaForma = (fp?: FormaPagamento | null) => {
  const d = sem(fp?.descricao || '');
  return {
    boleto: d.includes('BOLETO'),
    cartaoCredito: d.includes('CREDITO'),
    avistaPelaForma: d.includes('DINHEIRO') || d.includes('PIX') || d.includes('DEBITO'),
  };
};

export const totalItem = (i: ItemVenda) => (Number(i.qtd) || 0) * (Number(i.prunit) || 0);
export const totalItens = (itens: ItemVenda[]) => itens.reduce((a, i) => a + totalItem(i), 0);
export const totalImpostos = (itens: ItemVenda[]) => itens.reduce((a, i) => a + (Number(i.impostos) || 0), 0);

export const precoDaTabela = (precos: Record<string, number> | undefined, prvenda: string) =>
  Number(precos?.[String(prvenda)] || 0);

export interface EstadoPagamento {
  forma: FormaPagamento | null;
  prazo: string; // '' | '35 49 63' | 'FECHAMENTO NA SEMANA'
  prazoDias: number[];
  parcelasCartao: number;
}

export function analisarVenda(opts: {
  cliente: ClienteVenda | null;
  itens: ItemVenda[];
  pag: EstadoPagamento;
  /** funções do usuário (BPV/MPV liberam preço abaixo da tabela) */
  funcoes?: string[];
  /** resposta do validarCredito (online); null = não consultado */
  credito?: { passou: string; mensagem?: string } | null;
}) {
  const { cliente, itens, pag, funcoes = [], credito } = opts;
  const total = totalItens(itens);
  const claspgto = String(cliente?.claspgto || '').trim().toUpperCase();
  const tempAvista = String(cliente?.status || '').trim() === '4';
  const balcao = String(cliente?.codcli || '').trim() === '99999';
  const { boleto, cartaoCredito, avistaPelaForma } = tipoDaForma(pag.forma);

  const avistaForcado = !!cliente && (['V', 'D'].includes(claspgto) || tempAvista);
  const avistaMotivo = !cliente
    ? ''
    : claspgto === 'Z'
      ? 'Z'
      : claspgto === 'V'
        ? 'V'
        : claspgto === 'D'
          ? 'D'
          : tempAvista
            ? 'V'
            : 'VE';
  const avista = avistaForcado || (!!pag.forma && avistaPelaForma);
  const saldo = Number(cliente?.saldo || 0);
  const prazoBloqueado = !!cliente && (avistaForcado || (total > 0 && saldo < total));
  const prazoBloqueadoMsg = !cliente
    ? ''
    : ['V', 'D'].includes(claspgto)
      ? `Cliente à vista obrigatório (${claspgto})`
      : total > 0 && saldo < total
        ? 'Sem crédito para prazo'
        : '';

  const temBPV = funcoes.includes('BPV');
  const temMPV = funcoes.includes('MPV');
  const precoAbaixo =
    !temBPV &&
    !temMPV &&
    itens.some((i) => {
      const o = Number(i.prvenda_original) || 0;
      return o > 0 && (Number(i.prunit) || 0) < o - 0.01;
    });

  let obsfat = '';
  if (cartaoCredito && pag.parcelasCartao > 0) obsfat = `CARTAO DE CREDITO ${String(pag.parcelasCartao).padStart(2, '0')}x`;
  else if (avista) obsfat = avistaMotivo === 'Z' ? 'A VISTA (Z) - DINHEIRO' : `A VISTA (${avistaMotivo || 'VE'})`;
  else if (pag.prazo === 'FECHAMENTO NA SEMANA') obsfat = 'FECHAMENTO NA SEMANA';
  else if (boleto) obsfat = pag.prazo ? `BOLETO ${pag.prazo}` : 'BOLETO';
  else if (pag.forma) obsfat = pag.forma.descricao;

  const MSG_PRECO = 'PREÇO ABAIXO DA TABELA — SERÁ ENVIADA PARA ANÁLISE';
  let impedimento: string | null = null;
  if (!cliente) impedimento = 'INFORME O CLIENTE';
  else if (credito?.passou === 'NOK') impedimento = credito.mensagem || 'CLIENTE BLOQUEADO — CONSULTE O SETOR DE COBRANÇA';
  else if (itens.length === 0) impedimento = 'ESCOLHA PRODUTOS!';
  else if (itens.some((i) => !(i.qtd > 0) || !(i.prunit > 0))) impedimento = 'QUANTIDADE E PREÇO DEVEM SER MAIORES QUE ZERO';
  else if (total > 0 && total < 30) impedimento = 'VENDA MÍNIMA DE R$ 30,00';
  else if (balcao && total > 10000) impedimento = 'CLIENTE BALCÃO. LIMITE DE 10.000,00 EXCEDIDO.';
  else if (balcao && !avista && !cartaoCredito) impedimento = 'CLIENTE BALCÃO. PAGAMENTO SOMENTE À VISTA OU C. CRÉDITO.';
  else if (cartaoCredito && pag.parcelasCartao <= 0) impedimento = 'INFORME O PARCELAMENTO DO CARTÃO';
  else if (!pag.forma && pag.prazo !== 'FECHAMENTO NA SEMANA') impedimento = 'INFORME A FORMA DE PAGAMENTO';
  else if (boleto && prazoBloqueado)
    impedimento = `BOLETO NÃO PERMITIDO: ${prazoBloqueadoMsg || 'CLIENTE SOMENTE À VISTA'} — ESCOLHA OUTRA FORMA DE PAGAMENTO`;
  else if (boleto && !pag.prazo) impedimento = 'INFORME O PRAZO DO BOLETO';
  else if (precoAbaixo) impedimento = MSG_PRECO;

  // só o preço abaixo deixa enviar (vai bloqueada para análise)
  const podeEnviar = impedimento === null || impedimento === MSG_PRECO;
  const maxParcelasCartao = cartaoCredito && total > 0 ? Math.max(1, Math.min(10, Math.floor(total / 100))) : 1;

  return {
    total,
    avista,
    avistaForcado,
    avistaMotivo,
    boleto,
    cartaoCredito,
    prazoBloqueado,
    prazoBloqueadoMsg,
    precoAbaixo,
    obsfat,
    impedimento,
    podeEnviar,
    maxParcelasCartao,
  };
}

/** Formas que a Nova Venda mostra (boleto só para quem pode comprar a prazo). */
export function formasVisiveis(formas: FormaPagamento[], prazoBloqueado: boolean) {
  return formas.filter((fp) => {
    const d = sem(fp.descricao || '');
    if (d.includes('BOLETO')) return !prazoBloqueado;
    return d.includes('DINHEIRO') || d === 'PIX' || d.includes('DEBITO') || d.includes('CREDITO');
  });
}

/** Payload igual ao da Nova Venda V2 para /api/vendas/postgresql/finalizarVenda. */
export function montarPayloadVenda(opts: {
  cliente: ClienteVenda;
  itens: ItemVenda[];
  pag: EstadoPagamento;
  analise: ReturnType<typeof analisarVenda>;
  usuario: { usuario: string; codusr: string | number };
  armId: number;
  obs?: string;
  transporte?: { codtptransp: string; descr: string } | null;
}) {
  const { cliente, itens, pag, analise, usuario, armId, obs, transporte } = opts;
  const hoje = new Date();
  const prazos = pag.prazoDias.map((d) => {
    const dt = new Date(hoje);
    dt.setDate(dt.getDate() + d);
    return { data: dt, dia: d };
  });
  return {
    header: {
      operacao: 1,
      codcli: cliente.codcli,
      codusr: Number(usuario.codusr) || 0,
      pedido: '',
      tipo: 'P',
      tele: 'N',
      transp: transporte?.descr || '',
      codtptransp: transporte?.codtptransp ? Number(transporte.codtptransp) : null,
      vlrfrete: 0,
      prazo: pag.prazo || '',
      obs: obs || '',
      obsfat: analise.obsfat,
      bloqueada: analise.precoAbaixo ? 'S' : '0',
      estoque_virtual: 'N',
      uName: usuario.usuario || '',
      nomecf: cliente.nomefant || cliente.nome || null,
      vendedor: cliente.codvend || String(usuario.codusr || '') || null,
      operador: null,
      formaPagamento: pag.forma?.descricao || null,
      parcelasCartao: analise.cartaoCredito ? Math.max(1, pag.parcelasCartao) : null,
      avista: analise.avista,
      avistaMotivo: analise.avista ? analise.avistaMotivo : null,
    },
    itens: itens.map((it, idx) => ({
      codprod: it.codprod,
      qtd: it.qtd,
      prunit: it.prunit,
      arm_id: armId,
      ref: it.ref || '',
      descr: it.descr || '',
      desconto: 0,
      codvend: cliente.codvend || null,
      codoperador: null,
      nritem: String(idx + 1),
      nrequis: '',
      demanda: 'S',
      qtdpnd: 0,
      ...(it.campos_fiscais || {}),
    })),
    prazos,
  };
}

export const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
