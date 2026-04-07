/**
 * API de Relatório de Pendências de Compra - Exportação Excel
 *
 * GET /api/compras/ordens/pendencias-excel - Exporta pendências para Excel
 *
 * Parâmetros de query:
 * - filial: string (opcional) - Filtrar por filial de entrega
 * - marca: string (opcional) - Filtrar por código de marca
 * - grupo: string (opcional) - Filtrar por código de grupo de produto
 * - fornecedor: string (opcional) - Filtrar por código de fornecedor
 * - statusOrdem: string (opcional) - Filtrar por status da ordem (A, B, F, C)
 *
 * Baseado no sistema legado Oracle (stored procedure PENDENCIA)
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import ExcelJS from 'exceljs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const {
    filial,
    marca,
    grupo,
    fornecedor,
    statusOrdem = 'A' // Por padrão, apenas ordens Abertas
  } = req.query;

  let client;
  try {
    client = await pool.connect();

    // Configurar schema
    await client.query('SET search_path TO db_manaus');

    // Construir filtros dinâmicos
    const whereClauses: string[] = [
      'oc.orc_status = $1', // Filtro de status
      '(itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) > 0' // Apenas itens com pendência
    ];
    const params: any[] = [statusOrdem];
    let paramIndex = 2;

    // Filtro de filial (local de entrega)
    if (filial && filial !== 'TODAS') {
      whereClauses.push(`ue.unm_nome = $${paramIndex}`);
      params.push(filial);
      paramIndex++;
    }

    // Filtro de marca
    if (marca) {
      whereClauses.push(`m.codmarca = $${paramIndex}`);
      params.push(marca);
      paramIndex++;
    }

    // Filtro de grupo de produto
    if (grupo) {
      whereClauses.push(`gp.codgpp = $${paramIndex}`);
      params.push(grupo);
      paramIndex++;
    }

    // Filtro de fornecedor
    if (fornecedor) {
      whereClauses.push(`f.cod_credor = $${paramIndex}`);
      params.push(fornecedor);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    console.log('📋 PENDÊNCIAS - Filtros:', { filial, marca, grupo, fornecedor, statusOrdem });
    console.log('📋 PENDÊNCIAS - Where:', whereString);
    console.log('📋 PENDÊNCIAS - Params:', params);

    // Query principal de pendências
    // Similar à stored procedure PENDENCIA do Oracle
    const pendenciasQuery = `
      SELECT
        -- Dados da Ordem
        oc.orc_id as "ORDEM",
        oc.orc_data as "DATA_ORDEM",
        oc.orc_status as "STATUS_ORDEM",
        oc.orc_previsao_chegada as "PREVISAO_CHEGADA",

        -- Dados da Requisição
        r.req_id_composto as "REQUISICAO",
        r.req_data as "DATA_REQUISICAO",

        -- Dados do Fornecedor
        f.cod_credor as "COD_FORNECEDOR",
        COALESCE(f.nome, f.nome_fant, 'N/I') as "FORNECEDOR",

        -- Dados do Comprador
        c.nome as "COMPRADOR",

        -- Local de Entrega/Destino
        ue.unm_nome as "LOCAL_ENTREGA",
        ud.unm_nome as "LOCAL_DESTINO",

        -- Dados do Produto
        p.codprod as "CODPROD",
        p.ref as "REFERENCIA",
        p.descr as "DESCRICAO",
        p.aplic_extendida as "APLICACAO",

        -- Marca e Grupo
        m.codmarca as "COD_MARCA",
        m.descr as "MARCA",
        gp.codgpp as "COD_GRUPO",
        gp.descr as "GRUPO",

        -- Quantidades
        itr.itr_quantidade as "QTD_PEDIDA",
        COALESCE(itr.itr_quantidade_atendida, 0) as "QTD_ATENDIDA",
        COALESCE(itr.itr_quantidade_fechada, 0) as "QTD_FECHADA",
        (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) as "PENDENCIA",

        -- Estoque e Disponibilidade
        COALESCE(p.qtest, 0) as "ESTOQUE",
        COALESCE(p.qtdreservada, 0) as "RESERVADO",
        COALESCE(p.qtest - p.qtdreservada, 0) as "DISPONIVEL",

        -- Trânsito (itens em outras ordens abertas)
        COALESCE((
          SELECT SUM(itr2.itr_quantidade - COALESCE(itr2.itr_quantidade_atendida, 0) - COALESCE(itr2.itr_quantidade_fechada, 0))
          FROM cmp_it_requisicao itr2
          INNER JOIN cmp_ordem_compra oc2 ON (itr2.itr_req_id = oc2.orc_req_id AND itr2.itr_req_versao = oc2.orc_req_versao)
          WHERE itr2.itr_codprod = p.codprod
            AND oc2.orc_status = 'A'
            AND oc2.orc_id != oc.orc_id
            AND (itr2.itr_quantidade - COALESCE(itr2.itr_quantidade_atendida, 0) - COALESCE(itr2.itr_quantidade_fechada, 0)) > 0
        ), 0) as "TRANSITO",

        -- Preços
        itr.itr_pr_unitario as "PRECO_UNIT",
        (itr.itr_quantidade * itr.itr_pr_unitario) as "VALOR_TOTAL",
        ((itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) * itr.itr_pr_unitario) as "VALOR_PENDENTE",

        -- Informações adicionais
        itr.itr_base_indicacao as "BASE_INDICACAO",
        itr.itr_inf as "OBSERVACAO_ITEM",
        p.multiplo as "MULTIPLO_COMPRA"

      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      INNER JOIN cmp_it_requisicao itr ON (itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao)
      INNER JOIN dbprod p ON itr.itr_codprod = p.codprod
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      LEFT JOIN dbgpprod gp ON p.codgpp = gp.codgpp
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      ${whereString}
      ORDER BY
        ue.unm_nome,
        m.descr,
        p.ref,
        oc.orc_id
    `;

    const result = await client.query(pendenciasQuery, params);
    const pendencias = result.rows;

    console.log(`📋 PENDÊNCIAS - ${pendencias.length} itens encontrados`);

    if (pendencias.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Nenhuma pendência encontrada com os filtros informados'
      });
    }

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Melo';
    workbook.created = new Date();

    // ===== ABA 1: PENDÊNCIAS DETALHADAS =====
    const wsDetalhado = workbook.addWorksheet('Pendências Detalhadas');

    // Definir colunas
    wsDetalhado.columns = [
      { header: 'Ordem', key: 'ORDEM', width: 15 },
      { header: 'Data Ordem', key: 'DATA_ORDEM', width: 12 },
      { header: 'Status', key: 'STATUS_ORDEM', width: 10 },
      { header: 'Previsão', key: 'PREVISAO_CHEGADA', width: 12 },
      { header: 'Requisição', key: 'REQUISICAO', width: 18 },
      { header: 'Fornecedor', key: 'FORNECEDOR', width: 30 },
      { header: 'Comprador', key: 'COMPRADOR', width: 20 },
      { header: 'Local Entrega', key: 'LOCAL_ENTREGA', width: 15 },
      { header: 'Referência', key: 'REFERENCIA', width: 18 },
      { header: 'Descrição', key: 'DESCRICAO', width: 35 },
      { header: 'Marca', key: 'MARCA', width: 15 },
      { header: 'Grupo', key: 'GRUPO', width: 15 },
      { header: 'Qtd Pedida', key: 'QTD_PEDIDA', width: 12 },
      { header: 'Qtd Atendida', key: 'QTD_ATENDIDA', width: 12 },
      { header: 'PENDÊNCIA', key: 'PENDENCIA', width: 12 },
      { header: 'Estoque', key: 'ESTOQUE', width: 10 },
      { header: 'Disponível', key: 'DISPONIVEL', width: 10 },
      { header: 'Trânsito', key: 'TRANSITO', width: 10 },
      { header: 'Pr. Unit.', key: 'PRECO_UNIT', width: 12 },
      { header: 'Valor Pendente', key: 'VALOR_PENDENTE', width: 14 },
      { header: 'Observação', key: 'OBSERVACAO_ITEM', width: 25 },
    ];

    // Mapear status
    const statusMap: Record<string, string> = {
      'A': 'Aberta',
      'B': 'Bloqueada',
      'F': 'Fechada',
      'C': 'Cancelada',
    };

    // Adicionar dados
    pendencias.forEach((item: Record<string, any>) => {
      wsDetalhado.addRow({
        ORDEM: item.ORDEM,
        DATA_ORDEM: item.DATA_ORDEM ? new Date(item.DATA_ORDEM).toLocaleDateString('pt-BR') : '',
        STATUS_ORDEM: statusMap[item.STATUS_ORDEM] || item.STATUS_ORDEM,
        PREVISAO_CHEGADA: item.PREVISAO_CHEGADA ? new Date(item.PREVISAO_CHEGADA).toLocaleDateString('pt-BR') : '',
        REQUISICAO: item.REQUISICAO,
        FORNECEDOR: item.FORNECEDOR,
        COMPRADOR: item.COMPRADOR || '',
        LOCAL_ENTREGA: item.LOCAL_ENTREGA || '',
        REFERENCIA: item.REFERENCIA,
        DESCRICAO: item.DESCRICAO,
        MARCA: item.MARCA || '',
        GRUPO: item.GRUPO || '',
        QTD_PEDIDA: Number(item.QTD_PEDIDA),
        QTD_ATENDIDA: Number(item.QTD_ATENDIDA),
        PENDENCIA: Number(item.PENDENCIA),
        ESTOQUE: Number(item.ESTOQUE),
        DISPONIVEL: Number(item.DISPONIVEL),
        TRANSITO: Number(item.TRANSITO),
        PRECO_UNIT: Number(item.PRECO_UNIT || 0).toFixed(2),
        VALOR_PENDENTE: Number(item.VALOR_PENDENTE || 0).toFixed(2),
        OBSERVACAO_ITEM: item.OBSERVACAO_ITEM || '',
      });
    });

    // Estilizar header
    wsDetalhado.getRow(1).font = { bold: true };
    wsDetalhado.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    wsDetalhado.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Destacar coluna PENDÊNCIA
    wsDetalhado.getColumn('PENDENCIA').eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF2CC' }
        };
        cell.font = { bold: true };
      }
    });

    // ===== ABA 2: RESUMO POR MARCA =====
    const wsResumoMarca = workbook.addWorksheet('Resumo por Marca');

    // Agrupar por marca
    const resumoMarca = pendencias.reduce((acc: Record<string, any>, item: any) => {
      const marca = item.MARCA || 'SEM MARCA';
      if (!acc[marca]) {
        acc[marca] = {
          marca,
          qtdItens: 0,
          qtdPendencia: 0,
          valorPendente: 0,
        };
      }
      acc[marca].qtdItens++;
      acc[marca].qtdPendencia += Number(item.PENDENCIA);
      acc[marca].valorPendente += Number(item.VALOR_PENDENTE || 0);
      return acc;
    }, {});

    wsResumoMarca.columns = [
      { header: 'Marca', key: 'marca', width: 25 },
      { header: 'Qtd Itens', key: 'qtdItens', width: 12 },
      { header: 'Total Pendência', key: 'qtdPendencia', width: 15 },
      { header: 'Valor Pendente', key: 'valorPendente', width: 18 },
    ];

    Object.values(resumoMarca)
      .sort((a: any, b: any) => b.valorPendente - a.valorPendente)
      .forEach((item: any) => {
        wsResumoMarca.addRow({
          marca: item.marca,
          qtdItens: item.qtdItens,
          qtdPendencia: item.qtdPendencia,
          valorPendente: Number(item.valorPendente).toFixed(2),
        });
      });

    // Estilizar header
    wsResumoMarca.getRow(1).font = { bold: true };
    wsResumoMarca.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    wsResumoMarca.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // ===== ABA 3: RESUMO POR FORNECEDOR =====
    const wsResumoForn = workbook.addWorksheet('Resumo por Fornecedor');

    // Agrupar por fornecedor
    const resumoForn = pendencias.reduce((acc: Record<string, any>, item: any) => {
      const forn = item.FORNECEDOR || 'SEM FORNECEDOR';
      if (!acc[forn]) {
        acc[forn] = {
          fornecedor: forn,
          codFornecedor: item.COD_FORNECEDOR,
          qtdItens: 0,
          qtdPendencia: 0,
          valorPendente: 0,
        };
      }
      acc[forn].qtdItens++;
      acc[forn].qtdPendencia += Number(item.PENDENCIA);
      acc[forn].valorPendente += Number(item.VALOR_PENDENTE || 0);
      return acc;
    }, {});

    wsResumoForn.columns = [
      { header: 'Cód. Fornecedor', key: 'codFornecedor', width: 15 },
      { header: 'Fornecedor', key: 'fornecedor', width: 35 },
      { header: 'Qtd Itens', key: 'qtdItens', width: 12 },
      { header: 'Total Pendência', key: 'qtdPendencia', width: 15 },
      { header: 'Valor Pendente', key: 'valorPendente', width: 18 },
    ];

    Object.values(resumoForn)
      .sort((a: any, b: any) => b.valorPendente - a.valorPendente)
      .forEach((item: any) => {
        wsResumoForn.addRow({
          codFornecedor: item.codFornecedor || '',
          fornecedor: item.fornecedor,
          qtdItens: item.qtdItens,
          qtdPendencia: item.qtdPendencia,
          valorPendente: Number(item.valorPendente).toFixed(2),
        });
      });

    // Estilizar header
    wsResumoForn.getRow(1).font = { bold: true };
    wsResumoForn.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFED7D31' }
    };
    wsResumoForn.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // ===== ABA 4: RESUMO GERAL =====
    const wsResumoGeral = workbook.addWorksheet('Resumo Geral');

    // Calcular totais
    const totalItens = pendencias.length;
    const totalPendencia = pendencias.reduce((acc: number, item: any) => acc + Number(item.PENDENCIA), 0);
    const totalValor = pendencias.reduce((acc: number, item: any) => acc + Number(item.VALOR_PENDENTE || 0), 0);
    const totalMarcas = Object.keys(resumoMarca).length;
    const totalFornecedores = Object.keys(resumoForn).length;

    wsResumoGeral.columns = [
      { header: 'Indicador', key: 'indicador', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];

    wsResumoGeral.addRow({ indicador: 'Data do Relatório', valor: new Date().toLocaleString('pt-BR') });
    wsResumoGeral.addRow({ indicador: 'Filtro - Status Ordem', valor: statusMap[statusOrdem as string] || statusOrdem });
    wsResumoGeral.addRow({ indicador: 'Filtro - Filial', valor: filial || 'TODAS' });
    wsResumoGeral.addRow({ indicador: 'Filtro - Marca', valor: marca || 'TODAS' });
    wsResumoGeral.addRow({ indicador: 'Filtro - Grupo', valor: grupo || 'TODOS' });
    wsResumoGeral.addRow({ indicador: 'Filtro - Fornecedor', valor: fornecedor || 'TODOS' });
    wsResumoGeral.addRow({ indicador: '', valor: '' });
    wsResumoGeral.addRow({ indicador: 'Total de Itens Pendentes', valor: totalItens });
    wsResumoGeral.addRow({ indicador: 'Total de Unidades Pendentes', valor: totalPendencia });
    wsResumoGeral.addRow({ indicador: 'Valor Total Pendente', valor: `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` });
    wsResumoGeral.addRow({ indicador: 'Quantidade de Marcas', valor: totalMarcas });
    wsResumoGeral.addRow({ indicador: 'Quantidade de Fornecedores', valor: totalFornecedores });

    // Estilizar header
    wsResumoGeral.getRow(1).font = { bold: true };
    wsResumoGeral.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B9BD5' }
    };
    wsResumoGeral.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Gerar buffer e enviar
    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `pendencias-compra-${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Erro ao gerar relatório de pendências:', error);
    res.status(500).json({
      error: 'Erro ao gerar relatório de pendências',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
