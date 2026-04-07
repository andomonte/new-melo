import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { page = 1, perPage = 10, filtros = [] } = req.body;

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

    // Construir condições de filtro
    let whereConditions = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filtros && filtros.length > 0) {
      const conditions = filtros
        .map((filtro: any) => {
          const { campo, tipo, valor } = filtro;

          if (!campo || !tipo || valor === undefined || valor === '') {
            return '';
          }

          let condition = '';

          switch (tipo) {
            case 'contém':
            case 'contains':
              condition = `${campo} ILIKE $${paramIndex}`;
              queryParams.push(`%${valor}%`);
              break;
            case 'igual':
            case 'equals':
              condition = `${campo} = $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'começa':
            case 'startsWith':
              condition = `${campo} ILIKE $${paramIndex}`;
              queryParams.push(`${valor}%`);
              break;
            case 'termina':
            case 'endsWith':
              condition = `${campo} ILIKE $${paramIndex}`;
              queryParams.push(`%${valor}`);
              break;
            case 'maior':
            case 'greaterThan':
              condition = `${campo} > $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'menor':
            case 'lessThan':
              condition = `${campo} < $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'maior_igual':
            case 'greaterThanOrEqual':
              condition = `${campo} >= $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'menor_igual':
            case 'lessThanOrEqual':
              condition = `${campo} <= $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'diferente':
            case 'notEquals':
              condition = `${campo} != $${paramIndex}`;
              queryParams.push(valor);
              break;
            case 'nulo':
            case 'isNull':
              condition = `${campo} IS NULL`;
              paramIndex--; // Não incrementar paramIndex para este caso
              break;
            case 'nao_nulo':
            case 'isNotNull':
              condition = `${campo} IS NOT NULL`;
              paramIndex--; // Não incrementar paramIndex para este caso
              break;
            default:
              condition = `${campo} ILIKE $${paramIndex}`;
              queryParams.push(`%${valor}%`);
          }

          paramIndex++;
          return condition;
        })
        .filter(Boolean);

      if (conditions.length > 0) {
        whereConditions = `WHERE ${conditions.join(' AND ')}`;
      }
    }

    // Query principal
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
      ${whereConditions}
      ORDER BY nome ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbtransp
      ${whereConditions};
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit e offset

    const [dataResult, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / Number(perPage));

    const meta = {
      currentPage: Number(page),
      perPage: Number(perPage),
      total,
      lastPage: totalPages,
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
