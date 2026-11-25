import type { ColunaDef, Relatorio } from '../tipos';
import { numeros } from './_utilC';

/**
 * Relatórios › Gerenciais › Produtos em Promoção. Substitui FPreco / TabPromRel
 * (RELATO.REL_PROMOCAO_LISTAGEM / _ANALISE), mas é um relatório NOVO sobre o modelo de promoção
 * do web (decisão de 02/11/2026, PLANO-RELATORIOS 5.1): dbpromocao (campanha: período, desconto,
 * limites) + dbpromocao_item (produto ou grupo inteiro). O preço fixo por produto do legado
 * (dbpreco: PRPMAN/PRPBV/PRPPV) não existe no PG e não é usado.
 * Preço de tabela = dbformacaoprvenda tipo 0 (o mesmo que a tela de promoções usa); o preço
 * promocional segue a regra da tela (PERC = %, VALO = valor abatido, PREF = preço fixo).
 */
const colunasPara = (analise: boolean): ColunaDef[] => [
  { campo: 'promocao', titulo: 'Promoção' },
  { campo: 'inicio', titulo: 'Início', tipo: 'data' },
  { campo: 'fim', titulo: 'Fim', tipo: 'data' },
  { campo: 'situacao', titulo: 'Situação' },
  { campo: 'ref', titulo: 'Referência / grupo' },
  { campo: 'marca', titulo: 'Marca' },
  { campo: 'descricao', titulo: 'Descrição' },
  { campo: 'desconto', titulo: 'Desconto' },
  ...(analise ? [{ campo: 'prcompra', titulo: 'Pç. custo', tipo: 'moeda' } as ColunaDef] : []),
  { campo: 'prvenda', titulo: 'Preço tabela', tipo: 'moeda' },
  { campo: 'prpromocao', titulo: 'Preço promoção', tipo: 'moeda' },
  ...(analise ? [{ campo: 'lucro', titulo: '% lucro s/ custo', tipo: 'percentual' } as ColunaDef] : []),
  { campo: 'qtd_limite', titulo: 'Qtd. limite', tipo: 'inteiro' },
  { campo: 'qtd_vendida', titulo: 'Qtd. vendida', tipo: 'inteiro', total: true },
  { campo: 'estoque', titulo: 'Estoque', tipo: 'inteiro' },
];

export const relatorio: Relatorio = {
  slug: 'produtosPromocao',
  titulo: 'Produtos em Promoção',
  descricao:
    'Produtos e grupos incluídos nas promoções cadastradas em Vendas › Promoções, com desconto, preço de tabela, preço promocional e quantidade vendida na promoção. ' +
    'Itens de grupo valem para todos os produtos do grupo (aparecem numa linha só). No modo Análise mostra o custo e o % de lucro sobre o custo. ' +
    'A quantidade vendida é a que a venda soma na promoção; cancelamentos ainda não baixam esse número.',
  paisagem: true,
  filtros: [
    { campo: 'situacao', rotulo: 'Promoções', tipo: 'select', padrao: 'vigentes',
      opcoes: [
        { valor: 'vigentes', rotulo: 'Vigentes hoje' },
        { valor: 'periodo', rotulo: 'Com vigência no período' },
        { valor: 'todas', rotulo: 'Todas' },
      ] },
    { campo: 'periodo', rotulo: 'Período (para "com vigência no período")', tipo: 'periodo' },
    { campo: 'modo', rotulo: 'Modo', tipo: 'select', padrao: 'listagem',
      opcoes: [{ valor: 'listagem', rotulo: 'Listagem' }, { valor: 'analise', rotulo: 'Análise (custo e % lucro)' }] },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'somente_ativas', rotulo: 'Só promoções ativas', tipo: 'checkbox', padrao: true },
  ],
  colunas: colunasPara(false),
  async executar(db, p) {
    const analise = p.modo === 'analise';
    const params: any[] = [];
    const onde: string[] = [];
    if (p.somente_ativas) onde.push('pr.ativa IS TRUE');
    if (p.situacao === 'vigentes' || !p.situacao) onde.push('now() BETWEEN pr.data_inicio AND pr.data_fim');
    else if (p.situacao === 'periodo') {
      if (p.ate) { params.push(p.ate); onde.push(`pr.data_inicio < ($${params.length}::date + 1)`); }
      if (p.de) { params.push(p.de); onde.push(`pr.data_fim >= $${params.length}::date`); }
    }
    if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
    if (p.grupos) { params.push(p.grupos); onde.push(`COALESCE(pi.codgpp, pd.codgpp) = ANY($${params.length})`); }

    const tipo = `COALESCE(pi.tipo_desconto_item, pr.tipo_desconto)`;
    const valor = `COALESCE(pi.valor_desconto_item, pr.valor_desconto)`;
    const rows = (await db.query(
      `SELECT pr.id_promocao || ' - ' || COALESCE(pr.nome_promocao, '') AS promocao,
              to_char(pr.data_inicio, 'YYYY-MM-DD') AS inicio, to_char(pr.data_fim, 'YYYY-MM-DD') AS fim,
              CASE WHEN pr.ativa IS NOT TRUE THEN 'Inativa'
                   WHEN now() < pr.data_inicio THEN 'Futura'
                   WHEN now() > pr.data_fim THEN 'Encerrada' ELSE 'Vigente' END AS situacao,
              CASE WHEN pi.codprod IS NULL THEN 'Grupo ' || pi.codgpp ELSE pd.ref END AS ref,
              m.descr AS marca,
              CASE WHEN pi.codprod IS NULL THEN COALESCE(g.descr, '') || ' (todos os produtos do grupo)'
                   ELSE COALESCE(pd.descr, pi.codprod) END AS descricao,
              CASE ${tipo} WHEN 'PERC' THEN trim(to_char(${valor}, 'FM999990D00')) || '%'
                           WHEN 'VALO' THEN 'R$ ' || trim(to_char(${valor}, 'FM999999990D00'))
                           WHEN 'PREF' THEN 'preço fixo' ELSE '' END AS desconto,
              round(pd.prcompra::numeric, 2) AS prcompra,
              round(fp."PRECOVENDA"::numeric, 2) AS prvenda,
              round((CASE ${tipo}
                       WHEN 'PERC' THEN fp."PRECOVENDA" * (1 - ${valor} / 100)
                       WHEN 'VALO' THEN fp."PRECOVENDA" - ${valor}
                       WHEN 'PREF' THEN ${valor}
                       ELSE fp."PRECOVENDA" END)::numeric, 2) AS prpromocao,
              COALESCE(pi.qtd_total_item, pi.qtde_maxima_item, pr.qtde_maxima_total) AS qtd_limite,
              COALESCE(pi.qtdvendido, 0) AS qtd_vendida,
              pd.qtest AS estoque
         FROM dbpromocao_item pi
         JOIN dbpromocao pr ON pr.id_promocao = pi.id_promocao
         LEFT JOIN dbprod pd ON pd.codprod = pi.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbgpprod g ON g.codgpp = pi.codgpp
         LEFT JOIN dbformacaoprvenda fp ON fp."CODPROD" = pi.codprod AND fp."TIPOPRECO" = 0
        ${onde.length ? `WHERE ${onde.join(' AND ')}` : ''}
        ORDER BY pr.data_inicio DESC, pr.id_promocao, ref`, params)).rows;
    numeros(rows, ['prcompra', 'prvenda', 'prpromocao', 'qtd_limite', 'qtd_vendida', 'estoque']);
    for (const r of rows) {
      r.lucro = r.prcompra > 0 && r.prpromocao != null ? Math.round(((r.prpromocao / r.prcompra) * 100 - 100) * 100) / 100 : null;
    }
    const nProd = rows.filter((r) => !String(r.ref || '').startsWith('Grupo ')).length;
    return {
      linhas: rows,
      colunas: colunasPara(analise),
      resumo: [`${nProd} produto(s) e ${rows.length - nProd} grupo(s) em promoção`],
    };
  },
};
