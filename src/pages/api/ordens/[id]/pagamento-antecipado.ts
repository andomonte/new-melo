import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

interface MarcarPagamentoAntecipadoRequest {
  pagamento_antecipado: boolean;
  status?: string;
  observacao?: string;
  userId?: string;
  userName?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { pagamento_antecipado, status, observacao, userId, userName } = req.body as MarcarPagamentoAntecipadoRequest;

  console.log('DEBUG - Dados recebidos:', { pagamento_antecipado, status, observacao });

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem é obrigatório e deve ser um número'
    });
  }

  const ordemId = Number(id);

  try {
    const client = await pool.connect();

    // Verificar se a ordem existe
    const checkResult = await client.query(
      'SELECT orc_id, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
      [ordemId]
    );

    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const ordem = checkResult.rows[0];

    // Verificar se a ordem pode ser marcada como pagamento antecipado
    if (ordem.orc_status === 'C' || ordem.orc_status === 'F') {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Não é possível marcar como pagamento antecipado uma ordem cancelada ou finalizada'
      });
    }

    // Preparar dados para atualização (status tem limite de 1 caractere)
    const statusFinal = status || (pagamento_antecipado ? 'A' : 'P'); // A = Aguardando, P = Pendente
    const observacaoFinal = observacao || (pagamento_antecipado ?
      `Marcado como pagamento antecipado em ${new Date().toLocaleString('pt-BR')}` :
      null);

    // Atualizar apenas o status (campo que sabemos que existe)
    const updateResult = await client.query(
      `UPDATE db_manaus.cmp_ordem_compra
       SET orc_status = $1
       WHERE orc_id = $2
       RETURNING orc_id, orc_status`,
      [statusFinal, ordemId]
    );

    const updatedOrder = updateResult.rows[0];

    // Registrar histórico
    const userIdFinal = userId || 'SISTEMA';
    const userNameFinal = userName || 'Sistema';

    await registrarHistoricoOrdem(client, {
      orcId: ordemId,
      previousStatus: ordem.orc_status,
      newStatus: statusFinal,
      userId: userIdFinal,
      userName: userNameFinal,
      reason: pagamento_antecipado ? 'Pagamento antecipado marcado' : 'Pagamento antecipado desmarcado',
      comments: {
        tipo: 'PAGAMENTO_ANTECIPADO',
        pagamento_antecipado,
        observacao: observacaoFinal
      }
    });

    client.release();

    console.log('DEBUG - Ordem marcada como pagamento antecipado:', {
      ordemId: updatedOrder.orc_id,
      novoStatus: updatedOrder.orc_status,
      pagamentoAntecipado: pagamento_antecipado
    });

    res.status(200).json({
      success: true,
      message: pagamento_antecipado ?
        'Ordem marcada como pagamento antecipado com sucesso' :
        'Status de pagamento antecipado removido com sucesso',
      data: {
        ordemId: updatedOrder.orc_id,
        status: updatedOrder.orc_status,
        pagamentoAntecipado: pagamento_antecipado
      }
    });
  } catch (err) {
    console.error('Erro ao marcar pagamento antecipado:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao marcar pagamento antecipado',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}