import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import { getUserOrDefault } from '@/lib/authHelper';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

interface AlterarPrevisaoRequest {
  ordemId: number;
  novaPrevisao: string;
  motivo?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { ordemId, novaPrevisao, motivo } = req.body as AlterarPrevisaoRequest;

  if (!ordemId || !novaPrevisao) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem e nova previsão são obrigatórios'
    });
  }

  // Obter filial do cookie
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  // Obter dados do usuário autenticado
  const currentUser = getUserOrDefault(req);

  const pool = getPgPool(filial);
  let client;
  try {
    client = await pool.connect();
    
    // Verificar se a ordem existe
    const checkResult = await client.query(
      'SELECT orc_id, orc_previsao_chegada, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
      [ordemId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ordem de compra não encontrada' 
      });
    }

    const previsaoAnterior = checkResult.rows[0].orc_previsao_chegada;
    const statusAtual = checkResult.rows[0].orc_status;
    
    // Iniciar transação
    await client.query('BEGIN');

    // Atualizar previsão de chegada
    const updateResult = await client.query(
      `UPDATE db_manaus.cmp_ordem_compra 
       SET 
         orc_previsao_chegada = $1,
         orc_usuario_responsavel = $2
       WHERE orc_id = $3
       RETURNING orc_id, orc_previsao_chegada`,
      [novaPrevisao, currentUser.login_user_name, ordemId]
    );

    // Registrar histórico da alteração
    await registrarHistoricoOrdem(client, {
      orcId: ordemId,
      previousStatus: statusAtual,
      newStatus: statusAtual,
      userId: currentUser.login_user_login || 'SISTEMA',
      userName: currentUser.login_user_name || 'Sistema',
      reason: `Previsão de chegada alterada${motivo ? `: ${motivo}` : ''}`,
      comments: {
        tipo: 'ALTERACAO_PREVISAO',
        data_anterior: previsaoAnterior,
        data_nova: novaPrevisao,
        motivo: motivo || null
      }
    });
    
    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({ 
      success: true,
      message: 'Previsão de chegada alterada com sucesso',
      data: updateResult.rows[0]
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao alterar previsão de chegada:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}