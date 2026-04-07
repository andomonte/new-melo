import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import ExcelJS from 'exceljs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { colunas: colunasRaw = [], filtros = {}, busca = '' } = req.body;

  // Filtrar colunas inválidas (checkbox, ações, etc.)
  const colunasInvalidas = ['selecionar', 'SELECIONAR', 'AÇÕES', 'ações', 'acoes'];
  const colunas = colunasRaw.filter((c: string) => !colunasInvalidas.includes(c));

  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (busca) {
    whereClauses.push(`
      (
        CAST(oc.orc_id AS TEXT) ILIKE $${paramIndex}
        OR r.req_id_composto ILIKE $${paramIndex + 1}
        OR f.nome ILIKE $${paramIndex + 2}
        OR c.nome ILIKE $${paramIndex + 3}
      )
    `);
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
    paramIndex += 4;
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let client;
  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const query = `
      SELECT
        oc.orc_id as ordem,
        r.req_id_composto as requisicao,
        oc.orc_data as "dataOrdem",
        oc.orc_status as "statusOrdem",
        CASE WHEN oc.orc_pagamento_configurado THEN 'SIM' ELSE 'NÃO' END as "orc_pagamento_configurado",
        f.cod_credor as "fornecedorCod",
        f.nome as "fornecedor_completo",
        f.cpf_cgc as "fornecedorCpfCnpj",
        c.nome as "comprador_completo",
        r.req_status as "statusRequisicao",
        r.req_previsao_chegada as "previsaoChegada",
        ue.unm_nome as "localEntrega",
        ud.unm_nome as "localDestino",
        r.req_prazo_entrega as "prazoEntrega",
        oc.orc_data_finalizacao as "dataFinalizacao",
        usr.nomeusr as "usuarioResponsavel",
        r.req_observacao as observacao,
        COALESCE(
          (SELECT SUM(itr.itr_quantidade * itr.itr_pr_unitario)
           FROM cmp_it_requisicao itr
           WHERE itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao),
          0
        ) as "valorTotal"
      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN dbusuario usr ON r.req_codusr = usr.codusr
      ${whereString}
      ORDER BY oc.orc_data DESC, oc.orc_id DESC
    `;

    const result = await client.query(query, params);
    const dados = result.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ordens de Compra');

    // Mapear nomes amigáveis das colunas
    const colunasFriendly: Record<string, string> = {
      ordem: 'Ordem',
      requisicao: 'Requisição',
      dataOrdem: 'Data Ordem',
      statusOrdem: 'Status Ordem',
      orc_pagamento_configurado: 'Pagamento Configurado',
      fornecedorCod: 'Cód. Fornecedor',
      fornecedor_completo: 'Fornecedor',
      fornecedorCpfCnpj: 'CPF/CNPJ Fornecedor',
      comprador_completo: 'Comprador',
      statusRequisicao: 'Status Requisição',
      previsaoChegada: 'Previsão Chegada',
      localEntrega: 'Local Entrega',
      localDestino: 'Local Destino',
      prazoEntrega: 'Prazo Entrega',
      dataFinalizacao: 'Data Finalização',
      usuarioResponsavel: 'Responsável',
      observacao: 'Observação',
      valorTotal: 'Valor Total'
    };

    // Definir colunas para exportação (usar todas se nenhuma especificada)
    const colunasExport = colunas.length > 0 ? colunas : Object.keys(colunasFriendly);

    // Criar header manualmente na linha 1 (mesmo padrão do export que funciona)
    const headerRow = colunasExport.map((col: string) => colunasFriendly[col] || col);
    worksheet.addRow(headerRow);

    // Estilizar header (linha 1)
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };

    // Adicionar dados
    dados.forEach((item: Record<string, any>) => {
      const rowData = colunasExport.map((coluna: string) => {
        let value = item[coluna];

        // Formatação especial - garantir que ordem e requisicao venham como texto
        if ((coluna === 'ordem' || coluna === 'requisicao') && value) {
          value = String(value);
        } else if ((coluna === 'dataOrdem' || coluna === 'previsaoChegada' || coluna === 'dataFinalizacao') && value) {
          value = new Date(value).toLocaleDateString('pt-BR');
        } else if (coluna === 'statusOrdem') {
          const statusMap: Record<string, string> = { 'A': 'Aberta', 'B': 'Bloqueada', 'F': 'Fechada', 'C': 'Cancelada' };
          value = statusMap[value] || value || '';
        } else if (coluna === 'statusRequisicao') {
          const statusMap: Record<string, string> = { 'P': 'Pendente', 'S': 'Submetida', 'A': 'Aprovada', 'R': 'Rejeitada', 'C': 'Cancelada' };
          value = statusMap[value] || value || '';
        } else if (coluna === 'valorTotal' && value) {
          value = parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        }

        return value ?? '';
      });
      worksheet.addRow(rowData);
    });

    // Ajustar largura das colunas após adicionar dados
    colunasExport.forEach((col: string, index: number) => {
      const column = worksheet.getColumn(index + 1);
      if (col === 'ordem' || col === 'requisicao') {
        column.width = 18;
      } else if (col === 'fornecedor_completo' || col === 'comprador_completo' || col === 'observacao') {
        column.width = 35;
      } else {
        column.width = 20;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ordens-compra.xlsx');
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar ordens:', error);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
