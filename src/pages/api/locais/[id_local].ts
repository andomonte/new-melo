import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// Função auxiliar para executar operações com timeout
const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> => {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
};

// Função auxiliar para tratamento de erros padronizado
const handleDatabaseError = (error: any, res: NextApiResponse) => {
  console.error('Erro na operação do banco:', error);

  if (
    error.message?.includes('timeout') ||
    error.message?.includes('Timeout')
  ) {
    return res.status(408).json({
      error: 'Timeout na operação',
      message: 'A operação demorou muito para ser concluída. Tente novamente.',
    });
  }

  if (error.message?.includes('Connection') || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Erro de conexão com banco de dados',
      message: 'Não foi possível conectar ao banco de dados.',
    });
  }

  if (error.code === '23503') {
    return res.status(400).json({
      error: 'Erro de referência: O armazém especificado não existe.',
      detail: error.detail,
    });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    message: error.message,
  });
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Documentação: Pega o id_local da URL.
  const { id_local } = req.query;

  // Documentação: Valida se o ID foi passado e é uma string.
  if (!id_local || typeof id_local !== 'string') {
    return res.status(400).json({ error: 'ID do local inválido na URL.' });
  }

  switch (req.method) {
    case 'GET':
      await handleGetOne(req, res, id_local);
      break;
    case 'PUT':
      await handleUpdate(req, res, id_local);
      break;
    case 'DELETE':
      await handleDelete(req, res, id_local);
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
  id_local: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);

    // Obtém conexão com timeout
    client = await withTimeout(
      pool.connect(),
      10000,
      'Timeout ao obter conexão do pool',
    );

    // Executa query com timeout
    const query = 'SELECT * FROM dblocal WHERE id_local = $1';
    const result = await withTimeout(
      client.query(query, [id_local]),
      15000,
      'Timeout na execução da query',
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    return handleDatabaseError(error, res);
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Erro ao liberar conexão:', releaseError);
      }
    }
  }
};

// --- FUNÇÃO PARA ATUALIZAR (PUT) ---
const handleUpdate = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id_local: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // Documentação: Lista de campos que podem ser atualizados.
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
      dataToUpdate[field] = req.body[field];
    }
  });

  const fields = Object.keys(dataToUpdate);
  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhum campo para atualizar foi fornecido.' });
  }

  // Documentação: Monta a cláusula SET dinamicamente para a query de UPDATE.
  const setClause = fields
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');
  const values = Object.values(dataToUpdate);

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);

    // Obtém conexão com timeout
    client = await withTimeout(
      pool.connect(),
      10000,
      'Timeout ao obter conexão do pool',
    );

    // Documentação: Se está atualizando id_armazem, verifica se o armazém existe
    if (dataToUpdate.id_armazem) {
      const armazemQuery =
        'SELECT id_armazem FROM dbarmazem WHERE id_armazem = $1';
      const armazemResult = await withTimeout(
        client.query(armazemQuery, [dataToUpdate.id_armazem]),
        10000,
        'Timeout na verificação do armazém',
      );

      if (armazemResult.rowCount === 0) {
        return res.status(400).json({
          error: `Armazém com ID ${dataToUpdate.id_armazem} não encontrado.`,
        });
      }
    }

    const query = `
      UPDATE dblocal
      SET ${setClause}
      WHERE id_local = $${fields.length + 1}
      RETURNING *;
    `;

    const result = await withTimeout(
      client.query(query, [...values, id_local]),
      15000,
      'Timeout na atualização do local',
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Local não encontrado para atualizar.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    // Documentação: Trata erros específicos do banco de dados.
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Erro de referência: O armazém especificado não existe.',
        detail: error.detail,
      });
    }
    return handleDatabaseError(error, res);
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Erro ao liberar conexão:', releaseError);
      }
    }
  }
};

// --- FUNÇÃO PARA DELETAR (DELETE) ---
const handleDelete = async (
  req: NextApiRequest,
  res: NextApiResponse,
  id_local: string,
) => {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;
  try {
    const pool = getPgPool(filial);

    // Obtém conexão com timeout
    client = await withTimeout(
      pool.connect(),
      10000,
      'Timeout ao obter conexão do pool',
    );

    // Documentação: Verifica se o local existe
    const existsQuery = 'SELECT id_local FROM dblocal WHERE id_local = $1';
    const existsResult = await withTimeout(
      client.query(existsQuery, [id_local]),
      10000,
      'Timeout na verificação de existência do local',
    );

    if (existsResult.rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    // Documentação: Verifica se existem registros de estoque vinculados ao local
    // Usa a tabela dbestoque que referencia 'deposito' que pode corresponder ao id_local
    const estoqueQuery =
      'SELECT deposito FROM dbestoque WHERE deposito = $1 LIMIT 1';
    const estoqueResult = await withTimeout(
      client.query(estoqueQuery, [id_local]),
      10000,
      'Timeout na verificação de estoque',
    );

    if (estoqueResult.rowCount && estoqueResult.rowCount > 0) {
      return res.status(409).json({
        error:
          'Não é possível excluir este local pois existem registros de estoque vinculados a ele',
      });
    }

    // Documentação: Verifica se existem movimentos de estoque vinculados ao local
    const movimentoQuery =
      'SELECT deposito FROM dbestoque_movimento WHERE deposito = $1 LIMIT 1';
    const movimentoResult = await withTimeout(
      client.query(movimentoQuery, [id_local]),
      10000,
      'Timeout na verificação de movimentos',
    );

    if (movimentoResult.rowCount && movimentoResult.rowCount > 0) {
      return res.status(409).json({
        error:
          'Não é possível excluir este local pois existem movimentos de estoque vinculados a ele',
      });
    }

    // Documentação: Query para deletar um local pelo seu id_local.
    const query = 'DELETE FROM dblocal WHERE id_local = $1';
    const result = await withTimeout(
      client.query(query, [id_local]),
      15000,
      'Timeout na exclusão do local',
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Local não encontrado para deletar.' });
    }

    res.status(200).json({ message: 'Local deletado com sucesso.' });
  } catch (error: any) {
    return handleDatabaseError(error, res);
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Erro ao liberar conexão:', releaseError);
      }
    }
  }
};
