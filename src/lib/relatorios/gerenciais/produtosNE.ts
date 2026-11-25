import type { ColunaDef, Relatorio } from '../tipos';
import { AVISO_DBPRODFAT, FATURA_CLIENTE, consultar, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Produtos para N.E. (Delphi: frmRelFatura / tabProdutoNE — RELATO.PRODUTOS_PARA_NE).
 * Produtos que saíram em F.A.G. (dbfatura.tipofat='3'; o ramo "NF série B" do legado está morto desde 2006),
 * somados por produto e agrupados por grupo, para a emissão da nota de entrada/regularização.
 * O Delphi (sem fonte) mostrava o custo convertido pelo dólar; aqui saem os dois: preço da F.A.G. e custo
 * atual (prcompra × taxa do dólar quando o produto é cotado em dólar).
 * Diferença: o filtro "só estocados" (est='S') vale para qualquer escolha de grupo — no legado só valia em
 * "Todos os grupos". Fonte: dbprodfat, que só tem itens a partir de 08/2026 no banco novo.
 */
const colunas: ColunaDef[] = [
  { campo: 'grupo', titulo: 'Grupo' },
  { campo: 'codprod', titulo: 'Código' },
  { campo: 'ref', titulo: 'Referência' },
  { campo: 'descr', titulo: 'Descrição' },
  { campo: 'qtd', titulo: 'Quantidade', tipo: 'inteiro', total: true },
  { campo: 'prunit', titulo: 'Pr. unitário (FAG)', tipo: 'moeda' },
  { campo: 'total', titulo: 'Total item', tipo: 'moeda', total: true },
  { campo: 'custo_unit', titulo: 'Custo unit. atual', tipo: 'moeda' },
  { campo: 'custo_total', titulo: 'Custo total', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'produtosNE',
  titulo: 'Produtos para N.E.',
  descricao:
    'Produtos que saíram em F.A.G. (documento sem nota fiscal cheia) no período, somados por produto e agrupados por grupo, com o preço da F.A.G. e o custo atual (convertido pelo dólar quando o produto é cotado em dólar). ' +
    AVISO_DBPRODFAT,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da F.A.G.)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'grupos', rotulo: 'Grupos de produto (vazio = todos)', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'somente_estocados', rotulo: 'Só produtos estocados (est = S)', tipo: 'checkbox', padrao: true },
  ],
  colunas,
  quebra: 'grupo',
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const params: any[] = [de, ate];
    const onde = [`f.data BETWEEN $1::date AND $2::date`, `f.cancel = 'N'`, `f.tipofat = '3'`, FATURA_CLIENTE('f')];
    if (p.somente_estocados) onde.push(`pd.est = 'S'`);
    if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
    const custo = `COALESCE(pd.prcompra, 0) * CASE WHEN pd.dolar = 'S' THEN COALESCE(NULLIF(pd.txdolarcompra, 0), 1) ELSE 1 END`;
    const linhas = await consultar(db,
      `SELECT COALESCE(pd.codgpp, '') || ' - ' || COALESCE(g.descr, '(sem grupo)') AS grupo, pf.codprod,
              COALESCE(pd.ref, pf.ref) AS ref, COALESCE(pd.descr, pf.descr) AS descr,
              sum(COALESCE(pf.qtde, 0)) AS qtd,
              round(sum(COALESCE(pf.qtde, 0) * COALESCE(pf.prunit, 0)) / NULLIF(sum(COALESCE(pf.qtde, 0)), 0), 2) AS prunit,
              round(sum(COALESCE(pf.qtde, 0) * COALESCE(pf.prunit, 0)), 2) AS total,
              round(max(${custo}), 2) AS custo_unit,
              round(sum(COALESCE(pf.qtde, 0)) * max(${custo}), 2) AS custo_total
         FROM dbfatura f
         JOIN dbprodfat pf ON pf.codfat = f.codfat
         LEFT JOIN dbprod pd ON pd.codprod = pf.codprod
         LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
        WHERE ${onde.join(' AND ')}
        GROUP BY 1, 2, 3, 4
        ORDER BY 1, 3`, params);
    const avisos: string[] = [];
    if (!linhas.length && de < '2026-08-01') avisos.push(AVISO_DBPRODFAT);
    return { linhas: numerosDasColunas(linhas, colunas), avisos };
  },
};
