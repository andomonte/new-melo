import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Strict typing with readonly interfaces
interface PedidoConferido {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly vendedor: string;
  readonly horario: string;
  readonly status: string;
  readonly conferente: {
    readonly matricula: string;
    readonly nome: string;
  };
}

interface ConferidosResponse {
  readonly data: PedidoConferido[];
  readonly meta: {
    readonly total: number;
    readonly currentPage: number;
    readonly lastPage: number;
    readonly perPage: number;
  };
}

interface ErrorResponse {
  readonly error: string;
  readonly code?: string;
}

/**
 * Optimized query for listing conferidos
 * Uses efficient LEFT JOINs and specific column selection
 */
const LISTAR_CONFERIDOS_QUERY = `
  SELECT 
    v.codvenda,
    COALESCE(c.nome, 'Cliente não encontrado') as nomecliente,
    COALESCE(ven.nome, 'Vendedor não identificado') as vendedor_nome,
    v.data as horario,
    v.statuspedido,
    COALESCE(conf.nome, v.conferente, 'Não informado') as conferente_nome,
    COALESCE(conf.matricula, 'N/A') as conferente_matricula
  FROM dbvenda v
  LEFT JOIN dbclien c ON v.codcli = c.codcli
  LEFT JOIN dbfunc_estoque ven ON v.codvend = ven.matricula
  LEFT JOIN dbfunc_estoque conf ON v.conferente = conf.matricula
  WHERE v.statuspedido = '5'
  ORDER BY v.data DESC
`;

/**
 * Enhanced error handling with specific database error codes
 */
const handleDatabaseError = (
  error: unknown,
): { message: string; code: string } => {
  if (error instanceof Error) {
    if (error.message.includes('connection')) {
      return {
        message: 'Falha na conexão com o banco de dados',
        code: 'DATABASE_CONNECTION_ERROR',
      };
    }

    if (error.message.includes('timeout')) {
      return {
        message: 'Timeout na operação do banco de dados',
        code: 'DATABASE_TIMEOUT',
      };
    }

    console.error('Database error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  return {
    message: 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConferidosResponse | ErrorResponse>,
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // Extract filial from cookies for multi-tenant support (with fallback)
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS'; // Default to MANAUS if no cookie

  // Log filial source for debugging
  if (!cookies.filial_melo) {
    console.log(
      'API conferência/conferidos usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Get optimized multi-tenant connection pool
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    // Get connection with timeout
    client = await pool.connect();

    // Audit log
    console.log('Listando pedidos conferidos:', {
      filial,
      timestamp: new Date().toISOString(),
      module: 'conferencia',
    });

    // Execute optimized query
    const result = await client.query(LISTAR_CONFERIDOS_QUERY);

    console.log(`Encontrados ${result.rows.length} pedidos conferidos`, {
      filial,
      module: 'conferencia',
    });

    // Map data to response format
    const pedidos: PedidoConferido[] = result.rows.map((row) => ({
      codvenda: row.codvenda,
      nomeCliente: row.nomecliente,
      vendedor: row.vendedor_nome,
      horario: row.horario,
      status: row.statuspedido,
      conferente: {
        matricula: row.conferente_matricula,
        nome: row.conferente_nome,
      },
    }));

    return res.status(200).json({
      data: pedidos,
      meta: {
        total: pedidos.length,
        currentPage: 1,
        lastPage: 1,
        perPage: pedidos.length,
      },
    });
  } catch (error) {
    // Enhanced error handling with context
    const { message: errorMessage, code: errorCode } =
      handleDatabaseError(error);

    console.error('Erro crítico ao listar pedidos conferidos:', {
      filial,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
      module: 'conferencia',
    });

    return res.status(500).json({
      error: errorMessage,
      code: errorCode,
    });
  } finally {
    // Ensure connection is always released with timeout protection
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Erro ao liberar conexão do pool:', releaseError);
      }
    }
  }
}
