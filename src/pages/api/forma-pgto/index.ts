// pages/api/forma-pgto/index.ts
// Cadastro de Forma de Pagamento (Contas a Pagar). Grava a LETRA em dbfpgto.tp_pgto.
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();
const TABLE = 'db_manaus.cad_forma_pgto';

const filtroParaColuna: Record<string, string> = {
  fpg_letra: 'fpg_letra',
  fpg_descricao: 'fpg_descricao',
  fpg_ativo: 'fpg_ativo',
};

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGetList(req, res);
    case 'POST':
      if ('page' in req.body || 'filtros' in req.body || 'search' in req.body) {
        return handleGetList(req, res);
      }
      return handleCreate(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGetList = async (req: NextApiRequest, res: NextApiResponse) => {
  const isPost = req.method === 'POST';
  const source: any = isPost ? req.body : req.query;

  const page = Number(source.page) || 1;
  const perPage = Number(source.perPage) || 10;
  const search = (source.search as string) || '';
  const filtros = source.filtros || [];
  // Modo simples para o modal de pagamento: ?ativos=1 retorna só ativas, sem paginação
  const somenteAtivos = source.ativos === '1' || source.ativos === 1 || source.ativos === true;
  // Modo da tela de cadastro (lista completa, sem paginação): ?status=ativo|inativo|todos
  const status = typeof source.status === 'string' ? source.status : '';

  try {
    if (somenteAtivos) {
      const r = await pool.query(
        `SELECT fpg_letra, fpg_descricao, fpg_ativo FROM ${TABLE} WHERE fpg_ativo = 'S' ORDER BY fpg_descricao`,
      );
      return res.status(200).json({ data: r.rows });
    }

    if (status) {
      let where = '';
      if (status === 'ativo') where = "WHERE fpg_ativo = 'S'";
      else if (status === 'inativo') where = "WHERE fpg_ativo = 'N'";
      const r = await pool.query(
        `SELECT fpg_letra, fpg_descricao, fpg_ativo FROM ${TABLE} ${where} ORDER BY fpg_descricao`,
      );
      return res.status(200).json({ data: r.rows });
    }

    const params: any[] = [];
    const whereGroups: string[] = [];

    if (Array.isArray(filtros) && filtros.length > 0) {
      const agrupados: Record<string, { tipo: string; valor: string }[]> = {};
      filtros.forEach((f: { campo: string; tipo: string; valor: string }) => {
        (agrupados[f.campo] ||= []).push({ tipo: f.tipo, valor: f.valor });
      });

      Object.entries(agrupados).forEach(([campo, lista]) => {
        const coluna = filtroParaColuna[campo];
        if (!coluna) return;
        const parts: string[] = [];
        lista.forEach((f) => {
          let operador = 'ILIKE';
          let valor = '';
          switch (f.tipo) {
            case 'igual': operador = '='; valor = String(f.valor); break;
            case 'diferente': operador = '<>'; valor = String(f.valor); break;
            case 'contém': operador = 'ILIKE'; valor = `%${f.valor}%`; break;
            case 'começa': operador = 'ILIKE'; valor = `${f.valor}%`; break;
            case 'termina': operador = 'ILIKE'; valor = `%${f.valor}`; break;
            case 'nulo': parts.push(`${coluna} IS NULL`); return;
            case 'nao_nulo': parts.push(`${coluna} IS NOT NULL`); return;
            default: return;
          }
          parts.push(`${coluna} ${operador} $${params.length + 1}`);
          params.push(valor);
        });
        if (parts.length > 0) whereGroups.push(`(${parts.join(' OR ')})`);
      });
    }

    if (search && whereGroups.length === 0) {
      whereGroups.push(
        `(fpg_letra ILIKE $${params.length + 1} OR fpg_descricao ILIKE $${params.length + 2})`,
      );
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereString = whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

    const totalResult = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${whereString}`, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const offset = (page - 1) * perPage;
    const dataResult = await pool.query(
      `SELECT fpg_letra, fpg_descricao, fpg_ativo FROM ${TABLE} ${whereString}
       ORDER BY fpg_descricao ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, offset],
    );

    const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;
    return res.status(200).json({
      data: dataResult.rows,
      meta: { total, perPage, currentPage: total > 0 ? page : 1, lastPage, firstPage: 1 },
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar formas de pagamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

const handleCreate = async (req: NextApiRequest, res: NextApiResponse) => {
  const { fpg_letra, fpg_descricao, fpg_ativo } = req.body;
  if (!fpg_letra) return res.status(400).json({ error: 'A letra é obrigatória.' });
  if (!fpg_descricao) return res.status(400).json({ error: 'A descrição é obrigatória.' });

  try {
    const result = await pool.query(
      `INSERT INTO ${TABLE} (fpg_letra, fpg_descricao, fpg_ativo) VALUES ($1, $2, $3) RETURNING *`,
      [String(fpg_letra).toUpperCase(), String(fpg_descricao).toUpperCase(), fpg_ativo || 'S'],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma forma de pagamento com esta letra.' });
    }
    console.error('Erro ao criar forma de pagamento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};
