// pages/api/vendas/[codvenda].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Este endpoint só aceita o método PATCH
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    // 1. EXTRAIR DADOS DA REQUISIÇÃO
    const { codvenda } = req.query;
    const { status } = req.body;

    // Validação dos dados recebidos, usando o padrão de retorno corrigido
    if (!codvenda || typeof codvenda !== 'string') {
      res.status(400).json({ message: 'Código da venda inválido.' });
      return;
    }
    if (!status || typeof status !== 'string') {
      res.status(400).json({ message: 'Novo status não fornecido.' });
      return;
    }

    // 2. ATUALIZAR NO BANCO DE DADOS COM PG
    const pool = getPgPool();
    client = await pool.connect();

    // A instrução UPDATE com a cláusula RETURNING * é a chave aqui.
    // Ela atualiza a linha e a retorna em uma única operação.
    const updateQuery = `
      UPDATE dbvenda
      SET status = $1
      WHERE codvenda = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [status, codvenda]);

    // Se result.rows estiver vazio, significa que o WHERE não encontrou
    // nenhuma venda com o 'codvenda' fornecido.
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Venda não encontrada.' });
      return;
    }

    const updatedVenda = result.rows[0];

    // 3. ENVIAR RESPOSTA DE SUCESSO
    res.status(200).json(serializeBigInt(updatedVenda));
  } catch (error) {
    // Tratamento para outros erros de banco de dados (ex: conexão, violação de constraint)
    console.error('Erro ao desbloquear venda:', error);
    res.status(500).json({
      message: 'Erro interno ao tentar desbloquear a venda.',
      error: (error as Error).message,
    });
    return;
  } finally {
    if (client) {
      client.release();
    }
  }
}
