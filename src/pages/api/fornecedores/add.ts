import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { Fornecedor } from '@/data/fornecedores/fornecedores';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const fornecedorData: Fornecedor = req.body;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // ✅ PASSO 1: Buscar o próximo código disponível (ignora 99999 se já existir)
    const nextCodeQuery = await client.query(`
      SELECT COALESCE(MIN(num), 1) as next_code
      FROM (
        SELECT generate_series(1, 99998) AS num
      ) nums
      WHERE num NOT IN (
        SELECT CAST(cod_credor AS INTEGER) 
        FROM db_manaus.dbcredor 
        WHERE cod_credor ~ '^[0-9]+$'
      )
    `);

    const nextCodCredor = nextCodeQuery.rows[0].next_code;
    const newCodCredor = nextCodCredor.toString().padStart(5, '0');

    console.log(`✅ Novo cod_credor: ${newCodCredor}`);

    // ✅ PASSO 2: Adicionar o novo código aos dados que serão salvos.
    fornecedorData.cod_credor = newCodCredor;

    // ✅ VALIDAÇÃO: Truncar campos VARCHAR(5) para evitar erro 22001
    if (fornecedorData.codcf && fornecedorData.codcf.length > 5) {
      console.warn(
        `⚠️ Campo codcf truncado de ${fornecedorData.codcf.length} para 5 caracteres:`,
        fornecedorData.codcf,
      );
      fornecedorData.codcf = fornecedorData.codcf.substring(0, 5);
    }
    if (fornecedorData.cod_ident && fornecedorData.cod_ident.length > 5) {
      console.warn(
        `⚠️ Campo cod_ident truncado de ${fornecedorData.cod_ident.length} para 5 caracteres:`,
        fornecedorData.cod_ident,
      );
      fornecedorData.cod_ident = fornecedorData.cod_ident.substring(0, 5);
    }
    if (fornecedorData.codbairro && fornecedorData.codbairro.length > 5) {
      console.warn(
        `⚠️ Campo codbairro truncado de ${fornecedorData.codbairro.length} para 5 caracteres:`,
        fornecedorData.codbairro,
      );
      fornecedorData.codbairro = fornecedorData.codbairro.substring(0, 5);
    }

    // Constrói a query de inserção de forma segura
    const columns = Object.keys(fornecedorData)
      .map((col) => `"${col}"`)
      .join(', ');
    const placeholders = Object.keys(fornecedorData)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(fornecedorData);

    const insertQuery = `
      INSERT INTO db_manaus.dbcredor (${columns}) 
      VALUES (${placeholders}) 
      RETURNING *;
    `;

    const result = await client.query(insertQuery, values);

    res.status(201).json(serializeBigInt(result.rows[0]));
  } catch (error: any) {
    console.error('Erro ao cadastrar fornecedor:', error);

    // Verificar se é erro de string muito longa (22001)
    if (error.code === '22001') {
      console.error('🚨 Erro 22001 - Campo muito longo detectado!');
      console.error('Dados enviados:', JSON.stringify(fornecedorData, null, 2));
      return res.status(400).json({
        error: 'Um ou mais campos excedem o tamanho máximo permitido.',
        detail:
          'Verifique se os campos Código Identificação, Classe de Fornecedor e Código Bairro não excedem 5 caracteres.',
      });
    }

    // Verificar se é erro de duplicação de chave única (CNPJ já existe)
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'CNPJ/CPF já cadastrado no sistema.',
        detail: 'Este documento já está sendo utilizado por outro fornecedor.',
      });
    }

    // Verificar se é erro de violação de NOT NULL
    if (error.code === '23502') {
      return res.status(400).json({
        error: 'Campo obrigatório não preenchido.',
        detail: `O campo '${error.column}' é obrigatório.`,
      });
    }

    // Verificar se é erro de violação de chave estrangeira
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Dados relacionados inválidos.',
        detail:
          'Verifique se os dados de país, município ou outras referências estão corretos.',
      });
    }

    res.status(500).json({
      error: 'Erro interno do servidor ao cadastrar fornecedor.',
      detail: error.message || 'Erro desconhecido.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
