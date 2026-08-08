// pages/api/tipoOperacaoFiscal/index.ts
// Catálogo GLOBAL (banco central db_manaus) — usa @/lib/pg (search_path db_manaus,public).
import { NextApiRequest, NextApiResponse } from 'next';
import { queryWithRelease } from '@/lib/pg';

const TABLE = 'db_manaus."cad_tipo_operacao_fiscal"';

const filtroParaColunaSQL: Record<string, string> = {
  codigo: '"codigo"',
  descricao: '"descricao"',
  tipo_movimentacao: '"tipo_movimentacao"',
  ativo: '"ativo"',
};

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      await handleGetList(req, res);
      break;
    case 'POST':
      if ('page' in req.body || 'filtros' in req.body || 'search' in req.body) {
        await handleGetList(req, res);
      } else {
        await handleCreate(req, res);
      }
      break;
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGetList = async (req: NextApiRequest, res: NextApiResponse) => {
  const isPost = req.method === 'POST';
  const source = isPost ? req.body : req.query;
  const page = Number(source.page) || 1;
  const perPage = Number(source.perPage) || 10;
  const search = (source.search as string) || '';
  const filtros = source.filtros || [];

  try {
    const params: any[] = [];
    const whereGroups: string[] = [];

    if (Array.isArray(filtros) && filtros.length > 0) {
      const agrupados: Record<string, { tipo: string; valor: string }[]> = {};
      filtros.forEach((f: { campo: string; tipo: string; valor: string }) => {
        (agrupados[f.campo] ??= []).push({ tipo: f.tipo, valor: f.valor });
      });
      Object.entries(agrupados).forEach(([campo, lista]) => {
        const coluna = filtroParaColunaSQL[campo];
        if (!coluna) return;
        const partes: string[] = [];
        lista.forEach((f) => {
          let operador = 'ILIKE';
          let valor: string;
          switch (f.tipo) {
            case 'igual': operador = '='; valor = String(f.valor); break;
            case 'diferente': operador = '<>'; valor = String(f.valor); break;
            case 'contém': operador = 'ILIKE'; valor = `%${f.valor}%`; break;
            case 'começa': operador = 'ILIKE'; valor = `${f.valor}%`; break;
            case 'termina': operador = 'ILIKE'; valor = `%${f.valor}`; break;
            case 'nulo': partes.push(`${coluna} IS NULL`); return;
            case 'nao_nulo': partes.push(`${coluna} IS NOT NULL`); return;
            default: valor = `%${f.valor}%`;
          }
          partes.push(`${coluna} ${operador} $${params.length + 1}`);
          params.push(valor);
        });
        if (partes.length) whereGroups.push(`(${partes.join(' OR ')})`);
      });
    }

    if (search && whereGroups.length === 0) {
      whereGroups.push(
        `("codigo" ILIKE $${params.length + 1} OR "descricao" ILIKE $${params.length + 2} OR "tipo_movimentacao" ILIKE $${params.length + 3})`,
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereString = whereGroups.length ? `WHERE ${whereGroups.join(' AND ')}` : '';

    const totalResult = await queryWithRelease(`SELECT COUNT(*) FROM ${TABLE} ${whereString}`, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const offset = (page - 1) * perPage;
    const dataResult = await queryWithRelease(
      `SELECT * FROM ${TABLE} ${whereString}
       ORDER BY "tipo_movimentacao" ASC, "ordem" ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset],
    );

    const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;
    res.status(200).json({
      data: dataResult.rows,
      meta: { total, perPage, currentPage: total > 0 ? page : 1, lastPage, firstPage: 1 },
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar tipos de operação fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { codigo, descricao, tipo_movimentacao, ordem, ativo } = req.body;
  if (!codigo || !descricao || !tipo_movimentacao) {
    return res.status(400).json({ error: 'Código, descrição e movimentação são obrigatórios.' });
  }
  try {
    const result = await queryWithRelease(
      `INSERT INTO ${TABLE} ("codigo","descricao","tipo_movimentacao","ordem","ativo")
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        String(codigo).toUpperCase().trim(),
        descricao,
        tipo_movimentacao,
        Number(ordem) || 0,
        ativo === false || ativo === 'N' || ativo === 'false' ? false : true,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe esta operação para esta movimentação.' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Movimentação inválida.' });
    }
    console.error('Erro ao criar tipo de operação fiscal:', error);
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};
