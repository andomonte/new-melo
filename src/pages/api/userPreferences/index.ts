import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para salvar/carregar preferências de tela por usuário.
 *
 * GET  /api/userPreferences?user=MARIO&screen=contas-a-pagar
 * PUT  /api/userPreferences  body: { user, screen, preferences }
 *
 * Tabela: tb_user_screen_preferences
 *   login_user_login  VARCHAR  — usuário
 *   screen_key        VARCHAR  — identificador da tela
 *   preferences       JSONB    — { colunasVisiveis, ordemColunas, sortColumn, sortDirection, perPage }
 *   updated_at        TIMESTAMP
 */

// Garante que a tabela existe (roda só 1x por instância)
let tabelaCriada = false;

async function garantirTabela() {
  if (tabelaCriada) return;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tb_user_screen_preferences (
        login_user_login VARCHAR(100) NOT NULL,
        screen_key VARCHAR(100) NOT NULL,
        preferences JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (login_user_login, screen_key)
      );
    `);
    tabelaCriada = true;
  } finally {
    client.release();
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await garantirTabela();

    if (req.method === 'GET') {
      const { user, screen } = req.query;
      if (!user || !screen) {
        return res.status(400).json({ error: 'Parâmetros user e screen são obrigatórios.' });
      }

      const pool = getPgPool();
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT preferences FROM tb_user_screen_preferences
           WHERE login_user_login = $1 AND screen_key = $2`,
          [user, screen],
        );

        if (result.rows.length === 0) {
          return res.status(200).json({ preferences: null });
        }

        return res.status(200).json({ preferences: result.rows[0].preferences });
      } finally {
        client.release();
      }
    }

    if (req.method === 'PUT') {
      const { user, screen, preferences } = req.body;
      if (!user || !screen || !preferences) {
        return res.status(400).json({ error: 'Campos user, screen e preferences são obrigatórios.' });
      }

      const pool = getPgPool();
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO tb_user_screen_preferences (login_user_login, screen_key, preferences, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (login_user_login, screen_key)
           DO UPDATE SET preferences = $3, updated_at = NOW()`,
          [user, screen, JSON.stringify(preferences)],
        );

        return res.status(200).json({ ok: true });
      } finally {
        client.release();
      }
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error: any) {
    console.error('Erro em userPreferences:', error);
    return res.status(500).json({ error: error.message });
  }
}
