// API: Buscar títulos vencidos de um cliente
// Retorna: nroDoc, codReceita, dtEmissao, dtPgto, dtVenc, valor, diasAtraso

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'ID do cliente obrigatório.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar títulos vencidos (não pagos e vencimento passado)
    const result = await client.query(
      `
      SELECT 
        nro_doc,
        cod_receb,
        TO_CHAR(dt_emissao, 'DD/MM/YYYY') as dt_emissao,
        COALESCE(TO_CHAR(dt_pgto, 'DD/MM/YYYY'), '') as dt_pgto,
        TO_CHAR(dt_venc, 'DD/MM/YYYY') as dt_venc,
        valor_rec,
        (CURRENT_DATE - dt_venc) as dias_atraso,
        dt_venc as venc_sort
      FROM dbreceb
      WHERE codcli = $1
        AND (cancel IS NULL OR cancel = 'N')
        AND (rec IS NULL OR rec = 'N')
        AND dt_venc < CURRENT_DATE
      ORDER BY dt_venc DESC
      LIMIT 50
      `,
      [id],
    );

    const titulos = result.rows.map((row: any) => ({
      nroDoc: row.nro_doc || '',
      codReceita: row.cod_receb || '',
      dtEmissao: row.dt_emissao || '',
      dtPgto: row.dt_pgto || '',
      dtVenc: row.dt_venc || '',
      valor: parseFloat(row.valor_rec || 0),
      diasAtraso: parseInt(row.dias_atraso || 0),
    }));

    res.status(200).json(titulos);
  } catch (error) {
    console.error('Erro ao buscar títulos vencidos:', error);
    res.status(500).json({
      error: 'Erro ao buscar títulos vencidos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
