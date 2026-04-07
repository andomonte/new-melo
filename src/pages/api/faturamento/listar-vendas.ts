import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

function getCampoSQL(campo: string): string {
  switch (campo) {
    case 'cliente':
      return "CONCAT(c.codcli, ' - ', c.nome)";
    case 'uf':
      return 'c.uf';
    case 'cep':
      return 'c.cep';
    case 'cidade':
      return 'c.cidade';
    case 'bairro':
      return 'c.bairro';
    case 'ender':
      return 'c.ender';
    case 'numero':
      return 'c.numero';
    case 'complemento':
      return 'c.complemento';
    case 'transporte':
      return 'v.transp';
    default:
      return `v.${campo}`;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const rawFiltros = req.query.filtros || '[]';
  const termoBusca = (req.query.search as string) || '';

  let filtros: any[] = [];
  try {
    filtros = JSON.parse(rawFiltros as string);
  } catch {
    return res.status(400).json({ error: 'Filtros inválidos' });
  }

  const offset = (page - 1) * perPage;
  const values: any[] = [];

  const filtrosGlobais = filtros.filter((f) => f.global);
  const filtrosNormais = filtros.filter((f) => !f.global);

  const whereAND: string[] = [
    `v.status NOT IN ('F', 'B', 'C')`,
    `v.cancel = 'N'`,
  ];
  const whereOR: string[] = [];

  // Busca global por termo (pesquisa em múltiplos campos)
  if (termoBusca && termoBusca.trim() !== '') {
    const idx = values.length + 1;
    values.push(`%${termoBusca}%`);
    whereAND.push(`(
      LOWER(v.nrovenda) LIKE LOWER($${idx}) OR
      LOWER(c.nome) LIKE LOWER($${idx}) OR
      LOWER(CAST(c.codcli AS TEXT)) LIKE LOWER($${idx}) OR
      LOWER(v.obs) LIKE LOWER($${idx}) OR
      LOWER(v.transp) LIKE LOWER($${idx}) OR
      LOWER(c.cidade) LIKE LOWER($${idx})
    )`);
  }

  // Filtros normais (AND)
  filtrosNormais.forEach((filtro) => {
    const idx = values.length + 1;
    const campoSQL = getCampoSQL(filtro.campo);
    const valor = filtro.valor;

    // Tratamento especial para campo data
    if (filtro.campo === 'data') {
      if (filtro.tipo === 'igual') {
        whereAND.push(`DATE(v.data) = DATE($${idx})`);
        values.push(valor);
      } else if (filtro.tipo === 'maior_igual') {
        whereAND.push(`DATE(v.data) >= DATE($${idx})`);
        values.push(valor);
      } else if (filtro.tipo === 'menor_igual') {
        whereAND.push(`DATE(v.data) <= DATE($${idx})`);
        values.push(valor);
      } else if (filtro.tipo === 'maior') {
        whereAND.push(`DATE(v.data) > DATE($${idx})`);
        values.push(valor);
      } else if (filtro.tipo === 'menor') {
        whereAND.push(`DATE(v.data) < DATE($${idx})`);
        values.push(valor);
      } else if (filtro.tipo === 'contém') {
        whereAND.push(`TO_CHAR(v.data, 'DD/MM/YYYY') LIKE $${idx}`);
        values.push(`%${valor}%`);
      }
    } else {
      // Filtros para outros campos (texto e números)
      if (filtro.tipo === 'contém') {
        whereAND.push(`LOWER(${campoSQL}) LIKE LOWER($${idx})`);
        values.push(`%${valor}%`);
      } else if (filtro.tipo === 'igual') {
        whereAND.push(`${campoSQL} = $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'começa') {
        whereAND.push(`LOWER(${campoSQL}) LIKE LOWER($${idx})`);
        values.push(`${valor}%`);
      } else if (filtro.tipo === 'termina') {
        whereAND.push(`LOWER(${campoSQL}) LIKE LOWER($${idx})`);
        values.push(`%${valor}`);
      } else if (filtro.tipo === 'diferente') {
        whereAND.push(`${campoSQL} != $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'maior') {
        whereAND.push(`${campoSQL} > $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'maior_igual') {
        whereAND.push(`${campoSQL} >= $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'menor') {
        whereAND.push(`${campoSQL} < $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'menor_igual') {
        whereAND.push(`${campoSQL} <= $${idx}`);
        values.push(valor);
      } else if (filtro.tipo === 'nulo') {
        whereAND.push(`${campoSQL} IS NULL`);
      } else if (filtro.tipo === 'nao_nulo') {
        whereAND.push(`${campoSQL} IS NOT NULL`);
      }
    }
  });

  // Filtros globais (OR)
  filtrosGlobais.forEach((filtro) => {
    const idx = values.length + 1;
    const campoSQL = getCampoSQL(filtro.campo);
    whereOR.push(`LOWER(${campoSQL}) LIKE LOWER($${idx})`);
    values.push(`%${filtro.valor}%`);
  });

  if (whereOR.length > 0) {
    whereAND.push(`(${whereOR.join(' OR ')})`);
  }

  const whereSQL = whereAND.length ? `WHERE ${whereAND.join(' AND ')}` : '';

  const client = await getPgPool().connect();

  try {
    const countResult = await client.query(
      `SELECT COUNT(*) FROM dbvenda v LEFT JOIN dbclien c ON v.codcli = c.codcli ${whereSQL}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await client.query(
      `
      SELECT v.codvenda, v.nrovenda, v.tipo, v.obs, v.total, v.data,v.codvend,
             v.transp as transportadora,
             c.codcli, c.nome as cliente, c.uf, c.cep, c.cidade, c.bairro,
             c.ender, c.numero, c.complemento
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      ${whereSQL}
      ORDER BY v.data DESC, v.codvenda DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, perPage, offset],
    );

    const vendas = dataResult.rows.map((v: any) => ({
      codvenda: v.codvenda,
      cliente: v.cliente || '',
      total: Number(v.total ?? 0),
      data: v.data?.toISOString().split('T')[0] ?? '',
      nrovenda: v.nrovenda ?? '',
      tipo: v.tipo ?? '',
      obs: v.obs ?? '',
      uf: v.uf ?? '',
      cep: v.cep ?? '',
      cidade: v.cidade ?? '',
      bairro: v.bairro ?? '',
      ender: v.ender ?? '',
      numero: v.numero ?? '',
      complemento: v.complemento ?? '',
      transportadora: v.transportadora ?? '',
      codcli: v.codcli ?? '',
      codvend: v.codvend ?? '',
    }));

    res.status(200).json({
      data: vendas,
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  } finally {
    client.release();
  }
}
