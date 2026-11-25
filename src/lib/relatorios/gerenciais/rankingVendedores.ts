import type { ColunaDef, Relatorio } from '../tipos';
import { AVISO_ITENS, FATURA_CLIENTE, consultar, cteItensFaturados, numerosDasColunas, pct, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Ranking de Vendedores (Delphi: frmRelFatura / TabRankVendedor —
 * RELATO.RANKVEND_PRODFATURADOS + RELATO.OPERADORVENDA; a totalização era feita no Delphi, sem fonte).
 * Regra reconstruída: item de venda normal (dbvenda.tele<>'S') credita o vendedor da nota; item de venda de
 * telemarketing credita o operador (dbitvenda.codoperador, no lugar de dbvvend operador='S'; sem operador,
 * fica com o vendedor). % atingido = total ÷ objetivo do cadastro (dbvend.valobj — a tabela de metas
 * DBVENDEDOR_META não foi migrada). Ramo D1 do legado (sem movimento desde 2009) não entra.
 * Base "Notas": soma o total de produtos do cabeçalho das notas por vendedor da nota — cobre todo o
 * histórico de dbfatura, mas não separa normal × telemarketing.
 */
const colunasCompleto: ColunaDef[] = [
  { campo: 'posicao', titulo: 'Pos.', tipo: 'inteiro' },
  { campo: 'codvend', titulo: 'Código' },
  { campo: 'nome', titulo: 'Vendedor' },
  { campo: 'valorobj', titulo: 'Objetivo', tipo: 'moeda', total: true },
  { campo: 'valornormal', titulo: 'Venda normal', tipo: 'moeda', total: true },
  { campo: 'valortele', titulo: 'Telemarketing', tipo: 'moeda', total: true },
  { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
  { campo: 'percatingido', titulo: '% atingido', tipo: 'percentual' },
];
const colunasPerc: ColunaDef[] = colunasCompleto.filter((c) => ['posicao', 'codvend', 'nome', 'percatingido'].includes(c.campo));

export const relatorio: Relatorio = {
  slug: 'rankingVendedores',
  titulo: 'Ranking de Vendedores',
  descricao:
    'Faturamento por vendedor no período, separando a venda normal da venda de telemarketing (creditada ao operador), comparado com o objetivo do cadastro do vendedor (% atingido). ' +
    'Base "Itens": ' + AVISO_ITENS + ' Base "Notas": total de produtos das notas por vendedor da nota, com todo o histórico, mas sem separar telemarketing. ' +
    'O objetivo é o valor do cadastro do vendedor (mensal), sem proporção pelo tamanho do período.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'base', rotulo: 'Base', tipo: 'select', obrigatorio: true, padrao: 'itens',
      opcoes: [{ valor: 'itens', rotulo: 'Itens (normal × telemarketing)' }, { valor: 'notas', rotulo: 'Notas (cabeçalho)' }] },
    { campo: 'modo', rotulo: 'Mostrar', tipo: 'select', obrigatorio: true, padrao: 'completo',
      opcoes: [{ valor: 'completo', rotulo: 'Completo' }, { valor: 'perc', rotulo: 'Apenas % atingido' }] },
  ],
  colunas: colunasCompleto,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const params: any[] = [];
    let sql: string;
    if (p.base === 'notas') {
      params.push(de, ate);
      sql = `WITH t AS (
               SELECT f.codvend AS cod, sum(COALESCE(f.totalprod, 0)) AS normal, 0::numeric AS tele
                 FROM dbfatura f
                WHERE f.data BETWEEN $1::date AND $2::date AND f.cancel = 'N' AND ${FATURA_CLIENTE('f')}
                GROUP BY 1)`;
    } else {
      sql = `WITH ${cteItensFaturados(params, de, ate)},
             t AS (
               SELECT CASE WHEN i.tele = 'S' THEN COALESCE(i.codoperador, i.codvend) ELSE i.codvend END AS cod,
                      sum(i.valor) FILTER (WHERE i.tele <> 'S') AS normal,
                      sum(i.valor) FILTER (WHERE i.tele = 'S') AS tele
                 FROM itf i GROUP BY 1)`;
    }
    const linhas = await consultar(db,
      `${sql}
       SELECT t.cod AS codvend, COALESCE(v.nome, '(sem vendedor)') AS nome, COALESCE(v.valobj, 0) AS valorobj,
              round(COALESCE(t.normal, 0), 2) AS valornormal, round(COALESCE(t.tele, 0), 2) AS valortele,
              round(COALESCE(t.normal, 0) + COALESCE(t.tele, 0), 2) AS total
         FROM t LEFT JOIN dbvend v ON v.codvend = t.cod
        WHERE COALESCE(t.normal, 0) + COALESCE(t.tele, 0) <> 0
        ORDER BY total DESC`, params);
    numerosDasColunas(linhas, colunasCompleto);
    linhas.forEach((l, k) => { l.posicao = k + 1; l.percatingido = l.valorobj ? pct(l.total, l.valorobj) : null; });
    const totObj = linhas.reduce((s, l) => s + l.valorobj, 0);
    const tot = linhas.reduce((s, l) => s + l.total, 0);
    const avisos = p.base === 'notas' ? [] : (de < '2026-08-01' && ate > '2025-06-30' ? [AVISO_ITENS] : []);
    return {
      linhas,
      colunas: p.modo === 'perc' ? colunasPerc : colunasCompleto,
      totais: { percatingido: pct(tot, totObj), posicao: '' },
      avisos,
    };
  },
};
