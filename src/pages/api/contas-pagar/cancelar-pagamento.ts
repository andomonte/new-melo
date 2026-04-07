import { getPgPool } from '@/lib/pg';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { cod_pgto, fpg_cof_id } = req.body;

  if (!cod_pgto || !fpg_cof_id) {
    return res.status(400).json({ erro: 'Código do título e identificador do pagamento são obrigatórios' });
  }

  const pool = getPgPool();

  try {
    console.log(`🔍 [API Cancelar Pagamento] cod_pgto: ${cod_pgto}, fpg_cof_id: ${fpg_cof_id}`);

    // 1. Verificar se o pagamento existe e não está cancelado
    const checkPagamento = await pool.query(`
      SELECT 
        cod_pgto,
        fpg_cof_id,
        valor_pgto,
        cancel,
        dt_pgto
      FROM db_manaus.dbfpgto
      WHERE cod_pgto = $1 AND fpg_cof_id = $2
    `, [cod_pgto, fpg_cof_id]);

    if (checkPagamento.rows.length === 0) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' });
    }

    const pagamento = checkPagamento.rows[0];

    if (pagamento.cancel === 'S') {
      return res.status(400).json({ erro: 'Este pagamento já está cancelado' });
    }

    // 2. Cancelar o pagamento (marcar cancel = 'S')
    await pool.query(`
      UPDATE db_manaus.dbfpgto
      SET cancel = 'S'
      WHERE cod_pgto = $1 AND fpg_cof_id = $2
    `, [cod_pgto, fpg_cof_id]);

    console.log(`✅ [API] Pagamento ${fpg_cof_id} do título ${cod_pgto} cancelado com sucesso`);

    // 3. Recalcular o total pago do título (soma apenas pagamentos não cancelados)
    const totalPagoResult = await pool.query(`
      SELECT COALESCE(SUM(valor_pgto), 0) as total_pago
      FROM db_manaus.dbfpgto
      WHERE cod_pgto = $1 
        AND (cancel IS NULL OR cancel != 'S')
    `, [cod_pgto]);

    const totalPago = parseFloat(totalPagoResult.rows[0].total_pago || 0);

    // 4. Buscar valor original do título
    const tituloResult = await pool.query(`
      SELECT valor_pgto
      FROM db_manaus.dbpgto
      WHERE cod_pgto = $1
    `, [cod_pgto]);

    if (tituloResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Título não encontrado' });
    }

    const valorOriginal = parseFloat(tituloResult.rows[0].valor_pgto);

    // 5. Atualizar o status do título baseado no novo total pago
    let novoPaga = 'N';
    if (totalPago >= valorOriginal) {
      novoPaga = 'S'; // Pago completamente
    } else if (totalPago > 0) {
      novoPaga = 'P'; // Pago parcialmente
    }

    await pool.query(`
      UPDATE db_manaus.dbpgto
      SET paga = $1
      WHERE cod_pgto = $2
    `, [novoPaga, cod_pgto]);

    console.log(`✅ [API] Status do título atualizado: paga=${novoPaga}, total_pago=${totalPago}`);

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Pagamento cancelado com sucesso',
      dados: {
        cod_pgto,
        fpg_cof_id,
        valor_cancelado: parseFloat(pagamento.valor_pgto),
        total_pago_atual: totalPago,
        saldo_restante: valorOriginal - totalPago,
        novo_status: novoPaga === 'S' ? 'pago' : novoPaga === 'P' ? 'pago_parcial' : 'pendente'
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Erro ao cancelar pagamento:', error);
    return res.status(500).json({
      erro: 'Erro ao cancelar pagamento',
      detalhes: error.message
    });
  }
}
