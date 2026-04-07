import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability and type safety
interface ReadonlyPedidoParaConferencia {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly vendedor: string;
  readonly horario: string;
  readonly separador: string;
  readonly fimSeparacao: string;
  readonly inicioConferencia: string;
  readonly nomeConferente: string;
  readonly status: string;
}

interface ReadonlyPedidosResponse {
  readonly data: readonly ReadonlyPedidoParaConferencia[];
  readonly meta: {
    readonly total: number;
    readonly currentPage: number;
    readonly lastPage: number;
    readonly perPage: number;
  };
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
}

interface ReadonlyConferenciaPedidosQuery {
  readonly nomeConferente?: string | string[];
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'CONSULTA_PEDIDOS_CONFERENCIA';
  readonly usuario: string;
  readonly filial: string;
  readonly timestamp: string;
  readonly params: {
    readonly nomeConferente: string;
    readonly buscarOrfas: boolean;
  };
  readonly resultado: {
    readonly total: number;
    readonly performance_ms: number;
  };
}

/**
 * API para buscar pedidos para conferência
 *
 * Otimizada com padrões de nível sênior:
 * - Query CTE unificada para melhor performance
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Lógica de negócio otimizada para órfãos vs conferente específico
 * - Tratamento robusto de erros
 *
 * @param req - Request com nome do conferente (vazio para órfãos)
 * @param res - Response com lista de pedidos
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReadonlyPedidosResponse | ReadonlyErrorResponse>,
): Promise<void> {
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
      'API conferência/pedidos usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe query extraction
  const query = req.query as ReadonlyConferenciaPedidosQuery;
  const { nomeConferente } = query;

  // Validação de entrada
  if (nomeConferente === undefined || typeof nomeConferente !== 'string') {
    return res.status(400).json({
      error: 'Nome do conferente é obrigatório (string vazia para órfãos)',
      code: 'INVALID_NOME_CONFERENTE',
    });
  }

  // Determinar tipo de busca
  const buscarOrfas = nomeConferente === '';
  let matriculaConferente = '';

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Se não é busca por órfãos, encontrar a matrícula do conferente
    if (!buscarOrfas) {
      const conferenteQuery = `
        SELECT matricula 
        FROM dbfunc_estoque 
        WHERE nome = $1
      `;

      const conferenteResult = await client.query(conferenteQuery, [
        nomeConferente,
      ]);

      if (conferenteResult.rows.length === 0) {
        // Structured logging para auditoria
        const auditLog: ReadonlyAuditLog = {
          action: 'CONSULTA_PEDIDOS_CONFERENCIA',
          usuario: nomeConferente,
          filial,
          timestamp: new Date().toISOString(),
          params: {
            nomeConferente,
            buscarOrfas: false,
          },
          resultado: {
            total: 0,
            performance_ms: Date.now() - startTime,
          },
        };

        console.log(
          '[AUDIT] Conferente não encontrado:',
          JSON.stringify(auditLog),
        );

        return res.status(200).json({
          data: [],
          meta: {
            total: 0,
            currentPage: 1,
            lastPage: 1,
            perPage: 0,
          },
        });
      }

      matriculaConferente = conferenteResult.rows[0].matricula;
    }

    // Query CTE unificada otimizada para melhor performance
    const pedidosQuery = buscarOrfas
      ? `
      WITH pedidos_base AS (
        SELECT 
          v.codvenda,
          c.nome as nome_cliente,
          ven.nome as vendedor,
          v.data,
          v.inicioconferencia,
          v.fimseparacao,
          v.separador,
          v.conferente,
          v.statuspedido,
          COALESCE(sep.nome, v.separador, 'Não informado') as separador_nome,
          COALESCE(conf.nome, v.conferente, 'Não definido') as nome_conferente
        FROM dbvenda v
        LEFT JOIN dbclien c ON v.codcli = c.codcli
        LEFT JOIN dbfunc_estoque ven ON v.codvend = ven.matricula
        LEFT JOIN dbfunc_estoque sep ON v.separador = sep.matricula
        LEFT JOIN dbfunc_estoque conf ON v.conferente = conf.matricula
        WHERE v.statuspedido = '4' 
          AND (v.conferente IS NULL OR v.conferente = '')
      ),
      pedidos_formatados AS (
        SELECT 
          codvenda,
          nome_cliente,
          vendedor,
          CASE 
            WHEN inicioconferencia IS NOT NULL 
            THEN TO_CHAR(inicioconferencia, 'DD/MM/YYYY HH24:MI')
            ELSE TO_CHAR(data, 'DD/MM/YYYY')
          END as horario_formatado,
          separador_nome,
          CASE 
            WHEN fimseparacao IS NOT NULL 
            THEN TO_CHAR(fimseparacao, 'DD/MM/YYYY HH24:MI')
            ELSE 'Não informado'
          END as fim_separacao,
          CASE 
            WHEN inicioconferencia IS NOT NULL 
            THEN TO_CHAR(inicioconferencia, 'DD/MM/YYYY HH24:MI')
            ELSE 'Não iniciado'
          END as inicio_conferencia,
          nome_conferente,
          statuspedido
        FROM pedidos_base
      )
      SELECT * FROM pedidos_formatados
      ORDER BY inicio_conferencia DESC NULLS LAST, codvenda ASC
    `
      : `
      WITH pedidos_base AS (
        SELECT 
          v.codvenda,
          c.nome as nome_cliente,
          ven.nome as vendedor,
          v.data,
          v.inicioconferencia,
          v.fimseparacao,
          v.separador,
          v.conferente,
          v.statuspedido,
          COALESCE(sep.nome, v.separador, 'Não informado') as separador_nome,
          COALESCE(conf.nome, v.conferente, 'Não definido') as nome_conferente
        FROM dbvenda v
        LEFT JOIN dbclien c ON v.codcli = c.codcli
        LEFT JOIN dbfunc_estoque ven ON v.codvend = ven.matricula
        LEFT JOIN dbfunc_estoque sep ON v.separador = sep.matricula
        LEFT JOIN dbfunc_estoque conf ON v.conferente = conf.matricula
        WHERE v.statuspedido = '4' 
          AND v.conferente = $1
      ),
      pedidos_formatados AS (
        SELECT 
          codvenda,
          nome_cliente,
          vendedor,
          CASE 
            WHEN inicioconferencia IS NOT NULL 
            THEN TO_CHAR(inicioconferencia, 'DD/MM/YYYY HH24:MI')
            ELSE TO_CHAR(data, 'DD/MM/YYYY')
          END as horario_formatado,
          separador_nome,
          CASE 
            WHEN fimseparacao IS NOT NULL 
            THEN TO_CHAR(fimseparacao, 'DD/MM/YYYY HH24:MI')
            ELSE 'Não informado'
          END as fim_separacao,
          CASE 
            WHEN inicioconferencia IS NOT NULL 
            THEN TO_CHAR(inicioconferencia, 'DD/MM/YYYY HH24:MI')
            ELSE 'Não iniciado'
          END as inicio_conferencia,
          nome_conferente,
          statuspedido
        FROM pedidos_base
      )
      SELECT * FROM pedidos_formatados
      ORDER BY inicio_conferencia DESC NULLS LAST, codvenda ASC
    `;

    const queryParams = buscarOrfas ? [] : [matriculaConferente];
    const result = await client.query(pedidosQuery, queryParams);

    // Mapear dados com type safety
    const pedidos: readonly ReadonlyPedidoParaConferencia[] = result.rows.map(
      (row): ReadonlyPedidoParaConferencia => ({
        codvenda: row.codvenda,
        nomeCliente: row.nome_cliente || 'Cliente não encontrado',
        vendedor: row.vendedor || 'Vendedor não identificado',
        horario: row.horario_formatado || 'Não informado',
        separador: row.separador_nome || 'Não informado',
        fimSeparacao: row.fim_separacao || 'Não informado',
        inicioConferencia: row.inicio_conferencia || 'Não iniciado',
        nomeConferente: row.nome_conferente || 'Não definido',
        status: row.statuspedido,
      }),
    );

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'CONSULTA_PEDIDOS_CONFERENCIA',
      usuario: buscarOrfas
        ? 'SISTEMA_ORFAOS'
        : `${nomeConferente} (${matriculaConferente})`,
      filial,
      timestamp: new Date().toISOString(),
      params: {
        nomeConferente,
        buscarOrfas,
      },
      resultado: {
        total: pedidos.length,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log(
      '[AUDIT] Pedidos para conferência consultados:',
      JSON.stringify(auditLog),
    );

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
    const errorLog = {
      action: 'ERRO_CONSULTA_PEDIDOS_CONFERENCIA',
      usuario: buscarOrfas ? 'SISTEMA_ORFAOS' : nomeConferente,
      filial,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      performance_ms: Date.now() - startTime,
    };

    console.error(
      '[ERROR] Erro ao buscar pedidos para conferência:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao buscar pedidos para conferência',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    client.release();
  }
}
