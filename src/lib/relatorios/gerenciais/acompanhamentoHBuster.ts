import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { numeros, semLacoAninhado } from './_utilD';

/**
 * Relatórios › Gerenciais › Acompanhamento HBuster (Delphi: FrmConsultaSemanalHBUSTER, sem fonte do
 * form; regra da procedure CONSULTA_REL_SEMANAL_HBUSTER). Por produto da marca: estoque, média de
 * venda dos 4 meses anteriores ao mês da data, pendência de compra e venda do 1º dia do mês anterior
 * até a data. Diferenças deliberadas:
 *  - genérico: marca vira filtro (vazio = marca HBUSTER, achada pelo nome, vale em qualquer filial);
 *  - só a filial atual (o legado somava MAO/PVH/REC/FLZ por dblink, com colunas por filial);
 *  - média = média MENSAL (soma dos 4 meses ÷ 4); o legado fazia AVG da quantidade por linha de venda;
 *  - pendência = saldo dos itens de ordens de compra abertas (cmp_ordem_compra/cmp_it_requisicao),
 *    no lugar de DBITREQUIS/DBREQUIS (não existem no PG);
 *  - ignora vendas canceladas (o legado não filtrava) e, por padrão, esconde produtos sem movimento.
 */
export const relatorio: Relatorio = {
  slug: 'acompanhamentoHBuster',
  titulo: 'Acompanhamento HBuster',
  descricao: 'Por produto da marca (padrão: HBUSTER): estoque atual, média mensal de venda dos 4 meses anteriores ao mês da data-base, '
    + 'pendência de compra (saldo em ordens de compra abertas) e venda do 1º dia do mês anterior até a data-base. Só a filial atual. '
    + 'No legado a marca HBUSTER está praticamente sem estoque e sem venda.',
  filtros: [
    { campo: 'data', rotulo: 'Data-base', tipo: 'data', obrigatorio: true, padrao: 'hoje' },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true, ajuda: 'Vazio = marca HBUSTER.' },
    { campo: 'somente_movimento', rotulo: 'Só produtos com estoque, venda ou pendência', tipo: 'checkbox', padrao: true },
  ],
  colunas: [
    { campo: 'referencia', titulo: 'Referência' },
    { campo: 'descricao', titulo: 'Descrição' },
    { campo: 'marca', titulo: 'Marca' },
    { campo: 'estoque', titulo: 'Estoque', tipo: 'numero', total: true },
    { campo: 'media', titulo: 'Média mensal (4 meses)', tipo: 'numero', total: true },
    { campo: 'pendencia', titulo: 'Pendência de compra', tipo: 'numero', total: true },
    { campo: 'venda_mensal', titulo: 'Venda (mês anterior até a data)', tipo: 'numero', total: true },
  ],
  async executar(db, p) {
    if (!p.data) throw new RelatorioValidacaoError('Informe a data-base.');
    const params: any[] = [p.data];
    let marca = `pd.codmarca IN (SELECT codmarca FROM dbmarcas WHERE upper(trim(descr)) = 'HBUSTER')`;
    if (p.marcas) { params.push(p.marcas); marca = `pd.codmarca = ANY($${params.length})`; }
    // $1 = data-base; ini4 = 1º dia do mês −4; inimes = 1º dia do mês; iniant = 1º dia do mês anterior
    const rows = (await semLacoAninhado(db, () => db.query(
      `WITH d AS (
         SELECT date_trunc('month', $1::date)::date AS inimes,
                (date_trunc('month', $1::date) - interval '4 month')::date AS ini4,
                (date_trunc('month', $1::date) - interval '1 month')::date AS iniant
       ), prods AS MATERIALIZED (
         SELECT pd.codprod, trim(pd.ref) AS referencia, pd.descr AS descricao, m.descr AS marca, COALESCE(pd.qtest, 0) AS estoque
           FROM dbprod pd
           LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca
          WHERE ${marca} AND COALESCE(pd.inf, '') <> 'D' AND COALESCE(pd.excluido, 0) <> 1
       ), vend AS (
         SELECT iv.codprod,
                COALESCE(sum(iv.qtd) FILTER (WHERE v.data >= d.ini4 AND v.data < d.inimes), 0) AS q4,
                COALESCE(sum(iv.qtd) FILTER (WHERE v.data >= d.iniant AND v.data < $1::date + 1), 0) AS mensal
           FROM prods pr
           JOIN dbitvenda iv ON iv.codprod = pr.codprod
           JOIN dbvenda v ON v.codvenda = iv.codvenda
           CROSS JOIN d
          WHERE v.data >= d.ini4 AND v.data < $1::date + 1 AND COALESCE(v.cancel, 'N') = 'N'
          GROUP BY iv.codprod
       ), pend AS (
         SELECT itr.itr_codprod AS codprod,
                sum(itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) AS pendencia
           FROM cmp_ordem_compra oc
           JOIN cmp_it_requisicao itr ON itr.itr_req_id = oc.orc_req_id AND itr.itr_req_versao = oc.orc_req_versao
          WHERE oc.orc_status = 'A'
            AND itr.itr_codprod IN (SELECT codprod FROM prods)
            AND (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) > 0
          GROUP BY itr.itr_codprod
       )
       SELECT pr.referencia, pr.descricao, pr.marca, pr.estoque,
              round(COALESCE(vd.q4, 0) / 4.0, 2) AS media,
              COALESCE(pe.pendencia, 0) AS pendencia,
              COALESCE(vd.mensal, 0) AS venda_mensal
         FROM prods pr
         LEFT JOIN vend vd ON vd.codprod = pr.codprod
         LEFT JOIN pend pe ON pe.codprod = pr.codprod
        ${p.somente_movimento ? 'WHERE pr.estoque <> 0 OR COALESCE(vd.q4, 0) <> 0 OR COALESCE(vd.mensal, 0) <> 0 OR COALESCE(pe.pendencia, 0) <> 0' : ''}
        ORDER BY pr.referencia, pr.descricao`, params))).rows;
    return { linhas: numeros(rows, ['estoque', 'media', 'pendencia', 'venda_mensal']) };
  },
};
