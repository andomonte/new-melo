import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface EntradaItem {
  id: string;
  produto_cod: string;
  produto_descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  unimed: string;
}

interface EntradaItensResponse {
  success: boolean;
  data: EntradaItem[];
  total: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EntradaItensResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'ID da entrada é obrigatório'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar itens da entrada
    const itensQuery = `
      SELECT
        ei.id,
        ei.produto_cod,
        COALESCE(p.descr, 'Produto nao encontrado') as produto_descricao,
        ei.quantidade,
        ei.valor_unitario,
        ei.valor_total,
        COALESCE(p.unimed, 'UN') as unimed
      FROM entrada_itens ei
      LEFT JOIN dbprod p ON ei.produto_cod = p.codprod
      WHERE ei.entrada_id = $1
      ORDER BY ei.id ASC
    `;

    const result = await client.query(itensQuery, [id]);
    const items = result.rows;

    res.status(200).json({
      success: true,
      data: items.map(item => ({
        id: item.id.toString(),
        produto_cod: item.produto_cod,
        produto_descricao: item.produto_descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        valor_total: Number(item.valor_total),
        unimed: item.unimed || 'UN'
      })),
      total: items.length
    });

  } catch (error) {
    console.error('Erro ao buscar itens da entrada:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}