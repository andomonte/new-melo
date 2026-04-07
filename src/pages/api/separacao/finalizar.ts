import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

// Readonly interfaces for immutability and type safety
interface ReadonlyFinalizarSeparacaoRequest {
  readonly codVenda: string;
  readonly separadorInfo?: {
    readonly matricula: string;
    readonly nome: string;
  };
}

interface ReadonlyFinalizarSeparacaoResponse {
  readonly message: string;
  readonly data: {
    readonly codVenda: string;
    readonly operacao: string;
    readonly separador: {
      readonly matricula: string;
      readonly nome: string;
    };
    readonly finalizadoEm: string;
  };
}

interface ReadonlyErrorResponse {
  readonly error: string;
  readonly code?: string;
  readonly currentOperacao?: string;
  readonly currentStatus?: string;
  readonly statusDescricao?: string;
  readonly acao?: string;
  readonly separadorAtual?: string;
  readonly separadorSolicitante?: string;
}

// Database result interface
interface ReadonlyVendaSeparacao {
  readonly codvenda: string;
  readonly statuspedido: string;
  readonly separador: string | null;
  readonly func_nome: string | null;
  readonly func_matricula: string | null;
}

// Audit logging interface
interface ReadonlyAuditLog {
  readonly action: 'FINALIZAR_SEPARACAO' | 'ERRO_FINALIZAR_SEPARACAO';
  readonly usuario: string;
  readonly filial: string;
  readonly timestamp: string;
  readonly codVenda: string;
  readonly isOrpha?: boolean;
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
 * API para finalizar separação de um pedido
 *
 * Otimizada com padrões de nível sênior:
 * - Transação atômica com rollback automático
 * - Validação rigorosa de entrada
 * - Suporte multi-tenant
 * - Logging estruturado para auditoria
 * - Interfaces readonly para imutabilidade
 * - Tratamento especial de separações órfãs
 * - Optimistic locking para concorrência
 * - Tratamento robusto de erros
 *
 * @param req - Request com código da venda e dados do separador
 * @param res - Response com confirmação ou erro
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    ReadonlyFinalizarSeparacaoResponse | ReadonlyErrorResponse
  >,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({
      error: 'Método não permitido. Use PUT.',
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
      'API finalizar usando filial padrão (MANAUS) - cookie filial_melo não encontrado',
    );
  }

  // Type-safe request body extraction
  const requestBody = req.body as ReadonlyFinalizarSeparacaoRequest;
  const { codVenda, separadorInfo } = requestBody;

  // Validação rigorosa de entrada
  if (!codVenda || typeof codVenda !== 'string') {
    return res.status(400).json({
      error: 'Código da venda é obrigatório e deve ser uma string válida',
      code: 'INVALID_COD_VENDA',
    });
  }

  if (codVenda.trim().length === 0) {
    return res.status(400).json({
      error: 'Código da venda não pode estar vazio',
      code: 'EMPTY_COD_VENDA',
    });
  }

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // Iniciar transação para operação atômica
    await client.query('BEGIN');

    // Verificar se a venda existe e obter dados atuais (sem FOR UPDATE no LEFT JOIN)
    const checkQuery = `
      SELECT 
        v.codvenda,
        v.statuspedido,
        v.separador,
        v.inicioseparacao,
        v.fimseparacao,
        f.nome as func_nome,
        f.matricula as func_matricula
      FROM dbvenda v
      LEFT JOIN dbfunc_estoque f ON v.separador = f.matricula
      WHERE v.codvenda = $1
    `;

    const checkResult = await client.query(checkQuery, [codVenda]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Venda não encontrada',
        code: 'VENDA_NOT_FOUND',
      });
    }

    const venda = checkResult.rows[0] as ReadonlyVendaSeparacao;

    // Aplicar lock específico na linha da venda para evitar concorrência
    await client.query('SELECT 1 FROM dbvenda WHERE codvenda = $1 FOR UPDATE', [
      codVenda,
    ]);

    // Verificar se a venda está em separação (statuspedido = '2')
    if (venda.statuspedido !== '2') {
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

    // Determinar se é separação órfã e preparar dados do separador
    const isOrphanSeparation =
      !venda.separador || venda.separador.trim() === '';
    let separadorNome = venda.func_nome;
    let separadorMatricula = venda.func_matricula;

    if (isOrphanSeparation) {
      // Para separações órfãs, usar dados fornecidos
      if (!separadorInfo?.nome || !separadorInfo?.matricula) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'Separação órfã detectada. Informações do separador são necessárias para finalização.',
          code: 'ORPHAN_SEPARATION_MISSING_INFO',
        });
      }

      separadorNome = separadorInfo.nome;
      separadorMatricula = separadorInfo.matricula;

      // Validar dados do separador órfão
      if (
        separadorNome.trim().length === 0 ||
        separadorMatricula.trim().length === 0
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: 'Dados do separador não podem estar vazios',
          code: 'EMPTY_SEPARADOR_INFO',
        });
      }

      // Atualizar o campo separador na separação órfã
      const updateSeparadorQuery = `
        UPDATE dbvenda 
        SET separador = $1,
            dtupdate = NOW()
        WHERE codvenda = $2
      `;

      await client.query(updateSeparadorQuery, [separadorMatricula, codVenda]);
    } else {
      // Verificar se o separador que está finalizando é o mesmo que iniciou
      if (
        separadorInfo?.matricula &&
        venda.separador !== separadorInfo.matricula
      ) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          error: 'Apenas o separador que iniciou a separação pode finalizá-la',
          code: 'UNAUTHORIZED_SEPARADOR',
          separadorAtual: venda.separador,
          separadorSolicitante: separadorInfo.matricula,
        });
      }
    }

    // Verificar se temos dados válidos do separador
    if (!separadorNome || !separadorMatricula) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Dados do separador não encontrados ou incompletos',
        code: 'INCOMPLETE_SEPARADOR_DATA',
      });
    }

    // Atualizar a venda para statuspedido '3' (Separado) - lógica diferente para órfãs
    const updateQuery = isOrphanSeparation
      ? `
      UPDATE dbvenda 
      SET statuspedido = '3',
          separador = $2,
          fimseparacao = NOW(),
          dtupdate = NOW()
      WHERE codvenda = $1 AND statuspedido = '2' 
        AND (separador IS NULL OR separador = '')
      RETURNING codvenda, statuspedido, fimseparacao
    `
      : `
      UPDATE dbvenda 
      SET statuspedido = '3',
          fimseparacao = NOW(),
          dtupdate = NOW()
      WHERE codvenda = $1 AND statuspedido = '2' AND separador = $2
      RETURNING codvenda, statuspedido, fimseparacao
    `;

    const updateResult = await client.query(updateQuery, [
      codVenda,
      separadorMatricula,
    ]);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error:
          'Não foi possível finalizar a separação. Venda pode ter sido alterada por outro usuário.',
        code: 'CONCURRENT_MODIFICATION',
      });
    }

    // Commit da transação
    await client.query('COMMIT');

    const finalizadoEm = updateResult.rows[0].fimseparacao;

    // Structured logging para auditoria
    const auditLog: ReadonlyAuditLog = {
      action: 'FINALIZAR_SEPARACAO',
      usuario: `${separadorNome} (${separadorMatricula})`,
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      isOrpha: isOrphanSeparation,
      resultado: {
        success: true,
        performance_ms: Date.now() - startTime,
      },
    };

    console.log('[AUDIT] Separação finalizada:', JSON.stringify(auditLog));

    return res.status(200).json({
      message: 'Separação finalizada com sucesso',
      data: {
        codVenda,
        operacao: '3',
        separador: {
          matricula: separadorMatricula,
          nome: separadorNome,
        },
        finalizadoEm: finalizadoEm || new Date().toISOString(),
      },
    });
  } catch (error) {
    // Rollback em caso de erro
    await client.query('ROLLBACK');

    const errorLog: ReadonlyAuditLog = {
      action: 'ERRO_FINALIZAR_SEPARACAO',
      usuario: separadorInfo
        ? `${separadorInfo.nome} (${separadorInfo.matricula})`
        : 'Desconhecido',
      filial,
      timestamp: new Date().toISOString(),
      codVenda,
      error: {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        code: 'INTERNAL_SERVER_ERROR',
      },
    };

    console.error(
      '[ERROR] Erro ao finalizar separação:',
      JSON.stringify(errorLog),
    );

    return res.status(500).json({
      error: 'Erro interno do servidor ao finalizar separação',
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
        acao: 'Inicie a separação primeiro',
      };
    case '3':
      return {
        statusDescricao: 'Já Separado',
        acao: 'Esta venda já foi separada',
      };
    case '4':
      return {
        statusDescricao: 'Em Conferência',
        acao: 'Esta venda está sendo conferida',
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
        acao: 'Não é possível finalizar a separação',
      };
  }
}
