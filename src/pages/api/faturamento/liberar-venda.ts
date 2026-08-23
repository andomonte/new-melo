import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// Libera a reserva de vendas (release). Só remove reservas do PRÓPRIO usuário — assim
// um usuário não derruba a reserva de outro. Chamado ao desmarcar a venda, fechar o
// modal/aba (navigator.sendBeacon) ou após emitir com sucesso.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codvendas, usuario } = req.body || {};
  const lista: string[] = Array.isArray(codvendas)
    ? codvendas.filter(Boolean).map(String)
    : [];

  if (!usuario || lista.length === 0) {
    // Nada a liberar — resposta ok para não quebrar sendBeacon/cleanup.
    return res.status(200).json({ liberadas: 0 });
  }

  const client = await getPgPool().connect();
  try {
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);
    const r = await client.query(
      `DELETE FROM fat_reserva_venda
        WHERE codvenda = ANY($1) AND usuario = $2`,
      [lista, usuario],
    );
    return res.status(200).json({ liberadas: r.rowCount ?? 0 });
  } catch (error) {
    console.error('Erro ao liberar venda:', error);
    return res.status(500).json({
      error: `Erro ao liberar venda: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    client.release();
  }
}
