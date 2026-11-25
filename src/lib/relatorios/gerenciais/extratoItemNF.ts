import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { condPeriodo, exigirPeriodo, fmtNum, numeros } from './_utilC';

/**
 * Relatórios › Gerenciais › Extrato de Item de Nota Fiscal (Delphi: FrmRelatorioNotaFiscal, aba
 * tabExtItem / CONSULTAPRODUTO.EXTRATO_ITEM_NOTA_FISCAL). Entradas (NF de compra) e saídas
 * (NF de venda, CFOP 5/6/7) de um produto no período, com preço médio de venda.
 * Diferenças deliberadas: sem seletor de armazém (romaneio por armazém quase vazio no PG; a entrada
 * usa a quantidade do item) e sem as saídas por documento interno (dbitdocinterno não existe no PG).
 */
export const relatorio: Relatorio = {
  slug: 'extratoItemNF',
  titulo: 'Extrato de Item de Nota Fiscal',
  descricao:
    'Entradas (notas de compra) e saídas (notas fiscais de venda com CFOP 5, 6 ou 7) de um produto no período, agrupadas por nota, com o preço médio de venda. ' +
    'Atenção: os itens das notas de saída só existem no sistema novo a partir de 08/2026 e as entradas a partir de 2025; saídas por documento interno não entram.',
  filtros: [
    { campo: 'produto', rotulo: 'Produto', tipo: 'lookup', lookup: 'produto', obrigatorio: true, largura: 2 },
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true },
  ],
  colunas: [
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'nota', titulo: 'Nº nota' },
    { campo: 'codcf', titulo: 'Cód. cli/forn' },
    { campo: 'nomecf', titulo: 'Cliente / fornecedor' },
    { campo: 'sit', titulo: 'Operação' },
    { campo: 'preco', titulo: 'Preço unitário', tipo: 'moeda' },
    { campo: 'quantidade', titulo: 'Quantidade', tipo: 'numero' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda' },
  ],
  async executar(db, p) {
    exigirPeriodo(p);
    const codprod = String(p.produto || '').trim();
    if (!codprod) throw new RelatorioValidacaoError('Informe o produto.');
    const prod = (await db.query(
      `SELECT ref, descr, COALESCE(qtest, 0) AS qtest, COALESCE(qtest_filial, 0) AS qtest_filial,
              COALESCE(qtdreservada, 0) AS qtdreservada
         FROM dbprod WHERE codprod = $1`, [codprod])).rows[0];
    if (!prod) throw new RelatorioValidacaoError('Produto não encontrado.');

    const params: any[] = [codprod];
    const perEnt = condPeriodo('e.dtent', params, p.de, p.ate);
    const perFat = condPeriodo('f.data', params, p.de, p.ate);
    const rows = (await db.query(
      `SELECT * FROM (
         SELECT to_char(e.dtent::date, 'YYYY-MM-DD') AS data, e.nroform AS nota, e.cod_credor AS codcf,
                c.nome AS nomecf, 'E' AS sit, round(ie.prunit::numeric, 2) AS preco, sum(ie.quant) AS quantidade
           FROM dbitent ie
           JOIN dbent e ON e.codent = ie.codent
           LEFT JOIN dbcredor c ON c.cod_credor = e.cod_credor
          WHERE ie.codprod = $1 AND COALESCE(e.status, '') <> 'C' AND ${perEnt.join(' AND ')}
          GROUP BY 1, 2, 3, 4, 6
         UNION ALL
         SELECT to_char(f.data, 'YYYY-MM-DD'), f.nroform, f.codcli, c.nome, 'S',
                round(pf.prunit::numeric, 2), sum(pf.qtde)
           FROM dbprodfat pf
           JOIN dbfatura f ON f.codfat = pf.codfat
           LEFT JOIN dbclien c ON c.codcli = f.codcli
          WHERE pf.codprod = $1 AND COALESCE(f.cancel, 'N') = 'N' AND left(pf.cfop, 1) IN ('5', '6', '7')
            AND ${perFat.join(' AND ')}
          GROUP BY 1, 2, 3, 4, 6
       ) t ORDER BY data, sit, nota`, params)).rows;
    numeros(rows, ['preco', 'quantidade']);
    for (const r of rows) r.total = Math.round(r.preco * r.quantidade * 100) / 100;

    const ent = rows.filter((r) => r.sit === 'E').reduce((s, r) => s + r.quantidade, 0);
    const sai = rows.filter((r) => r.sit === 'S');
    const qSai = sai.reduce((s, r) => s + r.quantidade, 0);
    const vSai = sai.reduce((s, r) => s + r.total, 0);
    const medio = qSai ? vSai / qSai : 0;
    const qtest = Number(prod.qtest);
    return {
      linhas: rows,
      resumo: [
        `${prod.ref || ''} — ${prod.descr || ''}`,
        `(E) Entradas: ${fmtNum(ent)} · (S) Saídas: ${fmtNum(qSai)} · Saldo do movimento: ${fmtNum(ent - qSai)} · Preço médio de venda: R$ ${fmtNum(medio, 2)}`,
        `Estoque físico: ${fmtNum(qtest + Number(prod.qtest_filial))} · Disponível: ${fmtNum(qtest - Number(prod.qtdreservada))}`,
      ],
    };
  },
};
