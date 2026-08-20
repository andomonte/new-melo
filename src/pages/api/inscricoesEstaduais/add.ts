// pages/api/inscricoesEstaduais/add.ts

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

  const { cgc, inscricaoestadual, nomecontribuinte } = req.body;
  // tipo: '04' = IE principal (NF-e série 1 / NFC-e série 3); '07' = Inscrição 07
  // (NF-e série 2, não emite NFC-e). Default '04'.
  const tipo = String(req.body?.tipo || '04') === '07' ? '07' : '04';

  // Validações
  if (!cgc || !inscricaoestadual || !nomecontribuinte) {
    return res.status(400).json({
      error: 'CGC, Inscrição Estadual e Nome do Contribuinte são obrigatórios',
    });
  }

  try {
    const pool = getPgPool(filial);
    const client = await pool.connect();

    try {
      // Verificar se a inscrição estadual já existe
      const checkQuery = `
        SELECT inscricaoestadual
        FROM db_ie
        WHERE inscricaoestadual = $1
      `;
      const checkResult = await client.query(checkQuery, [inscricaoestadual]);

      if (checkResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Inscrição Estadual já cadastrada',
        });
      }

      // Inserir nova IE
      const insertQuery = `
        INSERT INTO db_ie (cgc, inscricaoestadual, nomecontribuinte, tipo)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        cgc,
        inscricaoestadual,
        nomecontribuinte,
        tipo,
      ]);

      return res.status(201).json({
        success: true,
        message: 'Inscrição Estadual cadastrada com sucesso',
        data: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao adicionar inscrição estadual:', error);
    return res.status(500).json({
      error: 'Erro ao adicionar inscrição estadual',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
