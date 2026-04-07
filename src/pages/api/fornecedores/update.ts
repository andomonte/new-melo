import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { Fornecedor } from '@/data/fornecedores/fornecedores';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const allData: Fornecedor = req.body;
  const fornecedorId = allData.cod_credor;

  if (!fornecedorId) {
    return res
      .status(400)
      .json({ error: 'O cod_credor é obrigatório para atualização.' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    const colunasDbCredor = [
      'nome',
      'nome_fant',
      'cpf_cgc',
      'tipo',
      'data_cad',
      'endereco',
      'bairro',
      'cidade',
      'uf',
      'isuframa',
      'iest',
      'imun',
      'cc',
      'n_agencia',
      'banco',
      'cod_ident',
      'contatos',
      'tipoemp',
      'cep',
      'codcf',
      'fabricante',
      'regime_tributacao',
      'codbairro',
      'codmunicipio',
      'numero',
      'referencia',
      'codpais',
      'complemento',
      'tipofornecedor',
      'codunico',
      'codccontabil',
    ];

    const colunasRegraFaturamento = [
      'desc_icms_sufra',
      'desc_icms_sufra_piscofins',
      'piscofins_365',
      'piscofins_925',
      'piscofins_1150',
      'piscofins_1310',
      'desc_icms_sufra_st',
      'desc_piscofins_st',
      'acres_piscofins_st',
      'desc_icms_sufra_importado',
      'cobrar_ipi_importado',
      'frete',
      'basereduzida_st',
      'basereduzida_icms',
      'desc_icms_sufra_base',
      'desc_icms_sufra_importado_base',
    ];

    const dadosFornecedor: { [key: string]: any } = {};
    const dadosRegra: { [key: string]: any } = {};

    for (const key in allData) {
      if (colunasDbCredor.includes(key)) {
        dadosFornecedor[key] = allData[key as keyof Fornecedor];
      } else if (colunasRegraFaturamento.includes(key)) {
        dadosRegra[key] = allData[key as keyof Fornecedor];
      }
    }

    if (Object.keys(dadosFornecedor).length > 0) {
      // ✅ VALIDAÇÃO: Truncar campos VARCHAR(5) para evitar erro 22001
      if (dadosFornecedor.codcf && dadosFornecedor.codcf.length > 5) {
        console.warn(
          `⚠️ Campo codcf truncado de ${dadosFornecedor.codcf.length} para 5 caracteres:`,
          dadosFornecedor.codcf,
        );
        dadosFornecedor.codcf = dadosFornecedor.codcf.substring(0, 5);
      }
      if (dadosFornecedor.cod_ident && dadosFornecedor.cod_ident.length > 5) {
        console.warn(
          `⚠️ Campo cod_ident truncado de ${dadosFornecedor.cod_ident.length} para 5 caracteres:`,
          dadosFornecedor.cod_ident,
        );
        dadosFornecedor.cod_ident = dadosFornecedor.cod_ident.substring(0, 5);
      }
      if (dadosFornecedor.codbairro && dadosFornecedor.codbairro.length > 5) {
        console.warn(
          `⚠️ Campo codbairro truncado de ${dadosFornecedor.codbairro.length} para 5 caracteres:`,
          dadosFornecedor.codbairro,
        );
        dadosFornecedor.codbairro = dadosFornecedor.codbairro.substring(0, 5);
      }

      const setClause = Object.keys(dadosFornecedor)
        .map((key, index) => `"${key}" = $${index + 1}`)
        .join(', ');
      const values = Object.values(dadosFornecedor);

      const updateQuery = `
        UPDATE db_manaus.dbcredor 
        SET ${setClause}
        WHERE cod_credor = $${Object.keys(dadosFornecedor).length + 1}
      `;
      await client.query(updateQuery, [...values, fornecedorId]);
    }

    // ✅ CORREÇÃO: Garantir que todos os campos de regra tenham um valor padrão de 0 se forem nulos.
    // Isso satisfaz a restrição "NOT NULL" do banco de dados.
    const dadosRegraComDefault: { [key: string]: any } = {
      crf_id: fornecedorId,
    };
    colunasRegraFaturamento.forEach((col) => {
      dadosRegraComDefault[col] = dadosRegra[col] ?? 0; // Se o valor for null ou undefined, usa 0
    });

    const columns = Object.keys(dadosRegraComDefault)
      .map((c) => `"${c}"`)
      .join(', ');
    const placeholders = Object.keys(dadosRegraComDefault)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(dadosRegraComDefault);
    const updateSet = Object.keys(dadosRegraComDefault)
      .filter((c) => c !== 'crf_id')
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    const upsertQuery = `
      INSERT INTO db_manaus.cad_credor_regra_faturamento (${columns})
      VALUES (${placeholders})
      ON CONFLICT (crf_id) 
      DO UPDATE SET ${updateSet};
    `;
    await client.query(upsertQuery, values);

    await client.query('COMMIT');

    res.status(200).json({ message: 'Fornecedor atualizado com sucesso!' });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Erro ao atualizar fornecedor:', error);

    // Verificar se é erro de string muito longa (22001)
    if (error.code === '22001') {
      console.error('🚨 Erro 22001 - Campo muito longo detectado!');
      console.error('Dados enviados:', JSON.stringify(allData, null, 2));
      return res.status(400).json({
        error: 'Um ou mais campos excedem o tamanho máximo permitido.',
        detail:
          'Verifique se os campos Código Identificação, Classe de Fornecedor e Código Bairro não excedem 5 caracteres.',
      });
    }

    res.status(500).json({
      error: 'Erro ao atualizar fornecedor.',
      detail: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
