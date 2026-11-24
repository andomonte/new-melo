/**
 * Fonte de dados ONLINE da venda externa — chama as mesmas APIs da Nova Venda V2.
 * Na fase 2 entra uma fonte "local" (IndexedDB) com a mesma interface.
 */
import api from '@/components/services/api';
import { calcularIBSCBS } from '@/lib/calc_engine_ibs_cbs';
import type { ClienteVenda, FormaPagamento, PrazoOpcao } from './regras';
import { authHeader, lerSessao } from './sessao';

export interface ProdutoBusca {
  codprod: string;
  ref: string;
  descr: string;
  marca: string;
  disp: number;
  preco: number;
  codgpe: string;
}

export interface FonteVenda {
  buscarClientes(termo: string): Promise<ClienteVenda[]>;
  buscarProdutos(termo: string, prvenda: string, armId: number): Promise<ProdutoBusca[]>;
  formasPagamento(): Promise<FormaPagamento[]>;
  opcoesPrazo(valor: number): Promise<PrazoOpcao[]>;
  validarCredito(codcli: string, valor: number, forma: string): Promise<{ passou: string; mensagem?: string } | null>;
  /** preço de tabela de vários produtos para um tipo de preço (troca de cliente) */
  precos(codprods: string[], prvenda: string): Promise<Record<string, number>>;
  /** ST+IPI do item e campos fiscais (null = sem cálculo) */
  impostosItem(codprod: string, codcli: string, qtd: number, prunit: number): Promise<{ impostos: number; campos: any } | null>;
  /** produtos COM estoque dos grupos de equivalência (dbprod.codgpe), maior estoque primeiro */
  equivalentes(grupos: string[], prvenda: string, armId: number): Promise<ProdutoBusca[]>;
}

const n = (v: any) => Number(v || 0);

function clienteDaApi(c: any): ClienteVenda {
  return {
    codcli: String(c.CODCLI || c.codcli || '').trim(),
    nome: c.NOME || c.nome || '',
    nomefant: c.NOMEFANT || c.nomefant || c.NOME || c.nome || '',
    cpfcgc: c.CPFCGC || c.cpfcgc || '',
    tipo: c.TIPO || c.tipo || '',
    uf: c.UF || c.uf || '',
    cidade: c.CIDADE || c.cidade || '',
    prvenda: String(c.PRVENDA ?? c.prvenda ?? '0') || '0',
    claspgto: c.CLASPGTO || c.claspgto || '',
    status: String(c.STATUS || c.status || '1'),
    limite: n(c.LIMITE_TOTAL ?? c.LIMITE ?? c.limite),
    debito: n(c.DEBITO_ATUAL ?? c.DEBITO ?? c.debito),
    saldo: n(c.LIMITE_DISPONIVEL ?? c.limite_disponivel),
    codvend: c.CODVEND || c.codvend || '',
    atraso: n(c.ATRASO ?? c.atraso),
  };
}

export const fonteOnline: FonteVenda = {
  async buscarClientes(termo) {
    const t = termo.trim();
    if (!t) return [];
    const codigo = /^\d{1,5}$/.test(t);
    const r = await api.post('/api/vendas/postgresql/buscarCliente', {
      descricao: codigo ? t.padStart(5, '0') : t,
      pagina: 0,
      tamanhoPagina: codigo ? 1 : 30,
    });
    return (r.data?.data || []).map(clienteDaApi);
  },

  async buscarProdutos(termo, prvenda, armId) {
    const t = termo.trim();
    if (t.length < 2) return [];
    const r = await api.post('/api/vendas/postgresql/produto', {
      descricao: t,
      PRVENDA: prvenda || '0',
      campo: 'ref',
      arm_id: armId || 1001,
    });
    const rows = Array.isArray(r.data) ? r.data : r.data?.data || [];
    return rows.map((p: any) => ({
      codprod: String(p.CODPROD || p.codprod || '').trim(),
      ref: p.REF || p.ref || '',
      descr: p.DESCR || p.descr || '',
      marca: p.MARCA || p.marca || '',
      disp: n(p.QTDDISPONIVEL ?? p.qtddisponivel),
      preco: n(p.PRECOVENDA ?? p.precovenda),
      codgpe: p.CODGPE || p.codgpe || '',
    }));
  },

  async formasPagamento() {
    const r = await api.get('/api/vendas/fpagamento');
    const lista = Array.isArray(r.data) ? r.data : r.data?.data || [];
    return lista.map((f: any) => ({ id: f.id ?? f.ID, descricao: String(f.descricao ?? f.DESCRICAO ?? '') }));
  },

  async opcoesPrazo(valor) {
    if (!(valor > 0)) return [];
    const r = await api.post('/api/vendas/tabelaPrazos', { valor });
    return (r.data?.opcoes || []).map((o: any) => ({
      prazo: String(o.prazo || '').replace(/\//g, ' '),
      dias: (o.dias || []).map(Number),
    }));
  },

  async validarCredito(codcli, valor, forma) {
    try {
      const r = await api.post('/api/vendas/postgresql/validarCredito', {
        codcli,
        valorSolicitado: valor,
        formaPagamento: forma,
      });
      return r.data || null;
    } catch (e: any) {
      if (!e?.response) throw e; // sem conexão: a fonte híbrida usa o pacote local
      return null;
    }
  },

  async precos(codprods, prvenda) {
    if (codprods.length === 0) return {};
    const r = await api.post('/api/vendas/postgresql/atualizarPrecos', { codprods, tipoPreco: prvenda || '0' });
    const p = r.data?.precos || {};
    const out: Record<string, number> = {};
    Object.keys(p).forEach((k) => (out[String(k).trim()] = n(p[k])));
    return out;
  },

  async impostosItem(codprod, codcli, qtd, prunit) {
    try {
      const r = await calcularIBSCBS({
        codProd: codprod,
        codCli: codcli,
        quantidade: qtd,
        valorUnitario: prunit,
        tipoMovimentacao: 'SAIDA',
        tipoOperacao: 'VENDA',
        tipoFatura: 'NOTA_FISCAL',
        zerarSubstituicao: 'N',
        usarAuto: true,
      } as any);
      // "por fora" = IPI + ICMS-ST (mesmo "Total c/ Imp." da Nova Venda)
      const imp: any = r?.impostosRs || {};
      const impostos = +(n(imp.valorIPI) + n(imp.valorICMS_Subst)).toFixed(2);
      return { impostos, campos: (r as any)?.raw?.campos || {} };
    } catch (e: any) {
      if (!e?.response) throw e; // sem conexão: a fonte híbrida usa o pacote local
      return null;
    }
  },

  async equivalentes(grupos, prvenda, armId) {
    const gs = Array.from(new Set(grupos.filter(Boolean)));
    if (gs.length === 0) return [];
    // fetch sem resposta (sem conexão) lança TypeError → a fonte híbrida usa o pacote
    const r = await fetch('/api/externo/equivalentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(lerSessao()) },
      body: JSON.stringify({ grupos: gs, prvenda: prvenda || '0', arm: armId || 1001 }),
    });
    if (!r.ok) throw Object.assign(new Error(`Falha ao buscar equivalentes (${r.status})`), { response: { status: r.status } });
    const d = await r.json();
    return (d.equivalentes || []) as ProdutoBusca[];
  },
};
