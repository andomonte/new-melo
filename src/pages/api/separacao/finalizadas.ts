import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability
interface ReadonlySeparacaoFinalizada {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly data: string;
  readonly total: number;
  readonly finalizadopedido: string;
  readonly tempoDeSeparacao?: string;
}

interface ReadonlySeparacaoFinalizadaResponse {
  readonly data: readonly ReadonlySeparacaoFinalizada[];
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
}

interface ReadonlySeparacaoQuery {
  readonly matricula?: string | string[];
  readonly limit?: string | string[];
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'CONSULTA_SEPARACOES_FINALIZADAS';
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
 * API para buscar separações finalizadas de um separador
 *
 * Otimizada com padrões de nível sênior:
 * - Query CTE para melhor performance
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Tratamento robusto de erros
 *
 * @param req - Request com matrícula do separador e limit opcional
 * @param res - Response com lista de separações finalizadas
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ReadonlySeparacaoFinalizadaResponse | ReadonlyErrorResponse
  >,
): Promise<void> {
  // Headers anti-cache para evitar dados antigos
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, max-age=0',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido. Use GET.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const startTime = Date.now();

  // Extrair filial dos cookies para multi-tenant (with fallback)
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS'; // Default to MANAUS if no cookie

  // Log filial source for debugging
  if (!cookies.filial_melo) {
    console.log(
      'API finalizadas usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe query extraction
  const query = req.query as ReadonlySeparacaoQuery;
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
    // Query CTE otimizada com dados atualizados e sem cache
    const query = `
      WITH separacoes_finalizadas AS (
        SELECT 
          v.codvenda,
          COALESCE(c.nome, 'Cliente não encontrado') as nome_cliente,
          v.data,
          v.total,
          v.fimseparacao,
          v.inicioseparacao,
          v.separador,
          v.statuspedido,
          CASE 
            WHEN v.inicioseparacao IS NOT NULL AND v.fimseparacao IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (v.fimseparacao::timestamp - v.inicioseparacao::timestamp))
            ELSE NULL
          END as tempo_separacao_segundos
        FROM dbvenda v
        LEFT JOIN dbclien c ON v.codcli = c.codcli
        WHERE v.separador = $1 
          AND v.statuspedido = '3'
          AND v.fimseparacao IS NOT NULL
          -- Ampliar período para 30 dias para capturar mais dados
          AND v.fimseparacao::date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      separacoes_ordenadas AS (
        SELECT *,
          ROW_NUMBER() OVER (
            -- Ordenar primeiro por fimseparacao (mais recente primeiro)
            ORDER BY fimseparacao DESC NULLS LAST,
                     codvenda DESC
          ) as rn
        FROM separacoes_finalizadas
      )
      SELECT 
        codvenda,
        nome_cliente,
        data,
        total,
        fimseparacao,
        tempo_separacao_segundos
      FROM separacoes_ordenadas
      WHERE rn <= $2
      ORDER BY rn
    `;

    const result = await client.query(query, [matricula, limitNum]);

    // Debug log para verificar dados retornados
    console.log(
      `[DEBUG] Separações finalizadas encontradas para ${matricula}:`,
      {
        total: result.rows.length,
        primeiros3: result.rows.slice(0, 3).map((row) => ({
          codvenda: row.codvenda,
          fimseparacao: row.fimseparacao,
          nome_cliente: row.nome_cliente,
        })),
        timestamp: new Date().toISOString(),
      },
    );

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'CONSULTA_SEPARACOES_FINALIZADAS',
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
      '[AUDIT] Separações finalizadas consultadas:',
      JSON.stringify(auditLog),
    );

    // Log de diagnóstico apenas se não houver resultados
    if (result.rows.length === 0) {
      const diagnosticQuery = `
        WITH diagnostic_data AS (
          SELECT 
            COUNT(*) as total_vendas,
            COUNT(CASE WHEN separador = $1 THEN 1 END) as vendas_separador,
            COUNT(CASE WHEN separador = $1 AND statuspedido = '3' THEN 1 END) as vendas_status_3,
            COUNT(CASE WHEN separador = $1 AND statuspedido = '3' AND fimseparacao IS NOT NULL 
                   AND fimseparacao::date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as vendas_ultimos_7_dias
          FROM dbvenda
        )
        SELECT * FROM diagnostic_data
      `;

      const diagnosticResult = await client.query(diagnosticQuery, [matricula]);
      console.log(
        `[DIAGNOSTIC] Separações para matrícula ${matricula}:`,
        diagnosticResult.rows[0],
      );
    }

    // Mapear dados com formatação de tempo otimizada
    const separacoesFinalizadas: readonly ReadonlySeparacaoFinalizada[] =
      result.rows.map((row): ReadonlySeparacaoFinalizada => {
        let tempoDeSeparacao: string | undefined;

        if (row.tempo_separacao_segundos !== null) {
          const segundos = parseInt(row.tempo_separacao_segundos, 10);
          const horas = Math.floor(segundos / 3600);
          const minutos = Math.floor((segundos % 3600) / 60);
          const segs = segundos % 60;

          if (horas > 0) {
            tempoDeSeparacao = `${horas}h ${minutos}m ${segs}s`;
          } else if (minutos > 0) {
            tempoDeSeparacao = `${minutos}m ${segs}s`;
          } else {
            tempoDeSeparacao = `${segs}s`;
          }
        }

        return {
          codvenda: row.codvenda,
          nomeCliente: row.nome_cliente || 'Cliente não identificado',
          data: row.data || '',
          total: parseFloat(row.total) || 0,
          finalizadopedido: row.fimseparacao || '',
          tempoDeSeparacao,
        } as const;
      });

    return res.status(200).json({
      data: separacoesFinalizadas,
    });
  } catch (error) {
    const errorLog = {
      action: 'ERRO_CONSULTA_SEPARACOES_FINALIZADAS',
      usuario: matricula,
      filial,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      performance_ms: Date.now() - startTime,
    };

    console.error(
      '[ERROR] Erro ao buscar separações finalizadas:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao buscar separações finalizadas',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    client.release();
  }
}
