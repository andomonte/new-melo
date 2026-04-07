import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

/**
 * API: /api/remessa/titulos
 * 
 * Implementa SELECIONA_REMESSA do Oracle
 * Retorna 3 tipos de títulos:
 * 1. REMESSA - Títulos novos para inclusão
 * 2. BAIXAR TITULO - Títulos baixados para enviar comando de baixa ao banco
 * 3. PRORROGAR TITULO - Títulos com vencimento alterado
 * 
 * Filtros:
 * - dtini, dtfim: Período de vencimento
 * - banco: Código do banco (opcional)
 * - conta: Código da conta bancária (opcional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { dtini, dtfim, banco, conta, page = '1', pageSize = '100', incluirEnviados = 'false' } = req.query;

    if (!dtini || !dtfim) {
      return res.status(400).json({
        erro: 'Parâmetros dtini e dtfim são obrigatórios'
      });
    }

    const currentPage = parseInt(page as string);
    const limit = parseInt(pageSize as string);
    const offset = (currentPage - 1) * limit;
    const mostrarEnviados = incluirEnviados === 'true';

    console.log('🔍 Selecionando títulos para remessa:', { 
      dtini, dtfim, banco, conta, 
      page: currentPage, pageSize: limit,
      incluirEnviados: mostrarEnviados 
    });

    // Construir filtros opcionais
    let filtrosBanco = '';
    let filtrosConta = '';
    const params: any[] = [dtini, dtfim];
    let paramIndex = 3;

    if (banco) {
      // Usar cb.cod_bc em vez de r.banco (237 = BRADESCO, 033 = SANTANDER)
      filtrosBanco = `AND cb.cod_bc = $${paramIndex}`;
      params.push(banco);
      paramIndex++;
    }

    if (conta) {
      filtrosConta = `AND r.cod_conta = $${paramIndex}`;
      params.push(conta);
      paramIndex++;
    }

    /**
     * PARTE 1: TÍTULOS NOVOS PARA REMESSA (INCLUSÃO)
     * 
     * Condições Oracle:
     * - r.bradesco = 'N' (não enviado ainda) - OPCIONAL se incluirEnviados=true
     * - r.cancel = 'N' (não cancelado)
     * - r.rec = 'N' (não recebido)
     * - r.dt_venc = r.venc_ant (vencimento não alterado)
     * - r.forma_fat = 'B' (boleto)
     */
    const queryParte1 = `
      SELECT
        'REMESSA' as situacao,
        r.cod_receb,
        r.codcli,
        r.nro_doc,
        r.valor_pgto,
        r.dt_venc,
        r.dt_emissao,
        r.banco,
        r.cod_conta,
        r.nro_banco,
        r.forma_fat,
        -- Dados do cliente
        c.nome as nome_cliente,
        c.cpfcgc,
        c.ender as endereco,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep,
        -- Dados bancários
        cb.nome as nome_banco,
        cb.n_agencia as agencia,
        ct.nro_conta,
        ct.digito as digito_conta,
        -- Flag para controle
        r.bradesco as flag_enviado,
        -- Vencimento anterior (NULL para remessa nova)
        r.venc_ant
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
      WHERE r.dt_venc BETWEEN $1 AND $2
        ${mostrarEnviados ? '' : "AND COALESCE(r.bradesco, 'N') = 'N'"}
        AND COALESCE(r.cancel, 'N') = 'N'
        AND COALESCE(r.rec, 'N') = 'N'
        AND COALESCE(r.forma_fat, '') = '2'
        AND r.valor_pgto > 0
        -- Removido filtro venc_ant que impedia títulos com vencimento alterado
        -- AND (r.venc_ant IS NULL OR r.dt_venc = r.venc_ant)
        ${filtrosBanco}
        ${filtrosConta}
    `;

    /**
     * PARTE 2: TÍTULOS PARA BAIXA
     * 
     * Condições Oracle:
     * - Registros em DBDOCBODERO_BAIXA_BANCO
     * - export = 0 (não exportado ainda)
     */
    const queryParte2 = `
      SELECT
        'BAIXAR TITULO' as situacao,
        r.cod_receb,
        r.codcli,
        r.nro_doc,
        r.valor_pgto,
        r.dt_venc,
        r.dt_emissao,
        r.banco,
        r.cod_conta,
        r.nro_banco,
        r.forma_fat,
        -- Dados do cliente
        c.nome as nome_cliente,
        c.cpfcgc,
        c.ender as endereco,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep,
        -- Dados bancários
        cb.nome as nome_banco,
        cb.n_agencia as agencia,
        ct.nro_conta,
        ct.digito as digito_conta,
        -- Flag para controle
        r.bradesco as flag_enviado,
        -- Vencimento anterior (pode ser NULL)
        r.venc_ant
      FROM db_manaus.dbdocbodero_baixa_banco db
      INNER JOIN db_manaus.dbreceb r ON r.cod_receb = db.cod_receb
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND COALESCE(db.export, 0) = 0
        AND COALESCE(r.forma_fat, '') = '2'
        ${filtrosBanco}
        ${filtrosConta}
    `;

    /**
     * PARTE 3: TÍTULOS PARA PRORROGAÇÃO (VENCIMENTO ALTERADO)
     * 
     * Condições Oracle:
     * - r.dt_venc <> r.venc_ant (vencimento mudou)
     * - r.bradesco = 'S' (já foi enviado anteriormente)
     */
    const queryParte3 = `
      SELECT
        'PRORROGAR TITULO' as situacao,
        r.cod_receb,
        r.codcli,
        r.nro_doc,
        r.valor_pgto,
        r.dt_venc,
        r.dt_emissao,
        r.banco,
        r.cod_conta,
        r.nro_banco,
        r.forma_fat,
        -- Dados do cliente
        c.nome as nome_cliente,
        c.cpfcgc,
        c.ender as endereco,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.uf,
        c.cep,
        -- Dados bancários
        cb.nome as nome_banco,
        cb.n_agencia as agencia,
        ct.nro_conta,
        ct.digito as digito_conta,
        -- Flag para controle
        r.bradesco as flag_enviado,
        -- Vencimento anterior para referência
        r.venc_ant
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND r.venc_ant IS NOT NULL
        AND r.dt_venc <> r.venc_ant
        AND COALESCE(r.bradesco, 'N') = 'S'
        AND COALESCE(r.cancel, 'N') = 'N'
        AND COALESCE(r.forma_fat, '') = '2'
        ${filtrosBanco}
        ${filtrosConta}
    `;

    // UNION das 3 partes
    const queryCompleta = `
      ${queryParte1}
      UNION ALL
      ${queryParte2}
      UNION ALL
      ${queryParte3}
      ORDER BY situacao, dt_venc, cod_receb
    `;

    // Primeiro, contar total de registros (sem paginação)
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        ${queryCompleta}
      ) as subquery
    `;
    
    const countResult = await pool.query(countQuery, params);
    const totalRegistros = parseInt(countResult.rows[0].total);

    // Agora buscar dados paginados
    const queryPaginada = `
      ${queryCompleta}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(queryPaginada, [...params, limit, offset]);

    // Agrupar estatísticas por situação
    const estatisticas = {
      total: result.rows.length,
      remessa: result.rows.filter(r => r.situacao === 'REMESSA').length,
      baixa: result.rows.filter(r => r.situacao === 'BAIXAR TITULO').length,
      prorrogacao: result.rows.filter(r => r.situacao === 'PRORROGAR TITULO').length,
      valor_total: result.rows.reduce((acc, r) => acc + parseFloat(r.valor_pgto || 0), 0)
    };

    // Agrupar por banco se não houver filtro
    const porBanco: Record<string, any> = {};
    result.rows.forEach(row => {
      const codBanco = row.banco || 'SEM_BANCO';
      if (!porBanco[codBanco]) {
        porBanco[codBanco] = {
          banco: codBanco,
          nome_banco: row.nome_banco || 'Sem banco',
          titulos: 0,
          valor_total: 0,
          remessa: 0,
          baixa: 0,
          prorrogacao: 0
        };
      }
      porBanco[codBanco].titulos++;
      porBanco[codBanco].valor_total += parseFloat(row.valor_pgto || 0);
      
      if (row.situacao === 'REMESSA') porBanco[codBanco].remessa++;
      if (row.situacao === 'BAIXAR TITULO') porBanco[codBanco].baixa++;
      if (row.situacao === 'PRORROGAR TITULO') porBanco[codBanco].prorrogacao++;
    });

    console.log('✅ Títulos selecionados:', estatisticas);

    const totalPages = Math.ceil(totalRegistros / limit);

    return res.status(200).json({
      titulos: result.rows,
      estatisticas: {
        ...estatisticas,
        total_registros: totalRegistros // Total sem paginação
      },
      por_banco: Object.values(porBanco),
      filtros: { dtini, dtfim, banco, conta },
      paginacao: {
        pagina_atual: currentPage,
        total_paginas: totalPages,
        registros_por_pagina: limit,
        total_registros: totalRegistros,
        registros_nesta_pagina: result.rows.length
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao selecionar títulos para remessa:', error);
    return res.status(500).json({
      erro: 'Erro ao selecionar títulos',
      detalhes: error.message
    });
  }
}
