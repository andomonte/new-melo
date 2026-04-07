// pages/api/inscricoesEstaduais/migrar-dados.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  try {
    const pool = getPgPool(filial);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1️⃣ Criar tabela db_ie se não existir
      await client.query(`
        CREATE TABLE IF NOT EXISTS db_ie (
          cgc VARCHAR(14),
          inscricaoestadual VARCHAR(20) PRIMARY KEY,
          nomecontribuinte VARCHAR(255)
        )
      `);

      console.log('✅ Tabela db_ie criada/verificada');

      // 2️⃣ Limpar dados antigos (opcional - descomente se quiser refazer a migração)
      // await client.query('TRUNCATE TABLE db_ie');
      // console.log('🗑️ Tabela db_ie limpa');

      // 3️⃣ Migrar dados de dadosempresa para db_ie
      const migrateQuery = `
        INSERT INTO db_ie (cgc, inscricaoestadual, nomecontribuinte)
        SELECT
          de.cgc,
          de.inscricaoestadual,
          de.nomecontribuinte
        FROM dadosempresa de
        WHERE de.inscricaoestadual IS NOT NULL
          AND de.inscricaoestadual != ''
          AND de.cgc IS NOT NULL
          AND de.cgc != ''
        ON CONFLICT (inscricaoestadual)
        DO UPDATE SET
          cgc = EXCLUDED.cgc,
          nomecontribuinte = EXCLUDED.nomecontribuinte
      `;

      const result = await client.query(migrateQuery);

      console.log(`✅ Migração concluída: ${result.rowCount} registros`);

      // 4️⃣ Verificar quantos registros foram migrados
      const countQuery = 'SELECT COUNT(*) as total FROM db_ie';
      const countResult = await client.query(countQuery);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Migração concluída com sucesso',
        registrosMigrados: result.rowCount,
        totalRegistros: total,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao migrar dados:', error);
    return res.status(500).json({
      error: 'Erro ao migrar dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
