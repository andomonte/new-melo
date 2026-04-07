import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para excluir produto (SOFT DELETE)
 *
 * Regra do Delphi (spDel_Prod):
 * - Verifica se produto tem vendas/compras vinculadas
 * - Faz soft delete (excluido = 1) em vez de DELETE físico
 * - Registra data e usuário da exclusão
 *
 * POST /api/produtos/delete
 * Body: { codprod: string, userId?: string }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod, userId } = req.body;

  if (!codprod) {
    return res.status(400).json({ error: 'Código do produto é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se produto existe
    const produtoResult = await client.query(
      `SELECT codprod, descr, excluido FROM db_manaus.dbprod WHERE codprod = $1`,
      [codprod],
    );

    if (produtoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const produto = produtoResult.rows[0];

    // Verificar se já está excluído
    if (produto.excluido === 1 || produto.excluido === '1') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Produto já está excluído',
        message: `O produto ${codprod} já foi excluído anteriormente.`,
      });
    }

    // 2. Verificar se produto tem vendas vinculadas
    // Nota: Adaptar nome da tabela conforme seu schema
    const vendasResult = await client.query(
      `
      SELECT COUNT(*) as count
      FROM db_manaus.dbvendaitens
      WHERE codprod = $1
    `,
      [codprod],
    );

    const temVendas = parseInt(vendasResult.rows[0]?.count || '0') > 0;

    if (temVendas) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Produto possui vendas vinculadas',
        message: `O produto ${codprod} - ${produto.descr} possui vendas registradas e não pode ser excluído.`,
        allowForceDelete: false, // Não permitir exclusão forçada
      });
    }

    // 3. Verificar se produto tem compras vinculadas (opcional)
    // Descomentar se tiver tabela de compras
    /*
    const comprasResult = await client.query(`
      SELECT COUNT(*) as count
      FROM db_manaus.dbcompraitens
      WHERE codprod = $1
    `, [codprod]);

    const temCompras = parseInt(comprasResult.rows[0]?.count || '0') > 0;

    if (temCompras) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Produto possui compras vinculadas',
        message: `O produto ${codprod} - ${produto.descr} possui compras registradas e não pode ser excluído.`,
        allowForceDelete: false
      });
    }
    */

    // 4. Fazer SOFT DELETE
    await client.query(
      `
      UPDATE db_manaus.dbprod
      SET
        excluido = 1,
        data_exclusao = NOW()
      WHERE codprod = $1
    `,
      [codprod],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Produto excluído com sucesso',
      codprod,
      descr: produto.descr,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao excluir produto:', error);
    return res.status(500).json({
      error: 'Erro ao excluir produto',
      message: error.message,
    });
  } finally {
    client.release();
  }
}
