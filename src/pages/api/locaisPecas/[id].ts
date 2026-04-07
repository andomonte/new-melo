import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do local é obrigatório.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, id);
      break;
    case 'PUT':
      await handleUpdate(req, res, id);
      break;
    case 'DELETE':
      await handleDelete(req, res, id);
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// --- FUNÇÃO PARA OBTER UM (GET) ---
const handleGetOne = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      SELECT 
        l.id_local,
        l.id_armazem,
        l.descricao,
        l.tipo_local,
        l.capacidade,
        l.unidade,
        a.id_armazem as armazem_id,
        a.nome as armazem_nome,
        a.filial as armazem_filial,
        a.ativo as armazem_ativo
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      WHERE l.id_local = $1
    `;
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    const row = result.rows[0];
    const formattedData = {
      id_local: row.id_local,
      id_armazem: row.id_armazem,
      descricao: row.descricao,
      tipo_local: row.tipo_local,
      capacidade: row.capacidade ? parseFloat(row.capacidade.toString()) : null,
      unidade: row.unidade,
      armazem: {
        id_armazem: row.armazem_id,
        nome: row.armazem_nome,
        filial: row.armazem_filial,
        ativo: row.armazem_ativo,
      },
    };

    res.status(200).json({ data: formattedData });
  } catch (error: any) {
    console.error('Erro ao obter local da peça:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA ATUALIZAR (PUT) ---
const handleUpdate = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const allowedFields = [
    'id_armazem',
    'descricao',
    'tipo_local',
    'capacidade',
    'unidade',
  ];

  const dataToUpdate: { [key: string]: any } = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === 'capacidade') {
        if (req.body[field] === '' || req.body[field] === null) {
          dataToUpdate[field] = null;
        } else {
          const capacidadeValue = parseFloat(req.body[field]);
          if (isNaN(capacidadeValue)) {
            return res.status(400).json({
              error: 'Capacidade deve ser um número válido.',
            });
          }
          if (capacidadeValue < 0) {
            return res.status(400).json({
              error: 'Capacidade não pode ser negativa.',
            });
          }
          dataToUpdate[field] = capacidadeValue.toString();
        }
      } else if (
        field === 'descricao' ||
        field === 'tipo_local' ||
        field === 'unidade'
      ) {
        dataToUpdate[field] = req.body[field] === '' ? null : req.body[field];
      } else {
        dataToUpdate[field] = req.body[field];
      }
    }
  });

  const fields = Object.keys(dataToUpdate);
  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum campo para atualizar foi fornecido.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Verificar se o local existe
    const existingQuery = 'SELECT id_local FROM dblocal WHERE id_local = $1';
    const existingResult = await client.query(existingQuery, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    // Se o id_armazem está sendo atualizado, verificar se o armazém existe
    if (dataToUpdate.id_armazem) {
      const armazemQuery =
        'SELECT id_armazem FROM dbarmazem WHERE id_armazem = $1';
      const armazemResult = await client.query(armazemQuery, [
        dataToUpdate.id_armazem,
      ]);

      if (armazemResult.rowCount === 0) {
        return res.status(400).json({ error: 'Armazém não encontrado.' });
      }
    }

    const setClause = fields
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const values = Object.values(dataToUpdate);

    const updateQuery = `
      UPDATE dblocal
      SET ${setClause}
      WHERE id_local = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [...values, id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Local não encontrado para atualizar.' });
    }

    // Buscar os dados completos incluindo o armazém
    const completeQuery = `
      SELECT 
        l.id_local,
        l.id_armazem,
        l.descricao,
        l.tipo_local,
        l.capacidade,
        l.unidade,
        a.id_armazem as armazem_id,
        a.nome as armazem_nome,
        a.filial as armazem_filial,
        a.ativo as armazem_ativo
      FROM dblocal l
      LEFT JOIN dbarmazem a ON a.id_armazem = l.id_armazem
      WHERE l.id_local = $1
    `;
    const completeResult = await client.query(completeQuery, [id]);
    const row = completeResult.rows[0];

    const formattedData = {
      id_local: row.id_local,
      id_armazem: row.id_armazem,
      descricao: row.descricao,
      tipo_local: row.tipo_local,
      capacidade: row.capacidade ? parseFloat(row.capacidade.toString()) : null,
      unidade: row.unidade,
      armazem: {
        id_armazem: row.armazem_id,
        nome: row.armazem_nome,
        filial: row.armazem_filial,
        ativo: row.armazem_ativo,
      },
    };

    res.status(200).json({ data: formattedData });
  } catch (error: any) {
    console.error('Erro ao atualizar local da peça:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};

// --- FUNÇÃO PARA DELETAR (DELETE) ---
const handleDelete = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Verificar se o local existe
    const existingQuery = 'SELECT id_local FROM dblocal WHERE id_local = $1';
    const existingResult = await client.query(existingQuery, [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    // Verificar se existe algum registro de estoque vinculado
    // Usa a tabela dbestoque que referencia 'deposito' que pode corresponder ao id_local
    const estoqueQuery =
      'SELECT deposito FROM dbestoque WHERE deposito = $1 LIMIT 1';
    const estoqueResult = await client.query(estoqueQuery, [id]);

    if (estoqueResult.rowCount && estoqueResult.rowCount > 0) {
      return res.status(409).json({
        error:
          'Não é possível excluir este local pois existem registros de estoque vinculados a ele',
      });
    }

    // Verificar se existem movimentos de estoque vinculados ao local
    const movimentoQuery =
      'SELECT deposito FROM dbestoque_movimento WHERE deposito = $1 LIMIT 1';
    const movimentoResult = await client.query(movimentoQuery, [id]);

    if (movimentoResult.rowCount && movimentoResult.rowCount > 0) {
      return res.status(409).json({
        error:
          'Não é possível excluir este local pois existem movimentos de estoque vinculados a ele',
      });
    }

    // Deletar o local
    const deleteQuery = 'DELETE FROM dblocal WHERE id_local = $1';
    const result = await client.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Local não encontrado para deletar.' });
    }

    res.status(200).json({ message: 'Local excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar local da peça:', error);
    res
      .status(500)
      .json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) client.release();
  }
};
