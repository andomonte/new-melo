import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Strict typing with readonly interfaces
interface SeparacaoAtiva {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly data: string;
  readonly total: number;
}

interface VerificarAtivasResponse {
  readonly temSeparacaoAtiva: boolean;
  readonly quantidadeAtivas: number;
  readonly separacoesAtivas: SeparacaoAtiva[];
}

interface ErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly details?: {
    readonly validationErrors?: string[];
  };
}

/**
 * Optimized CTE query for checking active separations
 * Handles multiple scenarios in a single efficient query
 */
const VERIFICAR_ATIVAS_QUERY = `
  WITH funcionario_info AS (
    SELECT nome 
    FROM dbfunc_estoque 
    WHERE matricula = $1
  ),
  separacoes_ativas AS (
    SELECT 
      v.codvenda,
      COALESCE(c.nome, 'Cliente não identificado') as nomecliente,
      v.data,
      COALESCE(v.total, 0) as total,
      v.separador,
      'by_matricula' as match_type
    FROM dbvenda v
    LEFT JOIN dbclien c ON v.codcli = c.codcli
    WHERE v.statuspedido = '2' 
      AND v.separador = $1
    
    UNION ALL
    
    SELECT 
      v.codvenda,
      COALESCE(c.nome, 'Cliente não identificado') as nomecliente,
      v.data,
      COALESCE(v.total, 0) as total,
      v.separador,
      'by_name' as match_type
    FROM dbvenda v
    LEFT JOIN dbclien c ON v.codcli = c.codcli
    CROSS JOIN funcionario_info f
    WHERE v.statuspedido = '2' 
      AND v.separador = f.nome
      AND v.separador != $1  -- Avoid duplicates from matricula match
    
    UNION ALL
    
    SELECT 
      v.codvenda,
      COALESCE(c.nome, 'Cliente não identificado') as nomecliente,
      v.data,
      COALESCE(v.total, 0) as total,
      v.separador,
      'orphan' as match_type
    FROM dbvenda v
    LEFT JOIN dbclien c ON v.codcli = c.codcli
    WHERE v.statuspedido = '2' 
      AND (v.separador IS NULL OR v.separador = '')
  )
  SELECT 
    codvenda,
    nomecliente,
    data,
    total,
    separador,
    match_type
  FROM separacoes_ativas
  ORDER BY 
    CASE match_type 
      WHEN 'by_matricula' THEN 1 
      WHEN 'by_name' THEN 2 
      ELSE 3 
    END,
    data ASC
`;

/**
 * Enhanced input validation
 */
const validateInput = (
  matricula: unknown,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
    errors.push('Matrícula é obrigatória e deve ser uma string válida');
  } else if (matricula.length > 20) {
    errors.push('Matrícula inválida');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

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
    message: 'Erro interno do servidor ao verificar separações ativas',
    code: 'INTERNAL_SERVER_ERROR',
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerificarAtivasResponse | ErrorResponse>,
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
      'API verificar-ativas usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  const { matricula } = req.query;

  // Enhanced input validation
  const validation = validateInput(matricula);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Dados de entrada inválidos',
      code: 'INVALID_INPUT',
      details: {
        validationErrors: validation.errors,
      },
    });
  }

  const matriculaStr = matricula as string;

  // Get optimized multi-tenant connection pool
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    // Get connection with timeout
    client = await pool.connect();

    // Audit log
    console.log('Verificando separações ativas:', {
      matricula: matriculaStr,
      filial,
      timestamp: new Date().toISOString(),
    });

    // Execute optimized query
    const result = await client.query(VERIFICAR_ATIVAS_QUERY, [matriculaStr]);

    console.log(
      `Encontradas ${result.rows.length} separações ativas para matrícula ${matriculaStr}:`,
      {
        filial,
        breakdown: {
          byMatricula: result.rows.filter(
            (row) => row.match_type === 'by_matricula',
          ).length,
          byName: result.rows.filter((row) => row.match_type === 'by_name')
            .length,
          orphan: result.rows.filter((row) => row.match_type === 'orphan')
            .length,
        },
      },
    );

    // Log detailed information for debugging
    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`Separação ${index + 1}:`, {
          codvenda: row.codvenda,
          separador: row.separador || 'N/A',
          matchType: row.match_type,
          data: row.data,
        });
      });
    }

    // Map data to response format
    const separacoesAtivas: SeparacaoAtiva[] = result.rows.map((row) => ({
      codvenda: row.codvenda,
      nomeCliente: row.nomecliente,
      data: row.data || '',
      total: parseFloat(row.total) || 0,
    }));

    const response: VerificarAtivasResponse = {
      temSeparacaoAtiva: separacoesAtivas.length > 0,
      quantidadeAtivas: separacoesAtivas.length,
      separacoesAtivas,
    };

    return res.status(200).json(response);
  } catch (error) {
    // Enhanced error handling with context
    const { message: errorMessage, code: errorCode } =
      handleDatabaseError(error);

    console.error('Erro crítico ao verificar separações ativas:', {
      matricula: matriculaStr,
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
