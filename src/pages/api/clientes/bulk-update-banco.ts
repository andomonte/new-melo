import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface BulkUpdateBancoRequest {
  clienteCodes: string[];
  banco: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { clienteCodes, banco }: BulkUpdateBancoRequest = req.body;

  if (
    !clienteCodes ||
    !Array.isArray(clienteCodes) ||
    clienteCodes.length === 0
  ) {
    return res.status(400).json({ error: 'Lista de clientes inválida' });
  }

  if (!banco) {
    return res.status(400).json({ error: 'Banco não informado' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    // Verificar se o banco existe
    const bancoExistsResult = await client.query(
      'SELECT banco FROM dbbanco_cobranca WHERE banco = $1',
      [banco],
    );

    if (bancoExistsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Banco não encontrado' });
    }

    // Atualizar os clientes em lote
    const updateResult = await client.query(
      `UPDATE dbclien 
       SET banco = $1
       WHERE codcli = ANY($2::text[])`,
      [banco, clienteCodes],
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      updated: updateResult.rowCount || 0,
      message: `${
        updateResult.rowCount || 0
      } cliente(s) atualizado(s) com sucesso`,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao atualizar banco:', error);
    res.status(500).json({ error: 'Erro ao atualizar banco' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
