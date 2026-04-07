import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ erro: 'Método não permitido. Use DELETE.' });
  }

  try {
    const { id } = req.query;
    const { motivo_cancelamento } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID da conta a pagar é obrigatório.' });
    }

    // Verificar se a conta existe e pode ser cancelada
    const checkQuery = `
      SELECT 
        p.paga, 
        p.cancel,
        p.nro_dup,
        COALESCE(
          (SELECT SUM(f.valor_pgto) 
           FROM db_manaus.dbfpgto f 
           WHERE f.cod_pgto = p.cod_pgto 
             AND (f.cancel IS NULL OR f.cancel != 'S')
          ), 0
        ) as total_pago
      FROM dbpgto p
      WHERE p.cod_pgto = $1
    `;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta a pagar não encontrada.' });
    }

    const conta = checkResult.rows[0];

    if (conta.cancel === 'S') {
      return res.status(400).json({ erro: 'Conta já está cancelada.' });
    }

    // ✅ REGRA CORRETA: Não permite cancelar se JÁ TEM PAGAMENTOS registrados no histórico
    if (parseFloat(conta.total_pago) > 0) {
      return res.status(400).json({ 
        erro: 'Não é possível cancelar uma conta que já possui pagamentos registrados.',
        detalhes: `Total pago: R$ ${parseFloat(conta.total_pago).toFixed(2)}. É necessário estornar os pagamentos primeiro.`
      });
    }

    // Cancelar a conta (marcar como cancelada)
    const updateQuery = `
      UPDATE dbpgto
      SET cancel = 'S',
          obs = COALESCE(obs || ' | CANCELADO: ' || $2, 'CANCELADO: ' || $2)
      WHERE cod_pgto = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      id,
      motivo_cancelamento || 'Cancelamento solicitado pelo usuário'
    ]);

    res.status(200).json({
      sucesso: true,
      mensagem: 'Conta a pagar cancelada com sucesso.',
      conta: updateResult.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Erro ao cancelar conta a pagar:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}