/**
 * Helper para geração de IDs de ordem de compra no padrão:
 * 1 dígito da filial + 4 dígitos do ano + 2 dígitos do mês + 4 dígitos sequenciais
 * Total: 11 dígitos numéricos
 *
 * Exemplo: Filial 1, Janeiro/2025, sequencial 1 = 12025010001
 */

import { PoolClient } from 'pg';

/**
 * Extrai o número da filial de um CNPJ (dígitos 8-11)
 * Exemplo: 04618302000189 → "0001" → 1
 */
export function extrairFilialDoCNPJ(cnpj: string): number {
  if (!cnpj || cnpj.length < 12) {
    throw new Error('CNPJ inválido para extração de filial');
  }

  // Remove caracteres não numéricos
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  // Extrai os 4 dígitos da filial (posições 8-11)
  const filialStr = cnpjLimpo.substring(8, 12);

  // Converte para número (remove zeros à esquerda)
  const filialNum = parseInt(filialStr, 10);

  return filialNum;
}

/**
 * Busca o CNPJ da filial/unidade atual
 */
export async function obterCNPJFilial(
  client: PoolClient,
  filialId?: number
): Promise<string> {
  let cnpj: string;

  if (filialId) {
    // Buscar CNPJ pela unidade/filial específica
    const result = await client.query(
      'SELECT unm_cnpj FROM db_manaus.cad_unidade_melo WHERE unm_id = $1',
      [filialId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Filial com ID ${filialId} não encontrada`);
    }

    cnpj = result.rows[0].unm_cnpj;
  } else {
    // Usar filial padrão (MELO MAO - id 1)
    const result = await client.query(
      'SELECT unm_cnpj FROM db_manaus.cad_unidade_melo WHERE unm_id = 1'
    );

    if (result.rows.length === 0) {
      throw new Error('Filial padrão (MELO MAO) não encontrada');
    }

    cnpj = result.rows[0].unm_cnpj;
  }

  return cnpj;
}

/**
 * Gera próximo sequencial para ordem de compra
 * Busca o maior sequencial do mesmo mês/ano/filial
 */
export async function obterProximoSequencial(
  client: PoolClient,
  filial: number,
  ano: number,
  mes: number
): Promise<number> {
  // Prefixo do ID: filial (1 dígito) + ano (4 dígitos) + mês (2 dígitos)
  const prefixo = `${filial}${ano}${mes.toString().padStart(2, '0')}`;

  // Buscar maior ID com esse prefixo
  const result = await client.query(
    `SELECT COALESCE(MAX(orc_id), 0) as max_id
     FROM db_manaus.cmp_ordem_compra
     WHERE orc_id::TEXT LIKE $1 || '%'`,
    [prefixo]
  );

  const maxId = result.rows[0]?.max_id || 0;

  if (maxId === 0) {
    // Primeira ordem deste mês
    return 1;
  }

  // Extrair últimos 4 dígitos (sequencial)
  const maxIdStr = maxId.toString();
  const sequencialAtual = parseInt(maxIdStr.slice(-4), 10);

  return sequencialAtual + 1;
}

/**
 * Gera ID completo para ordem de compra
 * Formato: [filial 1 dig][ano 4 dig][mês 2 dig][sequencial 4 dig]
 *
 * @param client - Cliente PostgreSQL para queries
 * @param filialId - ID da filial (opcional, padrão = 1 MELO MAO)
 * @returns ID numérico de 11 dígitos
 */
export async function gerarProximoIdOrdem(
  client: PoolClient,
  filialId?: number
): Promise<number> {
  // 1. Obter CNPJ da filial
  const cnpj = await obterCNPJFilial(client, filialId);

  // 2. Extrair número da filial do CNPJ
  const filial = extrairFilialDoCNPJ(cnpj);

  // Validar que filial é um único dígito (1-9)
  if (filial < 1 || filial > 9) {
    throw new Error(`Número de filial fora do range permitido (1-9): ${filial}`);
  }

  // 3. Obter ano e mês atuais
  const agora = new Date();
  const ano = agora.getFullYear(); // 2025
  const mes = agora.getMonth() + 1; // 1-12

  // 4. Obter próximo sequencial
  const sequencial = await obterProximoSequencial(client, filial, ano, mes);

  // Validar sequencial (máximo 9999)
  if (sequencial > 9999) {
    throw new Error(`Sequencial excedeu limite de 9999 para ${mes}/${ano} na filial ${filial}`);
  }

  // 5. Montar ID completo
  // Exemplo: filial=1, ano=2025, mes=01, seq=1 → "12025010001"
  const idStr =
    filial.toString() +
    ano.toString() +
    mes.toString().padStart(2, '0') +
    sequencial.toString().padStart(4, '0');

  const idNumerico = parseInt(idStr, 10);

  console.log('🔢 ID de Ordem Gerado:', {
    filial,
    ano,
    mes: mes.toString().padStart(2, '0'),
    sequencial: sequencial.toString().padStart(4, '0'),
    idCompleto: idStr,
    idNumerico
  });

  return idNumerico;
}

/**
 * Formata ID da ordem para exibição (com zeros à esquerda)
 */
export function formatarIdOrdem(id: number): string {
  return id.toString().padStart(11, '0');
}
