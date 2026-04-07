import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface EntradaPendenteRomaneio {
  id: number;
  numero_entrada: string;
  nfe_id: string;
  fornecedor_cod: string;
  fornecedor_nome: string | null;
  valor_total: number;
  total_itens: number;
  created_at: string;
  dias_pendente: number;
}

interface PendentesRomaneioResponse {
  success: boolean;
  entradas: EntradaPendenteRomaneio[];
  total: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PendentesRomaneioResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Buscar entradas com:
    // - status = 'PENDENTE' (entrada gerada, fiscal OK)
    // - est_alocado = 0 (produtos NÃO distribuídos fisicamente)
    // Ordenar por mais antigas primeiro (FIFO)
    const result = await client.query(`
      SELECT
        e.id,
        e.numero_entrada,
        e.nfe_id,
        e.fornecedor_cod,
        c.nome as fornecedor_nome,
        e.valor_total,
        COUNT(ei.id) as total_itens,
        e.created_at,
        EXTRACT(DAY FROM (NOW() - e.created_at))::INTEGER as dias_pendente
      FROM db_manaus.entradas_estoque e
      LEFT JOIN db_manaus.dbcredor c ON e.fornecedor_cod = c.cod_credor
      LEFT JOIN db_manaus.entrada_itens ei ON e.id = ei.entrada_id
      WHERE e.status = 'PENDENTE'
        AND COALESCE(e.est_alocado, 0) = 0
      GROUP BY e.id, e.numero_entrada, e.nfe_id, e.fornecedor_cod, c.nome, e.valor_total, e.created_at
      ORDER BY e.created_at ASC
    `);

    const entradas: EntradaPendenteRomaneio[] = result.rows.map(row => ({
      id: row.id,
      numero_entrada: row.numero_entrada,
      nfe_id: row.nfe_id,
      fornecedor_cod: row.fornecedor_cod,
      fornecedor_nome: row.fornecedor_nome,
      valor_total: parseFloat(row.valor_total || 0),
      total_itens: parseInt(row.total_itens || 0),
      created_at: row.created_at,
      dias_pendente: parseInt(row.dias_pendente || 0)
    }));

    console.log(`📦 Encontradas ${entradas.length} entrada(s) pendente(s) de romaneio`);

    return res.status(200).json({
      success: true,
      entradas: entradas,
      total: entradas.length
    });

  } catch (error: any) {
    console.error('Erro ao buscar entradas pendentes de romaneio:', error);
    return res.status(500).json({
      error: `Erro ao buscar entradas pendentes de romaneio: ${error.message}`
    });

  } finally {
    if (client) {
      client.release();
    }
  }
}
