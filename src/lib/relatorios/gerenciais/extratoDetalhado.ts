import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { condPeriodo, exigirPeriodo, limitarPeriodo, numeros, semNestedLoop } from './_utilC';

/**
 * Relatórios › Gerenciais › Extrato Detalhado (Delphi: frmExtratoDetalhado / procedure
 * EXTRATO_DETALHADO + EXTRATO_DETALHADO_ZOOM). Movimentação de todos os produtos de uma marca no
 * período: vendas, entradas e garantias.
 * Diferenças deliberadas: sem acertos (dbacerto não existe no PG); UNION ALL em vez de UNION (o
 * legado sumia com linhas iguais); o nº da NF da venda vem num JOIN (o Delphi fazia uma consulta
 * por linha) e procura o vínculo venda→fatura em fatura_venda, dbfecharvendas e dbprodfat.
 */
export const relatorio: Relatorio = {
  slug: 'extratoDetalhado',
  titulo: 'Extrato Detalhado',
  descricao:
    'Movimentação de todos os produtos de uma marca no período: vendas (S), entradas de compra (E) e garantias (S), com o nº da nota fiscal da venda quando houver. ' +
    'Histórico parcial no sistema novo (vendas desde 2024, entradas desde 2025); acertos de estoque não entram.',
  paisagem: true,
  filtros: [
    { campo: 'marca', rotulo: 'Marca', tipo: 'lookup', lookup: 'marca', obrigatorio: true, largura: 2 },
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true },
    { campo: 'operacao', rotulo: 'Operação', tipo: 'select', padrao: 'T',
      opcoes: [{ valor: 'T', rotulo: 'Entradas e saídas' }, { valor: 'E', rotulo: 'Só entradas' }, { valor: 'S', rotulo: 'Só saídas' }] },
  ],
  colunas: [
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'ref', titulo: 'Referência' },
    { campo: 'reforiginal', titulo: 'Ref. original' },
    { campo: 'descr', titulo: 'Descrição' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'documento', titulo: 'Documento' },
    { campo: 'codcf', titulo: 'Cód. cli/forn' },
    { campo: 'nome', titulo: 'Nome' },
    { campo: 'sit', titulo: 'Operação' },
    { campo: 'quantidade', titulo: 'Quantidade', tipo: 'numero' },
    { campo: 'preco', titulo: 'Preço', tipo: 'moeda' },
    { campo: 'nroform', titulo: 'Nº NF' },
  ],
  async executar(db, p) {
    exigirPeriodo(p);
    limitarPeriodo(p, 400);
    if (!p.marca) throw new RelatorioValidacaoError('Informe a marca.');
    const params: any[] = [p.marca];
    const perG = condPeriodo('g.dt_gar', params, p.de, p.ate).join(' AND ');
    const perV = condPeriodo('v.data', params, p.de, p.ate).join(' AND ');
    const perE = condPeriodo('e.dtent', params, p.de, p.ate).join(' AND ');
    params.push(p.operacao === 'E' || p.operacao === 'S' ? p.operacao : 'T');
    const pOp = `$${params.length}::text`;

    const rows = (await semNestedLoop(db, () => db.query(
      `WITH prod AS (
         SELECT pd.codprod, pd.ref, pd.reforiginal, pd.descr, m.descr AS marca
           FROM dbprod pd LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
          WHERE pd.codmarca = $1
       ), vend AS (
         SELECT v.codvenda, iv.codprod, v.data, COALESCE(v.tipo, '') || v.nrovenda AS documento,
                v.codcli, iv.qtd, iv.prunit
           FROM dbitvenda iv
           JOIN prod ON prod.codprod = iv.codprod
           JOIN dbvenda v ON v.codvenda = iv.codvenda
          WHERE COALESCE(v.cancel, 'N') = 'N' AND ${perV}
       ), nf AS (
         SELECT x.codvenda, string_agg(DISTINCT f.nroform, ', ') AS nroform
           FROM (SELECT codvenda, codfat FROM fatura_venda WHERE codvenda IN (SELECT codvenda FROM vend)
                 UNION SELECT codvenda, codfat FROM dbfecharvendas WHERE codvenda IN (SELECT codvenda FROM vend)
                 UNION SELECT codvenda, codfat FROM dbprodfat WHERE codvenda IN (SELECT codvenda FROM vend)) x
           JOIN dbfatura f ON f.codfat = x.codfat AND COALESCE(f.cancel, 'N') = 'N'
          GROUP BY x.codvenda
       ), mov AS (
         SELECT i.codprod, g.dt_gar::date AS data, 'G' || g.codgar AS documento, g.codcli AS codcf,
                c.nome, 'S' AS sit, i.qtde AS quant, i.prunit AS preco, NULL::varchar AS nroform
           FROM dbitgarantiaprod i
           JOIN prod ON prod.codprod = i.codprod
           JOIN dbgarantiaprod g ON g.codgar = i.codgar
           LEFT JOIN dbclien c ON c.codcli = g.codcli
          WHERE COALESCE(g.cancel, 'N') = 'N' AND ${perG}
         UNION ALL
         SELECT vend.codprod, vend.data::date, vend.documento, vend.codcli, c.nome, 'S', vend.qtd, vend.prunit, nf.nroform
           FROM vend
           LEFT JOIN dbclien c ON c.codcli = vend.codcli
           LEFT JOIN nf ON nf.codvenda = vend.codvenda
         UNION ALL
         SELECT ie.codprod, e.dtent::date, e.codent, e.cod_credor, cr.nome, 'E', ie.quant, ie.prunit, e.nroform
           FROM dbitent ie
           JOIN prod ON prod.codprod = ie.codprod
           JOIN dbent e ON e.codent = ie.codent
           LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
          WHERE COALESCE(e.status, '') <> 'C' AND ${perE}
       )
       SELECT prod.marca, prod.ref, prod.reforiginal, prod.descr, to_char(mov.data, 'YYYY-MM-DD') AS data,
              mov.documento, mov.codcf, mov.nome, mov.sit, mov.quant AS quantidade,
              round(mov.preco::numeric, 2) AS preco, mov.nroform
         FROM mov JOIN prod ON prod.codprod = mov.codprod
        WHERE (${pOp} = 'T' OR mov.sit = ${pOp})
        ORDER BY mov.data, prod.ref, mov.sit, mov.documento`, params))).rows;
    numeros(rows, ['quantidade', 'preco']);
    const ent = rows.filter((r) => r.sit === 'E').reduce((s, r) => s + r.quantidade, 0);
    const sai = rows.filter((r) => r.sit === 'S').reduce((s, r) => s + r.quantidade, 0);
    return {
      linhas: rows,
      resumo: [`(E) Entradas: ${ent.toLocaleString('pt-BR')} · (S) Saídas: ${sai.toLocaleString('pt-BR')} · ${rows.length.toLocaleString('pt-BR')} movimentos`],
    };
  },
};
