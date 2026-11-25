import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { VINCULO_VENDA_FATURA, listaCodigos, numeros, semLacoAninhado } from './_utilD';

/**
 * Relatórios › Gerenciais › Licitações (Delphi: FrmConsultaLicitacao / procedure CONSULTA_LICITACOES).
 * Itens vendidos aos clientes de licitação (centro de custo 00005/00006/00007 e vendedor do
 * cliente 00008) com NF de CFOP 6108. Diferenças deliberadas:
 *  - só a filial atual (o Delphi escolhia MAO/PVH/REC/FLZ por dblink);
 *  - centros de custo, vendedor e CFOP viraram filtros (com os valores fixos do Delphi como padrão);
 *  - o vínculo venda → NF usa dbfecharvendas + fatura_venda, que no PG só têm o faturado pelo web;
 *    venda faturada (status F) sem vínculo entra com a data da venda e o CFOP do item (sem nº de NF);
 *  - coluna Total (qtd × preço) a mais, para somar.
 */
export const relatorio: Relatorio = {
  slug: 'licitacoes',
  titulo: 'Licitações',
  descricao: 'Itens das vendas a órgãos públicos de licitação (clientes dos centros de custo e do vendedor informados) com NF no CFOP informado. '
    + 'Atenção: o vínculo venda → nota fiscal só existe para o que foi faturado pelo sistema web (desde 08/2025); vendas faturadas antes disso '
    + 'aparecem sem nº de NF, com a data da venda e o CFOP do item (que no histórico costuma estar vazio — limpe o CFOP para vê-las). '
    + 'No legado não há vendas a esses clientes desde 2024.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da NF)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'opcao', rotulo: 'Tipo de venda', tipo: 'select', obrigatorio: true, padrao: 'T',
      opcoes: [
        { valor: 'T', rotulo: 'Todas' },
        { valor: 'N', rotulo: 'Venda normal (estocado, sem estoque virtual)' },
        { valor: 'V', rotulo: 'Venda virtual (estocado, estoque virtual)' },
        { valor: 'E', rotulo: 'Venda não estocada' },
      ] },
    { campo: 'centros_custo', rotulo: 'Centros de custo do cliente', tipo: 'texto', padrao: '00005,00006,00007', ajuda: 'Códigos separados por vírgula. Vazio = todos.' },
    { campo: 'vendedor_cliente', rotulo: 'Vendedor do cliente', tipo: 'texto', padrao: '00008', ajuda: 'Código do vendedor no cadastro do cliente (00008 no Delphi). Vazio = todos.' },
    { campo: 'cfop', rotulo: 'CFOP da NF', tipo: 'texto', padrao: '6108', ajuda: 'Vazio = qualquer CFOP.' },
  ],
  colunas: [
    { campo: 'nome', titulo: 'Cliente' },
    { campo: 'nrovenda', titulo: 'Venda' },
    { campo: 'nroform', titulo: 'NF' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'descr', titulo: 'Descrição' },
    { campo: 'qtd', titulo: 'Qtd', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Pr. unitário', tipo: 'moeda' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
  ],
  async executar(db, p) {
    if (!p.de || !p.ate) throw new RelatorioValidacaoError('Informe o período.');
    const params: any[] = [p.de, p.ate];
    const onde: string[] = [
      `COALESCE(v.cancel, 'N') = 'N'`,
      `(vf.codfat IS NOT NULL OR v.status = 'F')`,
      `COALESCE(vf.data, v.data::date) BETWEEN $1::date AND $2::date`,
      // corta cedo pela data da venda (a NF sai no máximo alguns dias depois)
      `v.data >= $1::date - 60 AND v.data < $2::date + 1`,
    ];
    const cc = listaCodigos(p.centros_custo);
    if (cc) { params.push(cc); onde.push(`c.codcc = ANY($${params.length})`); }
    const vend = listaCodigos(p.vendedor_cliente);
    if (vend) { params.push(vend); onde.push(`c.codvend = ANY($${params.length})`); }
    const cfop = listaCodigos(p.cfop);
    if (cfop) { params.push(cfop); onde.push(`COALESCE(vf.cfop1, iv.cfop) = ANY($${params.length})`); }
    if (p.opcao === 'N') onde.push(`pd.est = 'S' AND v.estoque_virtual = 'N'`);
    else if (p.opcao === 'V') onde.push(`pd.est = 'S' AND v.estoque_virtual = 'S'`);
    else if (p.opcao === 'E') onde.push(`pd.est = 'N' AND v.estoque_virtual = 'N'`);

    const rows = (await semLacoAninhado(db, () => db.query(
      `WITH vf AS MATERIALIZED (
         SELECT DISTINCT ON (x.codvenda) x.codvenda, f.codfat, f.nroform, f.data, f.cfop1
           FROM ${VINCULO_VENDA_FATURA} x
           JOIN dbfatura f ON f.codfat = x.codfat AND f.cancel = 'N'
          ORDER BY x.codvenda, f.data, f.codfat
       )
       SELECT c.nome, v.nrovenda, vf.nroform, COALESCE(vf.data, v.data::date)::text AS data,
              pd.ref, pd.descr, iv.qtd, iv.prunit, round((iv.qtd * iv.prunit)::numeric, 2) AS total
         FROM dbclien c
         JOIN dbvenda v ON v.codcli = c.codcli
         JOIN dbitvenda iv ON iv.codvenda = v.codvenda
         JOIN dbprod pd ON pd.codprod = iv.codprod
         LEFT JOIN vf ON vf.codvenda = v.codvenda
        WHERE ${onde.join(' AND ')}
        ORDER BY c.nome, v.nrovenda, pd.ref`, params))).rows;
    return { linhas: numeros(rows, ['qtd', 'prunit', 'total']) };
  },
};
