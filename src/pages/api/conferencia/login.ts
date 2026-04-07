import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Strict typing with readonly interfaces
interface LoginRequest {
  readonly matricula: string;
  readonly codigoAcesso: string;
  readonly filial?: string; // Optional filial override
}

interface LoginResponse {
  readonly data: {
    readonly matricula: string;
    readonly nome: string;
  };
}

interface ErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly details?: {
    readonly securityEvent?: boolean;
    readonly attempts?: number;
  };
}

/**
 * Optimized authentication query with security considerations
 * Uses parameterized queries to prevent SQL injection
 */
const AUTHENTICATE_QUERY = `
  SELECT 
    matricula, 
    nome,
    codigoacesso
  FROM dbfunc_estoque 
  WHERE matricula = $1 AND codigoacesso = $2
`;

/**
 * Enhanced input validation with security considerations
 */
const validateLoginInput = (
  data: LoginRequest,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (
    !data.matricula ||
    typeof data.matricula !== 'string' ||
    data.matricula.trim() === ''
  ) {
    errors.push('Matrícula é obrigatória');
  } else if (data.matricula.length > 20) {
    errors.push('Matrícula inválida');
  }

  if (
    !data.codigoAcesso ||
    typeof data.codigoAcesso !== 'string' ||
    data.codigoAcesso.trim() === ''
  ) {
    errors.push('Código de acesso é obrigatório');
  } else if (data.codigoAcesso.length > 50) {
    errors.push('Código de acesso inválido');
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
    message: 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse | ErrorResponse>,
) {
  // Only allow POST method for security
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // Extract filial from cookies or request body for multi-tenant support
  const cookies = parseCookies({ req });
  const body = req.body as LoginRequest;
  const { matricula, codigoAcesso } = body;
  const filial = body.filial || cookies.filial_melo || 'MANAUS'; // Priority: body > cookie > default

  // Log filial source for debugging
  if (body.filial) {
    console.log(`Login conferência usando filial do request: ${filial}`);
  } else if (cookies.filial_melo) {
    console.log(`Login conferência usando filial do cookie: ${filial}`);
  } else {
    console.log(
      'Login conferência usando filial padrão (MANAUS) - sem cookie ou filial no request',
    );
  }

  // Enhanced input validation
  const validation = validateLoginInput(body);
  if (!validation.isValid) {
    // Security log for invalid input attempts
    console.warn('Tentativa de login com dados inválidos:', {
      matricula: matricula ? matricula.substring(0, 3) + '***' : 'undefined',
      filial,
      errors: validation.errors,
      timestamp: new Date().toISOString(),
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
      securityEvent: true,
      module: 'conferencia',
    });

    return res.status(400).json({
      error: 'Matrícula e código de acesso são obrigatórios',
      code: 'INVALID_INPUT',
      details: {
        securityEvent: true,
      },
    });
  }

  // Get optimized multi-tenant connection pool
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    // Get connection with timeout
    client = await pool.connect();

    // Security audit log for login attempt
    console.log('Tentativa de login para conferência:', {
      matricula: matricula.substring(0, 3) + '***', // Partially mask for security
      filial,
      timestamp: new Date().toISOString(),
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      module: 'conferencia',
    });

    // Execute authentication query
    const result = await client.query(AUTHENTICATE_QUERY, [
      matricula.trim(),
      codigoAcesso.trim(),
    ]);

    if (result.rows.length === 0) {
      // Security log for failed authentication
      console.warn('Falha na autenticação para conferência:', {
        matricula: matricula.substring(0, 3) + '***',
        filial,
        timestamp: new Date().toISOString(),
        ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
        securityEvent: true,
        module: 'conferencia',
      });

      return res.status(401).json({
        error: 'Matrícula ou código de acesso inválido',
        code: 'INVALID_CREDENTIALS',
        details: {
          securityEvent: true,
        },
      });
    }

    const funcionario = result.rows[0];

    // Success audit log
    console.log('Login realizado com sucesso para conferência:', {
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      filial,
      timestamp: new Date().toISOString(),
      module: 'conferencia',
    });

    return res.status(200).json({
      data: {
        matricula: funcionario.matricula,
        nome: funcionario.nome,
      },
    });
  } catch (error) {
    // Enhanced error handling with context
    const { message: errorMessage, code: errorCode } =
      handleDatabaseError(error);

    console.error('Erro crítico no login para conferência:', {
      matricula: matricula ? matricula.substring(0, 3) + '***' : 'undefined',
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
