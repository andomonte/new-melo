import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability and type safety
interface ReadonlyPedidoEmSeparacao {
  readonly codvenda: string;
  readonly nomeCliente: string;
  readonly codvend: string;
  readonly ra_mat: string;
  readonly nome: string;
  readonly data: string;
  readonly total: number;
  readonly operacao: string;
  readonly separador: string;
  readonly vendedor: string;
  readonly horario: string;
}

interface ReadonlyPedidosSeparacaoResponse {
  readonly data: readonly ReadonlyPedidoEmSeparacao[];
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

interface ReadonlySeparacaoPedidosQuery {
  readonly nomeSeparador?: string | string[];
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'CONSULTA_PEDIDOS_SEPARACAO';
  readonly usuario: string;
  readonly filial: string;
  readonly timestamp: string;
  readonly params: {
    readonly nomeSeparador: string;
    readonly buscarOrfas: boolean;
  };
  readonly resultado: {
    readonly total: number;
    readonly performance_ms: number;
  };
}

/**
 * API para buscar pedidos em separação
 *
 * Otimizada com padrões de nível sênior:
 * - Query CTE unificada para melhor performance
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Lógica de negócio otimizada para órfãos vs separador específico
 * - Tratamento robusto de erros
 *
 * @param req - Request com nome do separador (vazio para órfãs)
 * @param res - Response com lista de pedidos
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ReadonlyPedidosSeparacaoResponse | ReadonlyErrorResponse
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

  // Extrair filial dos cookies para multi-tenant (com fallback)
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS'; // Default to MANAUS if no cookie

  // Log filial source for debugging
  if (!cookies.filial_melo) {
    console.log(
      'API pedidos usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe query extraction
  const query = req.query as ReadonlySeparacaoPedidosQuery;
  const { nomeSeparador } = query;

  // Validação de entrada
  if (nomeSeparador === undefined || typeof nomeSeparador !== 'string') {
    return res.status(400).json({
      error: 'Nome do separador é obrigatório (string vazia para órfãos)',
      code: 'INVALID_NOME_SEPARADOR',
    });
  }

  // Determinar tipo de busca
  const buscarOrfas = nomeSeparador.trim() === '';
  let matriculaFuncionario = '';

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Se não é busca por órfãos, encontrar a matrícula do funcionário
    if (!buscarOrfas) {
      const funcionarioQuery = `
        SELECT matricula 
        FROM dbfunc_estoque 
        WHERE nome = $1
      `;

      const funcionarioResult = await client.query(funcionarioQuery, [
        nomeSeparador,
      ]);

      if (funcionarioResult.rows.length > 0) {
        matriculaFuncionario = funcionarioResult.rows[0].matricula;
      } else {
        // Se não encontrar o funcionário, retornar lista vazia
        const auditLog: ReadonlyAuditLog = {
          action: 'CONSULTA_PEDIDOS_SEPARACAO',
          usuario: nomeSeparador,
          filial,
          timestamp: new Date().toISOString(),
          params: {
            nomeSeparador,
            buscarOrfas: false,
          },
          resultado: {
            total: 0,
            performance_ms: Date.now() - startTime,
          },
        };

        console.log(
          '[AUDIT] Funcionário não encontrado:',
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
    }

    // Query otimizada sem CTEs complexos para evitar problemas de coluna
    const pedidosQuery = buscarOrfas
      ? `
      SELECT 
        v.codvenda,
        COALESCE(c.nome, 'Cliente não encontrado') as nome_cliente,
        v.codvend,
        v.data,
        v.total,
        v.operacao,
        v.separador,
        CASE 
          WHEN v.inicioseparacao IS NOT NULL 
          THEN TO_CHAR(v.inicioseparacao, 'DD/MM/YYYY HH24:MI')
          ELSE 'Não informado'
        END as horario_formatado,
        COALESCE(ven.nome, 'Vendedor não identificado') as vendedor_nome,
        ven.matricula as vendedor_matricula,
        COALESCE(sep.nome, 'Separador não identificado') as separador_nome
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      LEFT JOIN dbfunc_estoque ven ON v.codvend = ven.matricula
      LEFT JOIN dbfunc_estoque sep ON v.separador = sep.matricula
      WHERE v.statuspedido = '2' 
        AND (v.separador IS NULL OR v.separador = '')
      ORDER BY 
        CASE 
          WHEN v.inicioseparacao IS NOT NULL THEN v.inicioseparacao 
          ELSE v.data::timestamp 
        END DESC NULLS LAST, 
        v.codvenda ASC
    `
      : `
      SELECT 
        v.codvenda,
        COALESCE(c.nome, 'Cliente não encontrado') as nome_cliente,
        v.codvend,
        v.data,
        v.total,
        v.operacao,
        v.separador,
        CASE 
          WHEN v.inicioseparacao IS NOT NULL 
          THEN TO_CHAR(v.inicioseparacao, 'DD/MM/YYYY HH24:MI')
          ELSE 'Não informado'
        END as horario_formatado,
        COALESCE(ven.nome, 'Vendedor não identificado') as vendedor_nome,
        ven.matricula as vendedor_matricula,
        COALESCE(sep.nome, 'Separador não identificado') as separador_nome
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      LEFT JOIN dbfunc_estoque ven ON v.codvend = ven.matricula
      LEFT JOIN dbfunc_estoque sep ON v.separador = sep.matricula
      WHERE v.statuspedido = '2' 
        AND (v.separador = $1 OR v.separador = $2)
      ORDER BY 
        CASE 
          WHEN v.inicioseparacao IS NOT NULL THEN v.inicioseparacao 
          ELSE v.data::timestamp 
        END DESC NULLS LAST, 
        v.codvenda ASC
    `;

    const queryParams = buscarOrfas
      ? []
      : [matriculaFuncionario, nomeSeparador];
    const result = await client.query(pedidosQuery, queryParams);

    // Mapear dados com type safety
    const pedidos: readonly ReadonlyPedidoEmSeparacao[] = result.rows.map(
      (row): ReadonlyPedidoEmSeparacao => ({
        codvenda: row.codvenda,
        nomeCliente: row.nome_cliente || 'Cliente não encontrado',
        codvend: row.codvend || '',
        ra_mat: row.separador || '', // Matrícula do separador
        nome: row.separador_nome || 'Separador não identificado', // Nome do separador
        data: row.data || '',
        total: parseFloat(row.total) || 0,
        operacao: row.operacao || '',
        separador: row.separador || '',
        vendedor: row.vendedor_nome || 'Vendedor não identificado', // Nome do vendedor
        horario: row.horario_formatado || 'Não informado', // Horário formatado
      }),
    );

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'CONSULTA_PEDIDOS_SEPARACAO',
      usuario: buscarOrfas
        ? 'SISTEMA_ORFAOS'
        : `${nomeSeparador} (${matriculaFuncionario})`,
      filial,
      timestamp: new Date().toISOString(),
      params: {
        nomeSeparador,
        buscarOrfas,
      },
      resultado: {
        total: pedidos.length,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log(
      '[AUDIT] Pedidos em separação consultados:',
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
      action: 'ERRO_CONSULTA_PEDIDOS_SEPARACAO',
      usuario: buscarOrfas ? 'SISTEMA_ORFAOS' : nomeSeparador,
      filial,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      performance_ms: Date.now() - startTime,
    };

    console.error(
      '[ERROR] Erro ao buscar pedidos em separação:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao buscar pedidos em separação',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    client.release();
  }
}
