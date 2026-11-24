/**
 * Fonte de dados LOCAL (sem internet) da Venda Externa — mesma interface da fonteOnline,
 * lendo o pacote guardado no aparelho (IndexedDB). Regras espelhadas das rotas online:
 *  - busca de produto: referência sem pontuação, palavras em qualquer ordem, "| marca"
 *  - crédito: mesma ordem do /api/vendas/postgresql/validarCredito (com os dados do pacote)
 *  - impostos: só o servidor calcula → aqui não há (o total sai sem IPI/ST até o envio)
 */
import { lerMeta, todos } from './idb';
import { normalizar, soAlfanum, type ProdutoLocal } from './sincronizar';
import type { FonteVenda, ProdutoBusca } from './fonteOnline';
import type { ClienteVenda, FormaPagamento, PrazoOpcao } from './regras';

let cacheProdutos: ProdutoLocal[] | null = null;
let cacheClientes: any[] | null = null;
let cacheAux: any = null;

export function limparCacheLocal() {
  cacheProdutos = null;
  cacheClientes = null;
  cacheAux = null;
}

const produtos = async () => (cacheProdutos ??= await todos<ProdutoLocal>('produtos'));
const clientes = async () => (cacheClientes ??= await todos<any>('clientes'));
const aux = async () => (cacheAux ??= (await lerMeta<any>('aux')) || {});

const UF_FILIAL: Record<string, string> = { MANAUS: 'AM', RORAIMA: 'RR', RONDONIA: 'RO' };
let ufEmpresa = 'AM';
export const definirFilialLocal = (filial: string) => {
  ufEmpresa = UF_FILIAL[String(filial || '').toUpperCase()] || 'AM';
};

function clienteDoPacote(c: any): ClienteVenda {
  const limite = Number(c.limite || 0);
  const debito = Number(c.debito || 0);
  return {
    codcli: String(c.codcli || '').trim(),
    nome: c.nome || '',
    nomefant: c.nomefant || c.nome || '',
    cpfcgc: c.cpfcgc || '',
    tipo: c.tipo || '',
    uf: c.uf || '',
    cidade: c.cidade || '',
    prvenda: String(c.prvenda ?? '0'),
    claspgto: c.claspgto || '',
    status: String(c.status || '1'),
    limite,
    debito,
    saldo: limite - debito + Number(c.credito_tmp || 0),
    codvend: c.codvend || '',
    atraso: Number(c.atraso || 0),
  };
}

/** Dados extras do cliente que só o pacote tem (títulos vencidos), para a tela. */
export async function detalheClienteLocal(codcli: string) {
  return (await clientes()).find((c) => String(c.codcli).trim() === codcli) || null;
}

export const fonteLocal: FonteVenda = {
  async buscarClientes(termo) {
    const t = normalizar(termo.trim());
    if (!t) return [];
    const lista = await clientes();
    const dig = t.replace(/\D/g, '');
    const soNumero = /^\d+$/.test(t.replace(/[\s.\-/]/g, ''));
    const palavras = t.split(/\s+/).filter(Boolean);
    const achados = lista.filter((c) => {
      if (soNumero) {
        return (
          String(c.codcli).startsWith(dig.length <= 5 ? dig.padStart(5, '0') : dig) ||
          String(c.codcli).startsWith(dig) ||
          String(c.cpfcgc || '').replace(/\D/g, '').startsWith(dig)
        );
      }
      const alvo = c.busca ?? normalizar(`${c.nome} ${c.nomefant} ${c.cidade}`);
      return palavras.every((p) => alvo.includes(p));
    });
    // carteira do vendedor primeiro; depois quem começa com o termo; depois por nome
    const ini = (c: any) => (normalizar(c.nomefant || '').startsWith(t) || normalizar(c.nome || '').startsWith(t) ? 0 : 1);
    achados.sort(
      (a, b) =>
        (a.carteira ? 0 : 1) - (b.carteira ? 0 : 1) ||
        ini(a) - ini(b) ||
        String(a.nome || '').localeCompare(String(b.nome || '')),
    );
    return achados.slice(0, 30).map(clienteDoPacote);
  },

  async buscarProdutos(termo, prvenda) {
    const [parteTexto, parteMarca] = termo.split('|');
    const t = normalizar(parteTexto || '').trim();
    const marca = normalizar(parteMarca || '').trim();
    if (t.length < 2 && !marca) return [];
    const ref = soAlfanum(t);
    const palavras = t.split(/\s+/).filter(Boolean);
    const lista = await produtos();
    const res: { p: ProdutoLocal; pontos: number }[] = [];
    for (const p of lista) {
      if (marca && !normalizar(p.marca).includes(marca)) continue;
      let pontos = 0;
      if (ref && p.refnorm === ref) pontos = 100;
      else if (ref && p.refnorm.startsWith(ref)) pontos = 80;
      else if (palavras.length && palavras.every((w) => p.busca.includes(w))) pontos = 40;
      else if (!t && marca) pontos = 10;
      if (pontos === 0) continue;
      res.push({ p, pontos });
    }
    const curva = (c: string) => ({ A: 3, B: 2, C: 1 } as Record<string, number>)[String(c || '').toUpperCase()] || 0;
    res.sort((a, b) => b.pontos - a.pontos || curva(b.p.curva) - curva(a.p.curva) || b.p.disp - a.p.disp);
    return res.slice(0, 60).map(({ p }) => ({
      codprod: p.codprod,
      ref: p.ref,
      descr: p.descr,
      marca: p.marca,
      disp: p.disp,
      preco: Number(p.precos?.[String(prvenda || '0')] || 0),
      codgpe: p.codgpe || '',
    })) as ProdutoBusca[];
  },

  async formasPagamento() {
    const a = await aux();
    return (a.formas_pagamento || []).map((f: any) => ({ id: f.id, descricao: String(f.descricao || '') })) as FormaPagamento[];
  },

  async opcoesPrazo(valor) {
    if (!(valor > 0)) return [];
    const a = await aux();
    const faixa = (a.tabela_prazos || []).find(
      (f: any) =>
        String(f.categoria || '') === 'CARRO/MOTO/LUBRIFICANTES' &&
        Number(f.valor_min) <= valor &&
        (f.valor_max == null || Number(f.valor_max) >= valor),
    );
    if (!faixa) return [];
    const ops: PrazoOpcao[] = [{ prazo: String(faixa.dias_medio), dias: [Number(faixa.dias_medio)] }];
    for (const op of faixa.opcoes_prazo || []) {
      ops.push({ prazo: String(op).replace(/\//g, ' '), dias: String(op).split('/').map(Number) });
    }
    return ops;
  },

  async validarCredito(codcli, valor, forma) {
    const c = await detalheClienteLocal(codcli);
    if (!c) return { passou: 'NOK', mensagem: 'CLIENTE NÃO ESTÁ NOS DADOS DO APARELHO — ATUALIZE COM INTERNET' };
    const clas = String(c.claspgto || '').trim().toUpperCase();
    const fp = normalizar(forma || '');
    const isenta = (fp.includes('CARTAO') && fp.includes('CREDITO')) || fp.includes('A VISTA') || fp === 'PIX' || fp.includes('DINHEIRO') || fp.includes('DEBITO');
    const credTmp = Number(c.credito_tmp || 0);
    if (clas === 'I') return { passou: 'NOK', mensagem: 'CLIENTE INATIVO' };
    if (clas === 'Z' && !(credTmp >= valor && valor > 0)) return { passou: 'NOK', mensagem: 'CLIENTE EM COBRANÇA JUDICIAL' };
    if (clas === 'B') return { passou: 'NOK', mensagem: 'CLIENTE BLOQUEADO — CONSULTE O SETOR DE COBRANÇA' };
    if (String(c.tipo || '').toUpperCase() === 'F' && c.uf && String(c.uf).toUpperCase() !== ufEmpresa) {
      return { passou: 'NOK', mensagem: 'CLIENTE PESSOA FÍSICA DE OUTRO ESTADO' };
    }
    if (clas === 'V' || clas === 'D') return { passou: 'OK' };
    if (Number(c.qtd_vencidos || 0) > 0 && !isenta && !(credTmp >= valor && valor > 0)) {
      return {
        passou: 'NOK',
        mensagem: `CLIENTE COM TÍTULO(S) EM ATRASO HÁ ${Number(c.maior_atraso || 0)} DIA(S). Solicite regularização ao setor de cobrança ou crédito temporário.`,
      };
    }
    const saldo = Number(c.limite || 0) - Number(c.debito || 0) + credTmp;
    if (!isenta && valor > 0 && saldo < valor) {
      return { passou: 'NOK', mensagem: `CRÉDITO INSUFICIENTE PARA VENDA A PRAZO. Limite disponível: R$ ${saldo.toFixed(2)}` };
    }
    return { passou: 'OK' };
  },

  async precos(codprods, prvenda) {
    const mapa = new Map((await produtos()).map((p) => [p.codprod, p]));
    const out: Record<string, number> = {};
    for (const c of codprods) {
      const v = Number(mapa.get(c)?.precos?.[String(prvenda || '0')] || 0);
      if (v > 0) out[c] = v;
    }
    return out;
  },

  async impostosItem() {
    return null; // sem internet: impostos são calculados no envio
  },

  async equivalentes(grupos, prvenda) {
    const gs = new Set(grupos.map((g) => String(g || '').trim()).filter(Boolean));
    if (gs.size === 0) return [];
    const tipo = String(prvenda || '0');
    return (await produtos())
      .filter((p) => p.disp >= 1 && gs.has(String(p.codgpe || '').trim()))
      .sort((a, b) => b.disp - a.disp || a.ref.localeCompare(b.ref))
      .slice(0, 200)
      .map((p) => ({
        codprod: p.codprod,
        ref: p.ref,
        descr: p.descr,
        marca: p.marca,
        disp: p.disp,
        preco: Number(p.precos?.[tipo] || 0),
        codgpe: String(p.codgpe || '').trim(),
      })) as ProdutoBusca[];
  },
};
