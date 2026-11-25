import type { ColunaDef, Relatorio } from '../tipos';
import { exigirPeriodo, fmtNum, numeros, somar } from './_utilC';

/**
 * Relatórios › Gerenciais › Pedidos/Entradas por Comprador (Delphi: frmRel_Pedidos_por_Comprador /
 * ORDEM_COMPRA.COMPRADORES_PEDIDOS e COMPRADORES_ENTRADAS).
 * Pedidos = ordens de compra (cmp_ordem_compra ⨝ cmp_requisicao, total = Σ itens da requisição);
 * Entradas = notas de compra (dbent).
 * Diferenças deliberadas: sem a aba "Entrada NE" (dbentradane não existe no PG; parou em 2010);
 * "todos os compradores" = filtro vazio (o Delphi passava o parâmetro na consulta errada e a aba
 * Entradas saía vazia); transportadora, CFOP, fornecedor e comprador em LEFT JOIN (o legado
 * escondia entradas sem transportadora/CFOP).
 */
const colunasPara = (visao: string): ColunaDef[] => visao === 'entradas'
  ? [
    { campo: 'comprador', titulo: 'Comprador' },
    { campo: 'codent', titulo: 'Nº entrada' },
    { campo: 'nota', titulo: 'Nota fiscal' },
    { campo: 'dtent', titulo: 'Data entrada', tipo: 'data' },
    { campo: 'dtnota', titulo: 'Data NF', tipo: 'data' },
    { campo: 'fornecedor', titulo: 'Fornecedor' },
    { campo: 'transportadora', titulo: 'Transportadora' },
    { campo: 'cfop', titulo: 'CFOP' },
    { campo: 'situacao', titulo: 'Situação' },
    { campo: 'total', titulo: 'Total produtos', tipo: 'moeda', total: true },
    { campo: 'totalnf', titulo: 'Total NF', tipo: 'moeda', total: true },
  ]
  : [
    { campo: 'comprador', titulo: 'Comprador' },
    { campo: 'pedido', titulo: 'Nº pedido' },
    { campo: 'requisicao', titulo: 'Requisição' },
    { campo: 'destino', titulo: 'Estoque (destino)' },
    { campo: 'entrega', titulo: 'Local de entrega' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'fornecedor', titulo: 'Fornecedor' },
    { campo: 'condpag', titulo: 'Cond. pagto' },
    { campo: 'situacao', titulo: 'Situação' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
  ];

export const relatorio: Relatorio = {
  slug: 'pedidosPorComprador',
  titulo: 'Pedidos/Entradas por Comprador',
  descricao:
    'Por comprador e período: as ordens de compra emitidas (pedidos, com o total dos itens da requisição) ou as entradas de notas de compra, com subtotal por comprador. ' +
    'Ordens e entradas canceladas não entram. A antiga aba "Entrada NE" não existe mais. Entradas no sistema novo a partir de 2025.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true },
    { campo: 'visao', rotulo: 'Mostrar', tipo: 'select', padrao: 'pedidos',
      opcoes: [{ valor: 'pedidos', rotulo: 'Pedidos (ordens de compra)' }, { valor: 'entradas', rotulo: 'Entradas (notas de compra)' }] },
    { campo: 'compradores', rotulo: 'Compradores (vazio = todos)', tipo: 'lookup', lookup: 'comprador', multiplo: true, largura: 2 },
  ],
  colunas: colunasPara('pedidos'),
  quebra: 'comprador',
  async executar(db, p) {
    exigirPeriodo(p);
    const visao = p.visao === 'entradas' ? 'entradas' : 'pedidos';
    const params: any[] = [p.de, p.ate];
    let filtroComp = '';
    let rows: any[];
    if (visao === 'entradas') {
      if (p.compradores) { params.push(p.compradores); filtroComp = ` AND e.codcomprador = ANY($${params.length})`; }
      rows = (await db.query(
        `SELECT COALESCE(e.codcomprador, '') || ' - ' || COALESCE(co.nome, 'sem comprador') AS comprador,
                e.codent, e.nroform AS nota, to_char(e.dtent, 'YYYY-MM-DD') AS dtent, to_char(e.dtnota, 'YYYY-MM-DD') AS dtnota,
                e.cod_credor || ' - ' || COALESCE(c.nome, '') AS fornecedor, t.nome AS transportadora,
                COALESCE(e.cfop, '') || CASE WHEN f.descr IS NULL THEN '' ELSE ' - ' || f.descr END AS cfop,
                CASE e.status WHEN 'A' THEN 'Aberta' WHEN 'F' THEN 'Finalizada' ELSE e.status END AS situacao,
                round(e.totalprod::numeric, 2) AS total, round(e.totalnf::numeric, 2) AS totalnf
           FROM dbent e
           LEFT JOIN dbcompradores co ON co.codcomprador = e.codcomprador
           LEFT JOIN dbcredor c ON c.cod_credor = e.cod_credor
           LEFT JOIN dbtransp t ON t.codtransp = e.codtransp
           LEFT JOIN dbcfop_n f ON f.cfop = e.cfop
          WHERE e.dtent >= $1::date AND e.dtent < ($2::date + 1)
            AND COALESCE(e.status, '') <> 'C' AND e.totalprod IS NOT NULL${filtroComp}
          ORDER BY co.nome NULLS LAST, e.codcomprador, e.codent`, params)).rows;
      numeros(rows, ['total', 'totalnf']);
    } else {
      if (p.compradores) { params.push(p.compradores); filtroComp = ` AND req.req_codcomprador = ANY($${params.length})`; }
      rows = (await db.query(
        `SELECT COALESCE(req.req_codcomprador, '') || ' - ' || COALESCE(co.nome, 'sem comprador') AS comprador,
                orc.orc_id AS pedido, COALESCE(req.req_id_composto, req.req_id::text) AS requisicao,
                ud.unm_sigla AS destino, ue.unm_sigla AS entrega,
                to_char(orc.orc_data, 'YYYY-MM-DD') AS data,
                COALESCE(req.req_cod_credor, '') || ' - ' || COALESCE(c.nome, '') AS fornecedor,
                req.req_cond_pagto AS condpag,
                CASE orc.orc_status WHEN 'A' THEN 'Aberta' WHEN 'F' THEN 'Finalizada' ELSE orc.orc_status END AS situacao,
                round(COALESCE(it.total, orc.orc_valor_total, 0)::numeric, 2) AS total
           FROM cmp_ordem_compra orc
           JOIN cmp_requisicao req ON req.req_id = orc.orc_req_id AND req.req_versao = orc.orc_req_versao
           LEFT JOIN (SELECT itr_req_id, itr_req_versao, sum(itr_pr_unitario * itr_quantidade) AS total
                        FROM cmp_it_requisicao GROUP BY 1, 2) it
                  ON it.itr_req_id = req.req_id AND it.itr_req_versao = req.req_versao
           LEFT JOIN dbcompradores co ON co.codcomprador = req.req_codcomprador
           LEFT JOIN dbcredor c ON c.cod_credor = req.req_cod_credor
           LEFT JOIN cad_unidade_melo ud ON ud.unm_id = req.req_unm_id_destino
           LEFT JOIN cad_unidade_melo ue ON ue.unm_id = req.req_unm_id_entrega
          WHERE orc.orc_data >= $1::date AND orc.orc_data < ($2::date + 1)
            AND COALESCE(orc.orc_status, '') <> 'C'${filtroComp}
          ORDER BY co.nome NULLS LAST, req.req_codcomprador, orc.orc_id`, params)).rows;
      numeros(rows, ['total']);
    }
    return {
      linhas: rows,
      colunas: colunasPara(visao),
      quebra: 'comprador',
      resumo: [`${rows.length} ${visao === 'entradas' ? 'entradas' : 'pedidos'} · Total geral: R$ ${fmtNum(somar(rows, 'total'), 2)}`],
    };
  },
};
