/**
 * Hierarquia Fornecedor → Adição → Item da DI e regras de ordem/principal da
 * NF-e de nacionalização. Funções puras (sem DOM/DB) — usadas pela tela e pela
 * emissão, e cobertas por teste (scripts/test-importacao-hierarquia.mjs).
 *
 * Regras (DIe):
 *  - fornecedores ordenados pela MENOR adição de cada um (1ª adição);
 *  - adições em ordem crescente; itens em ordem crescente de numItem (nSeqAdic);
 *  - ordem dos itens na nota (det nItem 1..N) = ordem da listagem;
 *  - fornecedor principal (destinatário) = ADICAO_001 (fornecedor da menor adição)
 *    ou MAIOR_FOB (maior soma de FOB).
 */

export interface ItemHier {
  numItem: number;       // nSeqAdic
  numAdicao: number;     // nAdicao
  ncm?: string;
  descricao?: string;
  codprod?: string | null;
  [k: string]: any;
}

export interface AdicaoHier {
  numAdicao: number;
  nomeFornecedor: string;
  ncm?: string;
  vlFob?: number;        // US$
  vlFrete?: number;      // US$
  vlPisCofins?: number;  // R$
  vlIcms?: number;       // R$
  itens: ItemHier[];
}

export interface FornecedorHier {
  nome: string;
  primeiraAdicao: number;
  codCliente?: string | null;
  adicoes: AdicaoHier[];
}

export type RegraPrincipal = 'ADICAO_001' | 'MAIOR_FOB';

/** Agrupa adições por fornecedor; fornecedores por 1ª adição; adições/itens asc. */
export function montarHierarquia(adicoes: AdicaoHier[]): FornecedorHier[] {
  const porForn = new Map<string, AdicaoHier[]>();
  for (const a of adicoes) {
    const nome = a.nomeFornecedor || '';
    if (!porForn.has(nome)) porForn.set(nome, []);
    porForn.get(nome)!.push({ ...a, itens: [...(a.itens || [])].sort((x, y) => x.numItem - y.numItem) });
  }

  const forns: FornecedorHier[] = [];
  for (const [nome, ads] of porForn) {
    ads.sort((x, y) => x.numAdicao - y.numAdicao);
    forns.push({ nome, primeiraAdicao: ads[0]?.numAdicao ?? 0, adicoes: ads });
  }
  forns.sort((a, b) => a.primeiraAdicao - b.primeiraAdicao);
  return forns;
}

export interface ItemNota {
  nItem: number;       // det nItem (1..N)
  fornecedor: string;
  numAdicao: number;   // nAdicao
  numItem: number;     // nSeqAdic
  item: ItemHier;
}

/** Ordem dos itens na nota (det nItem) = ordem da listagem. */
export function ordemItensNota(forns: FornecedorHier[]): ItemNota[] {
  const out: ItemNota[] = [];
  let n = 1;
  for (const f of forns) {
    for (const a of f.adicoes) {
      for (const it of a.itens) {
        out.push({ nItem: n++, fornecedor: f.nome, numAdicao: a.numAdicao, numItem: it.numItem, item: it });
      }
    }
  }
  return out;
}

/** Fornecedor principal (destinatário da nota). */
export function fornecedorPrincipal(
  forns: FornecedorHier[],
  regra: RegraPrincipal = 'ADICAO_001',
): FornecedorHier | null {
  if (forns.length === 0) return null;
  if (regra === 'MAIOR_FOB') {
    let best = forns[0];
    let bestFob = -1;
    for (const f of forns) {
      const fob = f.adicoes.reduce((s, a) => s + (a.vlFob || 0), 0);
      if (fob > bestFob) { bestFob = fob; best = f; }
    }
    return best;
  }
  // ADICAO_001: fornecedor da menor adição = primeiro da listagem
  return forns[0];
}

/** Normaliza nome p/ matching: maiúsculas, sem acento/pontuação, espaços colapsados. */
export function normalizarNome(nome: string): string {
  return (nome || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Casa o nome (DIe, truncado em 30) com um candidato do cadastro por PREFIXO
 * normalizado: o nome mais curto deve ser prefixo do mais longo (até ~30 chars).
 */
export function nomesCombinam(nomeDie: string, nomeCadastro: string): boolean {
  const a = normalizarNome(nomeDie).slice(0, 30);
  const b = normalizarNome(nomeCadastro).slice(0, 30);
  if (!a || !b) return false;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  return longo.startsWith(curto);
}

/** Chave do vínculo reutilizável (tabela dbent_importacao_fornecedor_cliente.nome_norm). */
export function chaveVinculo(nomeDie: string): string {
  return normalizarNome(nomeDie).slice(0, 60);
}

// --- VÍNCULO FORNECEDOR (DIe) ↔ CLIENTE (cadastro tipo X) ---

export interface ClienteCadastro {
  codCliente: string;
  nome: string;
  nomeFant?: string | null;
  codPais?: number | string | null; // BACEN (dbclien.codpais)
  idEstrangeiro?: string | null;     // dbclien.cpfcgc
}

export type StatusVinculo = 'learned' | 'suggested' | 'multiple' | 'none';

export interface VinculoFornecedor {
  nomeDie: string;
  codCliente: string | null;
  status: StatusVinculo;      // learned=reaproveitado | suggested=1 match | multiple=2+ | none=0
  candidatos: ClienteCadastro[];
  cliente?: ClienteCadastro | null; // dados do cliente resolvido (p/ validação)
}

/**
 * Resolve o cliente de um fornecedor da DIe:
 *   1) vínculo aprendido (reutilizável) → status 'learned';
 *   2) exatamente 1 candidato por prefixo → 'suggested' (auto);
 *   3) 2+ candidatos → 'multiple' (usuário escolhe);
 *   4) nenhum → 'none' (busca manual).
 */
export function resolverFornecedorCliente(
  nomeDie: string,
  candidatosX: ClienteCadastro[],
  aprendidos: Map<string, string>,
): VinculoFornecedor {
  const matches = candidatosX.filter(
    (c) => nomesCombinam(nomeDie, c.nome) || (c.nomeFant ? nomesCombinam(nomeDie, c.nomeFant) : false),
  );
  const byCod = (cod: string) =>
    candidatosX.find((c) => String(c.codCliente) === String(cod)) || null;

  const aprendido = aprendidos.get(chaveVinculo(nomeDie));
  if (aprendido) {
    return { nomeDie, codCliente: aprendido, status: 'learned', candidatos: matches, cliente: byCod(aprendido) };
  }
  if (matches.length === 1) {
    return { nomeDie, codCliente: matches[0].codCliente, status: 'suggested', candidatos: matches, cliente: matches[0] };
  }
  if (matches.length > 1) {
    return { nomeDie, codCliente: null, status: 'multiple', candidatos: matches, cliente: null };
  }
  return { nomeDie, codCliente: null, status: 'none', candidatos: [], cliente: null };
}

/** País BACEN exigido e idEstrangeiro ausente geram aviso no destinatário exterior. */
export function avisosDestinatarioExterior(c: ClienteCadastro | null | undefined): string[] {
  const avisos: string[] = [];
  if (!c) return ['Cliente não vinculado'];
  if (!c.codPais || String(c.codPais).trim() === '' || String(c.codPais) === '0')
    avisos.push('País (BACEN) não cadastrado');
  if (!c.idEstrangeiro || String(c.idEstrangeiro).trim() === '')
    avisos.push('Identificação do estrangeiro (idEstrangeiro) não cadastrada');
  return avisos;
}
