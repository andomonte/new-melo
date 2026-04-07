/**
 * Server Actions para Clientes
 * Verificação de existência e operações relacionadas
 */

import { getPgPool } from '@/lib/pg';

// ============================================================================
// TYPES
// ============================================================================

interface ClientExistsResult {
  exists: boolean;
  client?: {
    codigo: number;
    nome: string;
    nome_fantasia: string | null;
    cpf_cnpj: string;
    cidade: string | null;
    uf: string | null;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Limpa CPF/CNPJ removendo caracteres especiais
 */
function cleanCpfCnpj(value: string): string {
  return value.replace(/[.\-/\s]/g, '');
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Verifica se um cliente já existe no sistema pelo CPF/CNPJ
 *
 * @param cpfCnpj - CPF ou CNPJ (com ou sem máscara)
 * @returns Objeto com exists e dados do cliente se encontrado
 *
 * @example
 * const result = await verifyClientExistence('123.456.789-00');
 * if (result.exists) {
 *   console.log('Cliente encontrado:', result.client);
 * }
 */
export async function verifyClientExistence(
  cpfCnpj: string,
): Promise<ClientExistsResult> {
  try {
    // Validação básica
    if (!cpfCnpj || typeof cpfCnpj !== 'string') {
      return { exists: false };
    }

    // Limpa o CPF/CNPJ
    const cleanedCpfCnpj = cleanCpfCnpj(cpfCnpj.trim());

    // Validação: deve ter 11 (CPF) ou 14 (CNPJ) dígitos
    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
      return { exists: false };
    }

    // Validação: deve conter apenas números
    if (!/^\d+$/.test(cleanedCpfCnpj)) {
      return { exists: false };
    }

    // Obtém conexão do pool
    const pool = getPgPool();

    // Query SQL com parameterização para prevenir SQL Injection
    // Remove pontos, traços e barras do campo cpf_cnpj no banco
    const query = `
      SELECT 
        codigo,
        nome,
        nome_fantasia,
        cpf_cnpj,
        cidade,
        uf
      FROM dbclien
      WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [cleanedCpfCnpj]);

    // Se encontrou registro
    if (result.rows.length > 0) {
      const row = result.rows[0];

      return {
        exists: true,
        client: {
          codigo: row.codigo,
          nome: row.nome,
          nome_fantasia: row.nome_fantasia || null,
          cpf_cnpj: row.cpf_cnpj,
          cidade: row.cidade || null,
          uf: row.uf || null,
        },
      };
    }

    // Não encontrou
    return { exists: false };
  } catch (error) {
    console.error('Erro ao verificar existência de cliente:', error);

    // Em produção, não expor detalhes do erro
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `Erro ao verificar cliente: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
      );
    }

    throw new Error(
      'Erro ao verificar existência do cliente. Tente novamente.',
    );
  }
}

/**
 * Busca cliente por código (para edição/visualização)
 *
 * @param codigo - Código único do cliente
 * @returns Dados completos do cliente ou null se não encontrado
 */
export async function getClientByCode(codigo: number) {
  try {
    if (!codigo || codigo <= 0) {
      return null;
    }

    const pool = getPgPool();

    const query = `
      SELECT 
        codigo,
        nome,
        nome_fantasia,
        email,
        cpf_cnpj,
        tipo_pessoa,
        tipo_cliente,
        situacao_tributaria,
        habilita_suframa,
        inscricao_suframa,
        inscricao_estadual,
        inscricao_municipal,
        telefone,
        telefone_secundario,
        celular,
        observacoes,
        ativo,
        data_cadastro,
        created_at,
        updated_at
      FROM dbclien
      WHERE codigo = $1
    `;

    const result = await pool.query(query, [codigo]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao buscar cliente por código:', error);
    throw new Error('Erro ao buscar dados do cliente.');
  }
}

/**
 * Valida se CPF/CNPJ está disponível (não cadastrado)
 * Útil para validação de formulário
 *
 * @param cpfCnpj - CPF ou CNPJ a verificar
 * @param excludeCode - Código do cliente a excluir da busca (para edição)
 * @returns true se disponível, false se já cadastrado
 */
export async function isCpfCnpjAvailable(
  cpfCnpj: string,
  excludeCode?: number,
): Promise<boolean> {
  try {
    const cleanedCpfCnpj = cleanCpfCnpj(cpfCnpj.trim());

    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
      return false;
    }

    const pool = getPgPool();

    let query = `
      SELECT codigo
      FROM dbclien
      WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = $1
    `;

    const params: (string | number)[] = [cleanedCpfCnpj];

    // Se estiver editando, excluir o próprio registro
    if (excludeCode) {
      query += ' AND codigo != $2';
      params.push(excludeCode);
    }

    query += ' LIMIT 1';

    const result = await pool.query(query, params);

    // Se não encontrou nenhum registro, o CPF/CNPJ está disponível
    return result.rows.length === 0;
  } catch (error) {
    console.error('Erro ao validar CPF/CNPJ:', error);
    throw new Error('Erro ao validar CPF/CNPJ.');
  }
}
