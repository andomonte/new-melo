import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface AlterarCodigoRequest {
  matricula: string;
  codigoAtual: string;
  novoCodigo: string;
}

/**
 * API para alterar código de acesso de um funcionário
 *
 * Valida o código atual e altera para o novo código na tabela dbfunc_estoque
 *
 * @param req - Request com matrícula, código atual e novo código
 * @param res - Response com confirmação ou erro
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { matricula, codigoAtual, novoCodigo }: AlterarCodigoRequest = req.body;

  // Validação de entrada
  if (!matricula || !codigoAtual || !novoCodigo) {
    return res.status(400).json({
      error: 'Matrícula, código atual e novo código são obrigatórios',
    });
  }

  if (
    typeof matricula !== 'string' ||
    typeof codigoAtual !== 'string' ||
    typeof novoCodigo !== 'string'
  ) {
    return res.status(400).json({
      error: 'Todos os campos devem ser strings válidas',
    });
  }

  if (novoCodigo.length < 4) {
    return res.status(400).json({
      error: 'Novo código deve ter pelo menos 4 caracteres',
    });
  }

  if (novoCodigo.length > 20) {
    return res.status(400).json({
      error: 'Novo código deve ter no máximo 20 caracteres',
    });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    console.log(`Alterando código de acesso para matrícula: ${matricula}`);

    // Verificar se o funcionário existe e se o código atual está correto
    const verificarQuery = `
      SELECT matricula, nome, codigoacesso 
      FROM dbfunc_estoque 
      WHERE matricula = $1 AND codigoacesso = $2
    `;

    const verificarResult = await client.query(verificarQuery, [
      matricula,
      codigoAtual,
    ]);

    if (verificarResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Matrícula não encontrada ou código atual incorreto',
      });
    }

    // Atualizar o código de acesso
    const atualizarQuery = `
      UPDATE dbfunc_estoque 
      SET codigoacesso = $1
      WHERE matricula = $2
    `;

    const atualizarResult = await client.query(atualizarQuery, [
      novoCodigo,
      matricula,
    ]);

    if (atualizarResult.rowCount === 0) {
      return res.status(500).json({
        error: 'Erro ao atualizar código de acesso',
      });
    }

    console.log(
      `Código de acesso alterado com sucesso para matrícula: ${matricula}`,
    );

    return res.status(200).json({
      message: 'Código de acesso alterado com sucesso',
      data: {
        matricula,
        nome: verificarResult.rows[0].nome,
      },
    });
  } catch (error) {
    console.error('Erro ao alterar código de acesso:', {
      matricula,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: 'Erro interno do servidor ao alterar código de acesso',
    });
  } finally {
    client.release();
  }
}
