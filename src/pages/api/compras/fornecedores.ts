import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

interface Fornecedor {
  cod_credor: string;
  nome: string;
  nome_fant?: string;
  cpf_cgc?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

interface FornecedorResponse {
  fornecedores: Fornecedor[];
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FornecedorResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const page = parseInt((req.query.page as string) ?? '1', 10);
  const perPage = parseInt((req.query.perPage as string) ?? '50', 10);
  const search = (req.query.search as string) ?? '';
  const tipo = (req.query.tipo as string) ?? '';
  const offset = (page - 1) * perPage;

  // Transportadoras ficam em dbtransp (colunas codtransp/cpfcgc/ender), fornecedores
  // em dbcredor. Antes o endpoint ignorava o "tipo" e sempre buscava dbcredor — por
  // isso a busca de transportadora não encontrava nada.
  const isTransp = tipo === 'transportadora';
  const tabela = isTransp ? 'db_manaus.dbtransp' : 'db_manaus.dbcredor';
  const colCod = isTransp ? 'codtransp' : 'cod_credor';
  const colFant = isTransp ? 'nomefant' : 'nome_fant';
  const colDoc = isTransp ? 'cpfcgc' : 'cpf_cgc';
  const colEnder = isTransp ? 'ender' : 'endereco';

  try {
    const client = await pool.connect();

    let whereSQL = '';
    const params: Array<string | number> = [];

    if (search) {
      // O CNPJ está gravado em formatos diferentes ('45.990.181/0001-89' e
      // '45990181000189'). Comparar só com ILIKE encontrava apenas os sem
      // pontuação. Aqui comparamos também os dígitos normalizados.
      whereSQL = `
        WHERE ${colCod} ILIKE $1
           OR nome ILIKE $1
           OR ${colFant} ILIKE $1
           OR ${colDoc} ILIKE $1
           OR ($2 <> '' AND regexp_replace(upper(COALESCE(${colDoc}, '')), '[^0-9A-Z]', '', 'g') LIKE '%' || $2 || '%')
      `;
      params.push(`%${search}%`, limparDocumentoAlfa(search));
    }

    // Query principal (aliases normalizam a saída para o mesmo formato)
    const fornecedoresQuery = `
      SELECT
        ${colCod} AS cod_credor,
        nome,
        ${colFant} AS nome_fant,
        ${colDoc} AS cpf_cgc,
        ${colEnder} AS endereco,
        cidade,
        uf
      FROM ${tabela}
      ${whereSQL}
      ORDER BY nome
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${tabela}
      ${whereSQL}
    `;

    // Adicionar limit e offset aos parâmetros
    params.push(perPage, offset);

    // Executar queries
    const [fornecedoresResult, countResult] = await Promise.all([
      client.query<Fornecedor>(fornecedoresQuery, params),
      client.query<{ total: string }>(countQuery, search ? [params[0], params[1]] : [])
    ]);
    
    client.release();
    
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      fornecedores: fornecedoresResult.rows,
      meta: {
        total,
        page,
        perPage
      }
    });
  } catch (err) {
    console.error('Erro ao buscar fornecedores:', err);
    res.status(500).json({ error: 'Falha ao buscar fornecedores.' });
  }
}