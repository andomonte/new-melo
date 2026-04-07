/**
 * EXEMPLO DE INTEGRAÇÃO - TABELAS DE IMPOSTOS
 *
 * Este arquivo mostra como integrar as tabelas de impostos migradas
 * no código da aplicação Next.js/TypeScript.
 */

import { Client } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

interface Legislacao {
  LEI_ID: string;
  LEI_PROTOCOLO: string;
  LEI_DATA_CADASTRO: Date;
  LEI_STATUS: 'EM VIGOR' | 'REVOGADO';
  LEI_DATA_VIGENCIA: Date;
  LEI_DATA_PUBLICACAO: Date;
  LEI_MVA_AJUSTADA: string;
  LEI_TIPO: 'PROTOCOLO' | 'RESOLUCAO' | 'DECRETO';
}

interface LegislacaoNCM {
  LIN_ID: string;
  LIN_LEI_ID: string;
  LIN_NCM: string;
  LIN_STATUS: string;
  LIN_MVA_ST_ORIGINAL: string;
  LIN_CEST: string | null;
}

interface TributoAliquota {
  codigo: string;
  n_ne_co: string;
  s_se: string;
  importado: string;
}

interface CEST {
  id: number;
  cest: string;
  ncm: string;
  segmento: string;
  descricao: string;
}

interface CalculoST {
  ncm: string;
  protocolo: string;
  mvaOriginal: number;
  formulaMVA: string;
  cest: string | null;
  descricaoProduto: string | null;
}

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const PG_CONFIG = {
  host: process.env.PG_HOST || 'servicos.melopecas.com.br',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'postgres',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'Melodb@2025',
};

async function getPostgresClient(): Promise<Client> {
  const client = new Client(PG_CONFIG);
  await client.connect();
  return client;
}

// ============================================================================
// FUNÇÃO 1: BUSCAR MVA POR NCM
// ============================================================================

/**
 * Busca a MVA (Margem de Valor Agregado) para um NCM específico
 *
 * @param ncm - Código NCM (8 dígitos)
 * @returns Dados de cálculo de ST ou null se não encontrado
 *
 * @example
 * const resultado = await buscarMVAPorNCM('84213920');
 * console.log(`MVA: ${resultado.mvaOriginal}%`);
 */
export async function buscarMVAPorNCM(ncm: string): Promise<CalculoST | null> {
  const client = await getPostgresClient();

  try {
    const query = `
      SELECT
        ln."LIN_NCM" as ncm,
        l."LEI_PROTOCOLO" as protocolo,
        ln."LIN_MVA_ST_ORIGINAL" as mva_original,
        l."LEI_MVA_AJUSTADA" as formula_mva,
        ln."LIN_CEST" as cest,
        c.descricao as descricao_produto
      FROM cad_legislacao_icmsst_ncm ln
      INNER JOIN cad_legislacao_icmsst l
        ON l."LEI_ID" = ln."LIN_LEI_ID"
      LEFT JOIN dbcest c
        ON c.cest = ln."LIN_CEST"
      WHERE ln."LIN_NCM" = $1
        AND ln."LIN_STATUS" = 'REGRA'
        AND l."LEI_STATUS" = 'EM VIGOR'
      LIMIT 1;
    `;

    const result = await client.query(query, [ncm]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      ncm: row.ncm,
      protocolo: row.protocolo,
      mvaOriginal: parseFloat(row.mva_original),
      formulaMVA: row.formula_mva,
      cest: row.cest,
      descricaoProduto: row.descricao_produto,
    };
  } finally {
    await client.end();
  }
}

// ============================================================================
// FUNÇÃO 2: CALCULAR MVA AJUSTADA
// ============================================================================

/**
 * Calcula a MVA ajustada usando a fórmula do protocolo
 *
 * @param ncm - Código NCM
 * @param aliquotaInter - Alíquota interestadual (ex: 0.12 para 12%)
 * @param aliquotaIntra - Alíquota intraestadual (ex: 0.17 para 17%)
 * @returns MVA ajustada em percentual
 *
 * @example
 * const mvaAjustada = await calcularMVAAjustada('84213920', 0.12, 0.17);
 * console.log(`MVA Ajustada: ${mvaAjustada.toFixed(2)}%`);
 */
export async function calcularMVAAjustada(
  ncm: string,
  aliquotaInter: number,
  aliquotaIntra: number
): Promise<number> {
  const dados = await buscarMVAPorNCM(ncm);

  if (!dados) {
    throw new Error(`NCM ${ncm} não encontrado nas tabelas de ST`);
  }

  const mvaOriginal = dados.mvaOriginal / 100; // Converter para decimal

  // Fórmula padrão: ((1 + MVA_ST_ORIGINAL) * (1 - ALQ_INTER) / (1 - ALQ_INTRA)) - 1
  const mvaAjustada = ((1 + mvaOriginal) * (1 - aliquotaInter) / (1 - aliquotaIntra)) - 1;

  return mvaAjustada * 100; // Retornar em percentual
}

// ============================================================================
// FUNÇÃO 3: BUSCAR ALÍQUOTA POR CÓDIGO
// ============================================================================

/**
 * Busca alíquotas específicas por código de exceção
 *
 * @param codigo - Código da exceção (ex: 'A001')
 * @returns Alíquotas por região
 *
 * @example
 * const aliquotas = await buscarAliquotaPorCodigo('A001');
 * console.log(`Sul/Sudeste: ${aliquotas.s_se}%`);
 */
export async function buscarAliquotaPorCodigo(codigo: string): Promise<TributoAliquota | null> {
  const client = await getPostgresClient();

  try {
    const query = `
      SELECT codigo, n_ne_co, s_se, importado
      FROM fis_tributo_aliquota
      WHERE codigo = $1;
    `;

    const result = await client.query(query, [codigo]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    await client.end();
  }
}

// ============================================================================
// FUNÇÃO 4: BUSCAR CEST POR NCM
// ============================================================================

/**
 * Busca o código CEST para um NCM
 *
 * @param ncm - Código NCM
 * @returns Dados do CEST ou null
 *
 * @example
 * const cest = await buscarCESTPorNCM('9032899');
 * console.log(`CEST: ${cest.cest} - ${cest.descricao}`);
 */
export async function buscarCESTPorNCM(ncm: string): Promise<CEST | null> {
  const client = await getPostgresClient();

  try {
    const query = `
      SELECT id, cest, ncm, segmento, descricao
      FROM dbcest
      WHERE ncm = $1
      LIMIT 1;
    `;

    const result = await client.query(query, [ncm]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    await client.end();
  }
}

// ============================================================================
// FUNÇÃO 5: LISTAR PROTOCOLOS EM VIGOR
// ============================================================================

/**
 * Lista todos os protocolos ICMS-ST em vigor
 *
 * @returns Lista de legislações
 *
 * @example
 * const protocolos = await listarProtocolosEmVigor();
 * protocolos.forEach(p => console.log(`Protocolo ${p.LEI_PROTOCOLO}`));
 */
export async function listarProtocolosEmVigor(): Promise<Legislacao[]> {
  const client = await getPostgresClient();

  try {
    const query = `
      SELECT *
      FROM cad_legislacao_icmsst
      WHERE "LEI_STATUS" = 'EM VIGOR'
      ORDER BY "LEI_PROTOCOLO";
    `;

    const result = await client.query(query);
    return result.rows;
  } finally {
    await client.end();
  }
}

// ============================================================================
// FUNÇÃO 6: BUSCAR NCMs POR PROTOCOLO
// ============================================================================

/**
 * Lista todos os NCMs de um protocolo específico
 *
 * @param protocolo - Número do protocolo (ex: 41, 129)
 * @returns Lista de NCMs com MVAs
 *
 * @example
 * const ncms = await buscarNCMsPorProtocolo('41');
 * console.log(`Total de NCMs: ${ncms.length}`);
 */
export async function buscarNCMsPorProtocolo(protocolo: string): Promise<LegislacaoNCM[]> {
  const client = await getPostgresClient();

  try {
    const query = `
      SELECT ln.*
      FROM cad_legislacao_icmsst l
      INNER JOIN cad_legislacao_icmsst_ncm ln
        ON ln."LIN_LEI_ID" = l."LEI_ID"
      WHERE l."LEI_PROTOCOLO" = $1
        AND l."LEI_STATUS" = 'EM VIGOR'
        AND ln."LIN_STATUS" = 'REGRA'
      ORDER BY ln."LIN_NCM";
    `;

    const result = await client.query(query, [protocolo]);
    return result.rows;
  } finally {
    await client.end();
  }
}

// ============================================================================
// EXEMPLO DE USO EM API ROUTE (Next.js)
// ============================================================================

/**
 * Exemplo de uso em uma API Route do Next.js
 *
 * Arquivo: src/pages/api/impostos/calcular-st.ts
 */
export async function calcularImpostosHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ncm, valorProduto, aliquotaInter, aliquotaIntra } = req.body;

  try {
    // 1. Buscar dados do NCM
    const dadosST = await buscarMVAPorNCM(ncm);

    if (!dadosST) {
      return res.status(404).json({
        error: 'NCM não encontrado nas tabelas de ST',
        ncm,
      });
    }

    // 2. Calcular MVA ajustada
    const mvaAjustada = await calcularMVAAjustada(ncm, aliquotaInter, aliquotaIntra);

    // 3. Calcular base de cálculo ST
    const baseCalculoST = valorProduto * (1 + mvaAjustada / 100);

    // 4. Calcular ICMS ST
    const icmsST = baseCalculoST * aliquotaIntra - valorProduto * aliquotaInter;

    // 5. Buscar CEST
    const cest = await buscarCESTPorNCM(ncm);

    return res.status(200).json({
      ncm,
      protocolo: dadosST.protocolo,
      mvaOriginal: dadosST.mvaOriginal,
      mvaAjustada: parseFloat(mvaAjustada.toFixed(2)),
      valorProduto,
      baseCalculoST: parseFloat(baseCalculoST.toFixed(2)),
      icmsST: parseFloat(icmsST.toFixed(2)),
      cest: cest?.cest || null,
      descricao: dadosST.descricaoProduto,
    });
  } catch (error: any) {
    console.error('Erro ao calcular ST:', error);
    return res.status(500).json({
      error: 'Erro ao calcular impostos',
      message: error.message,
    });
  }
}

// ============================================================================
// EXEMPLO DE TESTE
// ============================================================================

async function testeCompleto() {
  console.log('='.repeat(80));
  console.log('TESTE DE INTEGRAÇÃO - FUNÇÕES DE IMPOSTOS');
  console.log('='.repeat(80));

  const ncm = '84213920';

  // Teste 1: Buscar MVA
  console.log('\n1. Buscando MVA para NCM', ncm);
  const dadosST = await buscarMVAPorNCM(ncm);
  console.log('Resultado:', JSON.stringify(dadosST, null, 2));

  // Teste 2: Calcular MVA ajustada
  console.log('\n2. Calculando MVA ajustada');
  const mvaAjustada = await calcularMVAAjustada(ncm, 0.12, 0.17);
  console.log(`MVA Ajustada: ${mvaAjustada.toFixed(2)}%`);

  // Teste 3: Buscar alíquota
  console.log('\n3. Buscando alíquota código A001');
  const aliquota = await buscarAliquotaPorCodigo('A001');
  console.log('Resultado:', aliquota);

  // Teste 4: Listar protocolos
  console.log('\n4. Listando protocolos em vigor');
  const protocolos = await listarProtocolosEmVigor();
  console.log(`Total: ${protocolos.length} protocolos`);

  console.log('\n' + '='.repeat(80));
  console.log('TESTE CONCLUÍDO');
  console.log('='.repeat(80));
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testeCompleto().catch(console.error);
}
