import type { ColunaDef, Relatorio } from '../tipos';
import { CFOP_SEM_COBRANCA, DOC_FATURA, FATURA_CLIENTE, consultar, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Faturas sem Títulos de Cobrança
 * (Delphi: frmRelFatura / TabTitulo_sem_Cobranca — FATURA_SEM_TITULO_REL e, no painel "Vendedor",
 * CONS_FATURASEMTITULO).
 * Regra do legado: dbfatura cancel='N', tipodest='C', tipofat<>'2', cobranca='N' e CFOP 1 na lista fixa.
 * Acréscimo do web: opção de conferir no Contas a Receber (dbreceb), que pega também as faturas marcadas
 * com cobrança mas sem título — título pela própria fatura (cod_fat) ou pelo grupo de faturas (codgp).
 */
const colunasDetalhe: ColunaDef[] = [
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'data', titulo: 'Data', tipo: 'data' },
  { campo: 'codfat', titulo: 'Fatura' },
  { campo: 'nroform', titulo: 'Formulário' },
  { campo: 'documento', titulo: 'Doc.' },
  { campo: 'codcli', titulo: 'Cód. cliente' },
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'cfop', titulo: 'CFOP' },
  { campo: 'cobranca', titulo: 'Marcada c/ cobrança' },
  { campo: 'totalprod', titulo: 'Total produtos', tipo: 'moeda', total: true },
  { campo: 'totalnf', titulo: 'Total NF', tipo: 'moeda', total: true },
  { campo: 'totalfat', titulo: 'Total fatura', tipo: 'moeda', total: true },
];
const colunasResumo: ColunaDef[] = [
  { campo: 'codvend', titulo: 'Cód.' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'quant', titulo: 'Qtde faturas', tipo: 'inteiro', total: true },
  { campo: 'totalprod', titulo: 'Total produtos', tipo: 'moeda', total: true },
  { campo: 'totalnf', titulo: 'Total NF', tipo: 'moeda', total: true },
  { campo: 'totalfat', titulo: 'Total fatura', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'faturasSemTitulos',
  titulo: 'Faturas sem Títulos de Cobrança',
  descricao:
    'Faturas emitidas (não canceladas, para cliente) sem cobrança gerada, para o financeiro gerar os títulos. ' +
    'Regra do sistema antigo: fatura com o indicador de cobrança = "N" e CFOP de venda (5102, 5403, 5405, 6102, 6108, 6403, 6404 ou sem CFOP). ' +
    'Marcando "Conferir no Contas a Receber", lista as faturas que não têm nenhum título ativo (pela fatura ou pelo grupo de faturas), mesmo que estejam marcadas com cobrança — os títulos (dbreceb) só existem no banco novo a partir de 08/2025, então use essa conferência só para períodos desde então. ' +
    'A visão "Resumo por vendedor" substitui o painel "Clientes por Vendedor".',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da fatura)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'visao', rotulo: 'Visão', tipo: 'select', obrigatorio: true, padrao: 'detalhe',
      opcoes: [{ valor: 'detalhe', rotulo: 'Faturas (por vendedor)' }, { valor: 'resumo', rotulo: 'Resumo por vendedor' }] },
    { campo: 'documento', rotulo: 'Documento', tipo: 'select', padrao: 'T',
      opcoes: [{ valor: 'T', rotulo: 'Todos' }, { valor: 'F', rotulo: 'F.A.G.' }, { valor: 'N', rotulo: 'N.F.' }] },
    { campo: 'clientes', rotulo: 'Clientes', tipo: 'lookup', lookup: 'cliente', multiplo: true },
    { campo: 'conferir_receber', rotulo: 'Conferir no Contas a Receber (sem título ativo)', tipo: 'checkbox', padrao: false },
  ],
  colunas: colunasDetalhe,
  quebra: 'vendedor',
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const params: any[] = [de, ate, CFOP_SEM_COBRANCA];
    const onde = [
      `f.data BETWEEN $1::date AND $2::date`, `f.cancel = 'N'`, FATURA_CLIENTE('f'),
      `COALESCE(NULLIF(f.cfop1, ''), '0') = ANY($3)`,
    ];
    if (p.documento === 'F') onde.push(`f.tipofat = '3'`);
    else if (p.documento === 'N') onde.push(`COALESCE(f.tipofat, '1') <> '3'`);
    if (p.clientes) { params.push(p.clientes); onde.push(`f.codcli = ANY($${params.length})`); }
    if (!p.conferir_receber) onde.push(`f.cobranca = 'N'`);

    // Conferência no Contas a Receber: títulos ativos das faturas candidatas, pela fatura ou pelo grupo
    // (junção por hash — dbreceb não tem índice em cod_fat/codgp).
    const avisos = p.conferir_receber && de < '2025-08-01'
      ? ['Os títulos do Contas a Receber só existem no banco novo a partir de 08/2025: faturas anteriores aparecem como sem título.'] : [];
    const base = `
      WITH cand AS (SELECT f.* FROM dbfatura f WHERE ${onde.join(' AND ')})
      ${p.conferir_receber ? `,
      tit_fat AS (SELECT DISTINCT r.cod_fat FROM dbreceb r JOIN cand ON cand.codfat = r.cod_fat WHERE COALESCE(r.cancel, 'N') <> 'S'),
      tit_gp AS (SELECT DISTINCT r.codgp FROM dbreceb r JOIN (SELECT DISTINCT codgp FROM cand WHERE codgp IS NOT NULL) g ON g.codgp = r.codgp
                  WHERE COALESCE(r.cancel, 'N') <> 'S')` : ''}
      SELECT %CAMPOS%
        FROM cand f
        LEFT JOIN dbclien c ON c.codcli = f.codcli
        LEFT JOIN dbvend v ON v.codvend = f.codvend
        ${p.conferir_receber ? `LEFT JOIN tit_fat tf ON tf.cod_fat = f.codfat LEFT JOIN tit_gp tg ON tg.codgp = f.codgp
       WHERE tf.cod_fat IS NULL AND tg.codgp IS NULL` : ''}`;
    if (p.visao === 'resumo') {
      const linhas = await consultar(db, base.replace('%CAMPOS%',
        `f.codvend, COALESCE(v.nome, '(sem vendedor)') AS vendedor, count(*) AS quant,
                round(COALESCE(sum(f.totalprod), 0), 2) AS totalprod, round(COALESCE(sum(f.totalnf), 0), 2) AS totalnf,
                round(COALESCE(sum(f.totalfat), 0), 2) AS totalfat`) + ' GROUP BY 1, 2 ORDER BY 2', params);
      return { linhas: numerosDasColunas(linhas, colunasResumo), colunas: colunasResumo, quebra: null, avisos };
    }
    const linhas = await consultar(db, base.replace('%CAMPOS%',
      `COALESCE(v.nome, '(sem vendedor)') AS vendedor, to_char(f.data, 'YYYY-MM-DD') AS data, f.codfat, f.nroform,
              ${DOC_FATURA('f')} AS documento,
              f.codcli, c.nome AS cliente, f.cfop1 AS cfop, f.cobranca,
              f.totalprod, f.totalnf, f.totalfat`) + ' ORDER BY 1, c.nome, f.data, f.codfat', params);
    return { linhas: numerosDasColunas(linhas, colunasDetalhe), colunas: colunasDetalhe, quebra: 'vendedor', avisos };
  },
};
