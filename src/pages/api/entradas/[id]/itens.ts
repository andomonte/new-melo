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

    // Buscar itens da entrada (modelo Delphi dbitent, por codent)
    const itensQuery = `
      SELECT
        ie.codprod,
        ie.codreq,
        COALESCE(p.descr, 'Produto nao encontrado') as produto_descricao,
        ie.quant,
        ie.prunit,
        ROUND(COALESCE(ie.quant,0) * COALESCE(ie.prunit,0), 2) as valor_total,
        COALESCE(p.unimed, 'UN') as unimed
      FROM db_manaus.dbitent ie
      LEFT JOIN db_manaus.dbprod p ON ie.codprod = p.codprod
      WHERE ie.codent = $1
      ORDER BY ie.codprod ASC
    `;

    const result = await client.query(itensQuery, [id]);
    const items = result.rows;

    res.status(200).json({
      success: true,
      data: items.map(item => ({
        id: `${item.codprod}-${item.codreq ?? '0'}`,
        produto_cod: item.codprod,
        produto_descricao: item.produto_descricao,
        quantidade: Number(item.quant),
        valor_unitario: Number(item.prunit),
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