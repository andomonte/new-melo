import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarAprovacaoOrdem } from '@/lib/compras/ordemHistoricoHelper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem inválido'
    });
  }

  try {
    const client = await pool.connect();
    
    // Verificar se a ordem existe e está pendente
    const checkResult = await client.query(
      'SELECT orc_status FROM cmp_ordem_compra WHERE orc_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }
    
    if (checkResult.rows[0].orc_status !== 'P') {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Apenas ordens pendentes podem ser aprovadas'
      });
    }
    
    // Obter dados do usuário do body ou usar padrão
    const { userId, userName, motivo } = req.body || {};
    const userIdFinal = userId || 'SISTEMA';
    const userNameFinal = userName || 'Sistema';

    // Aprovar a ordem
    await client.query(
      'UPDATE cmp_ordem_compra SET orc_status = $1 WHERE orc_id = $2',
      ['A', id]
    );

    // Registrar histórico
    await registrarAprovacaoOrdem(
      client,
      Number(id),
      userIdFinal,
      userNameFinal,
      motivo
    );

    client.release();

    res.status(200).json({
      success: true,
      message: 'Ordem aprovada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao aprovar ordem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}