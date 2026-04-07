import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { nfeId } = req.query;

  if (!nfeId || typeof nfeId !== 'string') {
    return res.status(400).json({ error: 'NFE ID é obrigatório' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Buscar dados auxiliares
    const result = await client.query(`
      SELECT
        codnfe_ent,
        codcomprador,
        codcredor,
        codtransp,
        operacao,
        custofin,
        desconto,
        acrescimo,
        verba_tmk,
        desconto_icms,
        desconto_st,
        zerar_ipi,
        zerar_st,
        temcusto,
        codusr,
        cfop,
        complementar,
        devolucao,
        dev_codfat
      FROM dbnfe_ent_aux
      WHERE codnfe_ent = $1
    `, [nfeId]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Nenhum dado de confirmação encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('[dados-confirmacao] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados de confirmação',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
