import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { numeros } from './_utilD';

/**
 * Relatórios › Gerenciais › Produtos por Clientes e FAGs (Delphi: FrmListagemClientesFags / procedure
 * CONSULTA_TOT_ITEM_POR_FAG). Itens de cada FAG (fatura tipofat 3, não cancelada) agrupados por
 * cliente e FAG. Diferenças deliberadas: a linha sintética "TOTAL" por FAG do legado virou o
 * subtotal da quebra da tela; filtros extras de cliente e marca. Os itens vêm de dbprodfat, que no
 * PG só tem as notas emitidas pelo web (desde 08/2026) — FAGs antigas saem sem itens.
 */
export const relatorio: Relatorio = {
  slug: 'produtosClientesFags',
  titulo: 'Produtos por Clientes e FAGs',
  descricao: 'Itens de cada FAG (fatura do tipo 3, não cancelada) no período, agrupados por cliente e FAG, com subtotal por FAG. '
    + 'Atenção: os itens de fatura só estão no banco novo para as notas emitidas pelo sistema web (desde 08/2026); '
    + 'as FAGs do histórico ainda não têm itens carregados e por isso não aparecem.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da FAG)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'clientes', rotulo: 'Clientes', tipo: 'lookup', lookup: 'cliente', multiplo: true },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
  ],
  colunas: [
    { campo: 'cliente_fag', titulo: 'Cliente e FAG' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'referencia', titulo: 'Referência' },
    { campo: 'descricao', titulo: 'Descrição' },
    { campo: 'codprod', titulo: 'Cód. produto' },
    { campo: 'qtde', titulo: 'Qtde', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Pr. unitário', tipo: 'moeda' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
  ],
  quebra: 'cliente_fag',
  async executar(db, p) {
    if (!p.de || !p.ate) throw new RelatorioValidacaoError('Informe o período.');
    const params: any[] = [p.de, p.ate];
    const onde = [`f.tipofat = '3'`, `f.cancel = 'N'`, `f.data BETWEEN $1::date AND $2::date`];
    if (p.clientes) { params.push(p.clientes); onde.push(`f.codcli = ANY($${params.length})`); }
    if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
    const rows = (await db.query(
      `SELECT 'UF: ' || COALESCE(c.uf, '') || ' - ' || c.codcli || ' - ' || COALESCE(c.nome, '') || ' == Nº FAG: ' || f.codfat AS cliente_fag,
              m.descr AS marca, pd.ref AS referencia, pd.descr AS descricao, pd.codprod,
              pf.qtde, pf.prunit, round((pf.qtde * pf.prunit)::numeric, 2) AS total
         FROM dbfatura f
         JOIN dbprodfat pf ON pf.codfat = f.codfat
         JOIN dbclien c ON c.codcli = f.codcli
         JOIN dbprod pd ON pd.codprod = pf.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
        WHERE ${onde.join(' AND ')}
        ORDER BY c.nome, f.codfat, m.descr, pd.ref`, params)).rows;
    return { linhas: numeros(rows, ['qtde', 'prunit', 'total']) };
  },
};
