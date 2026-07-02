import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

/**
 * Consulta de compras por período (igual ao Delphi "Consulta Intervalo de Comprar").
 * Lê de dbvenda, apenas não canceladas, no intervalo de datas.
 * Mostra codvenda, total, data e status/tipo decodificados.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id, dataInicio, dataFim } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }
  if (!dataInicio || !dataFim) {
    return res
      .status(400)
      .json({ error: 'Data início e data fim são obrigatórias' });
  }

  const pool = getPgPool(filial);

  try {
    // Igual ao Delphi: dbvenda, cancel='N', no intervalo (comparando só a data).
    // Sem filtro por tipo (as vendas usam tipo 'P'/'1'/'C', não 'V'/'O').
    const query = `
      SELECT
        codvenda,
        nronf,
        data,
        COALESCE(total, 0) AS "valorTotal",
        CASE status
          WHEN 'F' THEN 'Faturado'
          WHEN 'B' THEN 'Bloqueado'
          WHEN 'L' THEN 'Liberado'
          ELSE status
        END AS status
      FROM dbvenda
      WHERE codcli = $1
        AND COALESCE(cancel, 'N') = 'N'
        AND data::date BETWEEN $2::date AND $3::date
      ORDER BY data DESC
    `;

    const result = await pool.query(query, [id, dataInicio, dataFim]);

    const compras = result.rows.map((row) => ({
      // No Delphi esta tela identifica a venda pelo codvenda (nronf normalmente é nulo)
      nf: row.nronf || row.codvenda || 'S/N',
      data: row.data ? new Date(row.data).toLocaleDateString('pt-BR') : '-',
      valorTotal: parseFloat(row.valorTotal || 0),
      status: row.status || '-',
    }));

    return res.status(200).json({ compras });
  } catch (error) {
    console.error('Erro ao buscar compras por intervalo:', error);
    return res.status(500).json({
      error: 'Erro ao buscar compras',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
