import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability and type safety
interface ReadonlyFinalizarConferenciaRequest {
  readonly codVenda: string;
  readonly matricula: string;
  readonly nome: string;
}

interface ReadonlyFinalizarConferenciaResponse {
  readonly message: string;
  readonly data: {
    readonly codVenda: string;
    readonly conferente: {
      readonly matricula: string;
      readonly nome: string;
    };
    readonly finalizadoEm: string;
  };
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly currentStatus?: string;
  readonly statusDescricao?: string;
  readonly acao?: string;
  readonly conferenteAtual?: string;
  readonly conferenteSolicitante?: string;
}

// Database result interface
interface ReadonlyVendaStatus {
  readonly statuspedido: string;
  readonly conferente: string | null;
  readonly inicioconferencia: string | null;
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'FINALIZAR_CONFERENCIA' | 'ERRO_FINALIZAR_CONFERENCIA';
  readonly usuario: string;
  readonly filial: string;
  readonly timestamp: string;
  readonly codVenda: string;
  readonly resultado?: {
    readonly success: boolean;
    readonly performance_ms: number;
  };
  readonly error?: {
    readonly message: string;
    readonly code: string;
  };
}

/**
 * API para finalizar conferência de um pedido
 *
 * Otimizada com padrões de nível sênior:
 * - Transação atômica com rollback automático
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Optimistic locking para concorrência
 * - Tratamento robusto de erros
 *
 * @param req - Request com código da venda e dados do conferente
 * @param res - Response com confirmação ou erro
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ReadonlyFinalizarConferenciaResponse | ReadonlyErrorResponse
  >,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({
      error: 'Método não permitido. Use PUT.',
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
      'API conferência/finalizar usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe request body extraction
  const requestBody = req.body as ReadonlyFinalizarConferenciaRequest;
  const { codVenda, matricula, nome } = requestBody;

  // Validação rigorosa de entrada
  if (!codVenda || !matricula || !nome) {
    return res.status(400).json({
      error: 'Código da venda, matrícula e nome do conferente são obrigatórios',
      code: 'MISSING_REQUIRED_FIELDS',
    });
  }

  if (
    typeof codVenda !== 'string' ||
    typeof matricula !== 'string' ||
    typeof nome !== 'string'
  ) {
    return res.status(400).json({
      error: 'Todos os campos devem ser strings válidas',
      code: 'INVALID_FIELD_TYPES',
    });
  }

  // Validação adicional de formato
  if (
    codVenda.trim().length === 0 ||
    matricula.trim().length === 0 ||
    nome.trim().length === 0
  ) {
    return res.status(400).json({
      error: 'Campos não podem estar vazios',
      code: 'EMPTY_FIELDS',
    });
  }

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Iniciar transação para operação atômica
    await client.query('BEGIN');

    // Verificar estado atual da venda com lock para evitar condições de corrida
    const checkQuery = `
      SELECT statuspedido, conferente, inicioconferencia
      FROM dbvenda 
      WHERE codvenda = $1
      FOR UPDATE
    `;

    const checkResult = await client.query(checkQuery, [codVenda]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Venda não encontrada',
        code: 'VENDA_NOT_FOUND',
      });
    }

    const venda = checkResult.rows[0] as ReadonlyVendaStatus;

    // Verificar se status permite finalização
    if (venda.statuspedido !== '4') {
      await client.query('ROLLBACK');

      const statusInfo = getStatusInfo(venda.statuspedido);

      return res.status(409).json({
        error: `${statusInfo.acao}. Status atual: ${statusInfo.statusDescricao}`,
        code: 'INVALID_STATUS_FOR_FINALIZATION',
        currentStatus: venda.statuspedido,
        statusDescricao: statusInfo.statusDescricao,
        acao: statusInfo.acao,
      });
    }

    // Verificar se é o mesmo conferente que está finalizando
    if (venda.conferente !== matricula) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Apenas o conferente que iniciou a conferência pode finalizá-la',
        code: 'UNAUTHORIZED_CONFERENTE',
        conferenteAtual: venda.conferente || 'Não definido',
        conferenteSolicitante: matricula,
      });
    }

    // Atualizar a venda para statuspedido '5' (Conferido) com RETURNING para validação
    const updateQuery = `
      UPDATE dbvenda 
      SET statuspedido = '5',
          finalizadopedido = NOW(),
          dtupdate = NOW()
      WHERE codvenda = $1 AND statuspedido = '4' AND conferente = $2
      RETURNING codvenda, statuspedido, finalizadopedido
    `;

    const updateResult = await client.query(updateQuery, [codVenda, matricula]);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error:
          'Não foi possível finalizar a conferência. Venda pode ter sido alterada por outro usuário.',
        code: 'CONCURRENT_MODIFICATION',
      });
    }

    // Commit da transação
    await client.query('COMMIT');

    const finalizadoEm = updateResult.rows[0].finalizadopedido;

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'FINALIZAR_CONFERENCIA',
      usuario: `${nome} (${matricula})`,
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      resultado: {
        success: true,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log('[AUDIT] Conferência finalizada:', JSON.stringify(auditLog));

    return res.status(200).json({
      message: 'Conferência finalizada com sucesso',
      data: {
        codVenda,
        conferente: {
          matricula,
          nome,
        },
        finalizadoEm: finalizadoEm || new Date().toISOString(),
      },
    });
  } catch (error) {
    // Rollback em caso de erro
    await client.query('ROLLBACK');

    const errorLog: ReadonlyAuditLog = {
      action: 'ERRO_FINALIZAR_CONFERENCIA',
      usuario: `${nome} (${matricula})`,
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      error: {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        code: 'INTERNAL_SERVER_ERROR',
      },
    };

    console.error(
      '[ERROR] Erro ao finalizar conferência:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao finalizar conferência',
      code: 'INTERNAL_SERVER_ERROR',
    });
  } finally {
    client.release();
  }
}

/**
 * Função auxiliar para obter informações de status
 */
function getStatusInfo(status: string): {
  statusDescricao: string;
  acao: string;
} {
  switch (status) {
    case '1':
      return {
        statusDescricao: 'Aguardando Separação',
        acao: 'Esta venda ainda não foi separada',
      };
    case '2':
      return {
        statusDescricao: 'Em Separação',
        acao: 'Esta venda ainda está sendo separada',
      };
    case '3':
      return {
        statusDescricao: 'Separado',
        acao: 'Esta venda precisa ter a conferência iniciada primeiro',
      };
    case '5':
      return {
        statusDescricao: 'Já Conferido',
        acao: 'Esta venda já foi conferida e finalizada',
      };
    case 'F':
      return {
        statusDescricao: 'Faturado',
        acao: 'Esta venda já foi faturada',
      };
    default:
      return {
        statusDescricao: `Status ${status}`,
        acao: 'Não é possível finalizar conferência',
      };
  }
}
