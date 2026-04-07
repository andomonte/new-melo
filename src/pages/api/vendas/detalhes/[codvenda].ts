import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export interface VendaDetalhes {
  codvenda: string;
  cliente: string;
  vendedor: string;
  horario: string;
  operacao: string;
  separador?: string;
  total?: number;
  itens: ItemVenda[];
}

export interface ItemVenda {
  codprod: string;
  descricao: string;
  quantidade: number;
  preco: number;
  subtotal: number;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { codvenda } = req.query;

    if (!codvenda || typeof codvenda !== 'string') {
      res.status(400).json({ message: 'Código da venda inválido.' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    // Buscar dados da venda
    const vendaQuery = `
      SELECT 
        v.codvenda,
        COALESCE(c.nome, 'Cliente não encontrado') as cliente,
        COALESCE(v.nome, '') as vendedor,
        v.data as horario,
        COALESCE(v.operacao, '1') as operacao,
        v.separador,
        v.total
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE v.codvenda = $1
    `;

    const vendaResult = await client.query(vendaQuery, [codvenda]);

    if (vendaResult.rowCount === 0) {
      res.status(404).json({ message: 'Venda não encontrada.' });
      return;
    }

    const venda = vendaResult.rows[0];

    // Buscar itens da venda
    const itensQuery = `
      SELECT 
        i.codprod,
        p.descr as descricao,
        i.qtd as quantidade,
        i.prunit as preco,
        (i.qtd * i.prunit) as subtotal
      FROM dbitvenda i
      LEFT JOIN dbprod p ON i.codprod = p.codprod
      WHERE i.codvenda = $1
      ORDER BY i.codprod
    `;

    const itensResult = await client.query(itensQuery, [codvenda]);

    const vendaDetalhes: VendaDetalhes = {
      ...venda,
      itens: itensResult.rows || [],
    };

    res.status(200).json(serializeBigInt(vendaDetalhes));
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    res.status(500).json({
      message: 'Erro interno ao buscar detalhes da venda.',
      error: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
