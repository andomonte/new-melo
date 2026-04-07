import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface PedidoRecebimento {
  codvenda: string;
  nrovenda: string;
  cliente: string;
  data: string;
  statusPedido: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Extrair parâmetro de query status
  const { status } = req.query;

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    let whereClause = '';
    let queryParams: string[] = [];

    // Lógica de filtro
    if (status) {
      // Se status for fornecido, filtrar pelos valores especificados
      const statusArray = Array.isArray(status) 
        ? status 
        : (status as string).split(',');
      
      // Sanitizar e validar os status
      const validStatuses = statusArray
        .map(s => s.toString().trim())
        .filter(s => s.length > 0);

      if (validStatuses.length > 0) {
        const placeholders = validStatuses.map((_, index) => `$${index + 1}`).join(',');
        whereClause = `WHERE v.statuspedido IN (${placeholders})`;
        queryParams = validStatuses;
      } else {
        // Se status inválido, usar padrão
        whereClause = `WHERE v.statuspedido = $1`;
        queryParams = ['1'];
      }
    } else {
      // Filtro padrão: apenas status '1' (Aguardando)
      whereClause = `WHERE v.statuspedido = $1`;
      queryParams = ['1'];
    }

    // Query principal para buscar pedidos
    const dataQuery = `
      SELECT 
        v.codvenda,
        COALESCE(v.nrovenda, v.codvenda) as nrovenda,
        COALESCE(c.nome, 'Cliente não encontrado') as cliente,
        v.data,
        COALESCE(v.statuspedido, '1') as statusPedido
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      ${whereClause}
      ORDER BY v.data DESC
    `;

    // Executar query
    const dataResult = await client.query(dataQuery, queryParams);

    const pedidos: PedidoRecebimento[] = dataResult.rows.map((row: any) => ({
      codvenda: row.codvenda,
      nrovenda: row.nrovenda,
      cliente: row.cliente,
      data: row.data,
      statusPedido: row.statuspedido,
    }));

    return res.status(200).json({
      data: pedidos,
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos para recebimento:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  } finally {
    client.release();
  }
}
