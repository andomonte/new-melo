import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { PoolClient } from 'pg';
import { Fornecedor } from '@/data/fornecedores/fornecedores';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { syncPessoaIntegridade } from '@/lib/syncPessoaIntegridade';
import { separarDadosFornecedor, regraComPadrao } from '@/lib/fornecedores/colunasFornecedor';
import { municipioPorCidade } from '@/lib/fornecedores/municipio';

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
    const pool = await getPgPoolPorNomeFilial(filial);
    client = await pool.connect();
    // Fornecedor e regra de faturamento entram juntos ou nenhum dos dois.
    await client.query('BEGIN');

    // Município pela cidade + UF (o do bairro podia faltar ou ser de outra cidade)
    const mun = await municipioPorCidade(client, fornecedorData.cidade, fornecedorData.uf);
    if (mun) fornecedorData.codmunicipio = mun;

    // ✅ PASSO 1: Buscar o próximo código disponível (ignora 99999 se já existir)
    const nextCodeQuery = await client.query(`
      SELECT COALESCE(MIN(num), 1) as next_code
      FROM (
        SELECT generate_series(1, 99998) AS num
      ) nums
      WHERE num NOT IN (
        SELECT CAST(cod_credor AS INTEGER) 
        FROM dbcredor 
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

    // Separa o que é do fornecedor (dbcredor) do que é regra de faturamento
    // (cad_credor_regra_faturamento), como faz a edição. Antes ia tudo para dbcredor
    // e quem marcava algo na aba Regras Faturamento recebia "Erro interno" (42703).
    const { fornecedor: dadosCredor, regra: dadosRegra, ignorados } =
      separarDadosFornecedor(fornecedorData as any);
    if (ignorados.length) console.warn('Campos ignorados no cadastro de fornecedor:', ignorados);
    const linhaCredor: Record<string, any> = { cod_credor: newCodCredor, ...dadosCredor };

    const columns = Object.keys(linhaCredor)
      .map((col) => `"${col}"`)
      .join(', ');
    const placeholders = Object.keys(linhaCredor)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(linhaCredor);

    const insertQuery = `
      INSERT INTO dbcredor (${columns})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await client.query(insertQuery, values);

    // Regra de faturamento: só quando o usuário mexeu na aba (mesmo formato da edição).
    if (Object.keys(dadosRegra).length > 0) {
      const linhaRegra = regraComPadrao(newCodCredor, dadosRegra);
      const cols = Object.keys(linhaRegra);
      await client.query(
        `INSERT INTO cad_credor_regra_faturamento (${cols.map((c) => `"${c}"`).join(', ')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
         ON CONFLICT (crf_id) DO UPDATE SET ${cols
           .filter((c) => c !== 'crf_id')
           .map((c) => `"${c}" = EXCLUDED."${c}"`)
           .join(', ')}`,
        Object.values(linhaRegra),
      );
    }

    await client.query('COMMIT');

    // Integridade de pessoa: replica nome/inscrições/tipo em cliente/transportadora.
    // O fornecedor já está gravado: falha aqui não pode virar "erro ao cadastrar"
    // (o usuário tentaria de novo e daria "CNPJ já cadastrado").
    try {
      await syncPessoaIntegridade(filial, 'FORNECEDOR', {
        doc: (fornecedorData as any).cpf_cgc,
        nome: (fornecedorData as any).nome,
        iest: (fornecedorData as any).iest,
        isuframa: (fornecedorData as any).isuframa,
        imun: (fornecedorData as any).imun,
        tipo: (fornecedorData as any).tipo,
      });
    } catch (e) {
      console.error('Fornecedor gravado, mas falhou a sincronização com cliente/transportadora:', e);
    }

    res.status(201).json(serializeBigInt(result.rows[0]));
  } catch (error: any) {
    await client?.query('ROLLBACK').catch(() => {});
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
