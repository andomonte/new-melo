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

  const whereClauses: string[] = ['r.req_data >= $1', 'r.req_id IS NOT NULL'];
  const params: any[] = ['2020-01-01'];
  let paramIndex = 2;

  if (busca) {
    whereClauses.push(`
      (
        CAST(r.req_id AS TEXT) ILIKE $${paramIndex}
        OR f.nome ILIKE $${paramIndex + 1}
        OR c.nome ILIKE $${paramIndex + 2}
        OR f.cpf_cgc ILIKE $${paramIndex + 3}
      )
    `);
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
    paramIndex += 4;
  }

  const whereString = `WHERE ${whereClauses.join(' AND ')}`;

  let client;
  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Query - req_id contém o código completo (ex: 12002010079), req_id_composto é só o sufixo (79)
    const query = `
      SELECT
        r.req_id as id,
        r.req_versao as versao,
        CAST(r.req_id AS TEXT) as requisicao,
        r.req_tipo as tipo,
        r.req_data as "dataRequisicao",
        r.req_status as "statusRequisicao",
        r.req_cod_credor as "fornecedorCodigo",
        f.nome as "fornecedorNome",
        f.cpf_cgc as "fornecedorCpfCnpj",
        f.nome_fant as "fornecedorFantasia",
        COALESCE(
          CASE
            WHEN f.nome IS NOT NULL AND f.nome != '' THEN f.cod_credor || ' - ' || f.nome
            ELSE ''
          END, ''
        ) as "fornecedorCompleto",
        c.nome as "compradorNome",
        COALESCE(
          CASE
            WHEN c.nome IS NOT NULL AND c.nome != '' THEN r.req_codcomprador || ' - ' || c.nome
            ELSE ''
          END, ''
        ) as "compradorCompleto",
        ue.unm_nome as "localEntrega",
        ud.unm_nome as destino,
        r.req_previsao_chegada as "previsaoChegada",
        r.req_cond_pagto as "condPagto",
        r.req_observacao as observacao,
        COALESCE(
          (SELECT SUM(itr.itr_quantidade * itr.itr_pr_unitario)
           FROM cmp_it_requisicao itr
           WHERE itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao),
          0
        ) as "valorTotal",
        oc.orc_id as "ordemCompra",
        oc.orc_data as "dataOrdem",
        oc.orc_status as "statusOrdem"
      FROM cmp_requisicao r
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN cmp_ordem_compra oc ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      ${whereString}
      ORDER BY r.req_data DESC, r.req_id DESC
    `;

    console.log('🔍 EXPORT DEBUG - Query:', query.substring(0, 300));
    console.log('🔍 EXPORT DEBUG - Params:', params);

    const result = await client.query(query, params);
    const dados = result.rows;

    // Debug detalhado: verificar valores que vêm do banco
    if (dados.length > 0) {
      console.log('🔍 EXPORT DEBUG - Total registros:', dados.length);
      console.log('🔍 EXPORT DEBUG - Primeiro registro COMPLETO:', JSON.stringify(dados[0], null, 2));
      console.log('🔍 EXPORT DEBUG - Campos do primeiro registro:', Object.keys(dados[0]));
      console.log('🔍 EXPORT DEBUG - Valor de requisicao:', dados[0].requisicao);
      console.log('🔍 EXPORT DEBUG - Valor de id:', dados[0].id);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Requisições de Compra');

    // Mapear nomes amigáveis das colunas
    const colunasFriendly: Record<string, string> = {
      requisicao: 'Requisição',
      fornecedorNome: 'Fornecedor',
      fornecedorCompleto: 'Fornecedor',
      compradorNome: 'Comprador',
      compradorCompleto: 'Comprador',
      statusRequisicao: 'Status Requisição',
      dataRequisicao: 'Data Requisição',
      tipo: 'Tipo',
      versao: 'Versão',
      observacao: 'Observação',
      condPagto: 'Condições de Pagamento',
      condicoesPagamento: 'Condições de Pagamento',
      localEntrega: 'Local de Entrega',
      destino: 'Destino',
      fornecedorCpfCnpj: 'CPF/CNPJ Fornecedor',
      previsaoChegada: 'Previsão de Chegada',
      ordemCompra: 'Ordem de Compra',
      dataOrdem: 'Data O.C.',
      statusOrdem: 'Status O.C.',
      valorTotal: 'Valor Total'
    };

    // Mapear nomes do frontend para nomes do banco
    const colunaParaCampo: Record<string, string> = {
      fornecedorCompleto: 'fornecedorCompleto',
      compradorCompleto: 'compradorCompleto',
      condicoesPagamento: 'condPagto',
    };

    // Definir colunas para exportação
    const colunasExport = colunas.length > 0 ? colunas : Object.keys(colunasFriendly);

    // Criar header manualmente na linha 1 (mesmo padrão do export individual que funciona)
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
        const campoReal = colunaParaCampo[coluna] || coluna;
        let value = item[campoReal];

        // Formatação especial
        if (coluna === 'requisicao' && value) {
          value = String(value);
        } else if (coluna === 'ordemCompra' && value) {
          value = String(value);
        } else if ((coluna === 'dataRequisicao' || coluna === 'dataOrdem' || coluna === 'previsaoChegada') && value) {
          value = new Date(value).toLocaleDateString('pt-BR');
        } else if (coluna === 'statusRequisicao') {
          const statusMap: Record<string, string> = { 'P': 'Pendente', 'S': 'Submetida', 'A': 'Aprovada', 'R': 'Rejeitada', 'C': 'Cancelada' };
          value = statusMap[value] || value || '';
        } else if (coluna === 'statusOrdem') {
          const statusMap: Record<string, string> = { 'A': 'Aberta', 'B': 'Bloqueada', 'F': 'Fechada', 'C': 'Cancelada' };
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
      if (col === 'requisicao' || col === 'ordemCompra') {
        column.width = 18;
      } else if (col === 'fornecedorCompleto' || col === 'compradorCompleto' || col === 'observacao') {
        column.width = 35;
      } else {
        column.width = 20;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=requisicoes-compra.xlsx');
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar requisições:', error);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
