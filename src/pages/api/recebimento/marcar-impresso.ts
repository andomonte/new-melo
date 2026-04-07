import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';
import { executeQuery } from '@/lib/databaseHelpers';

interface MarcarImpressoRequest {
  CODIGO: string;
  NRODOC: string;
  NROIMP: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Validar autenticação
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const { CODIGO, NRODOC, NROIMP }: MarcarImpressoRequest = req.body;

    // Validar campos obrigatórios
    if (!CODIGO || !NRODOC || !NROIMP) {
      return res.status(400).json({
        error: 'Campos obrigatórios: CODIGO, NRODOC, NROIMP',
      });
    }

    // Primeiro, verificar se o registro existe e não está já marcado como impresso
    const checkQuery = `
      SELECT "CODIGO", "NRODOC", "NROIMP", "IMPRESSO", "NOMEUSR", "DATA", "HORA", "VALOR"
      FROM dbservimp 
      WHERE "CODIGO" = $1 AND "NRODOC" = $2 AND "NROIMP" = $3
    `;

    const checkResult = await executeQuery(
      client,
      checkQuery,
      [CODIGO, NRODOC, NROIMP],
      'verificar venda para impressão',
    );

    if (!checkResult.success) {
      return res.status(500).json({
        error: 'Erro ao verificar venda',
        details: checkResult.error,
      });
    }

    if (!checkResult.data || checkResult.data.length === 0) {
      return res.status(404).json({
        error: 'Venda não encontrada',
        details: `Não foi encontrada venda com CODIGO: ${CODIGO}, NRODOC: ${NRODOC}, NROIMP: ${NROIMP}`,
      });
    }

    const venda = checkResult.data[0];

    if (venda.impresso === 'S') {
      return res.status(400).json({
        error: 'Venda já foi marcada como impressa',
        data: venda,
      });
    }

    // Atualizar o status para impresso
    const updateQuery = `
      UPDATE dbservimp 
      SET "IMPRESSO" = 'S'
      WHERE "CODIGO" = $1 AND "NRODOC" = $2 AND "NROIMP" = $3
      RETURNING *
    `;

    const updateResult = await executeQuery(
      client,
      updateQuery,
      [CODIGO, NRODOC, NROIMP],
      'marcar venda como impressa',
    );

    if (!updateResult.success) {
      return res.status(500).json({
        error: 'Erro ao marcar venda como impressa',
        details: updateResult.error,
      });
    }

    const vendaAtualizada = updateResult.data?.[0];

    return res.status(200).json({
      message: 'Venda marcada como impressa com sucesso',
      data: vendaAtualizada,
      info: {
        usuario_que_marcou: user.login_user_name || user.login_user_login,
        horario_marcacao: new Date().toISOString(),
        codigo: CODIGO,
        nrodoc: NRODOC,
        nroimp: NROIMP,
      },
    });
  } catch (error) {
    console.error('Erro ao marcar venda como impressa:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  } finally {
    client.release();
  }
}
