import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

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
    // Busca por CNPJ/CPF: limpa pontuação para comparar só dígitos
    const searchDigits = String(search).replace(/\D/g, '');
    const searchDigitsTerm = searchDigits.length >= 3 ? `%${searchDigits}%` : null;

    // Query com JOINs para nomes amigáveis (igual Delphi)
    const query = `
      SELECT
        c.*,
        COALESCE(cc.descr, '') as classe_nome,
        COALESCE(p.descricao, '') as pais_nome
      FROM dbclien c
      LEFT JOIN dbcclien cc ON cc.codcc = c.codcc
      LEFT JOIN dbpais p ON c.codpais = p.codpais
      WHERE
        c.codcli ILIKE $1 OR
        c.nome ILIKE $1 OR
        c.cpfcgc ILIKE $1
        ${searchDigitsTerm ? `OR REPLACE(REPLACE(REPLACE(REPLACE(c.cpfcgc, '.', ''), '-', ''), '/', ''), ' ', '') ILIKE $4` : ''}
      ORDER BY c.nome ASC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM dbclien c
      WHERE
        c.codcli ILIKE $1 OR
        c.nome ILIKE $1 OR
        c.cpfcgc ILIKE $1
        ${searchDigitsTerm ? `OR REPLACE(REPLACE(REPLACE(REPLACE(c.cpfcgc, '.', ''), '-', ''), '/', ''), ' ', '') ILIKE $4` : ''};
    `;

    // Executa as queries em paralelo
    const queryParams = searchDigitsTerm
      ? [searchTerm, limit, offset, searchDigitsTerm]
      : [searchTerm, limit, offset];
    const countParams = searchDigitsTerm
      ? [searchTerm, searchDigitsTerm]
      : [searchTerm];
    // Ajustar countQuery params — $4 no count vira $2
    const countQueryFinal = searchDigitsTerm
      ? countQuery.replace('$4', '$2')
      : countQuery;

    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQueryFinal, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0', 10);
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Enriquecer dados: "código - nome" como Delphi
    const clientes = result.rows.map((c: any) => {
      if (c.classe_nome && c.codcc) c.codcc = `${c.codcc} - ${c.classe_nome}`;
      if (c.pais_nome && c.codpais) c.codpais = `${c.codpais} - ${c.pais_nome}`;
      delete c.classe_nome;
      delete c.pais_nome;
      return c;
    });

    res.status(200).json({
      data: clientes,
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / limit) : 1,
        currentPage: total > 0 ? Number(page) : 1,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
