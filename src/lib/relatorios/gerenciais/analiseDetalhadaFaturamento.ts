import type { ColunaDef, Relatorio } from '../tipos';
import {
  AVISO_ITENS, FATURA_CLIENTE, MEDIDAS, OPCOES_AGRUPAR, agruparItens, aplicarMargem, consultar, cteItensFaturados,
  numerosDasColunas, participacao, periodo,
} from './_utilB';

/**
 * Relatórios › Gerenciais › Análise Detalhada do Faturamento (Delphi: frmAnaliseDetalhadaFaturamento, sem
 * fonte — DFM recuperado do executável; procedures ANALISE_DETALHADA_FATURA_MES/_DIAS,
 * ANALISE_DET_DADOS_GERAIS_MES/_DIA, ANALISE_DET_BANCO e package ANALISE_DETALHADA_FAT).
 * Visões:
 *  - Histórico / dados gerais (por mês ou por dia): produtos faturados (totalprod − desconto %) em N.F. e
 *    F.A.G., total das notas, qtde de notas e títulos emitidos para essas notas (dbreceb, pela emissão do título,
 *    só nos meses/dias com nota). Usa só o cabeçalho
 *    das notas e o contas a receber — histórico completo.
 *  - Bancos: títulos das notas do período por banco (enviados, pagos, em aberto, atrasados).
 *  - Ranking: cliente, vendedor, grupo, marca ou produto (itens faturados, ver _utilB).
 * Diferenças: sem as tabelas TMP e o SQL dinâmico do legado (o "construtor de filtro" da aba Bancos virou os
 * filtros fixos desta tela); ramo D1 (morto) fora; "clientes não atendidos" está na Análise de Faturamento -
 * Telemarketing. Títulos: pela fatura (cod_fat) e também pelo grupo de faturas (codgp), que o legado não via.
 */
const COLUNAS: Record<string, ColunaDef[]> = {
  historico: [
    { campo: 'periodo', titulo: 'Período' },
    { campo: 'qtd_notas', titulo: 'Qtde notas', tipo: 'inteiro', total: true },
    { campo: 'nf_produtos', titulo: 'Produtos N.F.', tipo: 'moeda', total: true },
    { campo: 'fag_produtos', titulo: 'Produtos F.A.G.', tipo: 'moeda', total: true },
    { campo: 'produtos', titulo: 'Produtos faturados', tipo: 'moeda', total: true },
    { campo: 'nf_total', titulo: 'Total N.F.', tipo: 'moeda', total: true },
    { campo: 'fag_total', titulo: 'Total F.A.G.', tipo: 'moeda', total: true },
    { campo: 'total_notas', titulo: 'Notas faturadas', tipo: 'moeda', total: true },
    { campo: 'boletos', titulo: 'Títulos emitidos', tipo: 'moeda', total: true },
  ],
  bancos: [
    { campo: 'banco', titulo: 'Banco' },
    { campo: 'qtd', titulo: 'Qtde títulos', tipo: 'inteiro', total: true },
    { campo: 'valor', titulo: 'Valor', tipo: 'moeda', total: true },
    { campo: 'enviado', titulo: 'Enviado ao banco', tipo: 'moeda', total: true },
    { campo: 'pago', titulo: 'Pago', tipo: 'moeda', total: true },
    { campo: 'aberto', titulo: 'Em aberto', tipo: 'moeda', total: true },
    { campo: 'atrasado', titulo: 'Atrasado', tipo: 'moeda', total: true },
  ],
  ranking: [
    { campo: 'posicao', titulo: 'Pos.', tipo: 'inteiro' },
    { campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Descrição' },
    { campo: 'qtd', titulo: 'Qtde', tipo: 'inteiro', total: true },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
    { campo: 'custo', titulo: 'Custo', tipo: 'moeda', total: true },
    { campo: 'margem', titulo: 'Margem s/ custo (%)', tipo: 'percentual' },
    { campo: 'perc', titulo: '% do total', tipo: 'percentual' }, { campo: 'perc_acum', titulo: '% acumulado', tipo: 'percentual' },
  ],
};

export const relatorio: Relatorio = {
  slug: 'analiseDetalhadaFaturamento',
  titulo: 'Análise Detalhada do Faturamento',
  descricao:
    'Histórico do faturamento por mês ou por dia (produtos em N.F. e F.A.G., total das notas e títulos emitidos), situação dos títulos dessas notas por banco e ranking por cliente, vendedor, grupo, marca ou produto. ' +
    'Histórico e bancos usam o cabeçalho das notas (histórico completo) e o contas a receber, que no banco novo só tem títulos a partir de 08/2025. No ranking: ' + AVISO_ITENS,
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_ano', ate: 'hoje' } },
    { campo: 'visao', rotulo: 'Visão', tipo: 'select', obrigatorio: true, padrao: 'historico',
      opcoes: [{ valor: 'historico', rotulo: 'Histórico / dados gerais' }, { valor: 'bancos', rotulo: 'Bancos (títulos)' }, { valor: 'ranking', rotulo: 'Ranking' }] },
    { campo: 'detalhe', rotulo: 'Histórico por', tipo: 'select', padrao: 'mes',
      opcoes: [{ valor: 'mes', rotulo: 'Mês' }, { valor: 'dia', rotulo: 'Dia' }] },
    { campo: 'agrupar', rotulo: 'Ranking por', tipo: 'select', padrao: 'cliente',
      opcoes: OPCOES_AGRUPAR(['cliente', 'vendedor', 'grupo', 'marca', 'produto']) },
    { campo: 'grupos', rotulo: 'Grupos de produto (ranking)', tipo: 'lookup', lookup: 'grupo', multiplo: true },
    { campo: 'marcas', rotulo: 'Marcas (ranking)', tipo: 'lookup', lookup: 'marca', multiplo: true },
    { campo: 'sem_carteira', rotulo: 'Bancos: retirar a carteira (conta 0005)', tipo: 'checkbox', padrao: false },
  ],
  colunas: COLUNAS.historico,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const visao = String(p.visao || 'historico');
    const notas = `nf AS (
        SELECT f.codfat, f.codgp, f.data, f.tipofat, COALESCE(f.totalnf, 0) AS totalnf,
               round(COALESCE(f.totalprod, 0) - COALESCE(f.totalprod, 0) * COALESCE(f.desconto, 0) / 100, 2) AS produtos
          FROM dbfatura f
         WHERE f.data BETWEEN $1::date AND $2::date AND f.cancel = 'N' AND ${FATURA_CLIENTE('f')}
           AND COALESCE(f.tipodoc, 'V') IN ('V', 'N')),
      tit AS (
        SELECT r.* FROM dbreceb r
         WHERE COALESCE(r.cancel, 'N') = 'N' AND r.dt_emissao >= $1::date - 60  -- codgp antigos se repetem
           AND (r.cod_fat IN (SELECT codfat FROM nf) OR r.codgp IN (SELECT codgp FROM nf WHERE codgp IS NOT NULL)))`;

    if (visao === 'bancos') {
      const params: any[] = [de, ate];
      const linhas = await consultar(db,
        `WITH ${notas}
         SELECT COALESCE(b.nome, 'Banco ' || COALESCE(t.banco, '?')) AS banco, count(*) AS qtd,
                round(sum(COALESCE(t.valor_pgto, 0)), 2) AS valor,
                round(COALESCE(sum(t.valor_pgto) FILTER (WHERE t.bradesco = 'S'), 0), 2) AS enviado,
                round(COALESCE(sum(COALESCE(NULLIF(t.valor_rec, 0), t.valor_pgto)) FILTER (WHERE t.rec = 'S'), 0), 2) AS pago,
                round(COALESCE(sum(t.valor_pgto) FILTER (WHERE COALESCE(t.rec, 'N') <> 'S'), 0), 2) AS aberto,
                round(COALESCE(sum(t.valor_pgto) FILTER (WHERE COALESCE(t.rec, 'N') <> 'S' AND t.dt_venc < current_date), 0), 2) AS atrasado
           FROM tit t
           LEFT JOIN dbbanco_cobranca b ON b.banco::text = t.banco
          ${p.sem_carteira ? `WHERE COALESCE(t.cod_conta, '') <> '0005'` : ''}
          GROUP BY 1 ORDER BY valor DESC`, params);
      return { linhas: numerosDasColunas(linhas, COLUNAS.bancos), colunas: COLUNAS.bancos };
    }

    if (visao === 'ranking') {
      const params: any[] = [];
      const cte = cteItensFaturados(params, de, ate);
      const onde: string[] = [];
      if (p.marcas) { params.push(p.marcas); onde.push(`pd.codmarca = ANY($${params.length})`); }
      if (p.grupos) { params.push(p.grupos); onde.push(`pd.codgpp = ANY($${params.length})`); }
      const linhas = await agruparItens(db, {
        cte, params, dim: String(p.agrupar || 'cliente'), onde, ordenar: 'total',
        medidas: { qtd: MEDIDAS.qtd, total: MEDIDAS.total, custo: MEDIDAS.custo },
      });
      const m = aplicarMargem(linhas);
      participacao(linhas);
      const avisos = de <= '2026-07-31' && ate >= '2025-07-01' ? [AVISO_ITENS] : [];
      return { linhas, colunas: COLUNAS.ranking, totais: { margem: m, perc: 100, perc_acum: '', posicao: '' }, avisos };
    }

    const params: any[] = [de, ate];
    const fmt = p.detalhe === 'dia' ? 'YYYY-MM-DD' : 'YYYY/MM';
    const linhas = await consultar(db,
      `WITH ${notas},
       h AS (
         SELECT to_char(nf.data, '${fmt}') AS periodo, count(*) AS qtd_notas,
                sum(nf.produtos) FILTER (WHERE COALESCE(nf.tipofat, '') <> '3') AS nf_produtos,
                sum(nf.produtos) FILTER (WHERE nf.tipofat = '3') AS fag_produtos,
                sum(nf.produtos) AS produtos,
                sum(nf.totalnf) FILTER (WHERE COALESCE(nf.tipofat, '') <> '3') AS nf_total,
                sum(nf.totalnf) FILTER (WHERE nf.tipofat = '3') AS fag_total,
                sum(nf.totalnf) AS total_notas
           FROM nf GROUP BY 1),
       b AS (SELECT to_char(t.dt_emissao, '${fmt}') AS periodo, sum(COALESCE(t.valor_pgto, 0)) AS boletos FROM tit t GROUP BY 1)
       SELECT h.periodo, COALESCE(h.qtd_notas, 0) AS qtd_notas,
              round(COALESCE(h.nf_produtos, 0), 2) AS nf_produtos, round(COALESCE(h.fag_produtos, 0), 2) AS fag_produtos,
              round(COALESCE(h.produtos, 0), 2) AS produtos, round(COALESCE(h.nf_total, 0), 2) AS nf_total,
              round(COALESCE(h.fag_total, 0), 2) AS fag_total, round(COALESCE(h.total_notas, 0), 2) AS total_notas,
              round(COALESCE(b.boletos, 0), 2) AS boletos
         FROM h LEFT JOIN b ON b.periodo = h.periodo
        ORDER BY 1`, params);
    const colunas = COLUNAS.historico.map((c) => (c.campo === 'periodo' ? (p.detalhe === 'dia' ? { ...c, titulo: 'Dia', tipo: 'data' as const } : { ...c, titulo: 'Mês (ano/mês)' }) : c));
    return { linhas: numerosDasColunas(linhas, colunas), colunas };
  },
};
