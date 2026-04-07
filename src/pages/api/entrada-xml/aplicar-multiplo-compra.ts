import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface AplicarMultiploRequest {
  pedidoId: string;
  produtoId: string;
  quantidadeAtual: number;
  novaQuantidade: number;
  senha: string;
  usuarioId: string;
  motivo: string;
}

interface AplicarMultiploResponse {
  success: boolean;
  message: string;
  quantidadeAnterior?: number;
  quantidadeNova?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AplicarMultiploResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { 
    pedidoId, 
    produtoId, 
    quantidadeAtual, 
    novaQuantidade, 
    senha, 
    usuarioId, 
    motivo 
  }: AplicarMultiploRequest = req.body;

  if (!pedidoId || !produtoId || !novaQuantidade || !senha || !usuarioId) {
    return res.status(400).json({ 
      error: 'Todos os campos obrigatórios devem ser preenchidos' 
    });
  }

  if (novaQuantidade <= quantidadeAtual) {
    return res.status(400).json({ 
      error: 'Nova quantidade deve ser maior que a quantidade atual' 
    });
  }

  let client;
  
  try {
    client = await pool.connect();
    
    // Iniciar transação
    await client.query('BEGIN');
    
    // Validar senha do gerente (implementar validação real aqui)
    const senhaValidaResult = await client.query(`
      SELECT u.login_user_login, u.login_user_name, u.login_perfil_name
      FROM db_manaus.tb_login_user u
      WHERE u.login_user_login = $1 
        AND u.login_user_password = $2 
        AND u.login_perfil_name IN ('GERENTE', 'DIRETOR', 'ADMIN')
    `, [usuarioId, senha]); // Em produção, hash a senha

    if (senhaValidaResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Senha incorreta ou usuário sem permissão para múltiplo de compra' 
      });
    }

    const gerente = senhaValidaResult.rows[0];

    // Verificar se o pedido existe e buscar dados atuais
    const pedidoResult = await client.query(`
      SELECT r.*, ri.itr_quantidade as quantidade_atual
      FROM db_manaus.cmp_requisicao r
      JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      WHERE r.req_id = $1 AND ri.itr_codprod = $2
    `, [pedidoId, produtoId]);

    if (pedidoResult.rows.length === 0) {
      throw new Error('Pedido ou produto não encontrado');
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.quantidade_atual !== quantidadeAtual) {
      throw new Error('Quantidade atual não confere com o banco de dados');
    }

    // Atualizar quantidade do item no pedido
    const updateResult = await client.query(`
      UPDATE db_manaus.cmp_it_requisicao
      SET
        itr_quantidade = $1,
        itr_quantidade_atendida = CASE
          WHEN itr_quantidade_atendida > $1 THEN $1  -- Se já atendida for maior, ajustar
          ELSE itr_quantidade_atendida
        END
      WHERE itr_req_id = $2 AND itr_codprod = $3
      RETURNING itr_quantidade as quantidade
    `, [novaQuantidade, pedidoId, produtoId]);

    if (updateResult.rowCount === 0) {
      throw new Error('Falha ao atualizar quantidade do pedido');
    }

    // Registrar log da operação de múltiplo de compra
    await client.query(`
      INSERT INTO db_manaus.log_multiplo_compra (
        req_id,
        codprod,
        quantidade_anterior,
        quantidade_nova,
        motivo,
        usuario_autorizador,
        gerente_autorizador,
        data_operacao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      pedidoId,
      produtoId,
      quantidadeAtual,
      novaQuantidade,
      motivo || 'Ajuste por múltiplo de compra',
      usuarioId,
      gerente.login_user_login
    ]);

    // Log geral da requisição
    await client.query(`
      INSERT INTO db_manaus.dbrequisicao_log (
        req_id,
        req_versao,
        acao,
        descricao,
        usuario,
        data_log
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      pedidoId,
      pedido.req_versao,
      'MULTIPLO_COMPRA_APLICADO',
      `Quantidade alterada de ${quantidadeAtual} para ${novaQuantidade} por múltiplo de compra. Autorizado por: ${gerente.login_user_name}`,
      usuarioId
    ]);
    
    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Múltiplo de compra aplicado com sucesso. Quantidade alterada de ${quantidadeAtual} para ${novaQuantidade}.`,
      quantidadeAnterior: quantidadeAtual,
      quantidadeNova: novaQuantidade
    });
  } catch (err) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }
    
    console.error('Erro ao aplicar múltiplo de compra:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Falha ao aplicar múltiplo de compra.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}