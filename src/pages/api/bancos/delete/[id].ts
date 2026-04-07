import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID do banco é obrigatório e deve ser uma string' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia a transação
    await client.query('BEGIN');

    // Verifica se o banco existe
    const bancoExistsResult = await client.query(
      'SELECT banco FROM dbbanco_cobranca WHERE banco = $1',
      [id],
    );

    if (bancoExistsResult.rowCount === 0) {
      throw new Error(`Banco com ID ${id} não encontrado.`);
    }

    // Verifica se há contas vinculadas (dbdados_banco)
    const contasVinculadas = await client.query(
      'SELECT COUNT(*) as total FROM dbdados_banco WHERE banco = $1',
      [id],
    );

    if (parseInt(contasVinculadas.rows[0].total) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Não é possível excluir este banco. Existem ${contasVinculadas.rows[0].total} conta(s) bancária(s) vinculada(s). Exclua as contas primeiro.`,
      });
    }

    // Verifica se há contas de depósito vinculadas (fin_conta_deposito)
    const depositosVinculados = await client.query(
      'SELECT COUNT(*) as total FROM fin_conta_deposito WHERE banco = $1',
      [id],
    );

    if (parseInt(depositosVinculados.rows[0].total) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Não é possível excluir este banco. Existem ${depositosVinculados.rows[0].total} conta(s) de depósito vinculada(s). Desvincule-as primeiro.`,
      });
    }

    // Verifica se há clientes vinculados
    const clientesVinculados = await client.query(
      'SELECT COUNT(*) as total FROM dbclien WHERE banco = $1',
      [id],
    );

    if (parseInt(clientesVinculados.rows[0].total) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Não é possível excluir este banco. Existem ${clientesVinculados.rows[0].total} cliente(s) vinculado(s). Altere o banco dos clientes primeiro.`,
      });
    }

    // Deleta o banco (só chega aqui se não houver dependências)
    await client.query('DELETE FROM dbbanco_cobranca WHERE banco = $1', [id]);

    // Confirma a transação
    await client.query('COMMIT');

    res
      .status(200)
      .json({ message: `Banco com ID ${id} foi excluído com sucesso.` });
  } catch (error: any) {
    // Rollback em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao excluir banco de cobrança:', error);

    // Retorna mensagem amigável
    const errorMessage = error.message || 'Erro ao excluir banco de cobrança';
    res.status(500).json({ error: errorMessage });
  } finally {
    if (client) {
      client.release();
    }
  }
}
