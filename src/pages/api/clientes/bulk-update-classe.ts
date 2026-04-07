import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface BulkUpdateClasseRequest {
  clienteCodes: string[];
  codcc: string;
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

  const { clienteCodes, codcc }: BulkUpdateClasseRequest = req.body;

  if (
    !clienteCodes ||
    !Array.isArray(clienteCodes) ||
    clienteCodes.length === 0
  ) {
    return res.status(400).json({ error: 'Lista de clientes inválida' });
  }

  if (!codcc) {
    return res.status(400).json({ error: 'Classe de pagamento não informada' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    // Verificar se a classe de pagamento existe
    const classeExistsResult = await client.query(
      'SELECT codcc FROM dbcclien WHERE codcc = $1',
      [codcc],
    );

    if (classeExistsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: 'Classe de pagamento não encontrada' });
    }

    // Atualizar os clientes em lote
    const updateResult = await client.query(
      `UPDATE dbclien 
       SET codcc = $1
       WHERE codcli = ANY($2::text[])`,
      [codcc, clienteCodes],
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
    console.error('Erro ao atualizar classe de pagamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar classe de pagamento' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
