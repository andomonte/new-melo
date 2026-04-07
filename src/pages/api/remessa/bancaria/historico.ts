import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { 
      page = '1', 
      limit = '20',
      dtini,
      dtfim,
      banco,
      tipo_remessa,
      status
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Construir filtros dinâmicos
    const filtros: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filtro de período
    if (dtini) {
      filtros.push(`a.data_gerado >= $${paramIndex}`);
      params.push(dtini);
      paramIndex++;
    }

    if (dtfim) {
      filtros.push(`a.data_gerado <= $${paramIndex}::timestamp + interval '1 day'`);
      params.push(dtfim);
      paramIndex++;
    }

    // Filtro de banco
    if (banco && banco !== 'TODOS') {
      filtros.push(`a.banco = $${paramIndex}`);
      params.push(banco);
      paramIndex++;
    }

    // Filtro de tipo de remessa (não existe na tabela, ignorar por agora)
    // A coluna tipo_remessa não existe em dbremessa_arquivo
    // if (tipo_remessa) {
    //   filtros.push(`a.tipo_remessa = $${paramIndex}`);
    //   params.push(tipo_remessa);
    //   paramIndex++;
    // }

    const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

    // Query principal com informações do borderô
    // NOTA: A tabela dbremessa_arquivo tem colunas: codremessa (bigint), banco, data_gerado, nome_arquivo, usuario_importacao, codbodero
    // A tabela dbremessa_detalhe tem: CODREMESSA (numeric), CODRECEB (varchar)
    // A tabela dbreceb tem: cod_receb (varchar)
    const query = `
      SELECT
        a.codremessa as id,
        a.data_gerado as data_envio,
        a.nome_arquivo,
        a.banco,
        a.codbodero as cod_bodero,
        CASE 
          WHEN a.banco = '237' THEN 'BRADESCO'
          WHEN a.banco = '033' THEN 'SANTANDER'
          ELSE 'EQUIFAX'
        END as nome_banco,
        'sucesso' as status,
        -- Calcular quantidade de registros (ambos numeric/bigint, comparação direta)
        COALESCE((
          SELECT COUNT(*)
          FROM db_manaus.dbremessa_detalhe d
          WHERE d."CODREMESSA" = a.codremessa
        ), 0) as registros_enviados,
        -- Calcular valor total
        COALESCE((
          SELECT SUM(d."VALOR")
          FROM db_manaus.dbremessa_detalhe d
          WHERE d."CODREMESSA" = a.codremessa
        ), 0) as valor_total,
        -- Contar títulos liquidados (CODRECEB é varchar, cod_receb é varchar)
        COALESCE((
          SELECT COUNT(DISTINCT d."CODRECEB")
          FROM db_manaus.dbremessa_detalhe d
          INNER JOIN db_manaus.dbreceb r ON r.cod_receb = d."CODRECEB"
          WHERE d."CODREMESSA" = a.codremessa
            AND r.bradesco = 'B'
        ), 0) as titulos_liquidados,
        -- Contar títulos pendentes
        COALESCE((
          SELECT COUNT(DISTINCT d."CODRECEB")
          FROM db_manaus.dbremessa_detalhe d
          INNER JOIN db_manaus.dbreceb r ON r.cod_receb = d."CODRECEB"
          WHERE d."CODREMESSA" = a.codremessa
            AND r.bradesco = 'S'
        ), 0) as titulos_pendentes
      FROM db_manaus.dbremessa_arquivo a
      ${whereClause}
      ORDER BY a.data_gerado DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Query de contagem total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.dbremessa_arquivo a
      ${whereClause}
    `;

    const countParams = params.slice(0, -2); // Remove limit e offset
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.status(200).json({
      historico: result.rows,
      paginacao: {
        pagina: parseInt(page as string),
        limite: parseInt(limit as string),
        total,
        totalPaginas: totalPages
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar histórico de remessas bancárias:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
