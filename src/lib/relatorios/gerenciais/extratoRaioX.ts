import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { condPeriodo, fmtNum, numeros, somar } from './_utilC';

/**
 * Relatórios › Gerenciais › Extrato Produto - Raio-X (Delphi: frmProduto_RaioX /
 * CONSULTAPRODUTO.PRODUTO_RAIOX). Toda a movimentação de UM produto, com saldo linha a linha.
 * Diferenças deliberadas:
 *  - sem seletor de armazém: as vendas do PG estão todas no GERAL e o romaneio por armazém
 *    (dbitent_armazem) quase não tem linhas — a entrada usa a quantidade do item (dbitent.quant);
 *    transferências entre armazéns (somam zero no total) ficam de fora;
 *  - sem acertos (dbacerto não existe no PG);
 *  - saldo: por padrão ancorado no estoque atual (saldo final = qtest), porque o histórico no PG
 *    é incompleto; a opção "desde zero" reproduz o legado (soma tudo a partir de 0).
 */
export const relatorio: Relatorio = {
  slug: 'extratoRaioX',
  titulo: 'Extrato Produto - Raio-X',
  descricao:
    'Movimentação completa de um produto (vendas, entradas, garantias e ajustes de inventário) com o saldo de estoque linha a linha. ' +
    'O histórico no sistema novo é parcial (vendas desde 2024, entradas desde 2025, inventário quase vazio), por isso o saldo é calculado a partir do estoque atual. ' +
    'Acertos de estoque e transferências entre armazéns não entram (sem tabela/sem movimento).',
  paisagem: true,
  filtros: [
    { campo: 'produto', rotulo: 'Produto', tipo: 'lookup', lookup: 'produto', obrigatorio: true, largura: 2 },
    { campo: 'periodo', rotulo: 'Período (opcional)', tipo: 'periodo', padrao: { de: '', ate: '' },
      ajuda: 'Em branco mostra toda a movimentação. O saldo considera também o que ficou fora do período.' },
    { campo: 'saldo', rotulo: 'Saldo', tipo: 'select', padrao: 'atual',
      opcoes: [
        { valor: 'atual', rotulo: 'A partir do estoque atual' },
        { valor: 'zero', rotulo: 'Desde zero (como no Delphi)' },
      ] },
  ],
  colunas: [
    { campo: 'tipodoc', titulo: 'Tipo doc.' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'documento', titulo: 'Nro. doc.' },
    { campo: 'codcf', titulo: 'Cód. cli/forn' },
    { campo: 'nomecf', titulo: 'Cliente / fornecedor' },
    { campo: 'sit', titulo: 'Mov.' },
    { campo: 'quantidade', titulo: 'Quantidade', tipo: 'numero' },
    { campo: 'preco', titulo: 'Preço', tipo: 'moeda' },
    { campo: 'movimentacao', titulo: 'Movimentação', tipo: 'numero', total: true },
    { campo: 'saldo', titulo: 'Saldo estoque', tipo: 'numero' },
  ],
  async executar(db, p) {
    const codprod = String(p.produto || '').trim();
    if (!codprod) throw new RelatorioValidacaoError('Informe o produto.');

    const prod = (await db.query(
      `SELECT pd.codprod, pd.ref, pd.descr, m.descr AS marca, pd.local,
              COALESCE(pd.qtest, 0) AS qtest, COALESCE(pd.qtest_filial, 0) AS qtest_filial,
              COALESCE(pd.qtdreservada, 0) AS qtdreservada
         FROM dbprod pd LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
        WHERE pd.codprod = $1`, [codprod])).rows[0];
    if (!prod) throw new RelatorioValidacaoError('Produto não encontrado.');
    const qtest = Number(prod.qtest);

    const desdeZero = p.saldo === 'zero';
    const params: any[] = [codprod];
    if (!desdeZero) params.push(qtest);
    const filtroPer = condPeriodo('z.data', params, p.de, p.ate);
    const rows = (await db.query(
      `WITH mov AS (
         SELECT 'GARANTIA' AS tipodoc, g.dt_gar::date AS data, 'G' || g.codgar AS documento,
                g.codcli AS codcf, c.nome AS nomecf, 'S' AS sit, i.qtde AS quant, i.prunit AS preco
           FROM dbitgarantiaprod i
           JOIN dbgarantiaprod g ON g.codgar = i.codgar
           LEFT JOIN dbclien c ON c.codcli = g.codcli
          WHERE i.codprod = $1 AND COALESCE(g.cancel, 'N') = 'N'
         UNION ALL
         SELECT 'VENDA', v.data::date, COALESCE(v.tipo, '') || v.nrovenda, v.codcli, c.nome, 'S',
                sum(iv.qtd), avg(iv.prunit)
           FROM dbitvenda iv
           JOIN dbvenda v ON v.codvenda = iv.codvenda
           LEFT JOIN dbclien c ON c.codcli = v.codcli
          WHERE iv.codprod = $1 AND COALESCE(v.cancel, 'N') = 'N' AND COALESCE(v.estoque_virtual, 'N') = 'N'
          GROUP BY v.data::date, COALESCE(v.tipo, '') || v.nrovenda, v.codcli, c.nome
         UNION ALL
         SELECT 'ENTRADA', e.dtent::date, e.codent, e.cod_credor, cr.nome, 'E', sum(ie.quant), avg(ie.prunit)
           FROM dbitent ie
           JOIN dbent e ON e.codent = ie.codent
           LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
          WHERE ie.codprod = $1 AND COALESCE(e.status, '') <> 'C'
          GROUP BY e.dtent::date, e.codent, e.cod_credor, cr.nome
         UNION ALL
         SELECT 'INVENTÁRIO', iv.data::date,
                'AJ' || lpad((row_number() OVER (ORDER BY iv.data))::text, 9, '0'),
                NULL, 'AJUSTE DE INVENTÁRIO', CASE WHEN iv.operacao = 'SUBTRAIU' THEN 'S' ELSE 'E' END,
                abs(COALESCE(iv.qtd_ant, 0) - COALESCE(iv.qtd_cont, 0)), 0
           FROM dbinventario_melo iv
          WHERE lpad(iv.codprod, 6, '0') = $1 AND COALESCE(iv.ajuste, 0) <> 0
       ), z AS (
         SELECT m.*, CASE WHEN m.sit = 'S' THEN -m.quant ELSE m.quant END AS movimentacao,
                sum(CASE WHEN m.sit = 'S' THEN -m.quant ELSE m.quant END)
                  OVER (ORDER BY m.data, m.sit, m.documento ROWS UNBOUNDED PRECEDING) AS acumulado,
                sum(CASE WHEN m.sit = 'S' THEN -m.quant ELSE m.quant END) OVER () AS total_mov
           FROM mov m
       )
       SELECT z.tipodoc, to_char(z.data, 'YYYY-MM-DD') AS data, z.documento, z.codcf, z.nomecf, z.sit,
              z.quant AS quantidade, round(z.preco::numeric, 2) AS preco, z.movimentacao,
              ${desdeZero ? 'z.acumulado' : '$2::numeric - z.total_mov + z.acumulado'} AS saldo
         FROM z
        ${filtroPer.length ? `WHERE ${filtroPer.join(' AND ')}` : ''}
        ORDER BY z.data, z.sit, z.documento`, params)).rows;
    numeros(rows, ['quantidade', 'preco', 'movimentacao', 'saldo']);

    const entradas = rows.filter((r) => r.sit === 'E').reduce((s, r) => s + r.quantidade, 0);
    const saidas = rows.filter((r) => r.sit === 'S').reduce((s, r) => s + r.quantidade, 0);
    const fis = qtest + Number(prod.qtest_filial);
    const disp = qtest - Number(prod.qtdreservada);
    const resumo = [
      `${prod.ref || ''} — ${prod.descr || ''} · Marca: ${prod.marca || '-'} · Locação: ${prod.local || '-'}`,
      `Estoque físico: ${fmtNum(fis)} · Disponível: ${fmtNum(disp)} · Em transferência (filial): ${fmtNum(Number(prod.qtest_filial))}`,
      `(E) Entradas: ${fmtNum(entradas)} · (S) Saídas: ${fmtNum(saidas)} · Saldo do movimento: ${fmtNum(somar(rows, 'movimentacao'))}`,
    ];
    const avisos = desdeZero
      ? ['Saldo calculado desde zero (como no Delphi): com o histórico parcial do sistema novo ele não bate com o estoque atual.']
      : [];
    return { linhas: rows, resumo, avisos };
  },
};
