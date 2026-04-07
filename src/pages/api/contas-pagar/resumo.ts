import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const {
      status, // 'pendente', 'pago', 'pago_parcial', 'cancelado', 'pendente_parcial'
      credor,
      data_inicio,
      data_fim,
      tipo,
      nro_nf,
      nro_dup,
      banco,
      ordem_compra,
      cod_ccusto,
      codcomprador,
      conta,
      cod_pgto,
      valor_min,
      valor_max,
      busca,
    } = req.query;

    // Construção de where clause e parâmetros
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    const statusFilter = status as string | undefined;

    // Filtro por período de vencimento
    if (data_inicio) {
      whereClause += ` AND p.dt_venc >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereClause += ` AND p.dt_venc <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    // Filtro por credor
    if (credor) {
      whereClause += ` AND (LOWER(c.nome) LIKE LOWER($${paramIndex}) OR p.cod_credor::text = $${paramIndex + 1})`;
      params.push(`%${credor}%`, credor);
      paramIndex += 2;
    }

    // Filtro por tipo
    if (tipo) {
      whereClause += ` AND p.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    // Filtro por NF
    if (nro_nf) {
      whereClause += ` AND p.nro_nf LIKE $${paramIndex}`;
      params.push(`%${nro_nf}%`);
      paramIndex++;
    }

    // Filtro por duplicata
    if (nro_dup) {
      whereClause += ` AND p.nro_dup LIKE $${paramIndex}`;
      params.push(`%${nro_dup}%`);
      paramIndex++;
    }

    // Filtro por banco
    if (banco) {
      whereClause += ` AND p.banco = $${paramIndex}`;
      params.push(banco);
      paramIndex++;
    }

    // Filtro por ordem de compra
    if (ordem_compra) {
      whereClause += ` AND p.ordem_compra LIKE $${paramIndex}`;
      params.push(`%${ordem_compra}%`);
      paramIndex++;
    }

    // Filtro por centro de custo
    if (cod_ccusto) {
      whereClause += ` AND p.cod_ccusto = $${paramIndex}`;
      params.push(cod_ccusto);
      paramIndex++;
    }

    // Filtro por comprador
    if (codcomprador) {
      whereClause += ` AND p.codcomprador = $${paramIndex}`;
      params.push(codcomprador);
      paramIndex++;
    }

    // Filtro por conta
    if (conta) {
      whereClause += ` AND p.cod_conta = $${paramIndex}`;
      params.push(conta);
      paramIndex++;
    }

    // Filtro por código de pagamento
    if (cod_pgto) {
      whereClause += ` AND p.cod_pgto = $${paramIndex}`;
      params.push(cod_pgto);
      paramIndex++;
    }

    // Filtro por valor mínimo
    if (valor_min) {
      whereClause += ` AND p.valor_pgto >= $${paramIndex}`;
      params.push(parseFloat(valor_min as string));
      paramIndex++;
    }

    // Filtro por valor máximo
    if (valor_max) {
      whereClause += ` AND p.valor_pgto <= $${paramIndex}`;
      params.push(parseFloat(valor_max as string));
      paramIndex++;
    }

    // Filtro de busca globall
    if (busca) {
      whereClause += ` AND (
        p.cod_pgto::text LIKE $${paramIndex} OR
        c.nome ILIKE $${paramIndex} OR
        t.nometransp ILIKE $${paramIndex} OR
        p.nro_nf LIKE $${paramIndex} OR
        p.nro_dup LIKE $${paramIndex} OR
        p.obs ILIKE $${paramIndex}
      )`;
      params.push(`%${busca}%`);
      paramIndex++;
    }
// TODO: descomentar quando for necessário
    // // Filtro por internacional
    // if (req.query.eh_internacional) {
    //   whereClause += ` AND p.eh_internacional = $${paramIndex}`;
    //   params.push(req.query.eh_internacional);
    //   paramIndex++;
    // }

    // Ocultar cancelados por padrão (a menos que filtro de status seja 'cancelado')
    const ocultarCancelados = !statusFilter || statusFilter !== 'cancelado';

    // Query otimizada apenas com campos necessários para os cards
    const query = `
      WITH contas_com_status AS (
        SELECT
          p.cod_pgto,
          p.valor_pgto,
          COALESCE(
            (SELECT SUM(f.valor_pgto) 
             FROM db_manaus.dbfpgto f 
             WHERE f.cod_pgto = p.cod_pgto 
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) as valor_pago,
          CASE
            WHEN p.cancel = 'S' THEN 'cancelado'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) >= p.valor_pgto THEN 'pago'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) > 0 THEN 'pago_parcial'
            ELSE 'pendente'
          END as status
        FROM db_manaus.dbpgto p
        LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
        LEFT JOIN db_manaus.dbtransp t ON t.codtransp = p.cod_transp
        LEFT JOIN db_manaus.dbccusto cc ON cc.cod_ccusto = p.cod_ccusto
        LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = CAST(p.cod_conta AS INTEGER)
        LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = p.banco
        LEFT JOIN db_manaus.dbcompradores comp ON comp.codcomprador = p.codcomprador
        WHERE 1=1 ${whereClause}
      )
      SELECT 
        cod_pgto,
        status,
        valor_pgto,
        valor_pago
      FROM contas_com_status
      WHERE 1=1
      ${statusFilter
        ? statusFilter === 'pendente_parcial'
          ? `AND status IN ('pendente', 'pago_parcial')`
          : `AND status = '${statusFilter}'`
        : ''
      }
    `;

    const result = await pool.query(query, params);

    // Retornar apenas os dados essenciais
    res.status(200).json({
      sucesso: true,
      dados: result.rows,
      total: result.rows.length
    });

  } catch (erro: any) {
    console.error('❌ Erro ao buscar resumo de contas a pagar:', erro);
    res.status(500).json({
      erro: 'Erro ao buscar resumo',
      mensagem: erro.message,
    });
  }
}
