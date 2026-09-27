// /api/locacoes/locacoes — CRUD das locações de um produto por armazém
// Espelha o Delphi (Armazéns → Locações): cad_armazem_produto_locacao
//   GET    ?arm_id=&codprod=            → lista as locações do produto no armazém
//   POST   {arm_id, codprod, descricao} → adiciona (apl_id = MAX+1 por arm+prod)
//   PUT    {arm_id, codprod, apl_id, descricao} → edita a descrição
//   DELETE {arm_id, codprod, apl_id}    → remove
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();
const TABLE = 'db_manaus.cad_armazem_produto_locacao';
const MAX_DESC = 15; // apl_descricao varchar(15) — igual ao Delphi

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return listar(req, res);
    case 'POST':
      return adicionar(req, res);
    case 'PUT':
      return editar(req, res);
    case 'DELETE':
      return remover(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

function parseArmProd(src: any) {
  const armId = parseInt(String(src.arm_id ?? ''), 10);
  const codprod = String(src.codprod ?? '').trim();
  return { armId, codprod };
}

async function listar(req: NextApiRequest, res: NextApiResponse) {
  const { armId, codprod } = parseArmProd(req.query);
  if (!armId || isNaN(armId) || !codprod) {
    return res.status(400).json({ error: 'Armazém e produto são obrigatórios.' });
  }
  try {
    const r = await pool.query(
      `SELECT apl_id, apl_descricao FROM ${TABLE}
       WHERE apl_arm_id = $1 AND apl_codprod = $2
       ORDER BY apl_id`,
      [armId, codprod],
    );
    return res.status(200).json({ locacoes: r.rows });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao listar locações', message: error.message });
  }
}

async function adicionar(req: NextApiRequest, res: NextApiResponse) {
  const { armId, codprod } = parseArmProd(req.body);
  const descricao = String(req.body.descricao ?? '').trim().toUpperCase();
  if (!armId || isNaN(armId) || !codprod) {
    return res.status(400).json({ error: 'Armazém e produto são obrigatórios.' });
  }
  if (!descricao) {
    return res.status(400).json({ error: 'Informe a descrição da locação.' });
  }
  if (descricao.length > MAX_DESC) {
    return res.status(400).json({ error: `A locação deve ter no máximo ${MAX_DESC} caracteres.` });
  }
  try {
    const nextRes = await pool.query(
      `SELECT COALESCE(MAX(apl_id), 0) + 1 as next_id FROM ${TABLE}
       WHERE apl_arm_id = $1 AND apl_codprod = $2`,
      [armId, codprod],
    );
    const nextId = nextRes.rows[0].next_id;
    const r = await pool.query(
      `INSERT INTO ${TABLE} (apl_arm_id, apl_codprod, apl_id, apl_descricao)
       VALUES ($1, $2, $3, $4) RETURNING apl_id, apl_descricao`,
      [armId, codprod, nextId, descricao],
    );
    return res.status(201).json({ locacao: r.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao adicionar locação', message: error.message });
  }
}

async function editar(req: NextApiRequest, res: NextApiResponse) {
  const { armId, codprod } = parseArmProd(req.body);
  const aplId = parseInt(String(req.body.apl_id ?? ''), 10);
  const descricao = String(req.body.descricao ?? '').trim().toUpperCase();
  if (!armId || isNaN(armId) || !codprod || isNaN(aplId)) {
    return res.status(400).json({ error: 'Armazém, produto e id da locação são obrigatórios.' });
  }
  if (!descricao) {
    return res.status(400).json({ error: 'Informe a descrição da locação.' });
  }
  if (descricao.length > MAX_DESC) {
    return res.status(400).json({ error: `A locação deve ter no máximo ${MAX_DESC} caracteres.` });
  }
  try {
    const r = await pool.query(
      `UPDATE ${TABLE} SET apl_descricao = $1
       WHERE apl_arm_id = $2 AND apl_codprod = $3 AND apl_id = $4 RETURNING apl_id, apl_descricao`,
      [descricao, armId, codprod, aplId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Locação não encontrada.' });
    return res.status(200).json({ locacao: r.rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao editar locação', message: error.message });
  }
}

async function remover(req: NextApiRequest, res: NextApiResponse) {
  const { armId, codprod } = parseArmProd(req.body);
  const aplId = parseInt(String(req.body.apl_id ?? ''), 10);
  if (!armId || isNaN(armId) || !codprod || isNaN(aplId)) {
    return res.status(400).json({ error: 'Armazém, produto e id da locação são obrigatórios.' });
  }
  try {
    const r = await pool.query(
      `DELETE FROM ${TABLE} WHERE apl_arm_id = $1 AND apl_codprod = $2 AND apl_id = $3`,
      [armId, codprod, aplId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Locação não encontrada.' });
    return res.status(200).json({ sucesso: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao remover locação', message: error.message });
  }
}
