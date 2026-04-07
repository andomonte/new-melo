import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Strict typing with readonly interfaces
interface AlterarCodigoRequest {
  readonly matricula: string;
  readonly novoCodigoAcesso: string;
}

interface AlterarCodigoResponse {
  readonly message: string;
  readonly data: {
    readonly matricula: string;
    readonly nome: string;
  };
}

interface ErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly details?: {
    readonly validationErrors?: string[];
    readonly securityEvent?: boolean;
  };
}

/**
 * Optimized query that validates and updates in a single operation
 * Uses RETURNING clause to get updated data efficiently
 */
const UPDATE_CODIGO_QUERY = `
  UPDATE dbfunc_estoque 
  SET 
    codigoacesso = $2,
    dtupdate = NOW()
  WHERE matricula = $1
  RETURNING 
    matricula, 
    nome,
    codigoacesso
`;

/**
 * Validation query to check if employee exists
 */
const VALIDATE_EMPLOYEE_QUERY = `
  SELECT matricula, nome 
  FROM dbfunc_estoque 
  WHERE matricula = $1
`;

/**
 * Enhanced input validation with security considerations
 */
const validateInput = (
  data: AlterarCodigoRequest,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (
    !data.matricula ||
    typeof data.matricula !== 'string' ||
    data.matricula.trim() === ''
  ) {
    errors.push('Matrícula é obrigatória e deve ser uma string válida');
  }

  if (!data.novoCodigoAcesso || typeof data.novoCodigoAcesso !== 'string') {
    errors.push('Novo código de acesso é obrigatório');
  } else {
    const codigo = data.novoCodigoAcesso.trim();

    if (codigo.length < 4) {
      errors.push('Código de acesso deve ter pelo menos 4 caracteres');
    }

    if (codigo.length > 50) {
      errors.push('Código de acesso deve ter no máximo 50 caracteres');
    }

    // Security: Check for common weak patterns
    if (/^(1234|0000|1111|abcd|password)$/i.test(codigo)) {
      errors.push('Código de acesso muito simples. Use um código mais seguro');
    }
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
    // Handle specific PostgreSQL error codes
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

    // Log full error for debugging
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
  res: NextApiResponse<AlterarCodigoResponse | ErrorResponse>,
) {
  // Only allow PUT method
  if (req.method !== 'PUT') {
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
      'API alterar-codigo usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  const body = req.body as AlterarCodigoRequest;
  const { matricula, novoCodigoAcesso } = body;

  // Enhanced input validation
  const validation = validateInput(body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Dados de entrada inválidos',
      code: 'INVALID_INPUT',
      details: {
        validationErrors: validation.errors,
      },
    });
  }

  // Get optimized multi-tenant connection pool
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    // Get connection with timeout
    client = await pool.connect();

    // Security audit log
    console.log('Tentativa de alteração de código de acesso:', {
      matricula,
      filial,
      timestamp: new Date().toISOString(),
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
    });

    // First validate if employee exists
    const employeeResult = await client.query(VALIDATE_EMPLOYEE_QUERY, [
      matricula,
    ]);

    if (employeeResult.rows.length === 0) {
      // Security log for unauthorized access attempt
      console.warn('Tentativa de alteração para funcionário inexistente:', {
        matricula,
        filial,
        timestamp: new Date().toISOString(),
        securityEvent: true,
      });

      return res.status(404).json({
        error: 'Funcionário não encontrado',
        code: 'EMPLOYEE_NOT_FOUND',
        details: {
          securityEvent: true,
        },
      });
    }

    const funcionario = employeeResult.rows[0];

    // Optimized update with RETURNING clause
    const updateResult = await client.query(UPDATE_CODIGO_QUERY, [
      matricula,
      novoCodigoAcesso.trim(),
    ]);

    if (updateResult.rowCount === 0) {
      return res.status(500).json({
        error: 'Não foi possível alterar o código de acesso',
        code: 'UPDATE_FAILED',
      });
    }

    // Success audit log
    console.log('Código de acesso alterado com sucesso:', {
      matricula,
      nome: funcionario.nome,
      filial,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      message: 'Código de acesso alterado com sucesso',
      data: {
        matricula: funcionario.matricula,
        nome: funcionario.nome,
      },
    });
  } catch (error) {
    // Enhanced error handling with context
    const { message: errorMessage, code: errorCode } =
      handleDatabaseError(error);

    console.error('Erro crítico ao alterar código de acesso:', {
      matricula,
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
