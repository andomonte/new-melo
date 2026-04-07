// src/lib/databaseHelpers.ts

import { PoolClient } from 'pg';

/**
 * Helpers para operações de banco com tratamento de erros padronizado
 */

export interface QueryResult<T = any> {
  success: boolean;
  data?: T[];
  rowCount?: number;
  error?: string;
  code?: string;
}

/**
 * Executa uma query com tratamento de erro padronizado
 */
export async function executeQuery<T = any>(
  client: PoolClient,
  query: string,
  params: any[] = [],
  operacao: string = 'consulta',
): Promise<QueryResult<T>> {
  try {
    console.log(`Executando ${operacao}:`, { query, params });

    const result = await client.query(query, params);

    console.log(
      `${operacao} executada com sucesso. Linhas afetadas: ${result.rowCount}`,
    );

    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error(`Erro ao executar ${operacao}:`, {
      query,
      params,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    let errorMessage = `Erro interno do servidor ao executar ${operacao}`;
    let errorCode = 'DATABASE_ERROR';

    if (error instanceof Error) {
      // Tratar erros específicos do PostgreSQL
      if (error.message.includes('duplicate key')) {
        errorMessage = 'Registro duplicado detectado';
        errorCode = 'DUPLICATE_KEY';
      } else if (error.message.includes('foreign key')) {
        errorMessage = 'Violação de chave estrangeira';
        errorCode = 'FOREIGN_KEY_VIOLATION';
      } else if (error.message.includes('not-null')) {
        errorMessage = 'Campo obrigatório não informado';
        errorCode = 'NOT_NULL_VIOLATION';
      } else if (error.message.includes('connection')) {
        errorMessage = 'Erro de conexão com o banco de dados';
        errorCode = 'CONNECTION_ERROR';
      }
    }

    return {
      success: false,
      error: errorMessage,
      code: errorCode,
    };
  }
}

/**
 * Executa múltiplas queries em uma transação
 */
export async function executeTransaction(
  client: PoolClient,
  queries: Array<{ query: string; params: any[]; operacao?: string }>,
): Promise<QueryResult> {
  try {
    await client.query('BEGIN');

    const results = [];
    for (const { query, params, operacao = 'operação' } of queries) {
      const result = await executeQuery(client, query, params, operacao);

      if (!result.success) {
        await client.query('ROLLBACK');
        return result;
      }

      results.push(result);
    }

    await client.query('COMMIT');

    return {
      success: true,
      data: results,
      rowCount: results.reduce(
        (total, result) => total + (result.rowCount || 0),
        0,
      ),
    };
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Erro na transação:', error);

    return {
      success: false,
      error: 'Erro interno do servidor durante transação',
      code: 'TRANSACTION_ERROR',
    };
  }
}

/**
 * Valida se um registro existe no banco
 */
export async function validarExistencia(
  client: PoolClient,
  tabela: string,
  campo: string,
  valor: string,
  nomeEntidade: string = 'registro',
): Promise<QueryResult> {
  const query = `SELECT ${campo} FROM ${tabela} WHERE ${campo} = $1 LIMIT 1`;

  const result = await executeQuery(
    client,
    query,
    [valor],
    `verificar existência de ${nomeEntidade}`,
  );

  if (result.success && result.data && result.data.length === 0) {
    return {
      success: false,
      error: `${nomeEntidade} não encontrado`,
      code: 'NOT_FOUND',
    };
  }

  return result;
}

/**
 * Busca informações completas de uma venda
 */
export async function buscarVendaCompleta(
  client: PoolClient,
  codVenda: string,
): Promise<QueryResult> {
  const query = `
    SELECT 
      v.codvenda, 
      v.statuspedido,
      v.separador,
      v.conferente,
      v.inicioseparacao,
      v.inicioconferencia,
      v.fimseparacao,
      v.finalizadopedido,
      sep.nome as separador_nome,
      sep.matricula as separador_matricula,
      conf.nome as conferente_nome,
      conf.matricula as conferente_matricula
    FROM dbvenda v
    LEFT JOIN dbfunc_estoque sep ON v.separador = sep.matricula
    LEFT JOIN dbfunc_estoque conf ON v.conferente = conf.matricula
    WHERE v.codvenda = $1
  `;

  return executeQuery(
    client,
    query,
    [codVenda],
    'buscar dados completos da venda',
  );
}

/**
 * Atualiza status de venda com validações
 */
export async function atualizarStatusVenda(
  client: PoolClient,
  codVenda: string,
  novoStatus: string,
  camposExtras: Record<string, any> = {},
  condicoes: Record<string, any> = {},
): Promise<QueryResult> {
  // Construir campos para atualização
  const campos = ['statuspedido = $2'];
  const valores = [codVenda, novoStatus];
  let paramIndex = 3;

  for (const [campo, valor] of Object.entries(camposExtras)) {
    if (valor === 'NOW()') {
      campos.push(`${campo} = NOW()`);
    } else if (valor === null) {
      campos.push(`${campo} = NULL`);
    } else {
      campos.push(`${campo} = $${paramIndex}`);
      valores.push(valor);
      paramIndex++;
    }
  }

  // Construir condições WHERE
  const condicoesWhere = ['codvenda = $1'];
  for (const [campo, valor] of Object.entries(condicoes)) {
    condicoesWhere.push(`${campo} = $${paramIndex}`);
    valores.push(valor);
    paramIndex++;
  }

  const query = `
    UPDATE dbvenda 
    SET ${campos.join(', ')}, dtupdate = NOW()
    WHERE ${condicoesWhere.join(' AND ')}
  `;

  return executeQuery(
    client,
    query,
    valores,
    `atualizar status da venda para ${novoStatus}`,
  );
}
