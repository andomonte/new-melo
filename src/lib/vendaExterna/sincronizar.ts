/**
 * Baixa o pacote para trabalhar sem internet (/api/offline/pacote, em partes) e grava no
 * aparelho (IndexedDB). Pacote completo a cada sincronização (produto/preço/estoque não
 * têm "alterado em"); ~1 MB com gzip.
 */
import { gravarMeta, lerMeta, substituirTudo } from './idb';
import { authHeader, type SessaoExterna } from './sessao';

export interface MetaPacote {
  gerado_em: string;
  filial: string;
  vendedor: string;
  armazem: number;
  estoque_minimo: number;
  tipos_preco: string[];
  total_produtos: number;
  total_clientes: number;
}

export interface ProdutoLocal {
  codprod: string;
  ref: string;
  refnorm: string;
  descr: string;
  marca: string;
  codgpe: string | null;
  disp: number;
  dolar: string;
  curva: string;
  precos: Record<string, number>;
  busca: string; // texto normalizado (ref + descrição + marca) para a busca local
}

export const normalizar = (s: string) =>
  String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
export const soAlfanum = (s: string) => normalizar(s).replace(/[^A-Z0-9]/g, '');

async function pegar(url: string, s: SessaoExterna) {
  const r = await fetch(url, { headers: authHeader(s), cache: 'no-store' });
  let d: any = {};
  try {
    d = await r.json();
  } catch {
    /* */
  }
  if (!r.ok) throw new Error(d.erro || d.error || `Falha ao baixar (${r.status})`);
  return d;
}

export async function baixarPacote(
  s: SessaoExterna,
  progresso?: (txt: string, pct: number) => void,
  estoqueMinimo = 1,
): Promise<MetaPacote> {
  const base = `/api/offline/pacote?arm=${s.armId || 1001}&min=${estoqueMinimo}`;
  progresso?.('Preparando…', 2);
  const meta: MetaPacote = await pegar(`${base}&parte=meta`, s);

  // produtos em partes
  const produtos: ProdutoLocal[] = [];
  let apos = '';
  for (let volta = 0; volta < 100; volta++) {
    const d = await pegar(`${base}&parte=produtos&limite=5000&apos=${encodeURIComponent(apos)}`, s);
    for (const [codprod, ref, descr, marca, codgpe, disp, dolar, curva, precos] of d.itens as any[]) {
      produtos.push({
        codprod,
        ref: ref || '',
        refnorm: soAlfanum(ref),
        descr: descr || '',
        marca: marca || '',
        codgpe,
        disp: Number(disp) || 0,
        dolar,
        curva,
        precos: precos || {},
        busca: normalizar(`${ref} ${descr} ${marca}`),
      });
    }
    const pct = meta.total_produtos ? Math.min(80, 5 + (produtos.length / meta.total_produtos) * 70) : 50;
    progresso?.(`Produtos ${produtos.length.toLocaleString('pt-BR')} de ${meta.total_produtos.toLocaleString('pt-BR')}`, pct);
    if (d.fim || !d.proximo) break;
    apos = d.proximo;
  }

  // clientes da carteira
  const clientes: any[] = [];
  apos = '';
  for (let volta = 0; volta < 100; volta++) {
    const d = await pegar(`${base}&parte=clientes&limite=5000&apos=${encodeURIComponent(apos)}`, s);
    clientes.push(...d.itens);
    progresso?.(`Clientes ${clientes.length.toLocaleString('pt-BR')}`, 85);
    if (d.fim || !d.proximo) break;
    apos = d.proximo;
  }

  progresso?.('Formas de pagamento e prazos…', 92);
  const aux = await pegar(`${base}&parte=aux`, s);

  progresso?.('Gravando no aparelho…', 95);
  await substituirTudo('produtos', produtos);
  await substituirTudo('clientes', clientes);
  await gravarMeta('aux', aux);
  await gravarMeta('pacote', meta);
  progresso?.('Pronto', 100);
  return meta;
}

export const metaDoPacote = () => lerMeta<MetaPacote>('pacote');
