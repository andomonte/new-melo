import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

const mapTipoParaOperadorSQL = (tipo: string, campo: string, valor: string) => {
  // Escapar aspas simples para prevenir SQL injection
  const valorEscapado = valor.replace(/'/g, "''");

  switch (tipo) {
    case 'contém':
      return `${campo} ILIKE '%${valorEscapado}%'`;
    case 'começa':
      return `${campo} ILIKE '${valorEscapado}%'`;
    case 'termina':
      return `${campo} ILIKE '%${valorEscapado}'`;
    case 'igual':
      return `${campo} = '${valorEscapado}'`;
    case 'diferente':
      return `${campo} <> '${valorEscapado}'`;
    case 'maior':
      return `${campo} > '${valorEscapado}'`;
    case 'maior_igual':
      return `${campo} >= '${valorEscapado}'`;
    case 'menor':
      return `${campo} < '${valorEscapado}'`;
    case 'menor_igual':
      return `${campo} <= '${valorEscapado}'`;
    case 'nulo':
      return `${campo} IS NULL`;
    case 'nao_nulo':
      return `${campo} IS NOT NULL`;
    default:
      return '';
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { page = 1, perPage = 10, filtros = '[]', busca = '' } = req.body;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;
  const filtrosObj = JSON.parse(filtros) as {
    campo: string;
    tipo: string;
    valor: string;
  }[];

  const whereFiltros = filtrosObj
    .map((f) => mapTipoParaOperadorSQL(f.tipo, `c.${f.campo}`, f.valor))
    .filter(Boolean);

  const whereBuscaGlobal = busca
    ? [
        `(c.cod_credor ILIKE '%${busca}%' OR c.nome ILIKE '%${busca}%' OR c.nome_fant ILIKE '%${busca}%')`,
      ]
    : [];

  // Corrigir a construção da cláusula WHERE
  const condicoes = [...whereBuscaGlobal, ...whereFiltros];
  const whereFinal = condicoes.length > 0 ? condicoes.join(' AND ') : '';

  const offset = (Number(page) - 1) * Number(perPage);

  try {
    client = await pool.connect();

    const totalResult = await client.query(
      `SELECT COUNT(*)::bigint as count FROM dbcredor c
       ${whereFinal ? `WHERE ${whereFinal}` : ''}`,
    );

    const dadosResult = await client.query(
      `
      SELECT 
        c.*,
        p.descricao AS nome_pais,
        m.descricao AS nome_municipio,
        b.descr AS nome_bairro,
        cla.descr AS nome_classe
      FROM dbcredor c
      LEFT JOIN dbpais p ON p.codpais = c.codpais
      LEFT JOIN dbmunicipio m ON m.codmunicipio = c.codmunicipio
      LEFT JOIN dbbairro b ON b.codbairro = c.codbairro
      LEFT JOIN dbclassefornecedor cla ON cla.codcf = c.codcf
      ${whereFinal ? `WHERE ${whereFinal}` : ''}
      ORDER BY c.cod_credor
      OFFSET ${offset}
      LIMIT ${perPage}
      `,
    );

    const count = Number(totalResult.rows[0]?.count || 0);

    res.status(200).json(
      serializeBigInt({
        data: dadosResult.rows,
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / Number(perPage)) : 1,
          currentPage: count > 0 ? Number(page) : 1,
          perPage: Number(perPage),
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
