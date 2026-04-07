import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarCancelamentoOrdem } from '@/lib/compras/ordemHistoricoHelper';

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
    
    // Verificar se a ordem existe e pode ser cancelada
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
    
    const status = checkResult.rows[0].orc_status;
    // Status válidos conforme legado Oracle: A=Aberta, B=Bloqueada, C=Cancelada, F=Fechada
    if (status !== 'A') {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Apenas ordens abertas podem ser canceladas'
      });
    }

    // Verificar se há financeiro pago antes de cancelar
    const pagamentoResult = await client.query(
      `SELECT cod_pgto, valor_pago
       FROM db_manaus.dbpgto
       WHERE ordem_compra = $1
         AND paga = 'S'
         AND (cancel IS NULL OR cancel != 'S')
       LIMIT 1`,
      [id.toString()]
    );

    if (pagamentoResult.rows.length > 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Não é possível cancelar esta ordem pois existe financeiro pago vinculado a ela'
      });
    }

    // Obter dados do usuário do body ou usar padrão
    const { userId, userName, motivo } = req.body || {};
    const userIdFinal = userId || 'SISTEMA';
    const userNameFinal = userName || 'Sistema';

    // Cancelar a ordem
    await client.query(
      'UPDATE cmp_ordem_compra SET orc_status = $1 WHERE orc_id = $2',
      ['C', id]
    );

    // Registrar histórico
    await registrarCancelamentoOrdem(
      client,
      Number(id),
      status, // status anterior
      userIdFinal,
      userNameFinal,
      motivo || 'Ordem cancelada pelo usuário'
    );

    client.release();

    res.status(200).json({
      success: true,
      message: 'Ordem cancelada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao cancelar ordem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}