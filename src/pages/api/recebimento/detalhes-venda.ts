import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';
import { executeQuery } from '@/lib/databaseHelpers';

interface DetalhesVenda {
  codvenda: string;
  codcli: string;
  nome_cliente: string;
  total: number;
  armazem: number;
  data: string;
  status: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Validar autenticação
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const { nrVenda } = req.query;

  if (!nrVenda || typeof nrVenda !== 'string') {
    return res.status(400).json({ error: 'Parâmetro nrVenda é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Buscar detalhes da venda (corrigindo JOIN com dbclien)
    const queryVenda = `
      SELECT 
        v.codvenda,
        v.nrovenda,
        v.codcli,
        v.data,
        v.total,
        v.codusr,
        v.nome,
        c.nome as cliente
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE v.codvenda = $1
      LIMIT 1
    `;

    const vendaResult = await executeQuery(
      client,
      queryVenda,
      [nrVenda],
      'buscar detalhes da venda',
    );

    if (!vendaResult.success) {
      return res.status(500).json({
        error: 'Erro ao buscar detalhes da venda',
        details: vendaResult.error,
      });
    }

    if (!vendaResult.data || vendaResult.data.length === 0) {
      return res.status(404).json({
        error: 'Venda não encontrada',
        nrVenda,
      });
    }

    const venda = vendaResult.data[0];

    // Montar resposta com dados formatados
    const detalhes: DetalhesVenda = {
      codvenda: venda.codvenda,
      codcli: venda.codcli || '00001',
      nome_cliente: venda.nome_cliente,
      total: parseFloat(venda.total) || 0,
      armazem: parseInt(venda.armazem) || 1,
      data: venda.data,
      status: venda.status,
    };

    return res.status(200).json({
      success: true,
      data: detalhes,
      additional_info: {
        nrovenda: venda.nrovenda,
        observacoes: venda.obs,
        tipo: venda.tipo,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  } finally {
    client.release();
  }
}
