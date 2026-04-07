import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface PedidoRecebimento {
  NrVenda: string;
  Cliente: string;
  Vendedor: string;
  horario: string;
  status: string;
}

// Função para mapear o status para descrição
function getStatusDescription(statuspedido: string): string {
  switch (statuspedido) {
    case '1':
      return 'Aguardando';
    case '2':
      return 'Em Separação';
    case '3':
      return 'Separado';
    case '4':
      return 'Em Conferência';
    case '5':
      return 'Conferido';
    case 'F':
      return 'Faturado';
    default:
      return `Status ${statuspedido}`;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Extrair parâmetros de query
  const {
    page = '1',
    perPage = '10',
    search = '',
    sortBy = 'data',
    sortOrder = 'ASC',
    statusFilter = '', // Novo parâmetro para filtro de status
  } = req.query;

  const pageNumber = parseInt(page as string, 10);
  const itemsPerPage = parseInt(perPage as string, 10);
  const offset = (pageNumber - 1) * itemsPerPage;
  const searchTerm = search as string;
  const sortField = sortBy as string;
  const sortDirection = (sortOrder as string).toUpperCase();
  const statusFiltro = statusFilter as string;

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Construir condições WHERE
    const whereConditions = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // REGRA DE NEGÓCIO: Se há busca ativa, ignorar filtro de status
    if (searchTerm && searchTerm.trim() !== '') {
      // Quando há pesquisa: buscar apenas pelo termo, ignorando status
      whereConditions.push(`(
        v.codvenda::text ILIKE $${paramIndex} OR 
        c.nome ILIKE $${paramIndex} OR 
        v.nome ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${searchTerm.trim()}%`);
      paramIndex++;
    } else {
      // Quando NÃO há pesquisa: aplicar filtro de status
      if (statusFiltro && statusFiltro !== '') {
        whereConditions.push(`v.statuspedido = $${paramIndex}`);
        queryParams.push(statusFiltro);
        paramIndex++;
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      ${whereClause}
    `;

    // Query principal com paginação e filtro
    let orderByClause = 'ORDER BY v.data DESC'; // Mudei para DESC para mostrar mais recentes primeiro

    if (sortField === 'codvenda') {
      orderByClause = `ORDER BY v.codvenda ${sortDirection}`;
    } else if (sortField === 'cliente') {
      orderByClause = `ORDER BY c.nome ${sortDirection}`;
    } else if (sortField === 'data') {
      orderByClause = `ORDER BY v.data ${sortDirection}`;
    }

    const dataQuery = `
      SELECT 
        v.codvenda as NrVenda,
        COALESCE(c.nome, 'Cliente não encontrado') as Cliente,
        COALESCE(v.nome, '') as Vendedor,
        v.data as horario,
        COALESCE(v.statuspedido, '1') as statuspedido
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(itemsPerPage, offset);

    // Executar queries
    const countResult = await client.query(
      countQuery,
      queryParams.slice(0, -2),
    );
    const dataResult = await client.query(dataQuery, queryParams);

    const total = parseInt(countResult.rows[0].total, 10);
    const lastPage = Math.ceil(total / itemsPerPage);

    const pedidos: PedidoRecebimento[] = dataResult.rows.map((row: any) => ({
      NrVenda: row.nrvenda,
      Cliente: row.cliente,
      Vendedor: row.vendedor,
      horario: row.horario,
      status: getStatusDescription(row.statuspedido),
    }));

    return res.status(200).json({
      data: pedidos,
      meta: {
        total,
        currentPage: pageNumber,
        lastPage,
        perPage: itemsPerPage,
        from: offset + 1,
        to: Math.min(offset + itemsPerPage, total),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos para recebimento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
}
