import { RelatorioValidacaoError, type ColunaDef, type Relatorio } from '../tipos';
import {
  AVISO_ITENS, FATURA_CLIENTE, MEDIDAS, OPCOES_AGRUPAR, agruparItens, consultar, cteItensFaturados, numerosDasColunas, participacao, periodo,
} from './_utilB';

/**
 * Relatórios › Gerenciais › Análise de Faturamento - Telemarketing (Delphi: FrmAnaliseFaturamentoTeleMkt —
 * ANALISE_TELEMARKETING.VENDEDOR_NAO_TELE, VENDEDOR_OPERADOR, RANKING_CLIENTE/MARCA/GRUPO/VENDEDOR,
 * CLIENTES_VENDEDOR, e SQL dinâmico via FILTRO para o "faturado").
 * Regra central do legado: venda de telemarketing (dbvenda.tele='S') é crédito do operador; a venda normal,
 * do vendedor da nota. O operador vem de dbitvenda.codoperador (dbvvend operador='S' não foi migrada); venda
 * tele sem operador fica com o vendedor. Visões:
 *  - Vendedor (valor real): venda direta × como operador, por grupo/marca/cliente/produto;
 *  - Faturado × real: por vendedor, total faturado como vendedor da nota, valor real e a diferença (tele);
 *  - Ranking telemarketing: só vendas tele, por cliente/marca/grupo/operador;
 *  - Clientes não atendidos: clientes da carteira do vendedor (dbclien.codvend) sem faturamento no período.
 * Diferenças: UNION do legado virou UNION ALL (não deduplica valores iguais); ramo D1 (morto) não entra.
 */
const base: ColunaDef[] = [{ campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Descrição' }];
const COLUNAS: Record<string, ColunaDef[]> = {
  vendedor: [...base, { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
    { campo: 'direto', titulo: 'Venda direta (R$)', tipo: 'moeda', total: true },
    { campo: 'operador', titulo: 'Como operador (R$)', tipo: 'moeda', total: true },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true }],
  faturado_real: [...base,
    { campo: 'faturado', titulo: 'Total faturado', tipo: 'moeda', total: true },
    { campo: 'real', titulo: 'Total vendedor (real)', tipo: 'moeda', total: true },
    { campo: 'diferenca', titulo: 'Diferença (telemarketing)', tipo: 'moeda', total: true }],
  ranking: [{ campo: 'posicao', titulo: 'Pos.', tipo: 'inteiro' }, ...base,
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
    { campo: 'perc', titulo: '% do total', tipo: 'percentual' }, { campo: 'perc_acum', titulo: '% acumulado', tipo: 'percentual' }],
  nao_atendidos: [{ campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Cliente' }, { campo: 'cidade', titulo: 'Cidade' },
    { campo: 'uf', titulo: 'UF' }, { campo: 'ultima_compra', titulo: 'Última nota', tipo: 'data' }],
};

export const relatorio: Relatorio = {
  slug: 'analiseFaturamentoTele',
  titulo: 'Análise de Faturamento - Telemarketing',
  descricao:
    'Faturamento de um vendedor separando a venda direta da venda como operador de telemarketing, comparação do faturado (vendedor da nota) com o valor real de cada vendedor, ranking das vendas de telemarketing e clientes da carteira não atendidos. ' +
    'Venda de telemarketing é creditada ao operador; sem operador no item, fica com o vendedor. ' + AVISO_ITENS,
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'visao', rotulo: 'Visão', tipo: 'select', obrigatorio: true, padrao: 'vendedor',
      opcoes: [{ valor: 'vendedor', rotulo: 'Vendedor (valor real)' }, { valor: 'faturado_real', rotulo: 'Faturado × real (por vendedor)' },
        { valor: 'ranking', rotulo: 'Ranking telemarketing' }, { valor: 'nao_atendidos', rotulo: 'Clientes não atendidos' }] },
    { campo: 'agrupar', rotulo: 'Agrupar por', tipo: 'select', obrigatorio: true, padrao: 'grupo',
      opcoes: OPCOES_AGRUPAR(['grupo', 'marca', 'cliente', 'produto', 'operador']),
      ajuda: 'Na visão Vendedor: grupo, marca, cliente ou produto. No ranking: cliente, marca, grupo ou operador.' },
    { campo: 'ordenar', rotulo: 'Ordenar por', tipo: 'select', padrao: 'total',
      opcoes: [{ valor: 'total', rotulo: 'Total' }, { valor: 'descricao', rotulo: 'Descrição' }] },
    { campo: 'vendedor', rotulo: 'Vendedor', tipo: 'lookup', lookup: 'vendedor', ajuda: 'Obrigatório nas visões Vendedor e Clientes não atendidos.' },
  ],
  colunas: COLUNAS.vendedor,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const visao = String(p.visao || 'vendedor');
    if ((visao === 'vendedor' || visao === 'nao_atendidos') && !p.vendedor) throw new RelatorioValidacaoError('Escolha o código do VENDEDOR.');
    const params: any[] = [];
    const avisos = de <= '2026-07-31' && ate >= '2025-07-01' ? [AVISO_ITENS] : [];
    const credito = `CASE WHEN i.tele = 'S' THEN COALESCE(i.codoperador, i.codvend) ELSE i.codvend END`;

    if (visao === 'nao_atendidos') {
      // carteira do vendedor sem nota no período (cabeçalho das notas: histórico completo)
      params.push(de, ate, p.vendedor);
      const linhas = await consultar(db,
        `WITH cart AS (SELECT codcli, nome, cidade, uf FROM dbclien WHERE codvend = $3),
         nf AS (SELECT f.codcli, max(f.data) AS ultima,
                       bool_or(f.data BETWEEN $1::date AND $2::date AND ${FATURA_CLIENTE('f')}) AS atendido
                  FROM dbfatura f JOIN cart ON cart.codcli = f.codcli
                 WHERE f.cancel = 'N' GROUP BY 1)
         SELECT c.codcli AS codigo, c.nome AS descricao, c.cidade, c.uf, to_char(nf.ultima, 'YYYY-MM-DD') AS ultima_compra
           FROM cart c LEFT JOIN nf ON nf.codcli = c.codcli
          WHERE NOT COALESCE(nf.atendido, false)
          ORDER BY ${p.ordenar === 'descricao' ? 'c.nome' : 'ultima_compra DESC NULLS LAST, c.nome'}`, params);
      return { linhas, colunas: COLUNAS.nao_atendidos, avisos: [] };
    }

    const cte = cteItensFaturados(params, de, ate);
    if (visao === 'faturado_real') {
      const linhas = await consultar(db,
        `WITH ${cte},
         t AS (SELECT i.codvend AS cod, i.valor AS faturado, CASE WHEN i.tele <> 'S' THEN i.valor ELSE 0 END AS real FROM itf i
               UNION ALL
               SELECT COALESCE(i.codoperador, i.codvend), 0, i.valor FROM itf i WHERE i.tele = 'S')
         SELECT t.cod AS codigo, COALESCE(v.nome, '(sem vendedor)') AS descricao,
                round(sum(t.faturado), 2) AS faturado, round(sum(t.real), 2) AS real, round(sum(t.faturado) - sum(t.real), 2) AS diferenca
           FROM t LEFT JOIN dbvend v ON v.codvend = t.cod
          GROUP BY 1, 2
          ORDER BY ${p.ordenar === 'descricao' ? '2' : 'real DESC'}`, params);
      return { linhas: numerosDasColunas(linhas, COLUNAS.faturado_real), colunas: COLUNAS.faturado_real, avisos };
    }

    if (visao === 'ranking') {
      const dim = p.agrupar === 'produto' || p.agrupar === 'operador' || !['cliente', 'marca', 'grupo'].includes(p.agrupar) ? 'operador' : p.agrupar;
      const linhas = await agruparItens(db, {
        cte, params, dim, onde: [`i.tele = 'S'`], medidas: { total: MEDIDAS.total }, ordenar: 'total',
      });
      if (dim === 'operador') {
        // sem operador no item: crédito do vendedor
        const semOp = linhas.find((l) => l.codigo == null);
        if (semOp) semOp.descricao = '(sem operador — crédito do vendedor)';
      }
      participacao(linhas);
      return { linhas, colunas: COLUNAS.ranking, totais: { perc: 100, perc_acum: '', posicao: '' }, avisos };
    }

    // visão Vendedor (valor real)
    params.push(p.vendedor);
    const v = `$${params.length}`;
    const dim = ['grupo', 'marca', 'cliente', 'produto'].includes(p.agrupar) ? p.agrupar : 'grupo';
    const linhas = await agruparItens(db, {
      cte, params, dim, ordenar: p.ordenar,
      onde: [`${credito} = ${v}`],
      medidas: {
        qtd: MEDIDAS.qtd,
        direto: `round(COALESCE(sum(i.valor) FILTER (WHERE i.tele <> 'S'), 0), 2)`,
        operador: `round(COALESCE(sum(i.valor) FILTER (WHERE i.tele = 'S'), 0), 2)`,
        total: MEDIDAS.total,
      },
    });
    return { linhas, colunas: COLUNAS.vendedor, avisos };
  },
};
