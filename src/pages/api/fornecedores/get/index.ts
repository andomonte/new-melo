// pages/api/fornecedores/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
    const offset = (pageNumber - 1) * perPageNumber;

    // Construir a cláusula WHERE — busca por código, nome, fantasia e CPF/CNPJ (com e sem formatação)
    const searchDigits = String(search).replace(/\D/g, '');
    const hasDigitSearch = searchDigits.length >= 3;

    let whereClause = '';
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (search) {
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm);
      whereClause = `WHERE (cod_credor ILIKE $${paramIdx} OR nome ILIKE $${paramIdx} OR nome_fant ILIKE $${paramIdx} OR cpf_cgc ILIKE $${paramIdx}`;
      paramIdx++;

      if (hasDigitSearch) {
        queryParams.push(`%${searchDigits}%`);
        whereClause += ` OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cgc, '.', ''), '-', ''), '/', ''), ' ', '') ILIKE $${paramIdx}`;
        paramIdx++;
      }
      whereClause += ')';
    }

    // Paginação
    queryParams.push(offset, perPageNumber);
    const limitOffset = `OFFSET $${paramIdx} LIMIT $${paramIdx + 1}`;

    // Buscar os fornecedores com JOINs para nomes amigáveis
    const fornecedoresResult = await client.query(
      `SELECT cr.*, COALESCE(cf.descr, '') as classe_nome
       FROM dbcredor cr
       LEFT JOIN dbcfornec cf ON cf.codcf = cr.codcf
       ${whereClause ? whereClause.replace(/\b(cod_credor|nome|nome_fant|cpf_cgc)\b/g, 'cr.$1') : ''}
       ORDER BY cr.nome ${limitOffset}`,
      queryParams,
    );

    // Contar o total
    const countParams = queryParams.slice(0, paramIdx - 1);
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM dbcredor ${whereClause}`,
      countParams,
    );

    // Enriquecer dados
    const fornecedores = fornecedoresResult.rows.map((f: any) => {
      if (f.classe_nome && f.codcf) f.codcf = `${f.codcf} - ${f.classe_nome}`;
      delete f.classe_nome;
      return f;
    });
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: fornecedores.map((fornecedor) => serializeBigInt(fornecedor)),
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / perPageNumber) : 1,
        currentPage: count > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', (error as Error).message);
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
