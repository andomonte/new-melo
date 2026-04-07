import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient'; // Importação correta

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '10', search = '' } = req.query;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  const pageNumber = parseInt(page as string, 10);
  const perPageNumber = parseInt(perPage as string, 10);
  const searchTerm = `%${search}%`;
  const skip = (pageNumber - 1) * perPageNumber;
  const take = perPageNumber;

  try {
    const pool = getPgPool(filial); // Chama a função para obter o pool da filial
    client = await pool.connect();

    // Monta a cláusula WHERE dinamicamente
    const whereClause = search ? `WHERE b.descr ILIKE $3` : '';

    // Consulta principal com JOIN
    const bairrosResult = await client.query(
      `
        SELECT
          b.codbairro,
          b.codzona,
          b.descr,
          b.uf,
          b.cidade,
          b.bai_nu_sequencial,
          b.codmunicipio,
          b.codpais,
          COALESCE(z.descr, '') AS zona_descr,
          COALESCE(m.descricao, '') AS municipio_nome,
          COALESCE(p.descricao, '') AS pais_nome
        FROM dbbairro b
        LEFT JOIN dbzona z ON z.codzona = b.codzona
        LEFT JOIN dbmunicipio m ON m.codmunicipio = b.codmunicipio
        LEFT JOIN dbpais p ON p.codpais = b.codpais
        ${whereClause}
        ORDER BY b.descr
        OFFSET $1
        LIMIT $2
      `,
      search ? [skip, take, searchTerm] : [skip, take],
    );
    const bairros = bairrosResult.rows;

    // Consulta de contagem total
    const countResult = await client.query(
      `
        SELECT COUNT(*) as total
        FROM dbbairro b
        ${whereClause}
      `,
      search ? [searchTerm] : [],
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    // Mapear os dados para a estrutura esperada
    const formattedBairros = bairros.map((bairro: any) => ({
      codbairro: bairro.codbairro,
      codzona: bairro.codzona,
      descr: bairro.descr,
      uf: bairro.uf,
      cidade: bairro.cidade,
      bai_nu_sequencial: bairro.bai_nu_sequencial,
      codmunicipio: bairro.codmunicipio,
      codpais: bairro.codpais,
      zona: {
        codzona: bairro.codzona,
        descr: bairro.zona_descr,
      },
      municipio: {
        codmunicipio: bairro.codmunicipio,
        descricao: bairro.municipio_nome,
      },
      pais: {
        codpais: bairro.codpais,
        descricao: bairro.pais_nome,
      },
    }));

    res.status(200).json({
      data: formattedBairros,
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / take) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: take,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar bairros:', error);
    console.error('Stack trace:', (error as Error).stack);
    res.status(500).json({
      error: 'Erro ao buscar bairros',
      message: (error as Error).message,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
