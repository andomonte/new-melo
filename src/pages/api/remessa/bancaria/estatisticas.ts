import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    // Estatísticas de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Estatísticas da semana (últimos 7 dias)
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    inicioSemana.setHours(0, 0, 0, 0);

    // Estatísticas do mês
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Query para buscar estatísticas
    // NOTA: A tabela dbremessa_arquivo não tem qtd_registros nem valor_total
    // Esses valores devem ser calculados via dbremessa_detalhe
    // CODREMESSA em detalhe é numeric, codremessa em arquivo é bigint - comparação direta OK
    const query = `
      SELECT
        -- Hoje
        COUNT(CASE WHEN a.data_gerado >= $1 THEN 1 END) as total_hoje,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $1 THEN (
          SELECT COALESCE(SUM(d."VALOR"), 0) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as valor_hoje,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $1 THEN (
          SELECT COUNT(*) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as titulos_hoje,
        
        -- Semana
        COUNT(CASE WHEN a.data_gerado >= $2 THEN 1 END) as total_semana,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $2 THEN (
          SELECT COALESCE(SUM(d."VALOR"), 0) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as valor_semana,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $2 THEN (
          SELECT COUNT(*) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as titulos_semana,
        
        -- Mês
        COUNT(CASE WHEN a.data_gerado >= $3 THEN 1 END) as total_mes,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $3 THEN (
          SELECT COALESCE(SUM(d."VALOR"), 0) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as valor_mes,
        COALESCE(SUM(CASE WHEN a.data_gerado >= $3 THEN (
          SELECT COUNT(*) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        ) ELSE 0 END), 0) as titulos_mes,
        
        -- Total geral
        COUNT(*) as total_geral,
        COALESCE((SELECT SUM(d."VALOR") FROM db_manaus.dbremessa_detalhe d), 0) as valor_geral,
        COALESCE((SELECT COUNT(*) FROM db_manaus.dbremessa_detalhe d), 0) as titulos_geral
      FROM db_manaus.dbremessa_arquivo a
    `;

    const result = await pool.query(query, [hoje, inicioSemana, inicioMes]);
    const stats = result.rows[0];

    // Buscar estatísticas por banco
    const bancoQuery = `
      SELECT
        a.banco,
        CASE 
          WHEN a.banco = '237' THEN 'BRADESCO'
          WHEN a.banco = '033' THEN 'SANTANDER'
          ELSE 'OUTROS'
        END as nome_banco,
        COUNT(*) as total_remessas,
        COALESCE(SUM((
          SELECT COALESCE(SUM(d."VALOR"), 0) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        )), 0) as valor_total,
        COALESCE(SUM((
          SELECT COUNT(*) FROM db_manaus.dbremessa_detalhe d WHERE d."CODREMESSA" = a.codremessa
        )), 0) as total_titulos
      FROM db_manaus.dbremessa_arquivo a
      WHERE a.data_gerado >= $1
      GROUP BY a.banco
      ORDER BY total_remessas DESC
    `;

    const bancoResult = await pool.query(bancoQuery, [inicioMes]);

    // Buscar status de títulos (liquidados vs pendentes)
    const statusQuery = `
      SELECT
        COUNT(CASE WHEN r.bradesco = 'S' THEN 1 END) as titulos_pendentes,
        COUNT(CASE WHEN r.bradesco = 'B' THEN 1 END) as titulos_liquidados,
        COUNT(CASE WHEN r.bradesco = 'N' THEN 1 END) as titulos_disponiveis,
        COALESCE(SUM(CASE WHEN r.bradesco = 'S' THEN r.valor_pgto ELSE 0 END), 0) as valor_pendente,
        COALESCE(SUM(CASE WHEN r.bradesco = 'B' THEN r.valor_pgto ELSE 0 END), 0) as valor_liquidado
      FROM db_manaus.dbreceb r
      WHERE r.forma_fat = '2'
        AND r.cancel = 'N'
        AND r.rec = 'N'
    `;

    const statusResult = await pool.query(statusQuery);

    res.status(200).json({
      periodo: {
        hoje: {
          remessas: parseInt(stats.total_hoje),
          valor: parseFloat(stats.valor_hoje),
          titulos: parseInt(stats.titulos_hoje)
        },
        semana: {
          remessas: parseInt(stats.total_semana),
          valor: parseFloat(stats.valor_semana),
          titulos: parseInt(stats.titulos_semana)
        },
        mes: {
          remessas: parseInt(stats.total_mes),
          valor: parseFloat(stats.valor_mes),
          titulos: parseInt(stats.titulos_mes)
        },
        geral: {
          remessas: parseInt(stats.total_geral),
          valor: parseFloat(stats.valor_geral),
          titulos: parseInt(stats.titulos_geral)
        }
      },
      porBanco: bancoResult.rows,
      statusTitulos: statusResult.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar estatísticas de remessas:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
