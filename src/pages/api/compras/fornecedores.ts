import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

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
  const offset = (page - 1) * perPage;

  try {
    const client = await pool.connect();
    
    let whereSQL = '';
    const params: Array<string | number> = [];

    if (search) {
      whereSQL = `
        WHERE cod_credor ILIKE $1 
           OR nome ILIKE $1 
           OR nome_fant ILIKE $1 
           OR cpf_cgc ILIKE $1
      `;
      params.push(`%${search}%`);
    }

    // Query principal
    const fornecedoresQuery = `
      SELECT 
        cod_credor,
        nome,
        nome_fant,
        cpf_cgc,
        endereco,
        cidade,
        uf
      FROM db_manaus.dbcredor 
      ${whereSQL}
      ORDER BY nome
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM db_manaus.dbcredor 
      ${whereSQL}
    `;

    // Adicionar limit e offset aos parâmetros
    params.push(perPage, offset);

    // Executar queries
    const [fornecedoresResult, countResult] = await Promise.all([
      client.query<Fornecedor>(fornecedoresQuery, params),
      client.query<{ total: string }>(countQuery, search ? [params[0]] : [])
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