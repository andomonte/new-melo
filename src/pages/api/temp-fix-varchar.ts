import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    const alteracoes: string[] = [];

    // 1. Verificar e ajustar entrada_operacoes_log.status_anterior
    try {
      await client.query(`ALTER TABLE entrada_operacoes_log ALTER COLUMN status_anterior TYPE VARCHAR(50)`);
      alteracoes.push('entrada_operacoes_log.status_anterior -> VARCHAR(50)');
    } catch (e: any) {
      if (!e.message.includes('already')) {
        console.log('status_anterior:', e.message);
      }
    }

    // 2. Verificar e ajustar entrada_operacoes_log.status_novo
    try {
      await client.query(`ALTER TABLE entrada_operacoes_log ALTER COLUMN status_novo TYPE VARCHAR(50)`);
      alteracoes.push('entrada_operacoes_log.status_novo -> VARCHAR(50)');
    } catch (e: any) {
      if (!e.message.includes('already')) {
        console.log('status_novo:', e.message);
      }
    }

    // 3. Verificar e ajustar entradas_estoque.status
    try {
      await client.query(`ALTER TABLE entradas_estoque ALTER COLUMN status TYPE VARCHAR(50)`);
      alteracoes.push('entradas_estoque.status -> VARCHAR(50)');
    } catch (e: any) {
      if (!e.message.includes('already')) {
        console.log('entradas_estoque.status:', e.message);
      }
    }

    // 4. Verificar e ajustar entrada_operacoes.status
    try {
      await client.query(`ALTER TABLE entrada_operacoes ALTER COLUMN status TYPE VARCHAR(50)`);
      alteracoes.push('entrada_operacoes.status -> VARCHAR(50)');
    } catch (e: any) {
      if (!e.message.includes('already')) {
        console.log('entrada_operacoes.status:', e.message);
      }
    }

    // 5. Verificar tamanho atual dos campos
    const infoResult = await client.query(`
      SELECT
        table_name,
        column_name,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name IN ('entradas_estoque', 'entrada_operacoes', 'entrada_operacoes_log')
        AND column_name LIKE '%status%'
      ORDER BY table_name, column_name
    `);

    res.status(200).json({
      success: true,
      message: 'Campos ajustados',
      alteracoes,
      campos_status: infoResult.rows
    });

  } catch (error: any) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
}
