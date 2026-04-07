import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability and type safety
interface ReadonlyIniciarConferenciaRequest {
  readonly codVenda: string;
  readonly matriculaConferente: string;
  readonly nomeConferente: string;
}

interface ReadonlyIniciarConferenciaResponse {
  readonly message: string;
  readonly data: {
    readonly codVenda: string;
    readonly statuspedido: string;
    readonly conferente: {
      readonly matricula: string;
      readonly nome: string;
    };
    readonly iniciadoEm: string;
  };
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly currentStatus?: string;
  readonly statusDescricao?: string;
  readonly acao?: string;
  readonly conferente?: string;
  readonly conferenteSolicitante?: string;
}

// Database result interface
interface ReadonlyVendaInfo {
  readonly codvenda: string;
  readonly statuspedido: string;
  readonly conferente: string | null;
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'INICIAR_CONFERENCIA' | 'ERRO_INICIAR_CONFERENCIA';
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
 * API para iniciar conferência de um pedido
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
    ReadonlyIniciarConferenciaResponse | ReadonlyErrorResponse
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
      'API conferência/iniciar usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe request body extraction
  const requestBody = req.body as ReadonlyIniciarConferenciaRequest;
  const { codVenda, matriculaConferente, nomeConferente } = requestBody;

  // Validação rigorosa de entrada
  if (!codVenda || !matriculaConferente || !nomeConferente) {
    return res.status(400).json({
      error: 'Código da venda, matrícula e nome do conferente são obrigatórios',
      code: 'MISSING_REQUIRED_FIELDS',
    });
  }

  if (
    typeof codVenda !== 'string' ||
    typeof matriculaConferente !== 'string' ||
    typeof nomeConferente !== 'string'
  ) {
    return res.status(400).json({
      error: 'Todos os campos devem ser strings válidas',
      code: 'INVALID_FIELD_TYPES',
    });
  }

  // Validação adicional de formato
  if (
    codVenda.trim().length === 0 ||
    matriculaConferente.trim().length === 0 ||
    nomeConferente.trim().length === 0
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

    // Verificar se a venda existe e está no estado correto com lock
    const checkQuery = `
      SELECT codvenda, statuspedido, conferente
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

    const venda = checkResult.rows[0] as ReadonlyVendaInfo;

    // Verificar se status permite iniciar conferência
    if (venda.statuspedido !== '3') {
      await client.query('ROLLBACK');

      const statusInfo = getStatusInfo(venda.statuspedido);

      return res.status(409).json({
        error: `${statusInfo.acao}. Status atual: ${statusInfo.statusDescricao}`,
        code: 'INVALID_STATUS_FOR_CONFERENCE',
        currentStatus: venda.statuspedido,
        statusDescricao: statusInfo.statusDescricao,
        acao: statusInfo.acao,
      });
    }

    // Verificar se já está vinculada a outro conferente
    if (venda.conferente && venda.conferente !== matriculaConferente) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'Venda já está vinculada a outro conferente',
        code: 'ALREADY_ASSIGNED_TO_OTHER_CONFERENTE',
        conferente: venda.conferente,
        conferenteSolicitante: matriculaConferente,
      });
    }

    // Verificar se já está vinculada ao mesmo conferente
    // Isso pode acontecer se houve um erro anterior ou requisição duplicada
    if (venda.conferente === matriculaConferente) {
      await client.query('ROLLBACK');

      return res.status(200).json({
        message: 'Pedido já está vinculado a este conferente',
        data: {
          codVenda,
          statuspedido: venda.statuspedido,
          conferente: {
            matricula: matriculaConferente,
            nome: nomeConferente,
          },
          iniciadoEm: new Date().toISOString(),
        },
      });
    }

    // Atualizar a venda para iniciar conferência com RETURNING para validação
    const updateQuery = `
      UPDATE dbvenda 
      SET conferente = $1, 
          statuspedido = '4',
          inicioconferencia = NOW(),
          dtupdate = NOW()
      WHERE codvenda = $2 AND statuspedido = '3' AND (conferente IS NULL OR conferente = '' OR conferente = $1)
      RETURNING codvenda, statuspedido, inicioconferencia
    `;

    const updateResult = await client.query(updateQuery, [
      matriculaConferente,
      codVenda,
    ]);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error:
          'Não foi possível vincular a conferência. Venda pode ter sido alterada por outro usuário.',
        code: 'CONCURRENT_MODIFICATION',
      });
    }

    // Commit da transação
    await client.query('COMMIT');

    const iniciadoEm = updateResult.rows[0].inicioconferencia;

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'INICIAR_CONFERENCIA',
      usuario: `${nomeConferente} (${matriculaConferente})`,
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      resultado: {
        success: true,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log('[AUDIT] Conferência iniciada:', JSON.stringify(auditLog));

    return res.status(200).json({
      message: 'Conferência iniciada com sucesso',
      data: {
        codVenda,
        statuspedido: '4',
        conferente: {
          matricula: matriculaConferente,
          nome: nomeConferente,
        },
        iniciadoEm: iniciadoEm || new Date().toISOString(),
      },
    });
  } catch (error) {
    // Rollback em caso de erro
    await client.query('ROLLBACK');

    const errorLog: ReadonlyAuditLog = {
      action: 'ERRO_INICIAR_CONFERENCIA',
      usuario: `${nomeConferente} (${matriculaConferente})`,
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      error: {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        code: 'INTERNAL_SERVER_ERROR',
      },
    };

    console.error(
      '[ERROR] Erro ao iniciar conferência:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao iniciar conferência',
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
    case '4':
      return {
        statusDescricao: 'Já em Conferência',
        acao: 'Esta venda já está sendo conferida',
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
        acao: 'Não é possível iniciar conferência',
      };
  }
}
