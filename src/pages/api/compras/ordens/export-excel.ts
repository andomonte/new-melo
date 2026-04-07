import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import ExcelJS from 'exceljs';

const filtroParaColunaSQL: Record<string, string> = {
  orc_id: 'oc.orc_id',
  orc_data: 'oc.orc_data',
  req_previsao_chegada: 'r.req_previsao_chegada',
  orc_status: 'oc.orc_status',
  req_id: 'r.req_id',
  req_status: 'r.req_status',
  req_cod_credor: 'r.req_cod_credor',
  fornecedor: 'f.nome',
  comprador: 'c.nome',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { colunas = [], filtros = {}, busca = '', incluirItens = true } = req.body;

  const whereClauses: string[] = ['oc.orc_data >= $1']; // Filtro para ignorar ordens antigas do legado
  const params: any[] = ['2020-01-01'];
  let paramIndex = 2;

  if (busca) {
    whereClauses.push(`
      (
        CAST(oc.orc_id AS TEXT) ILIKE $${paramIndex}
        OR CAST(r.req_id AS TEXT) ILIKE $${paramIndex + 1}
        OR r.req_id_composto ILIKE $${paramIndex + 2}
        OR f.nome ILIKE $${paramIndex + 3}
        OR c.nome ILIKE $${paramIndex + 4}
        OR f.cpf_cgc ILIKE $${paramIndex + 5}
      )
    `);
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
    paramIndex += 6;
  } else {
    Object.entries(filtros).forEach(([key, value]) => {
      const coluna = filtroParaColunaSQL[key];
      if (coluna && value) {
        // Para IDs numéricos, usar = ao invés de ILIKE
        if (key === 'orc_id' || key === 'req_id') {
          whereClauses.push(`${coluna} = $${paramIndex}`);
          params.push(value);
        } else {
          whereClauses.push(`${coluna}::TEXT ILIKE $${paramIndex}`);
          params.push(`%${value}%`);
        }
        paramIndex++;
      }
    });
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let client;
  try {
    client = await pool.connect();

    // Configurar schema
    await client.query('SET search_path TO db_manaus');

    console.log('🔍 EXPORT ORDENS - Filtros recebidos:', filtros);
    console.log('🔍 EXPORT ORDENS - Where clauses:', whereClauses);
    console.log('🔍 EXPORT ORDENS - Params:', params);

    // Query principal com campos do sistema
    const ordensQuery = `
      SELECT
        oc.orc_id as "ORC_ID",
        oc.orc_data as "ORC_DATA",
        r.req_previsao_chegada as "REQ_PREVISAO_CHEGADA",
        oc.orc_status as "ORC_STATUS",
        r.req_id as "REQ_ID",
        r.req_versao as "REQ_VERSAO",
        r.req_tipo as "TIPO",
        r.req_data as "REQ_DATA",
        r.req_status as "REQ_STATUS",
        r.req_cod_credor as "REQ_COD_CREDOR",
        f.nome as "REQ_FORNECEDOR",
        f.cpf_cgc as "CPF_CGC",
        f.nome_fant as "FORNECEDOR_FANTASIA",
        c.nome as "COMPRADOR",
        ue.unm_nome as "REQ_MELO_ENTREGA",
        ud.unm_nome as "REQ_MELO_DESTINO",
        cli.nome as "CLIENTE",
        v.nome as "VENDEDOR",
        usr.nomeusr as "NOMEUSR",
        r.req_previsao_chegada as "REQ_PREVISAO_CHEGADA",
        r.req_cond_pagto as "REQ_COND_PAGTO",
        r.req_observacao as "REQ_OBSERVACAO",
        COALESCE(r.req_id_composto, CAST(r.req_id AS TEXT)) as "REQ_ID_COMPOSTO",
        r.req_situacao as "REQ_SITUACAO",
        COALESCE(
          (SELECT SUM(itr.itr_quantidade * itr.itr_pr_unitario)
           FROM cmp_it_requisicao itr
           WHERE itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao),
          0
        ) as "REQ_TOTAL",
        COALESCE(
          (SELECT SUM(itr_ant.itr_quantidade * itr_ant.itr_pr_unitario)
           FROM cmp_it_requisicao itr_ant
           WHERE itr_ant.itr_req_id = r.req_id AND itr_ant.itr_req_versao = (r.req_versao - 1)),
          0
        ) as "REQ_TOTAL_ANT"
      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN dbusuario usr ON r.req_codusr = usr.codusr
      LEFT JOIN cmp_venda_casada vc ON (r.req_id = vc.vec_req_id AND r.req_versao = vc.vec_req_versao)
      LEFT JOIN dbclien cli ON vc.vec_codcli = cli.codcli
      LEFT JOIN dbvend v ON vc.vec_codvend = v.codvend
      ${whereString}
      ORDER BY oc.orc_data DESC, oc.orc_id DESC
    `;

    const ordensResult = await client.query(ordensQuery, params);
    const ordens = ordensResult.rows;

    // Se incluirItens = true, buscar itens de todas as requisições retornadas
    let itens: any[] = [];
    if (incluirItens && ordens.length > 0) {
      const reqIds = ordens.map(o => o.REQ_ID);
      const reqVersoes = ordens.map(o => o.REQ_VERSAO);

      // Query para buscar itens
      const itensQuery = `
        SELECT
          COALESCE(r.req_id_composto, CAST(r.req_id AS TEXT)) as "REQ_ID_COMPOSTO",
          p.ref as "REFERENCIA",
          p.aplic_extendida as "APLICACAO",
          p.descr as "DESCRICAO",
          m.descr as "MARCA",
          p.codprod as "CODPROD",
          itr.itr_base_indicacao as "ITR_BASE_INDICACAO",
          itr.itr_data_sugestao as "ITR_DATA_SUGESTAO",
          p.multiplo as "MULTIPLO",
          itr.itr_quantidade_sugerida as "ITR_QUANTIDADE_SUGERIDA",
          itr.itr_quantidade as "ITR_QUANTIDADE",
          itr.itr_quantidade_atendida as "ITR_QUANTIDADE_ATENDIDA",
          COALESCE(p.qtest - p.qtdreservada, 0) as "QTDISPONIVEL",
          itr.itr_pr_unitario as "ITR_PR_UNITARIO",
          (itr.itr_quantidade * itr.itr_pr_unitario) as "ITR_TOTAL",
          itr.itr_inf as "ITR_OBSERVACAO",
          CASE
            WHEN COALESCE(itr.itr_quantidade_atendida, 0) = 0 THEN 'A'
            WHEN itr.itr_quantidade_atendida >= itr.itr_quantidade THEN 'F'
            ELSE 'P'
          END as "ITR_STATUS"
        FROM cmp_it_requisicao itr
        INNER JOIN cmp_requisicao r ON (itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao)
        INNER JOIN dbprod p ON itr.itr_codprod = p.codprod
        LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
        WHERE itr.itr_req_id = ANY($1::bigint[])
          AND itr.itr_req_versao = ANY($2::bigint[])
        ORDER BY r.req_id_composto, itr.itr_codprod
      `;

      const itensResult = await client.query(itensQuery, [reqIds, reqVersoes]);
      itens = itensResult.rows;
    }

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();

    // Aba 1: Lista de Ordens/Requisições (22 campos)
    const worksheetOrdens = workbook.addWorksheet('Ordens de Compra');

    // Mapear nomes das colunas (já vêm em uppercase do SELECT AS)
    const colunasOrdensFriendly: Record<string, string> = {
      ORC_ID: 'Nº Ordem',
      ORC_DATA: 'Data Ordem',
      REQ_PREVISAO_CHEGADA: 'Previsão Chegada',
      ORC_STATUS: 'Status Ordem',
      REQ_ID: 'Nº Requisição',
      REQ_VERSAO: 'Versão',
      TIPO: 'Tipo',
      REQ_DATA: 'Data Requisição',
      REQ_STATUS: 'Status Req.',
      REQ_COD_CREDOR: 'Cód. Fornecedor',
      REQ_FORNECEDOR: 'Fornecedor',
      CPF_CGC: 'CPF/CNPJ',
      FORNECEDOR_FANTASIA: 'Nome Fantasia',
      COMPRADOR: 'Comprador',
      REQ_MELO_ENTREGA: 'Local Entrega',
      REQ_MELO_DESTINO: 'Destino',
      CLIENTE: 'Cliente',
      VENDEDOR: 'Vendedor',
      NOMEUSR: 'Usuário',
      REQ_COND_PAGTO: 'Cond. Pagamento',
      REQ_OBSERVACAO: 'Observação',
      REQ_ID_COMPOSTO: 'ID Composto',
      REQ_SITUACAO: 'Situação',
      REQ_TOTAL: 'Valor Total',
      REQ_TOTAL_ANT: 'Total Anterior',
    };

    // Definir colunas dinamicamente ou usar todas se não especificado
    const colunasOrdens = colunas.length > 0
      ? colunas
      : Object.keys(colunasOrdensFriendly);

    // Criar header manualmente na linha 1 (evita bug de linhas vazias)
    const headerRow = colunasOrdens.map((coluna: string) => colunasOrdensFriendly[coluna] || coluna);
    worksheetOrdens.addRow(headerRow);

    // Adicionar dados com formatações
    ordens.forEach((ordem: Record<string, any>) => {
      const rowData = colunasOrdens.map((coluna: string) => {
        let value = ordem[coluna];

        // Formatação especial para datas
        if ((coluna === 'ORC_DATA' || coluna === 'REQ_DATA' || coluna === 'REQ_PREVISAO_CHEGADA') && value) {
          value = new Date(value).toLocaleDateString('pt-BR');
        }
        // Formatação de status da ordem
        else if (coluna === 'ORC_STATUS') {
          const statusMap: Record<string, string> = {
            'P': 'Pendente',
            'E': 'Em Processamento',
            'A': 'Aprovada',
            'F': 'Finalizada',
            'C': 'Cancelada',
          };
          value = statusMap[value] || value || '';
        }
        // Formatação de status da requisição
        else if (coluna === 'REQ_STATUS') {
          const statusMap: Record<string, string> = {
            'P': 'Pendente',
            'S': 'Submetida',
            'A': 'Aprovada',
            'R': 'Rejeitada',
            'C': 'Cancelada',
          };
          value = statusMap[value] || value || '';
        }
        // Formatação de valores monetários
        else if (coluna === 'REQ_TOTAL' || coluna === 'REQ_TOTAL_ANT') {
          value = parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        }
        // Garantir que ID Composto venha como texto
        else if (coluna === 'REQ_ID_COMPOSTO' && value) {
          value = String(value);
        }

        return value ?? '';
      });
      worksheetOrdens.addRow(rowData);
    });

    // Estilizar header da primeira aba
    worksheetOrdens.getRow(1).font = { bold: true };
    worksheetOrdens.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };

    // Aba 2: Itens das Requisições (12 campos) - só se incluirItens = true
    if (incluirItens && itens.length > 0) {
      const worksheetItens = workbook.addWorksheet('Itens das Requisições');

      const colunasItensFriendly: Record<string, string> = {
        REQ_ID_COMPOSTO: 'ID Requisição',
        REFERENCIA: 'Referência',
        APLICACAO: 'Aplicação',
        DESCRICAO: 'Descrição',
        MARCA: 'Marca',
        CODPROD: 'Cód Único',
        ITR_BASE_INDICACAO: 'Indicação',
        ITR_DATA_SUGESTAO: 'Data Sugestão',
        MULTIPLO: 'Múltiplo',
        ITR_QUANTIDADE_SUGERIDA: 'Sugestão',
        ITR_QUANTIDADE: 'Quantidade',
        ITR_QUANTIDADE_ATENDIDA: 'Quant. Atendida',
        QTDISPONIVEL: 'Qtd Disponível',
        ITR_PR_UNITARIO: 'Pr. Unit.',
        ITR_TOTAL: 'Total',
        ITR_OBSERVACAO: 'Observação',
        ITR_STATUS: 'Status',
      };

      const colunasItens = Object.keys(colunasItensFriendly);

      // Criar header manualmente na linha 1 (evita bug de linhas vazias)
      const headerRowItens = colunasItens.map((coluna: string) => colunasItensFriendly[coluna]);
      worksheetItens.addRow(headerRowItens);

      itens.forEach((item: Record<string, any>) => {
        const rowData = colunasItens.map((coluna: string) => {
          let value = item[coluna];

          // Formatação de valores monetários
          if (coluna === 'ITR_PR_UNITARIO' || coluna === 'ITR_TOTAL') {
            value = parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          }
          // Formatação de base de indicação
          else if (coluna === 'ITR_BASE_INDICACAO') {
            const baseMap: Record<string, string> = {
              'MANUAL': 'MANUAL',
              'SUGESTAO': 'AUTOMATIC',
              'IMPORTADO': 'IMPORTADO',
              'AUTOMATIC': 'AUTOMATIC',
            };
            value = baseMap[value] || value || '';
          }
          // Formatação de data de sugestão
          else if (coluna === 'ITR_DATA_SUGESTAO' && value) {
            value = new Date(value).toLocaleDateString('pt-BR');
          }
          // Formatação de status do item
          else if (coluna === 'ITR_STATUS') {
            const statusMap: Record<string, string> = {
              'A': 'Aberto',
              'F': 'Fechado',
              'P': 'Parcial',
            };
            value = statusMap[value] || value || '';
          }
          // Garantir que ID Composto venha como texto
          else if (coluna === 'REQ_ID_COMPOSTO' && value) {
            value = String(value);
          }

          return value ?? '';
        });
        worksheetItens.addRow(rowData);
      });

      // Estilizar header da segunda aba
      worksheetItens.getRow(1).font = { bold: true };
      worksheetItens.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
      };
    }

    // Gerar buffer e enviar
    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ordens-compra-${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar ordens de compra:', error);
    res.status(500).json({
      error: 'Erro ao gerar Excel',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
