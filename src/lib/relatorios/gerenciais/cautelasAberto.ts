import type { ColunaDef, Relatorio } from '../tipos';
import { consultar, dataLocal, tsEntre, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Cautelas em Aberto (Delphi: frmRelFatura / tabCautelas_Aberto e
 * TabCautela_Aberto_Cliente — RELATO.CAUTELA_ABERTO, CAUTELA_EM_ABERTO_NOVA, CAUTELA_ABERTO_NOVA_OPERADOR).
 * Itens das vendas ainda não faturadas (status <> 'F', não canceladas, tipo C ou P), agrupados por venda.
 * Diferenças: o vendedor/operador vem do item da venda (dbitvenda.codvend / codoperador), no lugar de
 * dbvvend (não migrada). A sub-aba "2º Vendedor" (carteira cliente × grupo, view vwRelVendCliGpp) não
 * foi feita: depende de dbclivend, que não existe no banco novo. As abas por vendedor do Delphi só olhavam
 * cautelas tipo 'C' (sem movimento desde 2013); aqui entram também os pré-pedidos (tipo 'P').
 */
const colunas: ColunaDef[] = [
  { campo: 'venda', titulo: 'Venda' },
  { campo: 'data', titulo: 'Data', tipo: 'data' },
  { campo: 'status', titulo: 'Status' },
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'operador', titulo: 'Operador' },
  { campo: 'ref', titulo: 'Referência' },
  { campo: 'marca', titulo: 'Marca' },
  { campo: 'descr', titulo: 'Descrição' },
  { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
  { campo: 'prunit', titulo: 'Pr. unitário', tipo: 'moeda' },
  { campo: 'totalitem', titulo: 'Total item', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'cautelasAberto',
  titulo: 'Cautelas em Aberto',
  descricao:
    'Itens das vendas (cautelas e pré-pedidos) ainda não faturadas e não canceladas no período, agrupados por venda, com o valor em aberto. ' +
    'Filtre por vendedor ou operador de telemarketing (do item da venda) e por cliente. ' +
    'A visão "2º vendedor" do sistema antigo não está disponível (depende da carteira cliente × vendedor, dbclivend, que ainda não existe no banco novo). ' +
    'Observação: as vendas no banco novo vão até 06/2025 (mais as feitas pelo web).',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da venda)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_ano', ate: 'hoje' } },
    { campo: 'papel', rotulo: 'Vendedor como', tipo: 'select', padrao: 'vendedor',
      opcoes: [{ valor: 'vendedor', rotulo: 'Vendedor principal' }, { valor: 'operador', rotulo: 'Operador (telemarketing)' }] },
    { campo: 'vendedores', rotulo: 'Vendedores', tipo: 'lookup', lookup: 'vendedor', multiplo: true },
    { campo: 'clientes', rotulo: 'Clientes', tipo: 'lookup', lookup: 'cliente', multiplo: true },
  ],
  colunas,
  quebra: 'venda',
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const params: any[] = [de, ate];
    const onde = [
      tsEntre('v.data', '$1::date', '$2::date'), `COALESCE(v.status, '') <> 'F'`, `v.cancel = 'N'`, `v.tipo IN ('C', 'P')`,
    ];
    if (p.vendedores) {
      params.push(p.vendedores);
      onde.push(p.papel === 'operador' ? `i.codoperador = ANY($${params.length})` : `COALESCE(NULLIF(i.codvend, ''), v.codvend) = ANY($${params.length})`);
    } else if (p.papel === 'operador') onde.push(`NULLIF(i.codoperador, '') IS NOT NULL`);
    if (p.clientes) { params.push(p.clientes); onde.push(`v.codcli = ANY($${params.length})`); }
    const linhas = await consultar(db,
      `SELECT v.tipo || COALESCE(v.nrovenda, v.codvenda) || ' — ' || COALESCE(c.nome, v.codcli) AS venda,
              to_char(${dataLocal('v.data')}, 'YYYY-MM-DD') AS data, v.status,
              v.codcli || ' - ' || COALESCE(c.nome, '') AS cliente,
              vd.nome AS vendedor, op.nome AS operador,
              pd.ref, m.descr AS marca, COALESCE(pd.descr, i.descr) AS descr,
              i.qtd, i.prunit, round(COALESCE(i.qtd, 0) * COALESCE(i.prunit, 0), 2) AS totalitem
         FROM dbvenda v
         JOIN dbitvenda i ON i.codvenda = v.codvenda
         LEFT JOIN dbprod pd ON pd.codprod = i.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
         LEFT JOIN dbclien c ON c.codcli = v.codcli
         LEFT JOIN dbvend vd ON vd.codvend = COALESCE(NULLIF(i.codvend, ''), v.codvend)
         LEFT JOIN dbvend op ON op.codvend = NULLIF(i.codoperador, '')
        WHERE ${onde.join(' AND ')}
        ORDER BY v.data, v.codvenda, pd.ref`, params);
    return { linhas: numerosDasColunas(linhas, colunas) };
  },
};
