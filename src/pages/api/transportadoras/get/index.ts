import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
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

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const searchTerm = `%${search}%`;

    // Query de busca com filtros e paginação
    const query = `
      SELECT 
        codtransp,
        nome,
        nomefant,
        cpfcgc,
        tipo,
        data_cad,
        ender,
        bairro,
        cidade,
        uf,
        iest,
        isuframa,
        imun,
        tipoemp,
        contatos,
        cc,
        n_agencia,
        banco,
        cod_ident,
        cep,
        codbairro,
        codmunicipio,
        numero,
        referencia,
        CAST(codpais AS INTEGER) AS codpais,
        complemento,
        codunico
      FROM dbtransp
      WHERE 
        codtransp ILIKE $1 OR
        nome ILIKE $1 OR
        nomefant ILIKE $1 OR
        cpfcgc ILIKE $1
      ORDER BY nome ASC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbtransp
      WHERE 
        codtransp ILIKE $1 OR
        nome ILIKE $1 OR
        nomefant ILIKE $1 OR
        cpfcgc ILIKE $1;
    `;

    const [dataResult, countResult] = await Promise.all([
      client.query(query, [searchTerm, limit, offset]),
      client.query(countQuery, [searchTerm]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / Number(perPage));

    const meta = {
      page: Number(page),
      perPage: Number(perPage),
      total,
      totalPages,
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    };

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(dataResult.rows),
        meta,
      });
  } catch (error: any) {
    console.error('Erro ao buscar transportadoras:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao buscar transportadoras.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
