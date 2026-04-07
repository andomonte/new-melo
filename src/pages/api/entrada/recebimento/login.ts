/**
 * Endpoint de login para o modulo de Recebimento de Entradas
 * POST /api/entrada/recebimento/login
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface LoginRequest {
  readonly matricula: string;
  readonly codigoAcesso: string;
  readonly filial?: string;
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
}

const AUTHENTICATE_QUERY = `
  SELECT
    matricula,
    nome,
    codigoacesso
  FROM dbfunc_estoque
  WHERE matricula = $1 AND codigoacesso = $2
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Metodo nao permitido',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const cookies = parseCookies({ req });
  const body = req.body as LoginRequest;
  const { matricula, codigoAcesso } = body;
  const filial = body.filial || cookies.filial_melo || 'MANAUS';

  // Validacao
  if (!matricula?.trim() || !codigoAcesso?.trim()) {
    return res.status(400).json({
      error: 'Matricula e codigo de acesso sao obrigatorios',
      code: 'INVALID_INPUT',
    });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    console.log('Login recebimento:', {
      matricula: matricula.substring(0, 3) + '***',
      filial,
      timestamp: new Date().toISOString(),
    });

    const result = await client.query(AUTHENTICATE_QUERY, [
      matricula.trim(),
      codigoAcesso.trim(),
    ]);

    if (result.rows.length === 0) {
      console.warn('Falha autenticacao recebimento:', {
        matricula: matricula.substring(0, 3) + '***',
        filial,
      });

      return res.status(401).json({
        error: 'Credenciais invalidas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const funcionario = result.rows[0];

    console.log('Login recebimento sucesso:', {
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      filial,
    });

    return res.status(200).json({
      data: {
        matricula: funcionario.matricula,
        nome: funcionario.nome,
      },
    });
  } catch (error) {
    console.error('Erro critico login recebimento:', error);

    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
