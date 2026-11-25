import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import { exigirPeriodo, fmtNum, numeros, somar } from './_utilC';

/**
 * Relatórios › Gerenciais › Compras por Origem AB (Delphi: FrmRelComprasOrigemAB, menu invisível /
 * procedure RELATORIO_COMPRAS_ORIGEM_AB). Entradas com custo (temcusto = 'S') do período,
 * separadas por origem (A/B) e CFOP, com o total geral em compras.
 * Custo final como na Análise de Compra e Vendas (Prepara_Geral): valor − desconto % (se o item
 * não tem IPI) + custo financeiro % + IPI % + frete do conhecimento (se não CIF).
 * Diferenças deliberadas: o legado tinha o outer join invertido (E.NroCon (+)= Con.Nrocon), que
 * na prática virava inner join e sumia com as entradas sem conhecimento — aqui é LEFT JOIN de
 * dbent para dbconhecimentoent; filtros de origem e CFOP no SQL (o Delphi filtrava no cliente).
 */
const colunasPara = (porItem: boolean): ColunaDef[] => [
  { campo: 'codent', titulo: 'Entrada' },
  { campo: 'nota', titulo: 'Nota fiscal' },
  { campo: 'data', titulo: 'Data', tipo: 'data' },
  { campo: 'fornecedor', titulo: 'Fornecedor' },
  ...(porItem ? [
    { campo: 'ref', titulo: 'Referência' } as ColunaDef,
    { campo: 'descr', titulo: 'Descrição' } as ColunaDef,
    { campo: 'quant', titulo: 'Quant.', tipo: 'numero', total: true } as ColunaDef,
    { campo: 'prunit', titulo: 'Pr. unit.', tipo: 'moeda' } as ColunaDef,
  ] : []),
  { campo: 'origem', titulo: 'Origem' },
  { campo: 'cfop', titulo: 'CFOP' },
  { campo: 'cif', titulo: 'CIF' },
  { campo: 'comprado', titulo: 'Comprado (pr. × qtd.)', tipo: 'moeda', total: true },
  { campo: 'custo_final', titulo: 'Custo final', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'comprasOrigemAB',
  titulo: 'Compras por Origem AB',
  descricao:
    'Entradas de compra com custo no período, por origem (A/B) e CFOP, com o valor comprado e o custo final (desconto, custo financeiro, IPI e frete do conhecimento). ' +
    'No Delphi este item ficava escondido no menu. Entradas no sistema novo a partir de 2025.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true },
    { campo: 'origem_a', rotulo: 'Origem A', tipo: 'checkbox', padrao: true },
    { campo: 'origem_b', rotulo: 'Origem B', tipo: 'checkbox', padrao: true },
    { campo: 'cfop', rotulo: 'CFOP', tipo: 'texto', ajuda: '4 dígitos; vazio = todos' },
    { campo: 'detalhe', rotulo: 'Detalhar', tipo: 'select', padrao: 'entrada',
      opcoes: [{ valor: 'entrada', rotulo: 'Por entrada' }, { valor: 'item', rotulo: 'Por item' }] },
  ],
  colunas: colunasPara(false),
  quebra: 'origem',
  async executar(db, p) {
    exigirPeriodo(p);
    const origens = [p.origem_a ? 'A' : null, p.origem_b ? 'B' : null].filter(Boolean);
    if (!origens.length) throw new RelatorioValidacaoError('Marque a origem A e/ou a origem B.');
    const params: any[] = [p.de, p.ate, origens];
    let filtroCfop = '';
    if (p.cfop) {
      const cfop = String(p.cfop).replace(/\D/g, '');
      if (cfop.length !== 4) throw new RelatorioValidacaoError('O CFOP deve ter 4 dígitos.');
      params.push(cfop);
      filtroCfop = ` AND e.cfop = $${params.length}`;
    }
    const porItem = p.detalhe === 'item';
    const itens = `
      SELECT e.codent, e.nroform AS nota, to_char(e.dtent, 'YYYY-MM-DD') AS data,
             e.cod_credor || ' - ' || COALESCE(cr.nome, '') AS fornecedor,
             pd.ref, pd.descr, ie.quant, ie.prunit, e.origem, e.cfop, COALESCE(con.cif, '') AS cif,
             ie.quant * ie.prunit AS comprado, COALESCE(ie.ipi, 0) AS ipi,
             COALESCE(e.custofin, 0) AS fin, COALESCE(e.desconto, 0) AS desconto,
             CASE WHEN COALESCE(con.totaltransp, 0) > 0 AND con.cif = 'N' THEN con.totalcon / con.totaltransp ELSE 0 END AS coef_frete
        FROM dbent e
        JOIN dbitent ie ON ie.codent = e.codent
        LEFT JOIN dbprod pd ON pd.codprod = ie.codprod
        LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
        LEFT JOIN dbconhecimentoent con ON con.nrocon = e.nrocon AND con.codtransp = e.codtransp
       WHERE e.dtent >= $1::date AND e.dtent < ($2::date + 1) AND COALESCE(e.status, '') <> 'C'
         AND e.temcusto = 'S' AND e.origem = ANY($3)${filtroCfop}`;
    const custo = `
      SELECT c.*, (c.comprado - d.v + f.v + i.v) * (1 + c.coef_frete) AS custo_final
        FROM (${itens}) c
        CROSS JOIN LATERAL (SELECT CASE WHEN c.ipi > 0 THEN 0 ELSE c.comprado * c.desconto / 100 END AS v) d
        CROSS JOIN LATERAL (SELECT (c.comprado - d.v) * c.fin / 100 AS v) f
        CROSS JOIN LATERAL (SELECT (c.comprado - d.v + f.v) * c.ipi / 100 AS v) i`;
    const sql = porItem
      ? `SELECT codent, nota, data, fornecedor, ref, descr, quant, prunit, origem, cfop, cif,
                round(comprado::numeric, 2) AS comprado, round(custo_final::numeric, 2) AS custo_final
           FROM (${custo}) x ORDER BY origem, cfop, codent, ref`
      : `SELECT codent, nota, data, fornecedor, origem, cfop, cif,
                round(sum(comprado)::numeric, 2) AS comprado, round(sum(custo_final)::numeric, 2) AS custo_final
           FROM (${custo}) x GROUP BY 1, 2, 3, 4, 5, 6, 7 ORDER BY origem, cfop, codent`;
    const rows = (await db.query(sql, params)).rows;
    numeros(rows, ['quant', 'prunit', 'comprado', 'custo_final']);
    const porOrigem = (o: string) => somar(rows.filter((r) => r.origem === o), 'custo_final');
    return {
      linhas: rows,
      colunas: colunasPara(porItem),
      quebra: 'origem',
      resumo: [`Total geral em compras: R$ ${fmtNum(somar(rows, 'custo_final'), 2)}` +
        origens.map((o) => ` · Origem ${o}: R$ ${fmtNum(porOrigem(String(o)), 2)}`).join('')],
    };
  },
};
