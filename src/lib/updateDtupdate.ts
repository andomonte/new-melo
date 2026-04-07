import { getPgPool } from './pg';

/**
 * Atualiza o campo dtupdate para um registro específico na tabela dbvenda
 * @param codvenda - Código da venda a ser atualizada
 * @returns Promise<void>
 */
export async function updateDtUpdate(codvenda: string | number): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const query = `
      UPDATE dbvenda 
      SET dtupdate = NOW() 
      WHERE codvenda = $1
    `;

    await client.query(query, [codvenda]);
  } catch (error) {
    console.error('Erro ao atualizar dtupdate:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atualiza o campo dtupdate para múltiplos registros na tabela dbvenda
 * @param codvendas - Array de códigos de venda a serem atualizados
 * @returns Promise<void>
 */
export async function updateMultipleDtUpdate(
  codvendas: (string | number)[],
): Promise<void> {
  if (!codvendas.length) return;

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const placeholders = codvendas.map((_, index) => `$${index + 1}`).join(',');
    const query = `
      UPDATE dbvenda 
      SET dtupdate = NOW() 
      WHERE codvenda IN (${placeholders})
    `;

    await client.query(query, codvendas);
  } catch (error) {
    console.error('Erro ao atualizar dtupdate em lote:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Middleware para incluir dtupdate em queries de UPDATE
 * @param originalQuery - Query SQL original
 * @returns Query modificada com dtupdate
 */
export function addDtUpdateToQuery(originalQuery: string): string {
  // Verifica se a query já tem dtupdate
  if (originalQuery.toLowerCase().includes('dtupdate')) {
    return originalQuery;
  }

  // Encontra a posição do SET na query
  const setMatch = originalQuery.match(/SET\s+/i);
  if (!setMatch) {
    return originalQuery;
  }

  const setIndex = setMatch.index! + setMatch[0].length;

  // Insere dtupdate = NOW() após o SET
  const beforeSet = originalQuery.substring(0, setIndex);
  const afterSet = originalQuery.substring(setIndex);

  return `${beforeSet}dtupdate = NOW(), ${afterSet}`;
}

/**
 * Executa um UPDATE com dtupdate automático
 * @param query - Query de UPDATE
 * @param params - Parâmetros da query
 * @param client - Cliente PostgreSQL (opcional, será criado se não fornecido)
 * @returns Resultado da query
 */
export async function executeUpdateWithDtUpdate(
  query: string,
  params: any[] = [],
  client?: any,
): Promise<any> {
  const shouldReleaseClient = !client;
  const pool = getPgPool();

  if (!client) {
    client = await pool.connect();
  }

  try {
    const updatedQuery = addDtUpdateToQuery(query);
    const result = await client.query(updatedQuery, params);
    return result;
  } catch (error) {
    console.error('Erro ao executar UPDATE com dtupdate:', error);
    throw error;
  } finally {
    if (shouldReleaseClient) {
      client.release();
    }
  }
}
