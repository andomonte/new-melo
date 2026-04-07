import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability
interface ReadonlyConferenciaFinalizada {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly data: string;
  readonly total: number;
  readonly finalizadopedido: string;
  readonly tempoDeConferencia?: string;
}

interface ReadonlyConferenciaFinalizadaResponse {
  readonly data: readonly ReadonlyConferenciaFinalizada[];
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
}

interface ReadonlyConferenciaQuery {
  readonly matricula?: string | string[];
  readonly limit?: string | string[];
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'CONSULTA_FINALIZADAS';
  readonly usuario: string;
  readonly filial: string;
  readonly timestamp: string;
  readonly params: {
    readonly matricula: string;
    readonly limit: number;
  };
  readonly resultado: {
    readonly total: number;
    readonly performance_ms: number;
  };
}

/**
 * API para buscar conferências finalizadas de um conferente
 *
 * Otimizada com padrões de nível sênior:
 * - Query CTE para melhor performance
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Tratamento robusto de erros
 *
 * @param req - Request com matrícula do conferente e limit opcional
 * @param res - Response com lista de conferências finalizadas
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ReadonlyConferenciaFinalizadaResponse | ReadonlyErrorResponse
  >,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido. Use GET.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const startTime = Date.now();

  // Extrair filial dos cookies para multi-tenant (com fallback)
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS'; // Default to MANAUS if no cookie

  // Log filial source for debugging
  if (!cookies.filial_melo) {
    console.log(
      'API conferência/finalizadas usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe query extraction
  const query = req.query as ReadonlyConferenciaQuery;
  const { matricula, limit = '10' } = query;

  // Validação rigorosa de entrada
  if (!matricula || typeof matricula !== 'string') {
    return res.status(400).json({
      error: 'Matrícula é obrigatória e deve ser uma string válida',
      code: 'INVALID_MATRICULA',
    });
  }

  if (matricula.trim().length === 0) {
    return res.status(400).json({
      error: 'Matrícula não pode estar vazia',
      code: 'EMPTY_MATRICULA',
    });
  }

  // Validação do limit com limites de segurança
  const limitStr = Array.isArray(limit) ? limit[0] : limit;
  const limitNum = parseInt(limitStr, 10);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    return res.status(400).json({
      error: 'Limit deve ser um número entre 1 e 50',
      code: 'INVALID_LIMIT',
    });
  }

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Query CTE otimizada para melhor performance
    const query = `
      WITH conferencias_finalizadas AS (
        SELECT 
          v.codvenda,
          c.nome as nome_cliente,
          v.data,
          v.total,
          v.finalizadopedido,
          v.inicioconferencia,
          v.conferente,
          v.statuspedido,
          CASE 
            WHEN v.inicioconferencia IS NOT NULL AND v.finalizadopedido IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (v.finalizadopedido::timestamp - v.inicioconferencia::timestamp))
            ELSE NULL
          END as tempo_conferencia_segundos
        FROM dbvenda v
        LEFT JOIN dbclien c ON v.codcli = c.codcli
        WHERE v.conferente = $1 
          AND v.statuspedido = '5'
          AND v.finalizadopedido IS NOT NULL
          AND v.finalizadopedido::date >= CURRENT_DATE - INTERVAL '7 days'
      ),
      conferencias_ordenadas AS (
        SELECT *,
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE 
                WHEN finalizadopedido IS NOT NULL THEN finalizadopedido::timestamp
                WHEN inicioconferencia IS NOT NULL THEN inicioconferencia::timestamp
                ELSE data::timestamp
              END DESC
          ) as rn
        FROM conferencias_finalizadas
      )
      SELECT 
        codvenda,
        nome_cliente,
        data,
        total,
        finalizadopedido,
        tempo_conferencia_segundos
      FROM conferencias_ordenadas
      WHERE rn <= $2
      ORDER BY rn
    `;

    const result = await client.query(query, [matricula, limitNum]);

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'CONSULTA_FINALIZADAS',
      usuario: matricula,
      filial,
      timestamp: new Date().toISOString(),
      params: {
        matricula,
        limit: limitNum,
      },
      resultado: {
        total: result.rows.length,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log(
      '[AUDIT] Conferências finalizadas consultadas:',
      JSON.stringify(auditLog),
    );

    // Log de diagnóstico apenas se não houver resultados
    if (result.rows.length === 0) {
      const diagnosticQuery = `
        WITH diagnostic_data AS (
          SELECT 
            COUNT(*) as total_vendas,
            COUNT(CASE WHEN conferente = $1 THEN 1 END) as vendas_conferente,
            COUNT(CASE WHEN conferente = $1 AND statuspedido = '5' THEN 1 END) as vendas_status_5,
            COUNT(CASE WHEN conferente = $1 AND statuspedido = '5' AND finalizadopedido IS NOT NULL 
                   AND finalizadopedido::date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as vendas_ultimos_7_dias
          FROM dbvenda
        )
        SELECT * FROM diagnostic_data
      `;

      const diagnosticResult = await client.query(diagnosticQuery, [matricula]);
      console.log(
        `[DIAGNOSTIC] Conferências para matrícula ${matricula}:`,
        diagnosticResult.rows[0],
      );
    }

    // Mapear dados com formatação de tempo otimizada
    const conferenciasFinalizadas: readonly ReadonlyConferenciaFinalizada[] =
      result.rows.map((row): ReadonlyConferenciaFinalizada => {
        let tempoDeConferencia: string | undefined;

        if (row.tempo_conferencia_segundos !== null) {
          const segundos = parseInt(row.tempo_conferencia_segundos, 10);
          const horas = Math.floor(segundos / 3600);
          const minutos = Math.floor((segundos % 3600) / 60);
          const segs = segundos % 60;

          if (horas > 0) {
            tempoDeConferencia = `${horas}h ${minutos}m ${segs}s`;
          } else if (minutos > 0) {
            tempoDeConferencia = `${minutos}m ${segs}s`;
          } else {
            tempoDeConferencia = `${segs}s`;
          }
        }

        return {
          codvenda: row.codvenda,
          nomeCliente: row.nome_cliente || 'Cliente não identificado',
          data: row.data || '',
          total: parseFloat(row.total) || 0,
          finalizadopedido: row.finalizadopedido || '',
          tempoDeConferencia,
        } as const;
      });

    return res.status(200).json({
      data: conferenciasFinalizadas,
    });
  } catch (error) {
    const errorLog = {
      action: 'ERRO_CONSULTA_FINALIZADAS',
      usuario: matricula,
      filial,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      performance_ms: Date.now() - startTime,
    };

    console.error(
      '[ERROR] Erro ao buscar conferências finalizadas:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao buscar conferências finalizadas',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    client.release();
  }
}
