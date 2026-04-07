import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const {
      page = 1,
      limit = 20,
      status,
      data_inicio,
      data_fim,
      cliente,
      vendedor,
      operadora,
      conta,
      tipo,
      com_atraso,
      cod_receb,
      nro_nf,
      nro_dup,
      banco,
      codfat,
      valor_min,
      valor_max,
      search
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Construir filtros WHERE
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    const statusFilter = status as string | undefined;

    // Filtro por período de vencimento
    if (data_inicio) {
      whereClause += ` AND r.dt_venc >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereClause += ` AND r.dt_venc <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    // Filtro por cliente (aceita código ou nome)
    if (cliente) {
      whereClause += ` AND (CAST(r.codcli AS TEXT) LIKE $${paramIndex} OR UPPER(c.nome) LIKE UPPER($${paramIndex + 1}))`;
      params.push(`%${cliente}%`);
      params.push(`%${cliente}%`);
      paramIndex += 2;
    }

    // Filtro por vendedor
    if (vendedor) {
      whereClause += ` AND r.codvend = $${paramIndex}`;
      params.push(vendedor);
      paramIndex++;
    }

    // Filtro por conta financeira
    if (conta) {
      whereClause += ` AND r.rec_cof_id = $${paramIndex}`;
      params.push(conta);
      paramIndex++;
    }

    // Filtro por tipo
    if (tipo) {
      whereClause += ` AND r.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    // Filtro por código do recebimento
    if (cod_receb) {
      whereClause += ` AND r.cod_receb = $${paramIndex}`;
      params.push(cod_receb);
      paramIndex++;
    }

    // Filtro por número de NF - removido (campo não existe em dbreceb)
    // if (nro_nf) {
    //   whereClause += ` AND r.nro_nf LIKE $${paramIndex}`;
    //   params.push(`%${nro_nf}%`);
    //   paramIndex++;
    // }

    // Filtro por número de duplicata - removido (campo não existe em dbreceb)
    // if (nro_dup) {
    //   whereClause += ` AND r.nro_dup LIKE $${paramIndex}`;
    //   params.push(`%${nro_dup}%`);
    //   paramIndex++;
    // }

    // Filtro por banco
    if (banco) {
      whereClause += ` AND r.banco LIKE $${paramIndex}`;
      params.push(`%${banco}%`);
      paramIndex++;
    }

    // Filtro por código de fatura
    if (codfat) {
      whereClause += ` AND r.cod_fat LIKE $${paramIndex}`;
      params.push(`%${codfat}%`);
      paramIndex++;
    }

    // Filtro por valor mínimo
    if (valor_min) {
      whereClause += ` AND r.valor_rec >= $${paramIndex}`;
      params.push(parseFloat(valor_min as string));
      paramIndex++;
    }

    // Filtro por valor máximo
    if (valor_max) {
      whereClause += ` AND r.valor_rec <= $${paramIndex}`;
      params.push(parseFloat(valor_max as string));
      paramIndex++;
    }

    // Busca geral (código, cliente, documento)
    if (search) {
      whereClause += ` AND (
        CAST(r.cod_receb AS TEXT) LIKE $${paramIndex}
        OR UPPER(c.nome) LIKE UPPER($${paramIndex + 1})
        OR r.nro_doc LIKE $${paramIndex + 2}
      )`;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      paramIndex += 3;
    }

    // Query principal com cálculo de status baseado nos campos do PostgreSQL
    const query = `
      WITH contas_com_status AS (
        SELECT
          r.cod_receb as id,
          r.rec_cof_id,
          cf.cof_descricao as descricao_conta,
          r.codcli,
          c.nome as nome_cliente,
          r.dt_venc,
          r.dt_pgto,
          r.dt_emissao,
          r.valor_pgto as valor_original,
          COALESCE(r.valor_rec, 0) as valor_recebido,
          r.nro_doc,
          r.tipo,
          r.rec,
          r.cancel,
          r.banco,
          r.nro_banco,
          r.nro_docbanco,
          r.bradesco,
          r.forma_fat,
          r.cod_fat,
          r.cod_venda,
          r.grupo_pagamento_id,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status,
          CASE
            WHEN r.dt_venc < CURRENT_DATE AND (r.rec IS NULL OR r.rec != 'S')
            THEN CURRENT_DATE - r.dt_venc
            ELSE 0
          END as dias_atraso
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
        LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = r.rec_cof_id
        WHERE 1=1 ${whereClause}
      )
      SELECT * FROM contas_com_status
      WHERE 1=1
      ${statusFilter ? `AND status = '${statusFilter}'` : ''}
      ${com_atraso === 'true' ? 'AND dias_atraso > 0' : ''}
      ORDER BY id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Query de contagem total com o mesmo filtro de status
    const countQuery = `
      WITH contas_com_status AS (
        SELECT
          r.cod_receb,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status,
          CASE
            WHEN r.dt_venc < CURRENT_DATE AND (r.rec IS NULL OR r.rec != 'S')
            THEN CURRENT_DATE - r.dt_venc
            ELSE 0
          END as dias_atraso
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
        LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = r.rec_cof_id
        WHERE 1=1 ${whereClause}
      )
      SELECT COUNT(*) as total
      FROM contas_com_status
      WHERE 1=1
      ${statusFilter ? `AND status = '${statusFilter}'` : ''}
      ${com_atraso === 'true' ? 'AND dias_atraso > 0' : ''}
    `;

    const countParams = params.slice(0, -2); // Remove limit e offset
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    // Formatar dados de resposta - MOSTRAR CADA PARCELA INDIVIDUALMENTE
    const contasFormatadas = await Promise.all(result.rows.map(async row => {
      // Extrair número da parcela do campo nro_doc (formato: "base/01", "base/02")
      let parcela_atual = null;
      let qtd_parcelas = null;
      
      if (row.nro_doc && row.nro_doc.includes('/')) {
        const partes = row.nro_doc.split('/');
        const base = partes[0]; // base do nro_doc
        const numParcela = parseInt(partes[1]); // "01" -> 1
        
        // Buscar total de parcelas com mesmo base
        const totalParcelasResult = await pool.query(
          `SELECT COUNT(*) as total FROM dbreceb WHERE nro_doc LIKE $1`,
          [`${base}/%`]
        );
        const totalParcelas = parseInt(totalParcelasResult.rows[0].total);
        
        // Formato: "1 de 2", "2 de 2"
        parcela_atual = `${numParcela} de ${totalParcelas}`;
        qtd_parcelas = totalParcelas;
      }

      return {
        id: row.id,
        cod_receb: row.id,
        rec_cof_id: row.rec_cof_id,
        descricao_conta: row.descricao_conta,
        codcli: row.codcli,
        nome_cliente: row.nome_cliente,
        dt_venc: row.dt_venc,
        dt_pgto: row.dt_pgto,
        dt_emissao: row.dt_emissao,
        valor_original: parseFloat(row.valor_original || 0),
        valor_recebido: parseFloat(row.valor_recebido || 0),
        nro_doc: row.nro_doc,
        tipo: row.tipo,
        rec: row.rec,
        cancel: row.cancel,
        banco: row.banco,
        nro_banco: row.nro_banco,
        nro_docbanco: row.nro_docbanco,
        bradesco: row.bradesco,
        forma_fat: row.forma_fat,
        cod_fat: row.cod_fat,
        cod_venda: row.cod_venda,
        grupo_pagamento_id: row.grupo_pagamento_id,
        status: row.status,
        dias_atraso: parseInt(row.dias_atraso || 0),
        parcela_atual: parcela_atual, // Formato: "1 de 2", "2 de 2"
        qtd_parcelas: qtd_parcelas,
        eh_parcelada: parcela_atual !== null // Se tem parcela, é parcelada
      };
    }));

    // Calcular resumo (usando valor_pgto como valor original a receber)
    const resumoQuery = `
      SELECT
        SUM(CASE WHEN status = 'pendente' THEN valor_pgto ELSE 0 END) as total_pendente,
        SUM(CASE WHEN status = 'recebido' THEN valor_pgto ELSE 0 END) as total_recebido,
        SUM(CASE WHEN status = 'vencido' THEN valor_pgto ELSE 0 END) as total_vencido,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as qtd_pendente,
        COUNT(CASE WHEN status = 'vencido' THEN 1 END) as qtd_vencida
      FROM (
        SELECT
          r.valor_pgto,
          CASE
            WHEN r.cancel = 'S' THEN 'cancelado'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) >= COALESCE(r.valor_pgto, 0) THEN 'recebido'
            WHEN r.rec = 'S' AND COALESCE(r.valor_rec, 0) > 0 THEN 'recebido_parcial'
            WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
            ELSE 'pendente'
          END as status
        FROM db_manaus.dbreceb r
        WHERE r.cancel IS NULL OR r.cancel != 'S'
      ) as contas
    `;

    const resumoResult = await pool.query(resumoQuery);
    const resumo = resumoResult.rows[0];

    return res.status(200).json({
      contas_receber: contasFormatadas,
      paginacao: {
        pagina: parseInt(page as string),
        limite: parseInt(limit as string),
        total,
        totalPaginas: totalPages,
      },
      resumo: {
        total_a_receber: parseFloat(resumo.total_pendente || 0) + parseFloat(resumo.total_vencido || 0),
        total_recebido: parseFloat(resumo.total_recebido || 0),
        total_vencido: parseFloat(resumo.total_vencido || 0),
        total_pendente: parseFloat(resumo.total_pendente || 0),
        qtd_pendente: parseInt(resumo.qtd_pendente || 0),
        qtd_vencida: parseInt(resumo.qtd_vencida || 0),
      }
    });

  } catch (error) {
    console.error('Erro ao consultar contas a receber:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
