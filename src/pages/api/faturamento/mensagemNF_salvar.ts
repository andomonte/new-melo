// pages/api/faturas/salvar-mensagens.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// TIPO AJUSTADO: codigos_mensagens agora é um array de strings
type RequestBody = {
  codfat: string;
  codigos_mensagens: string[]; // <-- MUDANÇA AQUI
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codfat, codigos_mensagens }: RequestBody = req.body;

  if (
    !codfat ||
    !codigos_mensagens ||
    !Array.isArray(codigos_mensagens) ||
    codigos_mensagens.length === 0
  ) {
    return res
      .status(400)
      .json({
        error:
          'Dados inválidos. Forneça "codfat" e um array de strings "codigos_mensagens".',
      });
  }

  const client = await getPgPool().connect();

  try {
    await client.query('BEGIN');

    // O loop agora itera sobre um array de strings
    for (const codmsg of codigos_mensagens) {
      const insertQuery =
        'INSERT INTO dbmensagens_fatura (codfat, codmsg) VALUES ($1, $2)';
      // A inserção funcionará corretamente pois a coluna é do tipo texto
      await client.query(insertQuery, [codfat, codmsg]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      sucesso: true,
      message: `Mensagens salvas com sucesso para a fatura ${codfat}!`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar mensagens da fatura:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  } finally {
    client.release();
  }
}
