import type { Relatorio } from '../tipos';
import { condPeriodo, exigirPeriodo, numeros, semNestedLoop } from './_utilC';

/**
 * Relatórios › Gerenciais › Pendência de Produtos (Delphi: frmRelGer_PendenciaProduto /
 * PENDENCIA.RELGERENCIAL_PENDENCIAPRODUTO). Itens de venda pendentes (dbpend) no período.
 * As 5 abas do Delphi (Referência, Cliente, Vendedor, Grupo, Marca) viram o filtro "Agrupar por".
 * Diferença deliberada: o vendedor vem de dbvenda.codvend (LEFT JOIN) — o legado exigia dbvvend
 * (operador = 'N'), que quase não tem linhas no PG e excluía as vendas sem vendedor.
 */
const AGRUPAR: Record<string, { campo: string; ordem: string }> = {
  ref: { campo: 'ref', ordem: 'pd.ref, v.data' },
  cliente: { campo: 'cliente', ordem: 'c.nome, v.data, pd.ref' },
  vendedor: { campo: 'vendedor', ordem: 'vd.nome, v.data, pd.ref' },
  grupo: { campo: 'grupo', ordem: 'g.descr, pd.ref, v.data' },
  marca: { campo: 'marca', ordem: 'm.descr, pd.ref, v.data' },
};

export const relatorio: Relatorio = {
  slug: 'pendenciaProdutos',
  titulo: 'Pendência de Produtos',
  descricao:
    'Itens de venda com quantidade pendente (não atendida) em vendas não canceladas do período, por referência, cliente, vendedor, grupo ou marca. ' +
    'Atenção: no sistema novo a maior parte das pendências migradas não tem a venda correspondente, então o relatório sai com poucas linhas até o histórico ser completado.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período da venda', tipo: 'periodo', obrigatorio: true },
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', padrao: 'ref',
      opcoes: [
        { valor: 'ref', rotulo: 'Referência' }, { valor: 'cliente', rotulo: 'Cliente' },
        { valor: 'vendedor', rotulo: 'Vendedor' }, { valor: 'grupo', rotulo: 'Grupo de produto' },
        { valor: 'marca', rotulo: 'Marca' },
      ] },
    { campo: 'produtos', rotulo: 'Produtos', tipo: 'lookup', lookup: 'produto', multiplo: true },
    { campo: 'clientes', rotulo: 'Clientes', tipo: 'lookup', lookup: 'cliente', multiplo: true },
    { campo: 'vendedores', rotulo: 'Vendedores', tipo: 'lookup', lookup: 'vendedor', multiplo: true },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true },
  ],
  colunas: [
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'produto', titulo: 'Produto' },
    { campo: 'grupo', titulo: 'Grupo' },
    { campo: 'cliente', titulo: 'Cliente' },
    { campo: 'vendedor', titulo: 'Vendedor' },
    { campo: 'tipo', titulo: 'Tipo' },
    { campo: 'nrovenda', titulo: 'Nº venda' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'qtdpend', titulo: 'Qtd. pendente', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Preço unit.', tipo: 'moeda' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
  ],
  quebra: 'ref',
  async executar(db, p) {
    exigirPeriodo(p);
    const ag = AGRUPAR[String(p.agrupar || 'ref')] || AGRUPAR.ref;
    const params: any[] = [];
    const onde = [`COALESCE(v.cancel, 'N') = 'N'`, ...condPeriodo('v.data', params, p.de, p.ate)];
    const lista = (v: any, col: string) => { if (v) { params.push(v); onde.push(`${col} = ANY($${params.length})`); } };
    lista(p.produtos, 'pd.codprod');
    lista(p.clientes, 'v.codcli');
    lista(p.vendedores, 'v.codvend');
    lista(p.grupos, 'pd.codgpp');
    lista(p.marcas, 'pd.codmarca');
    const rows = (await semNestedLoop(db, () => db.query(
      `SELECT pd.ref, m.descr AS marca, pd.descr AS produto, g.descr AS grupo,
              v.codcli || ' - ' || COALESCE(c.nome, '') AS cliente,
              CASE WHEN v.codvend IS NULL THEN NULL ELSE v.codvend || ' - ' || COALESCE(vd.nome, '') END AS vendedor,
              v.tipo, v.nrovenda, to_char(v.data, 'YYYY-MM-DD') AS data,
              pe.qtd AS qtdpend, round(it.prunit::numeric, 2) AS prunit,
              round((it.prunit * pe.qtd)::numeric, 2) AS total
         FROM dbpend pe
         JOIN dbvenda v ON v.codvenda = pe.codvenda
         JOIN dbitvenda it ON it.codvenda = pe.codvenda AND it.codprod = pe.codprod
         JOIN dbprod pd ON pd.codprod = pe.codprod
         LEFT JOIN dbclien c ON c.codcli = v.codcli
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbgpprod g ON g.codgpp = pd.codgpp
         LEFT JOIN dbvend vd ON vd.codvend = v.codvend
        WHERE ${onde.join(' AND ')}
        ORDER BY ${ag.ordem}`, params))).rows;
    numeros(rows, ['qtdpend', 'prunit', 'total']);
    return { linhas: rows, quebra: ag.campo };
  },
};
