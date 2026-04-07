// pages/api/mensagens/criar.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { mensagem } = req.body;
  if (!mensagem) {
    return res.status(400).json({ error: 'O campo "mensagem" é obrigatório.' });
  }

  const client = await getPgPool().connect();

  try {
    await client.query('BEGIN');

    // Para garantir, mesmo que a coluna seja numérica, o CAST não causa problemas.
    // Se a coluna for texto, o CAST é essencial.
    const maxCodResult = await client.query(
      'SELECT MAX(CAST(codigo AS INTEGER)) as ultimo_codigo FROM db_manaus.dbmensagens',
    );

    const ultimoCodigo = maxCodResult.rows[0].ultimo_codigo || 0;
    let novoCodigo = ultimoCodigo + 1;
    
    // Garantir que codigo tenha no máximo 3 caracteres (varchar(3))
    // Se ultrapassar 999, reciclar do 1
    if (novoCodigo > 999) {
      novoCodigo = 1;
    }
    const codigoFormatado = String(novoCodigo).padStart(3, '0');

    const insertQuery = `
      INSERT INTO db_manaus.dbmensagens (codigo, mensagem) 
      VALUES ($1, $2) 
      ON CONFLICT (codigo) DO UPDATE SET mensagem = EXCLUDED.mensagem
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [
      codigoFormatado,
      mensagem,
    ]);

    await client.query('COMMIT');
    return res.status(201).json({
      sucesso: true,
      message: 'Mensagem criada com sucesso!',
      data: insertResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar mensagem:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  } finally {
    client.release();
  }
}
